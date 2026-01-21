import { spawn, ChildProcess } from 'child_process';
import { createInterface, Interface } from 'readline';
import { EventEmitter } from 'events';
import { getClaudePath } from '../utils/paths';
import {
  CLIEvent,
  CLIServiceEvent,
  CLIExitEvent,
  CLIErrorEvent,
  StartSessionOptions,
  AssistantContentBlock
} from '../../shared/types';

interface ActiveSession {
  process: ChildProcess | null;
  readline: Interface | null;
  sessionId: string;
  cliSessionId: string | null;  // CLI's session ID for resuming conversations
  cwd: string;
  isPlanMode: boolean;
  isProcessing: boolean;
  allowedTools: Set<string>;  // Tools that have been granted permission
  model: string | null;  // Model to use (opus, sonnet, haiku)
  pendingRetryMessage: string | null;  // Message to retry after current process finishes
}

export class ClaudeCliService extends EventEmitter {
  private activeSessions: Map<string, ActiveSession> = new Map();
  private claudePath: string;

  constructor() {
    super();
    this.claudePath = getClaudePath();
    console.log(`Claude CLI path: ${this.claudePath}`);
  }

  /**
   * Start a new Claude CLI session (creates session entry, doesn't spawn yet)
   */
  async startSession(options: StartSessionOptions): Promise<string> {
    const sessionId = options.sessionId || crypto.randomUUID();

    console.log(`Creating Claude CLI session: ${sessionId}`);
    console.log(`Working directory: ${options.cwd}`);

    // Initialize with auto-allowed tools from global settings
    const initialTools = new Set<string>();
    if (options.initialAllowedTools && options.initialAllowedTools.length > 0) {
      for (const tool of options.initialAllowedTools) {
        // For Bash tool, use wildcard pattern to allow all commands
        const toolPattern = tool === 'Bash' ? 'Bash(*)' : tool;
        initialTools.add(toolPattern);
      }
      console.log(`Initial allowed tools: ${Array.from(initialTools).join(', ')}`);
    }

    const session: ActiveSession = {
      process: null,
      readline: null,
      sessionId,
      cliSessionId: options.resumeSessionId || null,  // Use provided ID for resume, or set when CLI responds
      cwd: options.cwd,
      isPlanMode: options.permissionMode === 'plan',
      isProcessing: false,
      allowedTools: initialTools,
      model: null,
      pendingRetryMessage: null
    };

    if (options.resumeSessionId) {
      console.log(`Session will resume CLI session: ${options.resumeSessionId}`);
    }

    this.activeSessions.set(sessionId, session);

    return sessionId;
  }

  /**
   * Send user message to session - spawns a new process per message
   */
  sendMessage(sessionId: string, message: string): void {
    const session = this.activeSessions.get(sessionId);
    if (!session) {
      throw new Error(`No active session: ${sessionId}`);
    }

    if (session.isProcessing) {
      // Store as pending retry - will be executed when current process finishes
      console.log(`[sendMessage] Session ${sessionId} is busy, queuing message for retry after current process`);
      session.pendingRetryMessage = message;
      return;
    }

    session.isProcessing = true;
    console.log(`\n========== SENDING MESSAGE ==========`);
    console.log(`Session: ${sessionId}`);
    console.log(`Message: "${message.slice(0, 100)}${message.length > 100 ? '...' : ''}"`);
    console.log(`Allowed Tools (${session.allowedTools.size}):`);
    Array.from(session.allowedTools).forEach((tool, i) => {
      console.log(`  ${i + 1}. ${tool}`);
    });
    console.log(`======================================\n`);

    // Build args array
    const args = this.buildArgs(session, message);
    console.log(`Executing: ${this.claudePath}`);
    console.log(`Args: ${JSON.stringify(args)}`);
    console.log(`CWD: ${session.cwd}`);

    // Use spawn with piped stdio
    const childProcess = spawn(this.claudePath, args, {
      cwd: session.cwd,
      stdio: ['ignore', 'pipe', 'pipe'],  // ignore stdin (CLI in -p mode doesn't need it), pipe stdout/stderr
      env: {
        ...process.env,
        FORCE_COLOR: '0',
        NO_COLOR: '1',
      },
      windowsHide: true
    });

    console.log(`Process spawned with PID: ${childProcess.pid}`);

    if (!childProcess.pid) {
      console.error('Failed to spawn process - no PID');
      session.isProcessing = false;
      const errorEvent: CLIErrorEvent = { sessionId, error: 'Failed to spawn Claude CLI process' };
      this.emit('cli:error', errorEvent);
      return;
    }

    session.process = childProcess;

    this.setupProcessListeners(session);
  }

