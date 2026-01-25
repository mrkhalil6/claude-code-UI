import React, { memo, useState, useRef, useEffect } from 'react';
import clsx from 'clsx';
import { SessionSummary } from '../../../shared/types';
import { useSession, useSessionActions, useChatActions, useUIActions } from '../../store';
import { ChatMessage, ToolUseDisplay, ContentBlock } from '../../store/slices/chat.slice';
import { SelectedSession } from '../layout/Sidebar';
import styles from './SessionItem.module.css';

/**
 * Clean CLI internal tags from text content
 */
function cleanCliTags(text: string): string {
  if (!text) return '';
  return text
    .replace(/<local-command-stdout>/g, '')
    .replace(/<\/local-command-stdout>/g, '')
    .replace(/<local-command-stderr>/g, '')
    .replace(/<\/local-command-stderr>/g, '')
    .replace(/<command-name>.*?<\/command-name>/g, '')
    .replace(/<command-message>.*?<\/command-message>/g, '')
    .replace(/<command-args>.*?<\/command-args>/g, '')
    .replace(/<local-command-caveat>.*?<\/local-command-caveat>/gs, '')
    .replace(/<system-reminder>[\s\S]*?<\/system-reminder>/g, '')
    .trim();
}

interface SessionItemProps {
  session: SessionSummary;
  projectPath: string;
  projectEncodedName: string;
  isSelectMode?: boolean;
  isSelected?: boolean;
  onToggleSelection?: (session: SelectedSession) => void;
}

export const SessionItem: React.FC<SessionItemProps> = memo(({
  session,
  projectPath,
  projectEncodedName,
  isSelectMode = false,
  isSelected = false,
  onToggleSelection
}) => {
  const { cliSessionId } = useSession();
  const { setActiveSession, setActiveSessionId, setActiveProjectPath, setCurrentCwd, setIsLoadingSession } = useSessionActions();
  const { setMessages, clearMessages } = useChatActions();
  const { setConnectionStatus } = useUIActions();

  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(session.title);
  const [isRenaming, setIsRenaming] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const isActive = cliSessionId === session.id;

  // Focus input when editing starts
  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  const handleRename = async () => {
    const newName = editValue.trim();
    if (!newName || newName === session.title || isRenaming) {
      setIsEditing(false);
      setEditValue(session.title);
      return;
    }

    if (newName.length > 100) {
      setEditValue(session.title);
      setIsEditing(false);
      return;
    }

    setIsRenaming(true);
    try {
      const homeDir = await window.claudeUI.fs.getHomeDir();
      const fullProjectPath = `${homeDir}/.claude/projects/${projectEncodedName}`;
      const success = await window.claudeUI.sessions.rename(fullProjectPath, session.id, newName);

      if (!success) {
        setEditValue(session.title);
      }
      // File watcher will refresh the list with the new name
    } catch (error) {
      console.error('Failed to rename session:', error);
      setEditValue(session.title);
    } finally {
      setIsRenaming(false);
      setIsEditing(false);
    }
  };

  const handleEditClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setEditValue(session.title);
    setIsEditing(true);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleRename();
    } else if (e.key === 'Escape') {
      setEditValue(session.title);
      setIsEditing(false);
    }
  };

  const handleBlur = () => {
    handleRename();
  };

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

      // Set activeSession so components can access metadata (like slug for plan detection)
      setActiveSession(loadedSession);
      // Clear activeSessionId so new CLI session will be created on next message
      setActiveSessionId(null);
      // cliSessionId is set by setActiveSession, but we keep it for sidebar highlighting
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
              content: cleanCliTags(content),
              timestamp: msg.timestamp
            };
          }

          // Extract text content and clean CLI tags
          const textContent = cleanCliTags(
            content
              .filter((c): c is { type: 'text'; text: string } => c.type === 'text')
              .map(c => c.text)
              .join('\n')
          );

          // For assistant messages, build contentBlocks and toolUses
          if (msg.type === 'assistant') {
            const contentBlocks: ContentBlock[] = [];
            const toolUses: ToolUseDisplay[] = [];

            for (const block of content) {
              if (block.type === 'text' && 'text' in block) {
                const cleanedText = cleanCliTags(block.text);
                if (cleanedText) {
                  contentBlocks.push({ type: 'text', text: cleanedText });
                }
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

  const handleCheckboxClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onToggleSelection?.({
      sessionId: session.id,
      projectEncodedName,
      title: session.title
    });
  };

  return (
    <div className={clsx(styles.itemWrapper, isActive && styles.active, isSelected && styles.selected)}>
      {isSelectMode && (
        <button
          className={styles.checkboxButton}
          onClick={handleCheckboxClick}
          title={isSelected ? "Deselect" : "Select"}
        >
          <div className={clsx(styles.checkbox, isSelected && styles.checked)}>
            {isSelected && (
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                <path d="M20 6L9 17l-5-5" />
              </svg>
            )}
          </div>
        </button>
      )}
      <button
        className={styles.item}
        onClick={isSelectMode ? handleCheckboxClick : handleClick}
      >
        <div className={styles.content}>
          {isEditing ? (
            <input
              ref={inputRef}
              type="text"
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              onKeyDown={handleKeyDown}
              onBlur={handleBlur}
              onClick={(e) => e.stopPropagation()}
              className={styles.editInput}
              disabled={isRenaming}
              maxLength={100}
            />
          ) : (
            <span className={styles.title}>{session.title}</span>
          )}
          {session.preview && !isEditing && (
            <span className={styles.preview}>{session.preview}</span>
          )}
        </div>
        <div className={styles.meta}>
          <span className={styles.date}>{formatDate(session.lastModified)}</span>
          <div className={styles.metaRight}>
            {session.hasPlan && (
              <span className={styles.planIndicator} title="Has implementation plan">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                  <polyline points="14 2 14 8 20 8" />
                </svg>
              </span>
            )}
            <span className={styles.count}>{session.messageCount}</span>
          </div>
        </div>
      </button>
      {!isSelectMode && !isEditing && (
        <button
          className={styles.editButton}
          onClick={handleEditClick}
          title="Rename session"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
            <path d="m15 5 4 4" />
          </svg>
        </button>
      )}
    </div>
  );
});
