import React, { useRef, useEffect, useState, useCallback } from 'react';
import { MessageList } from './MessageList';
import { StreamingMessage } from './StreamingMessage';
import { InputArea } from './InputArea';
// TodoList moved to StatusBar
import { useStore, useChat, useSession, useUI, useChatActions, useUIActions, useSessionActions } from '../../store';
import { SlashCommand, SLASH_COMMANDS, parseCliSlashCommands } from '../../../shared/slash-commands';
import { TodoItem } from '../../store/slices/chat.slice';
import styles from './ChatContainer.module.css';

export const ChatContainer: React.FC = () => {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const wasInterruptedRef = useRef(false);  // Track intentional interrupts
  const [error, setError] = useState<string | null>(null);
  const { messages, isStreaming, streamingContent, streamingThinking, toolsInProgress, streamingBlocks } = useChat();
  const { activeSessionId, currentCwd, cliSessionId } = useSession();
  const { isPlanMode } = useUI();
  const { setShowSettings } = useUIActions();
  const { addMessage, setIsStreaming, appendStreamingContent, appendStreamingThinking, finalizeStreamingMessage, clearStreaming, setLastUserMessage, addToolInProgress, updateToolStatus, setTodos } = useChatActions();
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
  }, [setConnectionStatus, setIsStreaming, appendStreamingContent, appendStreamingThinking, finalizeStreamingMessage, clearStreaming, addToolInProgress, updateToolStatus, setCliSessionId, setCurrentCwd, setTodos, setModelInfo, updateUsage, setIsPlanMode, addMessage, setAvailableSkills]);

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

  // Handle slash commands
  const handleSlashCommand = useCallback(async (command: SlashCommand, args: string) => {
    console.log('Slash command:', command.name, args);

    // Handle local commands
    if (command.type === 'local') {
      switch (command.name) {
        case '/clear':
          // Clear messages from the store
          useStore.getState().clearMessages();
          // Add a system message to indicate the clear
          addMessage({
            id: crypto.randomUUID(),
            type: 'system',
            content: 'Conversation cleared.',
            timestamp: new Date().toISOString()
          });
          return;

        case '/help':
          // Show help message with available commands
          const helpText = SLASH_COMMANDS.map(cmd =>
            `**${cmd.name}** - ${cmd.description}${cmd.usage ? ` (Usage: ${cmd.usage})` : ''}`
          ).join('\n');
          addMessage({
            id: crypto.randomUUID(),
            type: 'system',
            content: `## Available Commands\n\n${helpText}`,
            timestamp: new Date().toISOString()
          });
          return;

        case '/settings':
          setShowSettings(true);
          return;

        case '/new':
          // Clear messages and reset session
          useStore.getState().clearMessages();
          clearSession();
          clearAvailableSkills();
          return;

        case '/rename':
          // Validate we have an active session to rename
          if (!cliSessionId) {
            addMessage({
              id: crypto.randomUUID(),
              type: 'system',
              content: 'No active session to rename. Start a chat first.',
              timestamp: new Date().toISOString()
            });
            return;
          }

          // Validate we have a name provided
          const newName = args.trim();
          if (!newName) {
            addMessage({
              id: crypto.randomUUID(),
              type: 'system',
              content: 'Usage: /rename <new name>\n\nExample: /rename Fix authentication bug',
              timestamp: new Date().toISOString()
            });
            return;
          }

          // Validate name length
          if (newName.length > 100) {
            addMessage({
              id: crypto.randomUUID(),
              type: 'system',
              content: 'Session name must be 100 characters or less.',
              timestamp: new Date().toISOString()
            });
            return;
          }

          try {
            // Get the home directory and find the project for this session
            const homeDir = await window.claudeUI.fs.getHomeDir();
            const projects = await window.claudeUI.sessions.getAll();
            let projectEncodedName: string | null = null;

            for (const project of projects) {
              const hasSession = project.sessions.some(s => s.id === cliSessionId);
              if (hasSession) {
                projectEncodedName = project.encodedName;
                break;
              }
            }

            if (!projectEncodedName) {
              addMessage({
                id: crypto.randomUUID(),
                type: 'system',
                content: 'Could not find the project for this session. The session may not have been saved yet.',
                timestamp: new Date().toISOString()
              });
              return;
            }

            const fullProjectPath = `${homeDir}/.claude/projects/${projectEncodedName}`;
            const success = await window.claudeUI.sessions.rename(fullProjectPath, cliSessionId, newName);

            if (success) {
              addMessage({
                id: crypto.randomUUID(),
                type: 'system',
                content: `Session renamed to: **${newName}**`,
                timestamp: new Date().toISOString()
              });
              // The file watcher will automatically trigger a sidebar refresh
            } else {
              addMessage({
                id: crypto.randomUUID(),
                type: 'system',
                content: 'Failed to rename session. The session file may not exist yet (send a message first).',
                timestamp: new Date().toISOString()
              });
            }
          } catch (err) {
            console.error('Failed to rename session:', err);
            addMessage({
              id: crypto.randomUUID(),
              type: 'system',
              content: `Failed to rename session: ${err instanceof Error ? err.message : 'Unknown error'}`,
              timestamp: new Date().toISOString()
            });
          }
          return;

        default:
          break;
      }
    }

    // Handle CLI-local commands (we fetch info and display it)
    if (command.type === 'cli-local') {
      switch (command.name) {
        case '/mcp': {
          try {
            // Get both global and project MCP servers
            const globalServers = await window.claudeUI.mcp.getGlobalServers();
            const projectServers = currentCwd
              ? await window.claudeUI.mcp.getProjectServers(currentCwd)
              : {};

            const formatServer = (name: string, server: { type?: string; url?: string; command?: string; args?: string[] }) => {
              if (server.type === 'sse' && server.url) {
                return `- **${name}** (SSE): \`${server.url}\``;
              } else if (server.type === 'http' && server.url) {
                return `- **${name}** (HTTP): \`${server.url}\``;
              } else {
                return `- **${name}** (stdio): \`${server.command}${server.args ? ' ' + server.args.join(' ') : ''}\``;
              }
            };

            const globalNames = Object.keys(globalServers);
            const projectNames = Object.keys(projectServers);

            let content = '## MCP Servers\n\n';

            if (globalNames.length === 0 && projectNames.length === 0) {
              content += 'No MCP servers configured.\n\n';
              content += '- **Global servers**: Go to *Settings > MCP Servers*\n';
              content += '- **Project servers**: Click the lock icon and select *MCP Servers* tab';
            } else {
              if (globalNames.length > 0) {
                content += '### Global (all projects)\n';
                content += globalNames.map(name => formatServer(name, globalServers[name])).join('\n');
                content += '\n\n';
              }

              if (projectNames.length > 0) {
                content += '### Project-specific\n';
                content += projectNames.map(name => formatServer(name, projectServers[name])).join('\n');
                content += '\n\n';
              }

              content += '*Manage global servers in Settings > MCP Servers*\n';
              content += '*Manage project servers via lock icon > MCP Servers tab*';
            }

            addMessage({
              id: crypto.randomUUID(),
              type: 'system',
              content,
              timestamp: new Date().toISOString()
            });
          } catch (err) {
            addMessage({
              id: crypto.randomUUID(),
              type: 'system',
              content: '## MCP Servers\n\nFailed to load MCP servers.',
              timestamp: new Date().toISOString()
            });
          }
          return;
        }

        case '/status': {
          const statusInfo = [
            `**Session ID:** ${activeSessionId || 'None'}`,
            `**CLI Session:** ${cliSessionId || 'None'}`,
            `**Working Directory:** ${currentCwd || 'Not set'}`,
            `**Plan Mode:** ${isPlanMode ? 'Enabled' : 'Disabled'}`,
            `**Messages:** ${messages.length}`
          ].join('\n');
          addMessage({
            id: crypto.randomUUID(),
            type: 'system',
            content: `## Session Status\n\n${statusInfo}`,
            timestamp: new Date().toISOString()
          });
          return;
        }

        case '/model': {
          addMessage({
            id: crypto.randomUUID(),
            type: 'system',
            content: '## Current Model\n\nModel selection is determined by your Claude CLI configuration.\nUse `claude config` in terminal to change the model.',
            timestamp: new Date().toISOString()
          });
          return;
        }

        case '/cost': {
          addMessage({
            id: crypto.randomUUID(),
            type: 'system',
            content: '## Cost Information\n\nToken usage and cost tracking is available in the Claude CLI.\nRun `claude` in terminal to see detailed usage stats.',
            timestamp: new Date().toISOString()
          });
          return;
        }

        default:
          break;
      }
    }

    // Handle CLI passthrough commands - send as a prompt to Claude
    if (command.type === 'cli-passthrough') {
      // Convert command to a natural language prompt
      let prompt = '';
      switch (command.name) {
        case '/compact':
          prompt = 'Please provide a brief summary of our conversation so far.';
          break;
        case '/review':
          prompt = 'Please review our conversation and highlight key points, decisions made, and any pending items.';
          break;
        default:
          prompt = `${command.name.slice(1)} ${args}`.trim();
      }

      // Send as regular message
      handleSendMessage(prompt);
      return;
    }

    // Handle skill commands - send as message to CLI (CLI handles skill expansion)
    if (command.type === 'skill') {
      // Reconstruct full command for CLI
      const fullCommand = command.packageName
        ? `/${command.packageName}:${command.name.slice(1)}${args ? ' ' + args : ''}`
        : `${command.name}${args ? ' ' + args : ''}`;
      handleSendMessage(fullCommand);
      return;
    }
  }, [activeSessionId, cliSessionId, currentCwd, isPlanMode, messages.length, addMessage, setShowSettings, clearSession, clearAvailableSkills, handleSendMessage]);

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