  private buildArgs(session: ActiveSession, message: string): string[] {
    const args = [
      '-p',
      '--verbose',
      '--output-format', 'stream-json',
      '--dangerously-skip-permissions'  // Bypass CLI permission checks - UI handles permissions
    ];

    // Resume existing conversation if we have CLI session ID
    if (session.cliSessionId) {
      args.push('--resume', session.cliSessionId);
      console.log(`Resuming CLI session: ${session.cliSessionId}`);
    }

    if (session.isPlanMode) {
      args.push('--permission-mode', 'plan');
    }

    // Add model if set
    if (session.model) {
      args.push('--model', session.model);
      console.log(`[buildArgs] Using model: ${session.model}`);
    }

    // Add allowed tools - use = syntax to prevent greedy argument parsing
    if (session.allowedTools.size > 0) {
      const toolsArray = Array.from(session.allowedTools);
      const toolsStr = toolsArray.join(',');
      args.push(`--allowedTools=${toolsStr}`);
      console.log(`[buildArgs] Adding allowed tools: ${toolsStr}`);
    } else {
      console.log(`[buildArgs] No allowed tools for this session`);
    }

    // Add the message as the final positional argument
    args.push(message);

    return args;
  }

  /**
   * Grant permission for a tool (stores for future use)
   * For tools that support command patterns (like Bash), we use wildcard (*) to allow all commands
   */
  allowTool(sessionId: string, toolName: string): boolean {
    const session = this.activeSessions.get(sessionId);
    if (!session) {
      console.error(`[allowTool] No session found for tool permission: ${sessionId}`);
      console.error(`[allowTool] Active sessions: ${Array.from(this.activeSessions.keys()).join(', ')}`);
      return false;
    }

    // For Bash tool, use wildcard pattern to allow all commands
    // CLI expects patterns like "Bash(git:*)" or "Bash(*)" for all
    const toolPattern = toolName === 'Bash' ? 'Bash(*)' : toolName;

    session.allowedTools.add(toolPattern);
    console.log(`[allowTool] Tool '${toolName}' -> pattern '${toolPattern}' allowed for session ${sessionId}`);
    console.log(`[allowTool] Session now has allowed tools: ${Array.from(session.allowedTools).join(', ')}`);

    return true;
  }

  /**
   * Set the model for a session
   */
  setModel(sessionId: string, model: string): boolean {
    const session = this.activeSessions.get(sessionId);
    if (!session) {
      console.error(`[setModel] No session found: ${sessionId}`);
      return false;
    }

    session.model = model;
    console.log(`[setModel] Model set to '${model}' for session ${sessionId}`);
    return true;
  }

  /**
   * Get allowed tools for a session
   */
  getAllowedTools(sessionId: string): string[] {
    const session = this.activeSessions.get(sessionId);
    return session ? Array.from(session.allowedTools) : [];
  }

  /**
   * Sync allowed tools for a session - replaces the entire set
   * Used when global or session permissions change
   */
  syncAllowedTools(sessionId: string, tools: string[]): boolean {
    const session = this.activeSessions.get(sessionId);
    if (!session) {
      console.error(`[syncAllowedTools] No session found: ${sessionId}`);
      return false;
    }

    // Clear and rebuild the set with proper patterns
    session.allowedTools.clear();
    for (const tool of tools) {
      const toolPattern = tool === 'Bash' ? 'Bash(*)' : tool;
      session.allowedTools.add(toolPattern);
    }

    console.log(`[syncAllowedTools] Session ${sessionId} now has tools: ${Array.from(session.allowedTools).join(', ') || 'none'}`);
    return true;
  }

