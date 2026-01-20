import React, { useRef, useEffect, useState, useCallback } from 'react';
import { MessageList } from './MessageList';
import { StreamingMessage } from './StreamingMessage';
import { InputArea } from './InputArea';
import { SessionPermissions } from './SessionPermissions';
import { PermissionDialog } from '../permissions';
import { useStore, useChat, useSession, useUI, useChatActions, useUIActions, useSessionActions, usePermissions, usePermissionActions } from '../../store';
import { SlashCommand, SLASH_COMMANDS } from '../../../shared/slash-commands';
import styles from './ChatContainer.module.css';

export const ChatContainer: React.FC = () => {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);
  const { messages, isStreaming, streamingContent, streamingThinking, toolsInProgress, streamingBlocks } = useChat();
  const { activeSessionId, currentCwd, cliSessionId } = useSession();
  const { isPlanMode } = useUI();
  const { pendingPermission } = usePermissions();
  const { setShowSettings } = useUIActions();
  const { addMessage, setIsStreaming, appendStreamingContent, appendStreamingThinking, finalizeStreamingMessage, clearStreaming, setLastUserMessage, addToolInProgress, updateToolStatus } = useChatActions();
  const { setActiveSessionId, setCliSessionId, setCurrentCwd, clearSession } = useSessionActions();
  const { setConnectionStatus } = useUIActions();
  const { setPendingPermission, setKnownTools } = usePermissionActions();

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

        // Store CLI's session ID separately for sidebar highlighting
        // (Don't change activeSessionId as it's used for main process communication)
        if (data.event && data.event.session_id) {
          setCliSessionId(data.event.session_id);
        }
        // Also sync the cwd if available
        if (data.event && data.event.cwd) {
          setCurrentCwd(data.event.cwd);
        }
        // Capture available tools from the CLI (includes MCP tools)
        if (data.event && data.event.tools && Array.isArray(data.event.tools)) {
          setKnownTools(data.event.tools);
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
        const event = data.event;
        if (event && event.message && event.message.content) {
          for (const block of event.message.content) {
            if (block.type === 'text' && block.text) {
              appendStreamingContent(block.text);
            } else if (block.type === 'tool_use') {
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
        const event = data.event;
        if (event && event.message && event.message.content) {
          for (const block of event.message.content) {
            if (block.type === 'tool_result') {
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
      })
    );

    cleanups.push(
      window.claudeUI.cli.onExit((data) => {
        console.log('CLI exited:', data);
        // Only disconnect if there was an error
        if (data.code !== 0) {
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

    cleanups.push(
      window.claudeUI.cli.onPermissionRequired((data) => {
        console.log('Permission required:', data);
        setPendingPermission({
          sessionId: data.sessionId,
          toolUseId: data.toolUseId,
          toolName: data.toolName,
          toolInput: data.toolInput || {},
          description: `Claude wants to use ${data.toolName}`,
          timestamp: new Date().toISOString()
        });
      })
    );

    return () => {
      cleanups.forEach(cleanup => cleanup());
    };
  }, [setConnectionStatus, setIsStreaming, appendStreamingContent, appendStreamingThinking, finalizeStreamingMessage, clearStreaming, setPendingPermission, addToolInProgress, updateToolStatus, setKnownTools, setCliSessionId, setCurrentCwd]);

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

  // Handle retry after permission is granted - resend the message without adding to chat again
  const handleRetryAfterPermission = useCallback(async (message: string) => {
    if (!activeSessionId) return;

    setIsStreaming(true);
    clearStreaming();

    try {
      await window.claudeUI.cli.sendMessage(activeSessionId, message);
    } catch (err) {
      console.error('Failed to retry message:', err);
      setError('Failed to retry message. Please try again.');
      setIsStreaming(false);
    }
  }, [activeSessionId, setIsStreaming, clearStreaming]);

  // Handle slash commands
  const handleSlashCommand = useCallback(async (command: SlashCommand, args: string) => {
    console.log('Slash command:', command.name, args);

    // Handle local commands
    if (command.type === 'local') {
      switch (command.name) {
        case '/clear':
          // Clear messages from the store
          useChatActions.getState().clearMessages();
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
          useChatActions.getState().clearMessages();
          clearSession();
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

        case '/permissions': {
          try {
            const globalPerms = await window.claudeUI.permissions.getGlobal();
            const sessionTools = useStore.getState().sessionAllowedTools;

            const globalList = globalPerms.length > 0
              ? globalPerms.map(p => `- **${p.tool}**: ${p.allowed ? 'Allowed' : 'Denied'} (${p.scope})`).join('\n')
              : 'No global permissions set';

            const sessionList = sessionTools.length > 0
              ? sessionTools.map(t => `- ${t}`).join('\n')
              : 'No session-specific tools allowed';

            addMessage({
              id: crypto.randomUUID(),
              type: 'system',
              content: `## Permissions\n\n### Global Permissions\n${globalList}\n\n### Session Allowed Tools\n${sessionList}\n\n*Go to Settings > Permissions to manage*`,
              timestamp: new Date().toISOString()
            });
          } catch (err) {
            addMessage({
              id: crypto.randomUUID(),
              type: 'system',
              content: '## Permissions\n\nFailed to load permissions.',
              timestamp: new Date().toISOString()
            });
          }
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
    }
  }, [activeSessionId, cliSessionId, currentCwd, isPlanMode, messages.length, addMessage, setShowSettings, clearSession, handleSendMessage]);

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
        <div className={styles.inputToolbar}>
          <SessionPermissions />
        </div>
        <InputArea
          onSend={handleSendMessage}
          onSlashCommand={handleSlashCommand}
          disabled={isStreaming || !!pendingPermission}
          placeholder={isPlanMode ? 'Describe what you want to plan...' : 'Ask Claude anything...'}
        />
      </div>

      {pendingPermission && (
        <PermissionDialog
          permission={pendingPermission}
          onRetry={handleRetryAfterPermission}
        />
      )}
    </div>
  );
};
