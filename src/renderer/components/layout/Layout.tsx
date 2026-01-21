import React from 'react';
import { Header } from './Header';
import { Sidebar } from './Sidebar';
import { StatusBar } from './StatusBar';
import { ChatContainer } from '../chat/ChatContainer';
import { GitDiffPanel } from '../git';
import { TerminalPanel } from '../terminal';
import { useUI, useUIActions, useSession } from '../../store';
import styles from './Layout.module.css';

export const Layout: React.FC = () => {
  const { showGitDiff, showTerminal } = useUI();
  const { setShowGitDiff } = useUIActions();
  const { activeProjectPath } = useSession();

  return (
    <div className={styles.layout}>
      <Header />

      <div className={styles.body}>
        <Sidebar />
        <main className={styles.main}>
          <div className={styles.mainContent}>
            <ChatContainer />
          </div>
          {showTerminal && (
            <TerminalPanel cwd={activeProjectPath || undefined} />
          )}
        </main>
      </div>

      <StatusBar />

      {showGitDiff && (
        <GitDiffPanel onClose={() => setShowGitDiff(false)} />
      )}
    </div>
  );
};