  /**
   * Get all active session IDs
   */
  getActiveSessionIds(): string[] {
    return Array.from(this.activeSessions.keys());
  }

  private setupProcessListeners(session: ActiveSession): void {
    const proc = session.process;
    if (!proc) {
      console.error('setupProcessListeners called with null process');
      return;
    }

    const { sessionId } = session;

    console.log(`Setting up listeners for session ${sessionId}, PID: ${proc.pid}`);

    // Use readline to read stdout line by line
    if (proc.stdout) {
      console.log('Creating readline interface for stdout');

      const rl = createInterface({
        input: proc.stdout,
        crlfDelay: Infinity
      });

      session.readline = rl;

      rl.on('line', (line: string) => {
        console.log(`CLI stdout line [${sessionId}]:`, line.slice(0, 500));

        if (line.trim()) {
          try {
            const event = JSON.parse(line);
            this.handleCliEvent(sessionId, event);
          } catch (e) {
            console.error('Failed to parse JSON line:', line.slice(0, 100), e);
          }
        }
      });

      rl.on('close', () => {
        console.log(`readline closed for session ${sessionId}`);
      });

      rl.on('error', (err) => {
        console.error(`readline error for session ${sessionId}:`, err);
      });
    } else {
      console.error('stdout stream not available');
    }

    // Handle stderr
    if (proc.stderr) {
      proc.stderr.on('data', (chunk: Buffer) => {
        const data = chunk.toString();
        console.error(`CLI stderr [${sessionId}]:`, data);
        this.emit('cli:stderr', { sessionId, data });

        // Check if it's an error that should be shown to user
        if (data.includes('Error:')) {
          const errorEvent: CLIErrorEvent = { sessionId, error: data };
          this.emit('cli:error', errorEvent);
        }
      });
    }

    // Handle process exit
    proc.on('exit', (code, signal) => {
      console.log(`CLI process exited [${sessionId}]: code=${code}, signal=${signal}`);

      session.isProcessing = false;
      session.process = null;
      if (session.readline) {
        session.readline.close();
        session.readline = null;
      }

      const exitEvent: CLIExitEvent = { sessionId, code, signal };
      this.emit('cli:exit', exitEvent);

      // Check for pending retry message (permission was granted while processing)
      if (session.pendingRetryMessage) {
        const retryMessage = session.pendingRetryMessage;
        session.pendingRetryMessage = null;
        console.log(`[exit handler] Found pending retry message, executing retry...`);
        // Use setImmediate to avoid recursion issues
        setImmediate(() => {
          this.sendMessage(sessionId, retryMessage);
        });
      }
    });

    proc.on('error', (error) => {
      console.error(`CLI process error [${sessionId}]:`, error);

      session.isProcessing = false;
      session.process = null;
      if (session.readline) {
        session.readline.close();
        session.readline = null;
      }

      const errorEvent: CLIErrorEvent = { sessionId, error: error.message };
      this.emit('cli:error', errorEvent);
    });

    proc.on('close', (code, signal) => {
      console.log(`CLI process closed [${sessionId}]: code=${code}, signal=${signal}`);
    });
  }

