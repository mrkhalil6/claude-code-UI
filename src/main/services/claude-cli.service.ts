import { spawn, ChildProcess } from 'child_process';
import { createInterface, Interface } from 'readline';
import { EventEmitter } from 'events';
import { getClaudePath } from '../utils/paths';
import {
  CLIEvent,
  CLIServiceEvent,
  CLIPermissionRequiredEvent,
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

    const session: ActiveSession = {
      process: null,
      readline: null,
      sessionId,
      cliSessionId: options.resumeSessionId || null,  // Use provided ID for resume, or set when CLI responds
      cwd: options.cwd,
      isPlanMode: options.permissionMode === 'plan',
      isProcessing: false,
      allowedTools: new Set<string>(),
      model: null
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
      console.warn(`Session ${sessionId} is already processing a message`);
      return;
    }

    session.isProcessing = true;
    console.log(`[sendMessage] Session ${sessionId}`);
    console.log(`[sendMessage] Session allowedTools: ${Array.from(session.allowedTools).join(', ') || 'none'}`);
    console.log(`[sendMessage] Message: ${message.slice(0, 100)}`);

    // Build args array
    const args = this.buildArgs(session, message);
    console.log(`Executing: ${this.claudePath}`);
    console.log(`Args: ${JSON.stringify(args)}`);
    console.log(`CWD: ${session.cwd}`);

    // Use spawn with piped stdio - no shell needed
    const childProcess = spawn(this.claudePath, args, {
      cwd: session.cwd,
      stdio: ['inherit', 'pipe', 'pipe'],  // inherit stdin, pipe stdout/stderr
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
      '--output-format', 'stream-json'
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

    // Add allowed tools using = syntax to bind the value and prevent greedy parsing
    if (session.allowedTools.size > 0) {
      const toolsList = Array.from(session.allowedTools).join(',');
      args.push(`--allowedTools=${toolsList}`);
      console.log(`[buildArgs] Adding allowed tools flag: --allowedTools=${toolsList}`);
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

        // Check for tool uses that might need permissions
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

        // Check for permission denial in user event (tool_use_result is a string when permission denied)
        if (typeof event.tool_use_result === 'string' && event.tool_use_result.includes('permission')) {
          const content = event.message.content[0];
          if (content && content.type === 'tool_result') {
            const permissionEvent: CLIPermissionRequiredEvent = {
              sessionId,
              toolUseId: content.tool_use_id,
              toolName: 'Unknown',
              toolInput: {}
            };
            this.emit('cli:permission-required', permissionEvent);
          }
        }
        break;

      case 'result':
        this.emit('cli:result', serviceEvent);

        if (event.permission_denials && event.permission_denials.length > 0) {
          console.log(`[handleCliEvent] Permission denials found: ${event.permission_denials.length}`);
          for (const denial of event.permission_denials) {
            console.log(`[handleCliEvent] Permission denial: tool_name="${denial.tool_name}", tool_use_id="${denial.tool_use_id}"`);
            console.log(`[handleCliEvent] Tool input:`, JSON.stringify(denial.tool_input).slice(0, 200));
            const permissionEvent: CLIPermissionRequiredEvent = {
              sessionId,
              toolUseId: denial.tool_use_id,
              toolName: denial.tool_name,
              toolInput: denial.tool_input
            };
            this.emit('cli:permission-required', permissionEvent);
          }
        }
        break;

      default:
        this.emit('cli:unknown', serviceEvent);
    }
  }

  /**
   * Grant permission for a tool use
   */
  grantPermission(sessionId: string, _toolUseId: string, _scope: 'once' | 'session' | 'always'): void {
    const session = this.activeSessions.get(sessionId);
    if (!session?.process) {
      console.warn(`No active process for permission grant: ${sessionId}`);
      return;
    }

    session.process.stdin?.write('y\n');
  }

  /**
   * Deny permission for a tool use
   */
  denyPermission(sessionId: string, _toolUseId: string): void {
    const session = this.activeSessions.get(sessionId);
    if (!session?.process) {
      console.warn(`No active process for permission denial: ${sessionId}`);
      return;
    }

    session.process.stdin?.write('n\n');
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

  /**
   * Get list of active session IDs
   */
  getActiveSessionIds(): string[] {
    return Array.from(this.activeSessions.keys());
  }
}
