import React, { useEffect, useRef } from 'react';
import { Header } from './Header';
import { Sidebar } from './Sidebar';
import { StatusBar } from './StatusBar';
import { ChatContainer } from '../chat/ChatContainer';
import { GitDiffPanel } from '../git';
import { TerminalPanel, ClaudePtyTerminal } from '../terminal';
import { PlanPanel } from '../plan';
import { useUI, useUIActions, useSession } from '../../store';
import styles from './Layout.module.css';

export const Layout: React.FC = () => {
  const { showGitDiff, showTerminal, showClaudePty, claudePtySessionId, claudePtySubcommand, claudePtySubcommandArgs, claudePtySendAsSlashCommand, showPlanPanel, activePlanSlug } = useUI();
  const { setShowGitDiff, closeClaudePtySession, setClaudePtyNeedsInteraction, setShowClaudePty, setClaudePtySessionId, closePlanPanel } = useUIActions();
  const { activeProjectPath, currentCwd, cliSessionId } = useSession();

  // Track previous cliSessionId to detect changes
  const prevCliSessionIdRef = useRef<string | null>(null);

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

  // When the selected chat changes (cliSessionId), restart the terminal to resume the new conversation
  useEffect(() => {
    // Skip on initial mount
    if (prevCliSessionIdRef.current === null) {
      prevCliSessionIdRef.current = cliSessionId;
      return;
    }

    // Check if cliSessionId actually changed
    if (prevCliSessionIdRef.current !== cliSessionId && showClaudePty && claudePtySessionId) {
      console.log(`[Layout] Chat changed from ${prevCliSessionIdRef.current} to ${cliSessionId}, restarting terminal`);

      // Destroy the old PTY session
      window.claudeUI.claudePty.destroy(claudePtySessionId).catch(console.error);

      // Create a new PTY session ID
      const newSessionId = `claude-pty-${Date.now()}`;
      setClaudePtySessionId(newSessionId);
    }

    prevCliSessionIdRef.current = cliSessionId;
  }, [cliSessionId, showClaudePty, claudePtySessionId, setClaudePtySessionId]);

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
              resumeSessionId={claudePtySubcommand ? undefined : (cliSessionId || undefined)}
              subcommand={claudePtySubcommand || undefined}
              subcommandArgs={claudePtySubcommandArgs || undefined}
              sendAsSlashCommand={claudePtySendAsSlashCommand ?? undefined}
            />
          )}
        </main>
      </div>

      <StatusBar />

      {showGitDiff && (
        <GitDiffPanel onClose={() => setShowGitDiff(false)} />
      )}

      {showPlanPanel && activePlanSlug && (
        <PlanPanel slug={activePlanSlug} onClose={closePlanPanel} />
      )}
    </div>
  );
};
