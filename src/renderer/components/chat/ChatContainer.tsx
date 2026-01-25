import React, { useRef, useEffect, useState, useCallback } from 'react';
import { MessageList } from './MessageList';
import { StreamingMessage } from './StreamingMessage';
import { InputArea } from './InputArea';
import { AskUserPrompt } from './AskUserPrompt';
// TodoList moved to StatusBar
import { useStore, useChat, useSession, useUI, useChatActions, useUIActions, useSessionActions } from '../../store';
import { SlashCommand, parseCliSlashCommands } from '../../../shared/slash-commands';
import { TodoItem, AskUserOption } from '../../store/slices/chat.slice';
import styles from './ChatContainer.module.css';

export const ChatContainer: React.FC = () => {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const wasInterruptedRef = useRef(false);  // Track intentional interrupts
  const [error, setError] = useState<string | null>(null);
  const { messages, isStreaming, streamingContent, streamingThinking, toolsInProgress, streamingBlocks, pendingUserQuestion } = useChat();
  const { activeSessionId, currentCwd, cliSessionId } = useSession();
  const { isPlanMode } = useUI();
  const { setShowSettings, openClaudePtySession } = useUIActions();
  const { addMessage, setIsStreaming, appendStreamingContent, appendStreamingThinking, finalizeStreamingMessage, clearStreaming, setLastUserMessage, addToolInProgress, updateToolStatus, setTodos, setPendingUserQuestion } = useChatActions();
  const { setActiveSessionId, setCliSessionId, setCurrentCwd, clearSession } = useSessionActions();
  const { setConnectionStatus, setModelInfo, updateUsage, setIsPlanMode, setAvailableSkills, clearAvailableSkills } = useUIActions();

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streamingContent]);

  // Set up CLI event listeners
  useEffect(() => {
    const cleanups: (() => void)[] = [];

    cleanups.push(
      window.claudeUI.cli.onSystem((data) => {
        console.log('System event:', data);
        setConnectionStatus('connected');
        setIsStreaming(true);

        // Cast to any to access properties that may exist on system events
        const evt = data.event as unknown as Record<string, unknown>;

        // Store CLI's session ID separately for sidebar highlighting
        // (Don't change activeSessionId as it's used for main process communication)
        if (evt && evt.session_id) {
          setCliSessionId(evt.session_id as string);
        }
        // Also sync the cwd if available
        if (evt && evt.cwd) {
          setCurrentCwd(evt.cwd as string);
        }
        // Capture model info and version
        if (evt && evt.model) {
          // Default context window values, will be updated from result event
          setModelInfo(evt.model as string, 200000, 64000, (evt.claude_code_version as string) || '');
        }
        // Capture available skills from CLI
        if (evt && evt.slash_commands && Array.isArray(evt.slash_commands)) {
          const skills = parseCliSlashCommands(evt.slash_commands as string[]);
          setAvailableSkills(skills);
        }
      })
    );

    cleanups.push(
      window.claudeUI.cli.onStream((data) => {
        const event = data.event;
        if (event.type === 'stream_event') {
          const streamData = event.event;

          if (streamData.type === 'message_start') {
            setIsStreaming(true);
            clearStreaming();
          }

          if (streamData.type === 'content_block_delta') {
            const delta = streamData.delta;
            if (delta.type === 'text_delta') {
              appendStreamingContent(delta.text);
            } else if (delta.type === 'thinking_delta') {
              appendStreamingThinking(delta.thinking);
            }
          }

          if (streamData.type === 'message_stop') {
            // Don't finalize here, wait for result event
          }
        }
      })
    );

    cleanups.push(
      window.claudeUI.cli.onAssistant((data) => {
        console.log('Assistant event:', data);

        // Extract content from the assistant message
        const event = data.event as { message?: { content?: Array<{ type: string; text?: string; id?: string; name?: string; input?: Record<string, unknown> }> } };
        if (event && event.message && event.message.content) {
          for (const block of event.message.content) {
            if (block.type === 'text' && block.text) {
              appendStreamingContent(block.text);
            } else if (block.type === 'tool_use' && block.id && block.name) {
              // Handle TodoWrite tool specially - update the todo list
              if (block.name === 'TodoWrite' && block.input && Array.isArray(block.input.todos)) {
                const todos = block.input.todos as TodoItem[];
                setTodos(todos);
              }

              // Handle AskUserQuestion tool - show prompt to user
              if (block.name === 'AskUserQuestion' && block.input) {
                const input = block.input as {
                  questions?: Array<{
                    question: string;
                    header?: string;
                    options?: Array<{ label: string; description?: string }>;
                    multiSelect?: boolean;
                  }>;
                };

                if (input.questions && input.questions.length > 0) {
                  const q = input.questions[0]; // Handle first question
                  setPendingUserQuestion({
                    toolUseId: block.id,
                    question: q.question,
                    header: q.header,
                    options: q.options as AskUserOption[] | undefined,
                    multiSelect: q.multiSelect
                  });
                }
              }

              // Add tool use to display
              addToolInProgress({
                id: block.id,
                name: block.name,
                input: block.input || {},
                status: 'running'
              });
            }
          }
        }
      })
    );

    // Handle user events (tool results)
    cleanups.push(
      window.claudeUI.cli.onUser((data) => {
        const event = data.event as { message?: { content?: Array<{ type: string; tool_use_id?: string; content?: unknown; is_error?: boolean }> } };
        if (event && event.message && event.message.content) {
          for (const block of event.message.content) {
            if (block.type === 'tool_result' && block.tool_use_id) {
              // Update tool status with result
              const resultContent = typeof block.content === 'string'
                ? block.content
                : JSON.stringify(block.content);
              const status = block.is_error ? 'error' : 'completed';
              updateToolStatus(block.tool_use_id, status, resultContent.slice(0, 500));
            }
          }
        }
      })
    );

    cleanups.push(
      window.claudeUI.cli.onResult((data) => {
        console.log('Result event:', data);
        finalizeStreamingMessage();
        setConnectionStatus('connected');

        // Extract usage info from result event
        const evt = data.event as {
          total_cost_usd?: number;
          usage?: {
            input_tokens?: number;
            output_tokens?: number;
            cache_read_input_tokens?: number;
            cache_creation_input_tokens?: number;
          };
          modelUsage?: Record<string, {
            contextWindow?: number;
            maxOutputTokens?: number;
          }>;
        };

        if (evt.usage) {
          const input = evt.usage.input_tokens || 0;
          const output = evt.usage.output_tokens || 0;
          const cacheRead = evt.usage.cache_read_input_tokens || 0;
          const cacheCreation = evt.usage.cache_creation_input_tokens || 0;
          const cost = evt.total_cost_usd || 0;
          updateUsage(input, output, cacheRead, cacheCreation, cost);
        }

        // Update context window from modelUsage if available
        if (evt.modelUsage) {
          const models = Object.entries(evt.modelUsage);
          if (models.length > 0) {
            const [modelName, info] = models[0];
            if (info.contextWindow) {
              setModelInfo(
                modelName,
                info.contextWindow,
                info.maxOutputTokens || 64000,
                ''
              );
            }
          }
        }
      })
    );

    cleanups.push(
      window.claudeUI.cli.onExit((data) => {
        console.log('CLI exited:', data);
        // Don't show error if it was an intentional interrupt
        if (wasInterruptedRef.current) {
          wasInterruptedRef.current = false;  // Reset for next time
          setIsStreaming(false);
          return;
        }
        // Only disconnect if there was an error (code !== 0 and not null from signal)
        if (data.code !== 0 && data.code !== null) {
          setConnectionStatus('error');
          setError(`Process exited with code ${data.code}`);
        }
        setIsStreaming(false);
      })
    );

    cleanups.push(
      window.claudeUI.cli.onError((data) => {
        console.error('CLI error:', data);
        setConnectionStatus('error');
        setError(data.error);
        setIsStreaming(false);
      })
    );

    // Handle plan mode exit (when Claude uses ExitPlanMode tool)
    cleanups.push(
      window.claudeUI.cli.onPlanModeExit((data) => {
        console.log('Plan mode exit requested:', data);
        // Update UI state to reflect plan mode has ended
        setIsPlanMode(false);
      })
    );

    // Handle interrupted event (user pressed Stop)
    cleanups.push(
      window.claudeUI.cli.onInterrupted((data) => {
        console.log('CLI interrupted:', data);
        wasInterruptedRef.current = true;  // Mark as intentional so onExit doesn't show error

        // Finalize the streaming message to preserve what Claude was doing
        // This keeps the text/tools visible instead of losing them
        finalizeStreamingMessage();
        setIsStreaming(false);

        // Add a small system note about the interruption
        addMessage({
          id: crypto.randomUUID(),
          type: 'system',
          content: '*Interrupted — conversation context is preserved. Send a message to continue.*',
          timestamp: new Date().toISOString()
        });
      })
    );

    return () => {
      cleanups.forEach(cleanup => cleanup());
    };
  }, [setConnectionStatus, setIsStreaming, appendStreamingContent, appendStreamingThinking, finalizeStreamingMessage, clearStreaming, addToolInProgress, updateToolStatus, setCliSessionId, setCurrentCwd, setTodos, setModelInfo, updateUsage, setIsPlanMode, addMessage, setAvailableSkills, setPendingUserQuestion]);

  const handleSendMessage = useCallback(async (content: string) => {
    if (!content.trim()) return;

    setError(null);

    // Store the message for potential retry after permission grant
    setLastUserMessage(content.trim());

    // Add user message to chat
    addMessage({
      id: crypto.randomUUID(),
      type: 'user',
      content: content.trim(),
      timestamp: new Date().toISOString()
    });

    // Start or get session
    let sessionId = activeSessionId;

    if (!sessionId) {
      // Get a working directory
      let workingDir: string;
      if (currentCwd) {
        workingDir = currentCwd;
      } else {
        // Ask user to select a directory
        const selectedDir = await window.claudeUI.fs.selectDirectory();
        if (!selectedDir) {
          setError('Please select a working directory to start a chat.');
          return;
        }
        workingDir = selectedDir;
        setCurrentCwd(workingDir);
      }

      setConnectionStatus('connecting');

      try {
        sessionId = await window.claudeUI.cli.startSession({
          cwd: workingDir,
          permissionMode: isPlanMode ? 'plan' : 'default',
          resumeSessionId: cliSessionId || undefined  // Resume loaded session if available
        });

        setActiveSessionId(sessionId);
      } catch (err) {
        console.error('Failed to start session:', err);
        setConnectionStatus('error');
        setError('Failed to start session. Make sure Claude CLI is installed.');
        return;
      }
    }

    // Show streaming indicator immediately
    setIsStreaming(true);
    clearStreaming();

    // Send message to CLI
    try {
      await window.claudeUI.cli.sendMessage(sessionId, content.trim());
    } catch (err) {
      console.error('Failed to send message:', err);
      setError('Failed to send message. Please try again.');
      setIsStreaming(false);
    }
  }, [activeSessionId, currentCwd, cliSessionId, isPlanMode, addMessage, setLastUserMessage, setCurrentCwd, setConnectionStatus, setActiveSessionId, setIsStreaming, clearStreaming]);

  // Handle interrupt (Stop button)
  const handleInterrupt = useCallback(async () => {
    if (!activeSessionId) {
      console.warn('No active session to interrupt');
      return;
    }

    console.log('Interrupting session:', activeSessionId);
    try {
      const success = await window.claudeUI.cli.interruptSession(activeSessionId);
      if (!success) {
        console.warn('Failed to interrupt session (may have already finished)');
        setIsStreaming(false);
      }
      // The onInterrupted event handler will update the UI
    } catch (err) {
      console.error('Failed to interrupt session:', err);
      setIsStreaming(false);
    }
  }, [activeSessionId, setIsStreaming]);

  // Handle AskUserQuestion answer
  const handleUserQuestionAnswer = useCallback((answer: string) => {
    // Clear the pending question
    setPendingUserQuestion(null);

    // Add the user's answer as a message (visible in chat)
    addMessage({
      id: crypto.randomUUID(),
      type: 'user',
      content: answer,
      timestamp: new Date().toISOString()
    });

    // Send the answer to CLI - it will resume the session
    if (activeSessionId) {
      setIsStreaming(true);
      clearStreaming();
      window.claudeUI.cli.sendMessage(activeSessionId, answer).catch((err) => {
        console.error('Failed to send answer:', err);
        setError('Failed to send answer. Please try again.');
        setIsStreaming(false);
      });
    }
  }, [activeSessionId, setPendingUserQuestion, addMessage, setIsStreaming, clearStreaming]);

  // Handle AskUserQuestion cancel
  const handleUserQuestionCancel = useCallback(() => {
    setPendingUserQuestion(null);
    handleInterrupt();
    addMessage({
      id: crypto.randomUUID(),
      type: 'system',
      content: '*Question skipped — you can continue the conversation.*',
      timestamp: new Date().toISOString()
    });
  }, [setPendingUserQuestion, handleInterrupt, addMessage]);

  // Handle UI-only commands (no CLI equivalent)
  const handleUiOnlyCommand = useCallback((command: SlashCommand, _args: string) => {
    switch (command.name) {
      case '/clear':
        useStore.getState().clearMessages();
        addMessage({
          id: crypto.randomUUID(),
          type: 'system',
          content: 'Conversation cleared.',
          timestamp: new Date().toISOString()
        });
        break;

      case '/settings':
        setShowSettings(true);
        break;

      case '/new':
        useStore.getState().clearMessages();
        clearSession();
        clearAvailableSkills();
        break;

      case '/status': {
        const { usage } = useStore.getState();
        const statusLines = [
          `**Session ID:** ${activeSessionId || 'None'}`,
          `**CLI Session:** ${cliSessionId || 'None'}`,
          `**Working Directory:** ${currentCwd || 'Not set'}`,
          `**Plan Mode:** ${isPlanMode ? 'Enabled' : 'Disabled'}`,
          `**Messages:** ${messages.length}`,
          `**Model:** ${usage?.modelName || 'Unknown'}`,
          `**CLI Version:** ${usage?.claudeCodeVersion || 'Unknown'}`
        ];
        addMessage({
          id: crypto.randomUUID(),
          type: 'system',
          content: `## Session Status\n\n${statusLines.join('\n')}`,
          timestamp: new Date().toISOString()
        });
        break;
      }

      case '/model': {
        const { usage } = useStore.getState();
        addMessage({
          id: crypto.randomUUID(),
          type: 'system',
          content: `## Current Model\n\n**Model:** ${usage?.modelName || 'Unknown'}\n**Context Window:** ${usage?.contextWindow?.toLocaleString() || 'Unknown'} tokens\n**Max Output:** ${usage?.maxOutputTokens?.toLocaleString() || 'Unknown'} tokens`,
          timestamp: new Date().toISOString()
        });
        break;
      }
    }
  }, [addMessage, setShowSettings, clearSession, clearAvailableSkills, activeSessionId, cliSessionId, currentCwd, isPlanMode, messages.length]);

  // Execute a CLI command and display the result
  const executeCliCommand = useCallback(async (command: SlashCommand, args: string) => {
    // Need a working directory for CLI commands
    const cwd = currentCwd || process.cwd?.() || '.';

    // Show the command being executed
    addMessage({
      id: crypto.randomUUID(),
      type: 'user',
      content: `${command.name}${args ? ' ' + args : ''}`,
      timestamp: new Date().toISOString()
    });

    try {
      const result = await window.claudeUI.cli.executeCommand(
        command.name.slice(1), // Remove leading slash
        args,
        cwd,
        cliSessionId || undefined
      );

      console.log('[executeCliCommand] Result received:', {
        success: result.success,
        outputLength: result.output?.length,
        hasNewlines: result.output?.includes('\n'),
        firstChars: result.output?.substring(0, 100)
      });

      // Display the CLI response
      addMessage({
        id: crypto.randomUUID(),
        type: 'system',
        content: result.success
          ? result.output || 'Command completed successfully.'
          : `Error: ${result.error || 'Command failed'}`,
        timestamp: new Date().toISOString()
      });
    } catch (err) {
      console.error('Failed to execute CLI command:', err);
      addMessage({
        id: crypto.randomUUID(),
        type: 'system',
        content: `Failed to execute ${command.name}: ${err instanceof Error ? err.message : 'Unknown error'}`,
        timestamp: new Date().toISOString()
      });
    }
  }, [currentCwd, cliSessionId, addMessage]);

  // Handle interactive commands - open PTY terminal
  const handleInteractiveCommand = useCallback((command: SlashCommand, args: string) => {
    // Show the command being executed
    addMessage({
      id: crypto.randomUUID(),
      type: 'system',
      content: `Opening interactive terminal for **${command.name}**...`,
      timestamp: new Date().toISOString()
    });

    // Get the CLI command (e.g., 'doctor', 'login', 'logout')
    const cliCommand = command.cliCommand || command.name.slice(1);
    const subcommandArgs = args ? args.split(/\s+/) : undefined;

    // Generate a unique session ID and open the PTY terminal
    const ptySessionId = `claude-pty-${Date.now()}`;
    // Pass sendAsSlashCommand to determine if we should send /command to REPL
    openClaudePtySession(ptySessionId, cliCommand, subcommandArgs, command.sendAsSlashCommand);
  }, [addMessage, openClaudePtySession]);

  // Handle slash commands - simplified router
  const handleSlashCommand = useCallback(async (command: SlashCommand, args: string) => {
    console.log('[handleSlashCommand] Command:', command.name, 'Type:', command.type, 'Args:', args, 'Full command object:', command);

    switch (command.type) {
      case 'ui-only':
        console.log('[handleSlashCommand] Routing to UI-only handler');
        handleUiOnlyCommand(command, args);
        break;

      case 'interactive':
        // Commands that need a real terminal (doctor, login, logout, config, etc.)
        console.log('[handleSlashCommand] Routing to interactive handler, cliCommand:', command.cliCommand);
        handleInteractiveCommand(command, args);
        break;

      case 'cli-subcommand':
        // Commands that use CLI subcommands (claude --help, claude mcp list, etc.)
        console.log('[handleSlashCommand] Routing to CLI subcommand');
        await executeCliCommand(command, args);
        break;

      case 'cli-skill':
        // Built-in CLI skills - execute via -p mode with session context
        // This actually runs the command (compaction, etc.)
        console.log('[handleSlashCommand] Routing to CLI skill');
        await executeCliCommand(command, args);
        break;

      case 'skill':
        // Dynamically loaded skills - send as messages to active CLI session
        console.log('[handleSlashCommand] Routing to skill (send as message)');
        const fullCommand = command.packageName
          ? `/${command.packageName}:${command.name.slice(1)}${args ? ' ' + args : ''}`
          : `${command.name}${args ? ' ' + args : ''}`;
        handleSendMessage(fullCommand);
        break;

      default:
        console.warn('[handleSlashCommand] Unknown command type:', command.type, '- sending as message');
        handleSendMessage(`${command.name}${args ? ' ' + args : ''}`);
    }
  }, [handleUiOnlyCommand, handleInteractiveCommand, executeCliCommand, handleSendMessage]);

  return (
    <div className={styles.container}>
      <div className={styles.messages}>
        {messages.length === 0 && !isStreaming ? (
          <div className={styles.welcome}>
            <div className={styles.welcomeIcon}>C</div>
            <h2 className={styles.welcomeTitle}>Welcome to Claude Code</h2>
            <p className={styles.welcomeText}>
              {isPlanMode
                ? 'Plan mode is enabled. Claude will help you plan without making changes.'
                : 'Ask me to help with coding, debugging, or any software engineering task.'}
            </p>
            {!currentCwd && (
              <p className={styles.welcomeHint}>
                Select a working directory when you send your first message.
              </p>
            )}
          </div>
        ) : (
          <MessageList messages={messages} />
        )}

        {isStreaming && (
          <StreamingMessage
            content={streamingContent}
            thinking={streamingThinking}
            toolsInProgress={toolsInProgress}
            streamingBlocks={streamingBlocks}
          />
        )}

        {error && (
          <div className={styles.error}>
            <span className={styles.errorIcon}>!</span>
            <span>{error}</span>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* AskUserQuestion prompt overlay */}
      {pendingUserQuestion && (
        <AskUserPrompt
          question={pendingUserQuestion.question}
          header={pendingUserQuestion.header}
          options={pendingUserQuestion.options}
          multiSelect={pendingUserQuestion.multiSelect}
          onAnswer={handleUserQuestionAnswer}
          onCancel={handleUserQuestionCancel}
        />
      )}

      <div className={styles.inputWrapper}>
        <InputArea
          onSend={handleSendMessage}
          onSlashCommand={handleSlashCommand}
          onInterrupt={handleInterrupt}
          disabled={isStreaming}
          isStreaming={isStreaming}
          placeholder={isPlanMode ? 'Describe what you want to plan...' : 'Ask Claude anything...'}
        />
      </div>
    </div>
  );
};
