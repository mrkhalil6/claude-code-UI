import { spawn } from 'child_process';
import { getClaudePath } from '../utils/paths';

export interface CommandResult {
  success: boolean;
  output: string;
  error?: string;
}

/**
 * Service for executing CLI slash commands and capturing their output.
 * This allows the UI to route commands directly to the CLI instead of
 * implementing command logic locally.
 */
export class CliCommandService {
  private claudePath: string;

  constructor() {
    this.claudePath = getClaudePath();
  }

  /**
   * Execute a CLI slash command and return the result.
   *
   * @param command - The command name without the leading slash (e.g., 'help', 'mcp')
   * @param args - Additional arguments for the command
   * @param cwd - Working directory for the command
   * @param sessionId - Optional CLI session ID for session-specific commands
   * @returns Promise resolving to the command result
   */
  async executeCommand(
    command: string,
    args: string,
    cwd: string,
    sessionId?: string
  ): Promise<CommandResult> {
    // Check if this is a built-in command that needs special handling
    const builtinResult = this.handleBuiltinCommand(command, args, cwd);
    if (builtinResult) {
      return builtinResult;
    }

    return new Promise((resolve) => {
      const cliArgs = this.buildCommandArgs(command, args, sessionId);

      console.log(`[CliCommandService] Executing: ${this.claudePath} ${cliArgs.join(' ')}`);
      console.log(`[CliCommandService] CWD: ${cwd}`);

      const proc = spawn(this.claudePath, cliArgs, {
        cwd,
        stdio: ['pipe', 'pipe', 'pipe'],
        env: {
          ...process.env,
          FORCE_COLOR: '0',
          NO_COLOR: '1',
        },
        windowsHide: true
      });

      const stdoutLines: string[] = [];
      const stderrLines: string[] = [];

      proc.stdout?.on('data', (chunk: Buffer) => {
        stdoutLines.push(chunk.toString());
      });

      proc.stderr?.on('data', (chunk: Buffer) => {
        stderrLines.push(chunk.toString());
      });

      proc.on('error', (error) => {
        console.error(`[CliCommandService] Process error:`, error);
        resolve({
          success: false,
          output: '',
          error: error.message
        });
      });

      proc.on('close', (code) => {
        const stdout = stdoutLines.join('');
        const stderr = stderrLines.join('');

        console.log(`[CliCommandService] Command exited with code: ${code}`);

        if (code !== 0 && stderr) {
          resolve({
            success: false,
            output: this.parseCliOutput(stdout),
            error: stderr
          });
        } else {
          resolve({
            success: true,
            output: this.parseCliOutput(stdout),
            error: stderr || undefined
          });
        }
      });

      // Send empty input and close stdin to signal we're done
      proc.stdin?.end();
    });
  }

  /**
   * Handle built-in CLI commands that don't work as skills in -p mode.
   * These commands need to be executed via CLI subcommands or handled specially.
   */
  private handleBuiltinCommand(
    command: string,
    args: string,
    cwd: string
  ): Promise<CommandResult> | null {
    // Map of built-in commands to their CLI subcommand equivalents
    // These commands don't work as skills in -p mode, so we use CLI subcommands
    // Only include commands that actually exist as CLI subcommands
    const builtinCommands: Record<string, { subcommand: string[] }> = {
      'help': { subcommand: ['--help'] },
      'mcp': { subcommand: args ? ['mcp', ...args.split(' ').filter(a => a)] : ['mcp', 'list'] },
      'doctor': { subcommand: ['doctor'] },
    };

    const builtin = builtinCommands[command];
    if (!builtin) {
      return null; // Not a built-in, use normal skill execution
    }

    return new Promise((resolve) => {
      const cliArgs = [...builtin.subcommand];

      console.log(`[CliCommandService] Executing builtin: ${this.claudePath} ${cliArgs.join(' ')}`);
      console.log(`[CliCommandService] CWD: ${cwd}`);

      const proc = spawn(this.claudePath, cliArgs, {
        cwd,
        stdio: ['pipe', 'pipe', 'pipe'],
        env: {
          ...process.env,
          FORCE_COLOR: '0',
          NO_COLOR: '1',
        },
        windowsHide: true
      });

      const stdoutLines: string[] = [];
      const stderrLines: string[] = [];

      proc.stdout?.on('data', (chunk: Buffer) => {
        stdoutLines.push(chunk.toString());
      });

      proc.stderr?.on('data', (chunk: Buffer) => {
        stderrLines.push(chunk.toString());
      });

      proc.on('error', (error) => {
        console.error(`[CliCommandService] Process error:`, error);
        resolve({
          success: false,
          output: '',
          error: error.message
        });
      });

      proc.on('close', (code) => {
        const stdout = stdoutLines.join('');
        const stderr = stderrLines.join('');

        console.log(`[CliCommandService] Builtin command exited with code: ${code}`);
        console.log(`[CliCommandService] Raw stdout length: ${stdout.length}`);
        console.log(`[CliCommandService] Has newlines: ${stdout.includes('\n')}, Has CR: ${stdout.includes('\r')}`);

        // For built-in commands, stdout is plain text (not JSON)
        // Normalize line endings (Windows uses \r\n)
        let output = stdout.replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim();

        if (!output) {
          output = stderr.replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim() || 'Command completed.';
        }

        // Wrap verbose CLI output in code block for better formatting
        const verboseCommands = ['help', 'doctor', 'config', 'mcp', 'memory', 'permissions'];
        if (output && verboseCommands.includes(command)) {
          output = '```\n' + output + '\n```';
        }

        console.log(`[CliCommandService] Final output has newlines: ${output.includes('\n')}`);

        resolve({
          success: code === 0,
          output,
          error: code !== 0 ? stderr : undefined
        });
      });

      proc.stdin?.end();
    });
  }

