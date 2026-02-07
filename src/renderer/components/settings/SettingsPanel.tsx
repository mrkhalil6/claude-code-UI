import React, { useState } from 'react';
import { McpManager } from './McpManager';
import { SkillsManager } from './SkillsManager';
import { HooksManager } from './HooksManager';
import { ColorCustomizer } from './ColorCustomizer';
import { ThemeToggle } from '../common';
import { useUI, useUIActions } from '../../store';
import { useTheme } from '../../hooks/useTheme';
import styles from './SettingsPanel.module.css';

type SettingsTab = 'appearance' | 'mcp' | 'skills' | 'hooks' | 'about';

export const SettingsPanel: React.FC = () => {
  const { showSettings } = useUI();
  const { setShowSettings } = useUIActions();
  const { themeMode, setThemeMode } = useTheme();
  const [activeTab, setActiveTab] = useState<SettingsTab>('appearance');

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

        <div className={styles.tabs}>
          <button
            className={`${styles.tab} ${activeTab === 'appearance' ? styles.activeTab : ''}`}
            onClick={() => setActiveTab('appearance')}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="5" />
              <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
            </svg>
            Appearance
          </button>
          <button
            className={`${styles.tab} ${activeTab === 'mcp' ? styles.activeTab : ''}`}
            onClick={() => setActiveTab('mcp')}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
              <line x1="8" y1="21" x2="16" y2="21" />
              <line x1="12" y1="17" x2="12" y2="21" />
            </svg>
            MCP Servers
          </button>
          <button
            className={`${styles.tab} ${activeTab === 'skills' ? styles.activeTab : ''}`}
            onClick={() => setActiveTab('skills')}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
            </svg>
            Skills
          </button>
          <button
            className={`${styles.tab} ${activeTab === 'hooks' ? styles.activeTab : ''}`}
            onClick={() => setActiveTab('hooks')}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
              <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
            </svg>
            Hooks
          </button>
          <button
            className={`${styles.tab} ${activeTab === 'about' ? styles.activeTab : ''}`}
            onClick={() => setActiveTab('about')}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="16" x2="12" y2="12" />
              <line x1="12" y1="8" x2="12.01" y2="8" />
            </svg>
            About
          </button>
        </div>

        <div className={styles.content}>
          {activeTab === 'appearance' && (
            <>
              <section className={styles.section}>
                <h3 className={styles.sectionTitle}>Theme</h3>
                <div className={styles.settingRow}>
                  <div className={styles.settingInfo}>
                    <span className={styles.settingLabel}>Color Theme</span>
                    <span className={styles.settingDescription}>
                      Choose light, dark, or match your system preference
                    </span>
                  </div>
                  <ThemeToggle
                    value={themeMode}
                    onChange={setThemeMode}
                    size="md"
                  />
                </div>
              </section>
              <section className={styles.section}>
                <h3 className={styles.sectionTitle}>Custom Colors</h3>
                <ColorCustomizer />
              </section>
            </>
          )}

          {activeTab === 'mcp' && (
            <section className={styles.section}>
              <McpManager />
            </section>
          )}

          {activeTab === 'skills' && (
            <section className={styles.section}>
              <SkillsManager />
            </section>
          )}

          {activeTab === 'hooks' && (
            <section className={styles.section}>
              <HooksManager />
            </section>
          )}

          {activeTab === 'about' && (
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
          )}
        </div>
      </div>
    </div>
  );
};
