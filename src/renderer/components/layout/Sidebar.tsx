import React, { useEffect, useState, useRef, useCallback } from 'react';
import { SessionList } from '../sidebar/SessionList';
import { ActivityBar } from '../sidebar/ActivityBar';
import { DirectoryTree } from '../sidebar/DirectoryTree';
import { Button } from '../common';
import { useUI, useSession, useSessionActions, useChatActions, useUIActions } from '../../store';
import styles from './Sidebar.module.css';

export interface SelectedSession {
  sessionId: string;
  projectEncodedName: string;
  title: string;
}

// Debounce delay for session changes (ms)
const SESSION_CHANGE_DEBOUNCE_MS = 500;

export const Sidebar: React.FC = () => {
  const { sidebarWidth, isSidebarCollapsed, sidebarView } = useUI();
  const { projects, isLoadingSessions, currentCwd } = useSession();
  const { setProjects, setIsLoadingSessions, setActiveSessionId, setCliSessionId, setCurrentCwd } = useSessionActions();
  const { clearMessages, clearStreaming } = useChatActions();
  const { setSidebarView, appendToChatInput } = useUIActions();
  const [isSelectMode, setIsSelectMode] = useState(false);
  const [selectedSessions, setSelectedSessions] = useState<SelectedSession[]>([]);
  const [isDeleting, setIsDeleting] = useState(false);

  // Ref for debounce timeout
  const loadTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Load sessions function - showLoading controls whether to show loading state
  const loadSessions = useCallback(async (showLoading = true) => {
    if (showLoading) {
      setIsLoadingSessions(true);
    }
    try {
      const loadedProjects = await window.claudeUI.sessions.getAll();
      setProjects(loadedProjects);
    } catch (error) {
      console.error('Failed to load sessions:', error);
    } finally {
      if (showLoading) {
        setIsLoadingSessions(false);
      }
    }
  }, [setProjects, setIsLoadingSessions]);

  // Debounced load for file watcher events - prevents flickering
  const debouncedLoadSessions = useCallback(() => {
    if (loadTimeoutRef.current) {
      clearTimeout(loadTimeoutRef.current);
    }
    loadTimeoutRef.current = setTimeout(() => {
      loadSessions(false); // Don't show loading state for background refreshes
    }, SESSION_CHANGE_DEBOUNCE_MS);
  }, [loadSessions]);

  // Load sessions on mount and subscribe to changes
  useEffect(() => {
    loadSessions(true); // Show loading state on initial load

    // Subscribe to session changes with debouncing
    const cleanup = window.claudeUI.sessions.onChanged(() => {
      debouncedLoadSessions();
    });

    return () => {
      cleanup();
      // Clear any pending debounce timeout
      if (loadTimeoutRef.current) {
        clearTimeout(loadTimeoutRef.current);
      }
    };
  }, [loadSessions, debouncedLoadSessions]);

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

  const handleFileClick = (filePath: string) => {
    appendToChatInput(filePath);
  };

  if (isSidebarCollapsed) {
    return null;
  }

  // Get the cwd for the directory tree - use home directory as fallback
  const directoryPath = currentCwd || '';

  return (
    <aside
      className={styles.sidebar}
      style={{ width: sidebarWidth }}
    >
      <div className={styles.sidebarContainer}>
        <ActivityBar activeView={sidebarView} onViewChange={setSidebarView} />
        <div className={styles.sidebarMain}>
          {sidebarView === 'projects' ? (
            <>
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
                    isSelectMode={isSelectMode}
                    selectedSessions={selectedSessions}
                    onToggleSelection={toggleSessionSelection}
                  />
                )}
              </div>
            </>
          ) : directoryPath ? (
            <DirectoryTree cwd={directoryPath} onFileClick={handleFileClick} />
          ) : (
            <div className={styles.empty}>
              <p>No directory selected.</p>
              <p className={styles.emptyHint}>Start a chat to set a working directory.</p>
            </div>
          )}
        </div>
      </div>
    </aside>
  );
};