  private handleCliEvent(sessionId: string, event: CLIEvent): void {
    const serviceEvent: CLIServiceEvent = { sessionId, event };

    console.log(`CLI event [${sessionId}]:`, event.type);

    switch (event.type) {
      case 'system':
        // Capture CLI's session ID for future resume
        if (event.session_id) {
          const session = this.activeSessions.get(sessionId);
          if (session && !session.cliSessionId) {
            session.cliSessionId = event.session_id;
            console.log(`Captured CLI session ID: ${event.session_id}`);
          }
        }
        this.emit('cli:system', serviceEvent);
        break;

      case 'stream_event':
        this.emit('cli:stream', serviceEvent);
        break;

      case 'assistant':
        this.emit('cli:assistant', serviceEvent);

        // Check for tool uses and emit tool-use events for UI tracking
        const toolUses = event.message.content.filter(
          (c: AssistantContentBlock) => c.type === 'tool_use'
        );

        for (const toolUse of toolUses) {
          if (toolUse.type === 'tool_use') {
            this.emit('cli:tool-use', {
              sessionId,
              toolUseId: toolUse.id,
              toolName: toolUse.name,
              toolInput: toolUse.input
            });
          }
        }
        break;

      case 'user':
        this.emit('cli:user', serviceEvent);
        break;

      case 'result':
        this.emit('cli:result', serviceEvent);

        // Handle ExitPlanMode in result event
        if (event.permission_denials && event.permission_denials.length > 0) {
          for (const denial of event.permission_denials) {
            if (denial.tool_name === 'ExitPlanMode') {
              console.log(`[handleCliEvent] ExitPlanMode detected - auto-exiting plan mode`);
              const session = this.activeSessions.get(sessionId);
              if (session) {
                session.isPlanMode = false;
              }
              // Emit special event for UI to handle
              this.emit('cli:plan-mode-exit', { sessionId });
            }
          }
        }
        break;

      default:
        this.emit('cli:unknown', serviceEvent);
    }
  }

  /**
   * Set plan mode for a session
   */
  setPlanMode(sessionId: string, enabled: boolean): void {
    const session = this.activeSessions.get(sessionId);
    if (session) {
      session.isPlanMode = enabled;
    }
  }

  /**
   * Check if a session is in plan mode
   */
  isPlanMode(sessionId: string): boolean {
    const session = this.activeSessions.get(sessionId);
    return session?.isPlanMode ?? false;
  }

  /**
   * Interrupt the current execution (like Ctrl+C in CLI)
   * This stops the current process but keeps the session context intact
   * so the user can send a follow-up message
   */
  interruptSession(sessionId: string): boolean {
    const session = this.activeSessions.get(sessionId);
    if (!session) {
      console.warn(`[interruptSession] No session found: ${sessionId}`);
      return false;
    }

    if (!session.process) {
      console.warn(`[interruptSession] No active process for session: ${sessionId}`);
      return false;
    }

    console.log(`[interruptSession] Sending SIGINT to session: ${sessionId}`);

    // Send SIGINT (Ctrl+C equivalent) to gracefully interrupt
    // On Windows, we need to use a different approach
    if (process.platform === 'win32') {
      // On Windows, kill with SIGINT doesn't work the same way
      // We'll use SIGTERM but the conversation context is preserved in the session file
      session.process.kill('SIGTERM');
    } else {
      session.process.kill('SIGINT');
    }

    // Clear any pending retry message since user is interrupting
    session.pendingRetryMessage = null;

    // Emit an interrupt event so UI knows it was interrupted
    this.emit('cli:interrupted', { sessionId });

    return true;
  }

  /**
   * Kill a specific session
   */
  killSession(sessionId: string): void {
    const session = this.activeSessions.get(sessionId);
    if (session) {
      console.log(`Killing session: ${sessionId}`);
      if (session.readline) {
        session.readline.close();
      }
      if (session.process) {
        session.process.kill('SIGTERM');
      }
      this.activeSessions.delete(sessionId);
    }
  }

  /**
   * Kill all active sessions
   */
  killAllSessions(): void {
    console.log(`Killing all ${this.activeSessions.size} sessions`);
    for (const [, session] of this.activeSessions) {
      if (session.readline) {
        session.readline.close();
      }
      if (session.process) {
        session.process.kill('SIGTERM');
      }
    }
    this.activeSessions.clear();
  }

  /**
   * Check if a session is active
   */
  isSessionActive(sessionId: string): boolean {
    return this.activeSessions.has(sessionId);
  }

  /**
   * Get the Claude CLI executable path
   */
  getClaudePath(): string {
    return this.claudePath;
  }
}
