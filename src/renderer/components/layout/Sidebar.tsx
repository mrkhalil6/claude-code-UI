import React, { useEffect, useState } from 'react';
import { SessionList } from '../sidebar/SessionList';
import { Button } from '../common';
import { useUI, useSession, useSessionActions, useChatActions } from '../../store';
import styles from './Sidebar.module.css';

export interface SelectedSession {
  sessionId: string;
  projectEncodedName: string;
  title: string;
}

export const Sidebar: React.FC = () => {
  const { sidebarWidth, isSidebarCollapsed } = useUI();
  const { projects, isLoadingSessions } = useSession();
  const { setProjects, setIsLoadingSessions, setActiveSessionId, setCliSessionId, setCurrentCwd } = useSessionActions();
  const { clearMessages, clearStreaming } = useChatActions();
  const [isSelectMode, setIsSelectMode] = useState(false);
  const [selectedSessions, setSelectedSessions] = useState<SelectedSession[]>([]);
  const [isDeleting, setIsDeleting] = useState(false);

  // Load sessions function
  const loadSessions = async () => {
    setIsLoadingSessions(true);
    try {
      const loadedProjects = await window.claudeUI.sessions.getAll();
      setProjects(loadedProjects);
    } catch (error) {
      console.error('Failed to load sessions:', error);
    } finally {
      setIsLoadingSessions(false);
    }
  };

  // Load sessions on mount
  useEffect(() => {
    loadSessions();

    // Subscribe to session changes
    const cleanup = window.claudeUI.sessions.onChanged(() => {
      loadSessions();
    });

    return cleanup;
  }, [setProjects, setIsLoadingSessions]);

  const handleNewChat = async () => {
    // Clear current chat state
    clearMessages();
    clearStreaming();
    setActiveSessionId(null);
    setCliSessionId(null);

    // Optionally select a new working directory
    const directory = await window.claudeUI.fs.selectDirectory();
    if (directory) {
      setCurrentCwd(directory);
    }
  };

  const toggleSelectMode = () => {
    setIsSelectMode(!isSelectMode);
    if (isSelectMode) {
      // Exiting select mode, clear selections
      setSelectedSessions([]);
    }
  };

  const toggleSessionSelection = (session: SelectedSession) => {
    setSelectedSessions(prev => {
      const exists = prev.some(s => s.sessionId === session.sessionId);
      if (exists) {
        return prev.filter(s => s.sessionId !== session.sessionId);
      } else {
        return [...prev, session];
      }
    });
  };

  const handleBulkDelete = async () => {
    if (selectedSessions.length === 0 || isDeleting) return;

    const count = selectedSessions.length;
    if (!confirm(`Delete ${count} chat${count > 1 ? 's' : ''}?\n\nThis action cannot be undone.`)) return;

    setIsDeleting(true);
    try {
      const homeDir = await window.claudeUI.fs.getHomeDir();

      for (const session of selectedSessions) {
        const fullProjectPath = `${homeDir}/.claude/projects/${session.projectEncodedName}`;
        await window.claudeUI.sessions.delete(fullProjectPath, session.sessionId);
      }

      // Clear selections and exit select mode
      setSelectedSessions([]);
      setIsSelectMode(false);

      // Refresh the list
      loadSessions();
    } catch (error) {
      console.error('Failed to delete sessions:', error);
    } finally {
      setIsDeleting(false);
    }
  };

  if (isSidebarCollapsed) {
    return null;
  }

  return (
    <aside
      className={styles.sidebar}
      style={{ width: sidebarWidth }}
    >
      <div className={styles.header}>
        <h2 className={styles.title}>Chat History</h2>
        <div className={styles.headerActions}>
          {isSelectMode ? (
            <>
              <Button
                variant="danger"
                size="sm"
                onClick={handleBulkDelete}
                disabled={selectedSessions.length === 0 || isDeleting}
              >
                {isDeleting ? 'Deleting...' : `Delete (${selectedSessions.length})`}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={toggleSelectMode}
              >
                Cancel
              </Button>
            </>
          ) : (
            <>
              <Button
                variant="ghost"
                size="sm"
                onClick={toggleSelectMode}
                title="Select multiple chats"
              >
                Select
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={handleNewChat}
              >
                + New
              </Button>
            </>
          )}
        </div>
      </div>

      <div className={styles.content}>
        {isLoadingSessions ? (
          <div className={styles.loading}>Loading sessions...</div>
        ) : projects.length === 0 ? (
          <div className={styles.empty}>
            <p>No chat history yet.</p>
            <p className={styles.emptyHint}>Start a new chat to get going!</p>
          </div>
        ) : (
          <SessionList
            projects={projects}
            onRefresh={loadSessions}
            isSelectMode={isSelectMode}
            selectedSessions={selectedSessions}
            onToggleSelection={toggleSessionSelection}
          />
        )}
      </div>
    </aside>
  );
};
