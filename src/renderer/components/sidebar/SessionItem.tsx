import React from 'react';
import clsx from 'clsx';
import { SessionSummary } from '../../../shared/types';
import { useSession, useSessionActions, useChatActions, useUIActions } from '../../store';
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

      // Convert session messages to chat messages
      const chatMessages = loadedSession.messages.map(msg => ({
        id: msg.uuid,
        type: msg.type as 'user' | 'assistant',
        content: typeof msg.message.content === 'string'
          ? msg.message.content
          : msg.message.content
              .filter((c): c is { type: 'text'; text: string } => c.type === 'text')
              .map(c => c.text)
              .join('\n'),
        timestamp: msg.timestamp
      }));

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
