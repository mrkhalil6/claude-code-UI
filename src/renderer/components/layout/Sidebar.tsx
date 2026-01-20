import React, { useEffect } from 'react';
import { SessionList } from '../sidebar/SessionList';
import { Button } from '../common';
import { useUI, useSession, useSessionActions } from '../../store';
import styles from './Sidebar.module.css';

export const Sidebar: React.FC = () => {
  const { sidebarWidth, isSidebarCollapsed } = useUI();
  const { projects, isLoadingSessions } = useSession();
  const { setProjects, setIsLoadingSessions } = useSessionActions();
  const { setCurrentCwd } = useSessionActions();

  // Load sessions on mount
  useEffect(() => {
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

    loadSessions();

    // Subscribe to session changes
    const cleanup = window.claudeUI.sessions.onChanged(() => {
      loadSessions();
    });

    return cleanup;
  }, [setProjects, setIsLoadingSessions]);

  const handleNewChat = async () => {
    const directory = await window.claudeUI.fs.selectDirectory();
    if (directory) {
      setCurrentCwd(directory);
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
        <Button
          variant="primary"
          size="sm"
          onClick={handleNewChat}
        >
          + New Chat
        </Button>
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
          <SessionList projects={projects} />
        )}
      </div>
    </aside>
  );
};
