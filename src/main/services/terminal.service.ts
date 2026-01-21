/**
 * Terminal Service
 *
 * Manages pseudo-terminal processes using node-pty
 */

import * as pty from 'node-pty';
import { BrowserWindow } from 'electron';
import * as os from 'os';
import { IPC_CHANNELS } from '../../shared/ipc-channels';

interface TerminalInstance {
  id: string;
  ptyProcess: pty.IPty;
  cwd: string;
}

export class TerminalService {
  private terminals: Map<string, TerminalInstance> = new Map();

  private getMainWindow(): BrowserWindow | null {
    const windows = BrowserWindow.getAllWindows();
    return windows.length > 0 ? windows[0] : null;
  }

  createTerminal(id: string, cwd?: string): { id: string; pid: number } {
    const shell = process.platform === 'win32'
      ? 'powershell.exe'
      : process.env.SHELL || '/bin/bash';

    const shellArgs = process.platform === 'win32'
      ? []
      : ['--login'];

    const workingDir = cwd || os.homedir();

    const ptyProcess = pty.spawn(shell, shellArgs, {
      name: 'xterm-256color',
      cols: 80,
      rows: 24,
      cwd: workingDir,
      env: process.env as { [key: string]: string }
    });

    // Store the terminal instance
    this.terminals.set(id, {
      id,
      ptyProcess,
      cwd: workingDir
    });

    // Forward data from PTY to renderer
    ptyProcess.onData((data) => {
      const mainWindow = this.getMainWindow();
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send(IPC_CHANNELS.TERMINAL_DATA, { id, data });
      }
    });

    // Handle PTY exit
    ptyProcess.onExit(({ exitCode, signal }) => {
      console.log(`[Terminal] Process ${id} exited with code ${exitCode}, signal ${signal}`);
      this.terminals.delete(id);
      const mainWindow = this.getMainWindow();
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send(IPC_CHANNELS.TERMINAL_EXIT, { id, exitCode, signal });
      }
    });

    console.log(`[Terminal] Created terminal ${id} with PID ${ptyProcess.pid}`);

    return { id, pid: ptyProcess.pid };
  }

  writeToTerminal(id: string, data: string): boolean {
    const terminal = this.terminals.get(id);
    if (!terminal) {
      console.error(`[Terminal] Terminal ${id} not found`);
      return false;
    }

    terminal.ptyProcess.write(data);
    return true;
  }

  resizeTerminal(id: string, cols: number, rows: number): boolean {
    const terminal = this.terminals.get(id);
    if (!terminal) {
      console.error(`[Terminal] Terminal ${id} not found for resize`);
      return false;
    }

    terminal.ptyProcess.resize(cols, rows);
    return true;
  }

  destroyTerminal(id: string): boolean {
    const terminal = this.terminals.get(id);
    if (!terminal) {
      return false;
    }

    terminal.ptyProcess.kill();
    this.terminals.delete(id);
    console.log(`[Terminal] Destroyed terminal ${id}`);
    return true;
  }

  destroyAllTerminals(): void {
    for (const [id, terminal] of this.terminals) {
      terminal.ptyProcess.kill();
      console.log(`[Terminal] Destroyed terminal ${id}`);
    }
    this.terminals.clear();
  }

  getTerminalIds(): string[] {
    return Array.from(this.terminals.keys());
  }
}

export const terminalService = new TerminalService();
