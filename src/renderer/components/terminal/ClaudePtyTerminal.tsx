/**
 * Claude PTY Terminal
 *
 * An interactive terminal component for Claude CLI sessions.
 * Uses xterm.js to render the PTY output and handles user input.
 * Auto-shows when Claude needs user interaction (permission prompts, etc.)
 */

import { useEffect, useRef, useCallback, useState } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import '@xterm/xterm/css/xterm.css';
import { useUI, useUIActions } from '../../store';
import { getTerminalTheme } from '../../utils/terminalThemes';
import styles from './ClaudePtyTerminal.module.css';

interface ClaudePtyTerminalProps {
  sessionId: string;
  cwd: string;
  onClose?: () => void;
  resumeSessionId?: string;
  permissionMode?: 'default' | 'plan';
  model?: string;
  allowedTools?: string[];
}

export function ClaudePtyTerminal({
  sessionId,
  cwd,
  onClose,
  resumeSessionId,
  permissionMode,
  model,
  allowedTools,
}: ClaudePtyTerminalProps) {
  const terminalRef = useRef<HTMLDivElement>(null);
  const xtermRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const resizeHandleRef = useRef<HTMLDivElement>(null);
  const sessionCreatedRef = useRef(false);
  const intentionalCloseRef = useRef(false);
  const [isResizing, setIsResizing] = useState(false);
  const [needsInteraction, setNeedsInteraction] = useState(false);
  const [isConnected, setIsConnected] = useState(false);

  const { claudePtyHeight, resolvedTheme } = useUI();
  const { setClaudePtyHeight } = useUIActions();

  // Initialize terminal and create PTY session
  useEffect(() => {
    if (!terminalRef.current) return;

    // Skip if xterm already exists (shouldn't happen, but just in case)
    if (xtermRef.current) {
      console.log(`[ClaudePtyTerminal] Skipping xterm init - already exists`);
      return;
    }

    console.log(`[ClaudePtyTerminal] Initializing xterm for session ${sessionId}`);

    // Create xterm.js terminal
    const terminal = new Terminal({
      cursorBlink: true,
      fontSize: 14,
      fontFamily: 'Consolas, "Courier New", monospace',
      theme: getTerminalTheme(resolvedTheme),
      scrollback: 10000,
      allowProposedApi: true,
    });

    const fitAddon = new FitAddon();
    terminal.loadAddon(fitAddon);

    terminal.open(terminalRef.current);
    fitAddon.fit();

    xtermRef.current = terminal;
    fitAddonRef.current = fitAddon;

    // Create the Claude PTY session (idempotent - main process handles existing sessions)
    const cols = terminal.cols;
    const rows = terminal.rows;

    window.claudeUI.claudePty.create(sessionId, {
      cwd,
      cols,
      rows,
      resumeSessionId,
      permissionMode,
      model,
      allowedTools,
    }).then(({ pid }) => {
      console.log(`[ClaudePtyTerminal] PTY session ${sessionId} ready with PID ${pid}`);
      setIsConnected(true);
      sessionCreatedRef.current = true;
    }).catch((err) => {
      console.error('[ClaudePtyTerminal] Failed to create session:', err);
      terminal.writeln('\x1b[31mFailed to create Claude session\x1b[0m');
    });

    // Handle user input - forward to PTY
    terminal.onData((data) => {
      window.claudeUI.claudePty.write(sessionId, data);
    });

    // Handle terminal resize
    const resizeObserver = new ResizeObserver(() => {
      if (fitAddonRef.current && xtermRef.current) {
        fitAddonRef.current.fit();
        window.claudeUI.claudePty.resize(
          sessionId,
          xtermRef.current.cols,
          xtermRef.current.rows
        );
      }
    });
    resizeObserver.observe(terminalRef.current);

    return () => {
      resizeObserver.disconnect();
    };
  }, [sessionId, cwd, resumeSessionId, permissionMode, model, allowedTools, resolvedTheme]);

  // Update theme when it changes
  useEffect(() => {
    if (xtermRef.current) {
      xtermRef.current.options.theme = getTerminalTheme(resolvedTheme);
    }
  }, [resolvedTheme]);

  // Subscribe to PTY data
  useEffect(() => {
    const cleanupData = window.claudeUI.claudePty.onData(({ id, data }) => {
      if (id === sessionId && xtermRef.current) {
        xtermRef.current.write(data);
      }
    });

    const cleanupExit = window.claudeUI.claudePty.onExit(({ id, exitCode }) => {
      if (id === sessionId && xtermRef.current) {
        xtermRef.current.writeln(`\r\n\x1b[33mClaude session ended (exit code: ${exitCode})\x1b[0m`);
        setIsConnected(false);
      }
    });

    const cleanupInteraction = window.claudeUI.claudePty.onInteraction(({ id, needsInteraction: needs }) => {
      if (id === sessionId) {
        setNeedsInteraction(needs);
      }
    });

    return () => {
      cleanupData();
      cleanupExit();
      cleanupInteraction();
    };
  }, [sessionId]);

  // Cleanup on unmount - only destroy PTY if intentionally closed
  useEffect(() => {
    const currentSessionId = sessionId;

    return () => {
      console.log(`[ClaudePtyTerminal] Cleanup for session ${currentSessionId}, intentional=${intentionalCloseRef.current}`);

      // Always dispose xterm on unmount
      if (xtermRef.current) {
        xtermRef.current.dispose();
        xtermRef.current = null;
      }
      fitAddonRef.current = null;

      // Only destroy the PTY session if it was an intentional close (user clicked X)
      // React Strict Mode will unmount/remount but we keep the PTY alive
      if (intentionalCloseRef.current) {
        console.log(`[ClaudePtyTerminal] Destroying PTY session ${currentSessionId}`);
        window.claudeUI.claudePty.destroy(currentSessionId).catch(console.error);
        sessionCreatedRef.current = false;
      }
    };
  }, [sessionId]);

  // Handle close button
  const handleClose = useCallback(() => {
    intentionalCloseRef.current = true;
    window.claudeUI.claudePty.destroy(sessionId).catch(console.error);
    if (xtermRef.current) {
      xtermRef.current.dispose();
      xtermRef.current = null;
    }
    fitAddonRef.current = null;
    sessionCreatedRef.current = false;
    onClose?.();
  }, [sessionId, onClose]);

  // Handle interrupt (Ctrl+C)
  const handleInterrupt = useCallback(() => {
    window.claudeUI.claudePty.interrupt(sessionId).catch(console.error);
  }, [sessionId]);

  // Handle resize drag
  const handleResizeMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);

    const startY = e.clientY;
    const startHeight = claudePtyHeight;

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const deltaY = startY - moveEvent.clientY;
      const newHeight = Math.max(150, Math.min(600, startHeight + deltaY));
      setClaudePtyHeight(newHeight);
    };

    const handleMouseUp = () => {
      setIsResizing(false);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      // Fit terminal after resize
      setTimeout(() => {
        if (fitAddonRef.current && xtermRef.current) {
          fitAddonRef.current.fit();
          window.claudeUI.claudePty.resize(
            sessionId,
            xtermRef.current.cols,
            xtermRef.current.rows
          );
        }
      }, 0);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  }, [claudePtyHeight, setClaudePtyHeight, sessionId]);

  // Focus terminal on mount
  useEffect(() => {
    if (xtermRef.current) {
      xtermRef.current.focus();
    }
  }, []);

  return (
    <div className={styles.container} style={{ height: claudePtyHeight }}>
      <div
        ref={resizeHandleRef}
        className={`${styles.resizeHandle} ${isResizing ? styles.resizing : ''}`}
        onMouseDown={handleResizeMouseDown}
      />
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <div className={`${styles.statusIndicator} ${needsInteraction ? styles.needsInput : ''}`} />
          <span className={styles.title}>Claude Interactive</span>
          {needsInteraction && (
            <span className={styles.interactionBadge}>
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                <path d="M6 1v6M6 9v1" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
              </svg>
              Input Needed
            </span>
          )}
        </div>
        <div className={styles.actions}>
          <button
            className={styles.actionButton}
            onClick={handleInterrupt}
            title="Interrupt (Ctrl+C)"
            disabled={!isConnected}
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <rect x="3" y="3" width="8" height="8" rx="1" stroke="currentColor" strokeWidth="1.5"/>
            </svg>
          </button>
          <button
            className={`${styles.actionButton} ${styles.danger}`}
            onClick={handleClose}
            title="Close Terminal"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M2 2L12 12M12 2L2 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
            </svg>
          </button>
        </div>
      </div>
      <div ref={terminalRef} className={styles.terminal} />
    </div>
  );
}
