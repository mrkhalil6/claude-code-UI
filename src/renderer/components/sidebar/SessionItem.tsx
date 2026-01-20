import React from 'react';
import clsx from 'clsx';
import { SessionSummary } from '../../../shared/types';
import { useSession, useSessionActions, useChatActions, useUIActions } from '../../store';
import { ChatMessage, ToolUseDisplay, ContentBlock } from '../../store/slices/chat.slice';
import styles from './SessionItem.module.css';

interface SessionItemProps {
  session: SessionSummary;
  projectPath: string;
  projectEncodedName: string;
}

export const SessionItem: React.FC<SessionItemProps> = ({
  session,
  projectPath,
  projectEncodedName
}) => {
  const { cliSessionId } = useSession();
  const { setActiveSession, setActiveSessionId, setCliSessionId, setActiveProjectPath, setCurrentCwd, setIsLoadingSession } = useSessionActions();
  const { setMessages, clearMessages } = useChatActions();
  const { setConnectionStatus } = useUIActions();

  const isActive = cliSessionId === session.id;

  const handleClick = async () => {
    if (isActive) return;

    setIsLoadingSession(true);
    clearMessages();

    try {
      // Get the full project path for loading the session
      const homeDir = await window.claudeUI.fs.getHomeDir();
      const fullProjectPath = `${homeDir}/.claude/projects/${projectEncodedName}`;

      const loadedSession = await window.claudeUI.sessions.load(
        fullProjectPath,
        session.id
      );

      // Don't set activeSessionId (it's for main process communication)
      // Only set cliSessionId for sidebar highlighting
      setActiveSessionId(null);  // Clear so new session will be created on next message
      setCliSessionId(loadedSession.id);  // For sidebar highlighting
      setActiveProjectPath(projectPath);
      setCurrentCwd(loadedSession.metadata.cwd);

      // First pass: collect tool results from user messages
      const toolResults = new Map<string, { result: string; isError: boolean }>();
      for (const msg of loadedSession.messages) {
        if (msg.type === 'user' && Array.isArray(msg.message.content)) {
          for (const block of msg.message.content) {
            if (block.type === 'tool_result' && 'tool_use_id' in block) {
              const resultContent = typeof block.content === 'string'
                ? block.content
                : JSON.stringify(block.content);
              toolResults.set(block.tool_use_id as string, {
                result: resultContent.slice(0, 500),
                isError: !!block.is_error
              });
            }
          }
        }
      }

      // Convert session messages to chat messages with tool uses
      const chatMessages: ChatMessage[] = loadedSession.messages
        .filter(msg => {
          // Filter out user messages that only contain tool_result (not visible to user)
          if (msg.type === 'user' && Array.isArray(msg.message.content)) {
            const hasUserText = msg.message.content.some(
              (c) => c.type === 'text' && 'text' in c && (c.text as string).trim()
            );
            const hasToolResult = msg.message.content.some(c => c.type === 'tool_result');
            if (hasToolResult && !hasUserText) return false;
          }
          return true;
        })
        .map(msg => {
          const content = msg.message.content;

          if (typeof content === 'string') {
            return {
              id: msg.uuid,
              type: msg.type as 'user' | 'assistant',
              content,
              timestamp: msg.timestamp
            };
          }

          // Extract text content
          const textContent = content
            .filter((c): c is { type: 'text'; text: string } => c.type === 'text')
            .map(c => c.text)
            .join('\n');

          // For assistant messages, build contentBlocks and toolUses
          if (msg.type === 'assistant') {
            const contentBlocks: ContentBlock[] = [];
            const toolUses: ToolUseDisplay[] = [];

            for (const block of content) {
              if (block.type === 'text' && 'text' in block) {
                contentBlocks.push({ type: 'text', text: block.text });
              } else if (block.type === 'tool_use' && 'id' in block && 'name' in block) {
                const toolId = block.id as string;
                const resultInfo = toolResults.get(toolId);
                const toolDisplay: ToolUseDisplay = {
                  id: toolId,
                  name: block.name as string,
                  input: (block.input as Record<string, unknown>) || {},
                  status: resultInfo?.isError ? 'error' : 'completed',
                  result: resultInfo?.result
                };
                contentBlocks.push({ type: 'tool', tool: toolDisplay });
                toolUses.push(toolDisplay);
              }
            }

            return {
              id: msg.uuid,
              type: 'assistant' as const,
              content: textContent,
              timestamp: msg.timestamp,
              contentBlocks: contentBlocks.length > 0 ? contentBlocks : undefined,
              toolUses: toolUses.length > 0 ? toolUses : undefined
            };
          }

          return {
            id: msg.uuid,
            type: msg.type as 'user' | 'assistant',
            content: textContent,
            timestamp: msg.timestamp
          };
        });

      setMessages(chatMessages);
      setConnectionStatus('connected');
    } catch (error) {
      console.error('Failed to load session:', error);
    } finally {
      setIsLoadingSession(false);
    }
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } else if (diffDays === 1) {
      return 'Yesterday';
    } else if (diffDays < 7) {
      return date.toLocaleDateString([], { weekday: 'short' });
    } else {
      return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
    }
  };

  return (
    <button
      className={clsx(styles.item, isActive && styles.active)}
      onClick={handleClick}
    >
      <div className={styles.content}>
        <span className={styles.title}>{session.title}</span>
        {session.preview && (
          <span className={styles.preview}>{session.preview}</span>
        )}
      </div>
      <div className={styles.meta}>
        <span className={styles.date}>{formatDate(session.lastModified)}</span>
        <span className={styles.count}>{session.messageCount}</span>
      </div>
    </button>
  );
};
