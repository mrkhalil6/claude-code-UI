/**
 * Claude PTY Service
 *
 * Manages Claude CLI sessions using real pseudo-terminals (PTY)
 * This ensures isatty() returns true for stdin/stdout/stderr,
 * enabling full interactive mode with permission prompts, MCP auth, etc.
 */

import * as pty from 'node-pty';
import { EventEmitter } from 'events';
import { BrowserWindow, app } from 'electron';
import { platform, homedir } from 'os';
import { resolve } from 'path';
import { getClaudePath } from '../utils/paths';
import { IPC_CHANNELS } from '../../shared/ipc-channels';

export interface ClaudePtyOptions {
  cwd: string;
  cols?: number;
  rows?: number;
  resumeSessionId?: string;
  permissionMode?: 'default' | 'plan';
  model?: string;
  allowedTools?: string[];
}

interface ClaudePtySession {
  id: string;
  ptyProcess: pty.IPty;
  cwd: string;
  isInteractive: boolean;
  lastOutput: string;
  interactionDetected: boolean;
}

// Patterns that indicate Claude is waiting for user interaction
const INTERACTION_PATTERNS = [
  /\?\s*\[y\/n\]/i,                    // Yes/No prompts
  /\?\s*\(y\/n\)/i,                    // Yes/No prompts alternate
  /Press Enter to continue/i,          // Press enter prompts
  /Allow\s+\w+\s+tool/i,              // Tool permission prompts
  /Grant permission/i,                  // Permission prompts
  /Do you want to/i,                   // Confirmation prompts
  /Would you like to/i,                // Confirmation prompts
  /Select an option/i,                 // Selection prompts
  /Choose/i,                           // Choice prompts
  /\[\d+\]/,                           // Numbered selection (like [1] [2] [3])
  /\>\s*$/,                            // Generic prompt
  /:\s*$/,                             // Input prompt ending with colon
  /OAuth|authenticate|login/i,         // Authentication prompts
  /MCP.*authentication/i,              // MCP auth prompts
];

export class ClaudePtyService extends EventEmitter {
  private sessions: Map<string, ClaudePtySession> = new Map();
  private claudePath: string;

  constructor() {
    super();
    this.claudePath = getClaudePath();
    console.log(`[ClaudePty] Claude CLI path: ${this.claudePath}`);
  }

  private getMainWindow(): BrowserWindow | null {
    const windows = BrowserWindow.getAllWindows();
    return windows.length > 0 ? windows[0] : null;
  }

  /**
   * Create a new Claude PTY session
   * If a session with this ID already exists, returns its info (idempotent)
   */
  createSession(id: string, options: ClaudePtyOptions): { id: string; pid: number } {
    // Check if session already exists (idempotent creation)
    const existingSession = this.sessions.get(id);
    if (existingSession) {
      console.log(`[ClaudePty] Session ${id} already exists, returning existing PID ${existingSession.ptyProcess.pid}`);
      return { id, pid: existingSession.ptyProcess.pid };
    }

    const isWindows = platform() === 'win32';

    // Resolve the working directory
    let workingDir = options.cwd;
    if (!workingDir || workingDir === '.' || workingDir === '') {
      // Use app's current directory or home directory
      workingDir = app.getPath('home') || homedir() || process.cwd();
    } else {
      // Resolve relative paths
      workingDir = resolve(workingDir);
    }
    console.log(`[ClaudePty] Resolved CWD: ${workingDir}`);

    // Build Claude arguments
    const claudeArgs: string[] = [];

    // Resume existing session if provided
    if (options.resumeSessionId) {
      claudeArgs.push('--resume', options.resumeSessionId);
    }

    // Set permission mode
    if (options.permissionMode === 'plan') {
      claudeArgs.push('--permission-mode', 'plan');
    }

    // Set model if specified
    if (options.model) {
      claudeArgs.push('--model', options.model);
    }

    // Add allowed tools
    if (options.allowedTools && options.allowedTools.length > 0) {
      const toolsStr = options.allowedTools.join(',');
      claudeArgs.push(`--allowedTools=${toolsStr}`);
    }

    // Environment for proper terminal behavior
    const env = {
      ...process.env,
      TERM: 'xterm-256color',
      COLORTERM: 'truecolor',
      FORCE_COLOR: '1',
      // Ensure Claude knows it's in a real terminal
      CLAUDE_INTERACTIVE: '1',
    };

    console.log(`[ClaudePty] Creating session ${id}`);
    console.log(`[ClaudePty] Executable: ${this.claudePath}`);
    console.log(`[ClaudePty] Args: ${JSON.stringify(claudeArgs)}`);
    console.log(`[ClaudePty] CWD: ${workingDir}`);

    // Spawn Claude directly using node-pty (no shell wrapper needed)
    // This gives us a real PTY where isatty() returns true
    const ptyProcess = pty.spawn(this.claudePath, claudeArgs, {
      name: 'xterm-256color',
      cols: options.cols || 120,
      rows: options.rows || 30,
      cwd: workingDir,
      env: env as { [key: string]: string },
      ...(isWindows && { useConpty: true }),
    });

    // Store the session
    const session: ClaudePtySession = {
      id,
      ptyProcess,
      cwd: workingDir,
      isInteractive: true,
      lastOutput: '',
      interactionDetected: false,
    };

    this.sessions.set(id, session);

    // Forward PTY data to renderer
    ptyProcess.onData((data) => {
      // Update last output buffer (keep last 2000 chars for pattern matching)
      session.lastOutput = (session.lastOutput + data).slice(-2000);

      // Check for interaction patterns
      const needsInteraction = this.detectInteraction(session.lastOutput);
      if (needsInteraction && !session.interactionDetected) {
        session.interactionDetected = true;
        this.emitToRenderer(IPC_CHANNELS.CLAUDE_PTY_INTERACTION, { id, needsInteraction: true });
        console.log(`[ClaudePty] Interaction detected in session ${id}`);
      }

      // Always emit data to renderer
      this.emitToRenderer(IPC_CHANNELS.CLAUDE_PTY_DATA, { id, data });
    });

    // Handle PTY exit
    ptyProcess.onExit(({ exitCode, signal }) => {
      console.log(`[ClaudePty] Session ${id} exited with code ${exitCode}, signal ${signal}`);
      this.sessions.delete(id);
      this.emitToRenderer(IPC_CHANNELS.CLAUDE_PTY_EXIT, { id, exitCode, signal });
    });

    console.log(`[ClaudePty] Created session ${id} with PID ${ptyProcess.pid}`);

    return { id, pid: ptyProcess.pid };
  }

