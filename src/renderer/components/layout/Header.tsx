import React from 'react';
import { Toggle } from '../common';
import { useUI, useUIActions, useSession } from '../../store';
import styles from './Header.module.css';

export const Header: React.FC = () => {
  const { isPlanMode, connectionStatus } = useUI();
  const { togglePlanMode, toggleSidebar, setShowSettings, setShowGitDiff } = useUIActions();
  const { currentCwd, activeSessionId } = useSession();

  const getStatusColor = () => {
    switch (connectionStatus) {
      case 'connected':
        return styles.statusConnected;
      case 'connecting':
        return styles.statusConnecting;
      case 'error':
        return styles.statusError;
      default:
        return styles.statusDisconnected;
    }
  };

  return (
    <header className={styles.header}>
      <div className={styles.left}>
        <button
          className={styles.menuButton}
          onClick={toggleSidebar}
          aria-label="Toggle sidebar"
        >
          <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
            <path d="M3 5h14a1 1 0 010 2H3a1 1 0 010-2zm0 4h14a1 1 0 010 2H3a1 1 0 010-2zm0 4h14a1 1 0 010 2H3a1 1 0 010-2z"/>
          </svg>
        </button>

        <div className={styles.logo}>
          <span className={styles.logoIcon}>C</span>
          <span className={styles.logoText}>Claude Code</span>
        </div>

        {currentCwd && (
          <div className={styles.cwd} title={currentCwd}>
            <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
              <path d="M1.5 1a.5.5 0 00-.5.5v3a.5.5 0 00.5.5h3a.5.5 0 000-1H2V1.5a.5.5 0 00-.5-.5zm13 0a.5.5 0 01.5.5v3a.5.5 0 01-.5.5h-3a.5.5 0 010-1h2.5V1.5a.5.5 0 01.5-.5zM1.5 11a.5.5 0 00-.5.5v3a.5.5 0 00.5.5h3a.5.5 0 000-1H2v-2.5a.5.5 0 00-.5-.5zm13 0a.5.5 0 01.5.5v3a.5.5 0 01-.5.5h-3a.5.5 0 010-1h2.5v-2.5a.5.5 0 01.5-.5z"/>
            </svg>
            <span className={styles.cwdText}>{currentCwd.split(/[/\\]/).pop()}</span>
          </div>
        )}
      </div>

      <div className={styles.center}>
        {activeSessionId && (
          <div className={styles.sessionIndicator}>
            <span className={`${styles.statusDot} ${getStatusColor()}`} />
            <span className={styles.sessionText}>
              {connectionStatus === 'connected' ? 'Active Session' : connectionStatus}
            </span>
          </div>
        )}
      </div>

      <div className={styles.right}>
        <div className={styles.planModeToggle}>
          <Toggle
            checked={isPlanMode}
            onChange={togglePlanMode}
            label="Plan Mode"
            size="sm"
          />
        </div>

        <button
          className={styles.gitButton}
          onClick={() => setShowGitDiff(true)}
          aria-label="Git Changes"
          title="View Git Changes"
          disabled={!currentCwd}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
            <path d="M21.007 8.222A3.738 3.738 0 0 0 15.045 5.2a3.737 3.737 0 0 0-6.09 0 3.738 3.738 0 0 0-5.962 3.022 3.737 3.737 0 0 0 2.49 6.527h.008l-.003.254c0 2.068 1.679 3.747 3.747 3.747h5.536a3.747 3.747 0 0 0 3.747-3.747l-.003-.254h.008a3.737 3.737 0 0 0 2.484-6.527zM12 18.75H9.226a1.747 1.747 0 0 1-1.747-1.747v-.254H9.5v-2H5.527a1.737 1.737 0 0 1-.74-3.306l.658-.306-.082-.71a1.737 1.737 0 0 1 1.75-1.932 1.72 1.72 0 0 1 .983.306l.655.445.465-.645A1.738 1.738 0 0 1 12 8c.585 0 1.13.29 1.455.778l.465.645.655-.445a1.72 1.72 0 0 1 .983-.306 1.738 1.738 0 0 1 1.75 1.932l-.082.71.658.306a1.737 1.737 0 0 1-.74 3.306H14.5v2h2.021v.254A1.747 1.747 0 0 1 14.773 19L12 18.75z"/>
          </svg>
        </button>

        <button
          className={styles.settingsButton}
          onClick={() => setShowSettings(true)}
          aria-label="Settings"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="3" />
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
          </svg>
        </button>
      </div>
    </header>
  );
};
