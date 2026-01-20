import React from 'react';
import { Toggle } from '../common';
import { useUI, useUIActions, useSession } from '../../store';
import styles from './Header.module.css';

export const Header: React.FC = () => {
  const { isPlanMode, connectionStatus } = useUI();
  const { togglePlanMode, toggleSidebar } = useUIActions();
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
      </div>
    </header>
  );
};