  /**
   * Detect if Claude is waiting for user interaction
   */
  private detectInteraction(output: string): boolean {
    // Check each pattern
    for (const pattern of INTERACTION_PATTERNS) {
      if (pattern.test(output)) {
        return true;
      }
    }
    return false;
  }

  /**
   * Reset interaction detection (call after user provides input)
   */
  resetInteractionDetection(id: string): void {
    const session = this.sessions.get(id);
    if (session) {
      session.interactionDetected = false;
      session.lastOutput = '';
    }
  }

  /**
   * Write data to a Claude PTY session
   */
  write(id: string, data: string): boolean {
    const session = this.sessions.get(id);
    if (!session) {
      console.error(`[ClaudePty] Session ${id} not found`);
      return false;
    }

    session.ptyProcess.write(data);

    // Reset interaction detection after user input
    if (data.includes('\r') || data.includes('\n')) {
      this.resetInteractionDetection(id);
    }

    return true;
  }

  /**
   * Send a command to Claude (simulates typing + Enter)
   */
  sendCommand(id: string, command: string): boolean {
    const session = this.sessions.get(id);
    if (!session) {
      console.error(`[ClaudePty] Session ${id} not found for sendCommand`);
      return false;
    }

    // Write the command followed by Enter
    session.ptyProcess.write(command + '\r');
    this.resetInteractionDetection(id);

    return true;
  }

  /**
   * Send Ctrl+C to interrupt current operation
   */
  interrupt(id: string): boolean {
    const session = this.sessions.get(id);
    if (!session) {
      console.error(`[ClaudePty] Session ${id} not found for interrupt`);
      return false;
    }

    // Send SIGINT via Ctrl+C character
    session.ptyProcess.write('\x03');
    return true;
  }

  /**
   * Resize a Claude PTY session
   */
  resize(id: string, cols: number, rows: number): boolean {
    const session = this.sessions.get(id);
    if (!session) {
      console.error(`[ClaudePty] Session ${id} not found for resize`);
      return false;
    }

    session.ptyProcess.resize(cols, rows);
    return true;
  }

  /**
   * Destroy a Claude PTY session
   */
  destroy(id: string): boolean {
    const session = this.sessions.get(id);
    if (!session) {
      return false;
    }

    session.ptyProcess.kill();
    this.sessions.delete(id);
    console.log(`[ClaudePty] Destroyed session ${id}`);
    return true;
  }

  /**
   * Destroy all Claude PTY sessions
   */
  destroyAll(): void {
    for (const [id, session] of this.sessions) {
      session.ptyProcess.kill();
      console.log(`[ClaudePty] Destroyed session ${id}`);
    }
    this.sessions.clear();
  }

  /**
   * Get all active session IDs
   */
  getSessionIds(): string[] {
    return Array.from(this.sessions.keys());
  }

  /**
   * Check if a session exists
   */
  hasSession(id: string): boolean {
    return this.sessions.has(id);
  }

  /**
   * Emit event to renderer process
   */
  private emitToRenderer(channel: string, data: unknown): void {
    const mainWindow = this.getMainWindow();
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send(channel, data);
    }
  }
}

export const claudePtyService = new ClaudePtyService();