  /**
   * Build CLI arguments for a slash command.
   * Uses the CLI's print mode to execute commands and capture output.
   */
  private buildCommandArgs(command: string, args: string, sessionId?: string): string[] {
    const cliArgs: string[] = [];

    // For slash commands, we send them as a message to the CLI
    // The CLI will interpret the slash command
    const fullCommand = args ? `/${command} ${args}` : `/${command}`;

    // Use print mode for single command execution
    cliArgs.push('-p');

    // Verbose mode is required when using stream-json output format
    cliArgs.push('--verbose');

    // Use JSON output for structured parsing
    cliArgs.push('--output-format', 'stream-json');

    // Skip permission prompts - we just want the command output
    cliArgs.push('--dangerously-skip-permissions');

    // If we have a session ID, use it to get session-specific info
    if (sessionId) {
      cliArgs.push('--resume', sessionId);
    }

    // Add the command as the message
    cliArgs.push(fullCommand);

    return cliArgs;
  }

  /**
   * Parse CLI JSON output into human-readable text.
   * The CLI outputs JSON events that we need to extract text from.
   */
  private parseCliOutput(rawOutput: string): string {
    const outputParts: string[] = [];
    const lines = rawOutput.split('\n');

    for (const line of lines) {
      if (!line.trim()) continue;

      try {
        const event = JSON.parse(line);

        switch (event.type) {
          case 'assistant':
            // Extract text content from assistant message
            if (event.message?.content) {
              for (const block of event.message.content) {
                if (block.type === 'text' && block.text) {
                  outputParts.push(this.cleanCliText(block.text));
                }
              }
            }
            break;

          case 'user':
            // User events can contain compaction summaries and other content
            if (event.message?.content) {
              // Content can be a string or an array
              if (typeof event.message.content === 'string') {
                outputParts.push(this.cleanCliText(event.message.content));
              } else if (Array.isArray(event.message.content)) {
                for (const block of event.message.content) {
                  if (block.type === 'text' && block.text) {
                    outputParts.push(this.cleanCliText(block.text));
                  } else if (typeof block === 'string') {
                    outputParts.push(this.cleanCliText(block));
                  }
                }
              }
            }
            break;

          case 'result':
            // Check for result text
            if (event.result && typeof event.result === 'string') {
              outputParts.push(this.cleanCliText(event.result));
            }
            // Also check for subtype with message
            if (event.subtype === 'success' && event.message) {
              outputParts.push(this.cleanCliText(event.message));
            }
            break;

          case 'system':
            // System messages - only include actual message content, not status updates
            if (event.subtype === 'status' && event.status === 'compacting') {
              outputParts.push('Compacting conversation...');
            } else if (event.message && typeof event.message === 'string') {
              outputParts.push(this.cleanCliText(event.message));
            }
            break;

          default:
            // Ignore other event types (stream_event, etc.)
            break;
        }
      } catch {
        // Non-JSON line - might be direct output, include if not empty
        const trimmed = line.trim();
        if (trimmed && !trimmed.startsWith('{')) {
          outputParts.push(this.cleanCliText(trimmed));
        }
      }
    }

    // Join and clean up the output
    const result = outputParts.join('\n').trim();

    // If no structured output was found, return the raw output (cleaned)
    if (!result) {
      return this.cleanCliText(rawOutput.trim());
    }

    return result;
  }

  /**
   * Clean CLI text by removing internal tags and formatting
   */
  private cleanCliText(text: string): string {
    if (!text) return '';

    // Remove internal CLI tags like <local-command-stdout>, <local-command-stderr>, etc.
    let cleaned = text
      .replace(/<local-command-stdout>/g, '')
      .replace(/<\/local-command-stdout>/g, '')
      .replace(/<local-command-stderr>/g, '')
      .replace(/<\/local-command-stderr>/g, '')
      .replace(/<command-name>.*?<\/command-name>/g, '')
      .replace(/<command-message>.*?<\/command-message>/g, '')
      .replace(/<command-args>.*?<\/command-args>/g, '')
      .replace(/<local-command-caveat>.*?<\/local-command-caveat>/gs, '')
      .replace(/<system-reminder>[\s\S]*?<\/system-reminder>/g, '');

    return cleaned.trim();
  }

  /**
   * Get the Claude CLI path
   */
  getClaudePath(): string {
    return this.claudePath;
  }
}
