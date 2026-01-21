import React from 'react';
import { Toggle, ThemeToggle } from '../common';
import { useUI, useUIActions, useSession } from '../../store';
import { useTheme } from '../../hooks/useTheme';
import styles from './Header.module.css';

export const Header: React.FC = () => {
  const { isPlanMode, connectionStatus } = useUI();
  const { togglePlanMode, toggleSidebar, setShowSettings, setShowGitDiff } = useUIActions();
  const { currentCwd, activeSessionId } = useSession();
  const { themeMode, setThemeMode } = useTheme();

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

        <ThemeToggle
          value={themeMode}
          onChange={setThemeMode}
          size="sm"
        />

        <button
          className={styles.gitButton}
          onClick={() => setShowGitDiff(true)}
          aria-label="Git Changes"
          title="View Git Changes"
          disabled={!currentCwd}
        >
          <svg width="18" height="18" viewBox="0 0 92 92" fill="currentColor">
            <path d="M90.156 41.965L50.036 1.848a5.913 5.913 0 00-8.368 0l-8.332 8.332 10.566 10.566a7.03 7.03 0 017.178 1.69 7.043 7.043 0 011.67 7.277l10.187 10.184a7.051 7.051 0 017.307 1.67 7.064 7.064 0 11-9.97 9.968 7.064 7.064 0 01-1.53-7.66l-9.5-9.497v24.997a7.063 7.063 0 011.86 1.333 7.063 7.063 0 11-9.957 0 7.063 7.063 0 011.86-1.333V34.108a7.063 7.063 0 01-1.86-1.333 7.064 7.064 0 01-1.53-7.66L28.93 14.6l-27.09 27.09a5.924 5.924 0 000 8.37l40.12 40.118a5.913 5.913 0 008.368 0l39.828-39.83a5.924 5.924 0 000-8.383z"/>
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
