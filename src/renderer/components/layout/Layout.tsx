import React from 'react';
import { Header } from './Header';
import { Sidebar } from './Sidebar';
import { StatusBar } from './StatusBar';
import { ChatContainer } from '../chat/ChatContainer';
import { GitDiffPanel } from '../git';
import { useUI, useUIActions } from '../../store';
import styles from './Layout.module.css';

export const Layout: React.FC = () => {
  const { showGitDiff } = useUI();
  const { setShowGitDiff } = useUIActions();

  return (
    <div className={styles.layout}>
      <Header />

      <div className={styles.body}>
        <Sidebar />
        <main className={styles.main}>
          <ChatContainer />
        </main>
      </div>

      <StatusBar />

      {showGitDiff && (
        <GitDiffPanel onClose={() => setShowGitDiff(false)} />
      )}
    </div>
  );
};
