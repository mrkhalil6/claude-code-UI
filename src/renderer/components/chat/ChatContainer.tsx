import React, { useRef, useEffect, useState, useCallback } from 'react';
import { MessageList } from './MessageList';
import { StreamingMessage } from './StreamingMessage';
import { InputArea } from './InputArea';
import { SessionPermissions } from './SessionPermissions';
import { PermissionDialog } from '../permissions';
import { useChat, useSession, useUI, useChatActions, useUIActions, useSessionActions, usePermissions, usePermissionActions } from '../../store';
import styles from './ChatContainer.module.css';

export const ChatContainer: React.FC = () => {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);
  const { messages, isStreaming, streamingContent, streamingThinking, toolsInProgress, streamingBlocks } = useChat();
  const { activeSessionId, currentCwd, cliSessionId } = useSession();
  const { isPlanMode } = useUI();
  const { pendingPermission } = usePermissions();
  const { addMessage, setIsStreaming, appendStreamingContent, appendStreamingThinking, finalizeStreamingMessage, clearStreaming, setLastUserMessage, addToolInProgress, updateToolStatus } = useChatActions();
  const { setActiveSessionId, setCliSessionId, setCurrentCwd } = useSessionActions();
  const { setConnectionStatus } = useUIActions();
  const { setPendingPermission } = usePermissionActions();

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
  }, [setConnectionStatus, setIsStreaming, appendStreamingContent, appendStreamingThinking, finalizeStreamingMessage, clearStreaming, setPendingPermission, addToolInProgress, updateToolStatus]);

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
