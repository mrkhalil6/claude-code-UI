import React, { useEffect } from 'react';
import { Header } from './Header';
import { Sidebar } from './Sidebar';
import { StatusBar } from './StatusBar';
import { ChatContainer } from '../chat/ChatContainer';
import { GitDiffPanel } from '../git';
import { TerminalPanel, ClaudePtyTerminal } from '../terminal';
import { useUI, useUIActions, useSession } from '../../store';
import styles from './Layout.module.css';

export const Layout: React.FC = () => {
  const { showGitDiff, showTerminal, showClaudePty, claudePtySessionId } = useUI();
  const { setShowGitDiff, closeClaudePtySession, setClaudePtyNeedsInteraction, setShowClaudePty } = useUIActions();
  const { activeProjectPath, currentCwd } = useSession();

  // Listen for Claude PTY interaction events to auto-show the terminal
  useEffect(() => {
    const cleanup = window.claudeUI.claudePty.onInteraction(({ id, needsInteraction }) => {
      if (id === claudePtySessionId) {
        setClaudePtyNeedsInteraction(needsInteraction);
        // Auto-show terminal when interaction is needed
        if (needsInteraction) {
          setShowClaudePty(true);
        }
      }
    });

    return cleanup;
  }, [claudePtySessionId, setClaudePtyNeedsInteraction, setShowClaudePty]);

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
          {showClaudePty && claudePtySessionId && (
            <ClaudePtyTerminal
              sessionId={claudePtySessionId}
              cwd={currentCwd || activeProjectPath || '.'}
              onClose={closeClaudePtySession}
            />
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
