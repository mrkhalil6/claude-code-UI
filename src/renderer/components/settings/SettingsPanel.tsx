import React from 'react';
import { PermissionsManager } from '../permissions';
import { useUI, useUIActions } from '../../store';
import styles from './SettingsPanel.module.css';

export const SettingsPanel: React.FC = () => {
  const { showSettings } = useUI();
  const { setShowSettings } = useUIActions();

  if (!showSettings) return null;

  return (
    <div className={styles.overlay} onClick={() => setShowSettings(false)}>
      <div className={styles.panel} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <h2 className={styles.title}>Settings</h2>
          <button className={styles.closeButton} onClick={() => setShowSettings(false)}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className={styles.content}>
          <section className={styles.section}>
            <PermissionsManager type="global" />
          </section>

          <section className={styles.section}>
            <h3 className={styles.sectionTitle}>About</h3>
            <div className={styles.aboutInfo}>
              <p>Claude Code UI</p>
              <p className={styles.version}>Version 1.0.0</p>
              <p className={styles.description}>
                A modern desktop GUI for Claude Code CLI
              </p>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
};
