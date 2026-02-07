import { useEffect, useRef, useCallback, useState } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import '@xterm/xterm/css/xterm.css';
import { useStore } from '../../store';
import { getTerminalTheme } from '../../utils/terminalThemes';
import styles from './TerminalPanel.module.css';

interface TerminalPanelProps {
  cwd?: string;
}

export function TerminalPanel({ cwd }: TerminalPanelProps) {
  const terminalRef = useRef<HTMLDivElement>(null);
  const xtermRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const terminalIdRef = useRef<string | null>(null);
  const resizeHandleRef = useRef<HTMLDivElement>(null);
  const [isResizing, setIsResizing] = useState(false);

  const { showTerminal, setShowTerminal, terminalHeight, setTerminalHeight, resolvedTheme, customColors } = useStore();

  // Initialize terminal
  useEffect(() => {
    if (!showTerminal || !terminalRef.current || xtermRef.current) return;

    const terminal = new Terminal({
      cursorBlink: true,
      fontSize: 14,
      fontFamily: 'Consolas, "Courier New", monospace',
      theme: getTerminalTheme(resolvedTheme, customColors[resolvedTheme])
    });

    const fitAddon = new FitAddon();
    terminal.loadAddon(fitAddon);

    terminal.open(terminalRef.current);
    fitAddon.fit();

    xtermRef.current = terminal;
    fitAddonRef.current = fitAddon;

    // Generate a unique terminal ID
    const terminalId = `terminal-${Date.now()}`;
    terminalIdRef.current = terminalId;

    // Create the terminal process in main
    window.claudeUI.terminal.create(terminalId, cwd).then(({ pid }) => {
      console.log(`[Terminal] Created with PID ${pid}`);
    }).catch((err) => {
      console.error('[Terminal] Failed to create:', err);
      terminal.writeln('\x1b[31mFailed to create terminal process\x1b[0m');
    });

    // Handle user input
    terminal.onData((data) => {
      if (terminalIdRef.current) {
        window.claudeUI.terminal.write(terminalIdRef.current, data);
      }
    });

    // Handle resize
    const resizeObserver = new ResizeObserver(() => {
      if (fitAddonRef.current) {
        fitAddonRef.current.fit();
        if (terminalIdRef.current && xtermRef.current) {
          window.claudeUI.terminal.resize(
            terminalIdRef.current,
            xtermRef.current.cols,
            xtermRef.current.rows
          );
        }
      }
    });
    resizeObserver.observe(terminalRef.current);

    return () => {
      resizeObserver.disconnect();
    };
  }, [showTerminal, cwd, resolvedTheme]);

  // Update terminal theme when resolved theme or custom colors change
  useEffect(() => {
    if (xtermRef.current) {
      xtermRef.current.options.theme = getTerminalTheme(resolvedTheme, customColors[resolvedTheme]);
    }
  }, [resolvedTheme, customColors]);

  // Subscribe to terminal data from main process
  useEffect(() => {
    if (!showTerminal) return;

    const cleanupData = window.claudeUI.terminal.onData(({ id, data }) => {
      if (id === terminalIdRef.current && xtermRef.current) {
        xtermRef.current.write(data);
      }
    });

    const cleanupExit = window.claudeUI.terminal.onExit(({ id, exitCode }) => {
      if (id === terminalIdRef.current && xtermRef.current) {
        xtermRef.current.writeln(`\r\n\x1b[33mProcess exited with code ${exitCode}\x1b[0m`);
      }
    });

    return () => {
      cleanupData();
      cleanupExit();
    };
  }, [showTerminal]);

  // Cleanup on unmount or when terminal is hidden
  useEffect(() => {
    return () => {
      if (terminalIdRef.current) {
        window.claudeUI.terminal.destroy(terminalIdRef.current);
        terminalIdRef.current = null;
      }
      if (xtermRef.current) {
        xtermRef.current.dispose();
        xtermRef.current = null;
      }
      fitAddonRef.current = null;
    };
  }, []);

  // Handle close
  const handleClose = useCallback(() => {
    if (terminalIdRef.current) {
      window.claudeUI.terminal.destroy(terminalIdRef.current);
      terminalIdRef.current = null;
    }
    if (xtermRef.current) {
      xtermRef.current.dispose();
      xtermRef.current = null;
    }
    fitAddonRef.current = null;
    setShowTerminal(false);
  }, [setShowTerminal]);

  // Handle resize drag
  const handleResizeMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);

    const startY = e.clientY;
    const startHeight = terminalHeight;

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const deltaY = startY - moveEvent.clientY;
      const newHeight = Math.max(150, Math.min(600, startHeight + deltaY));
      setTerminalHeight(newHeight);
    };

    const handleMouseUp = () => {
      setIsResizing(false);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      // Fit terminal after resize
      setTimeout(() => {
        if (fitAddonRef.current && xtermRef.current && terminalIdRef.current) {
          fitAddonRef.current.fit();
          window.claudeUI.terminal.resize(
            terminalIdRef.current,
            xtermRef.current.cols,
            xtermRef.current.rows
          );
        }
      }, 0);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  }, [terminalHeight, setTerminalHeight]);

  if (!showTerminal) return null;

  return (
    <div className={styles.container} style={{ height: terminalHeight }}>
      <div
        ref={resizeHandleRef}
        className={`${styles.resizeHandle} ${isResizing ? styles.resizing : ''}`}
        onMouseDown={handleResizeMouseDown}
      />
      <div className={styles.header}>
        <span className={styles.title}>Terminal</span>
        <div className={styles.actions}>
          <button
            className={styles.closeButton}
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
