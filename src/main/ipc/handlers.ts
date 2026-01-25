import { ipcMain, BrowserWindow, dialog, app } from 'electron';
import { readFile } from 'fs/promises';
import { homedir } from 'os';
import { spawn } from 'child_process';
import { IPC_CHANNELS } from '../../shared/ipc-channels';
import { ClaudeCliService } from '../services/claude-cli.service';
import { CliCommandService } from '../services/cli-command.service';
import { SessionLoaderService } from '../services/session-loader.service';
import { CredentialsService } from '../services/credentials.service';
import { McpService, McpServer } from '../services/mcp.service';
import { GitService } from '../services/git.service';
import { SkillsService } from '../services/skills.service';
import { HooksService } from '../services/hooks.service';
import { terminalService } from '../services/terminal.service';
import { claudePtyService, ClaudePtyOptions } from '../services/claude-pty.service';
import { StartSessionOptions, SkillPayload, HookPayload } from '../../shared/types';

export function registerIpcHandlers(
  cliService: ClaudeCliService,
  sessionLoader: SessionLoaderService,
  _credentialsService: CredentialsService,
  mcpService: McpService,
  gitService: GitService,
  skillsService: SkillsService,
  hooksService: HooksService
): void {
  // ===== Session Management =====

  ipcMain.handle(IPC_CHANNELS.SESSIONS_GET_ALL, async () => {
    return sessionLoader.getAllProjects();
  });

  ipcMain.handle(IPC_CHANNELS.SESSION_LOAD, async (_, { projectPath, sessionId }: { projectPath: string; sessionId: string }) => {
    return sessionLoader.loadFullSession(projectPath, sessionId);
  });

  ipcMain.handle(IPC_CHANNELS.SESSION_DELETE, async (_, { projectPath, sessionId }: { projectPath: string; sessionId: string }) => {
    return sessionLoader.deleteSession(projectPath, sessionId);
  });

  ipcMain.handle(IPC_CHANNELS.SESSION_RENAME, async (_, { projectPath, sessionId, newName }: { projectPath: string; sessionId: string; newName: string }) => {
    return sessionLoader.renameSession(projectPath, sessionId, newName);
  });

  // ===== CLI Session Control =====

  ipcMain.handle(IPC_CHANNELS.CLI_START_SESSION, async (_, options: StartSessionOptions) => {
    return cliService.startSession(options);
  });

  ipcMain.handle(IPC_CHANNELS.CLI_SEND_MESSAGE, async (_, { sessionId, message }: { sessionId: string; message: string }) => {
    cliService.sendMessage(sessionId, message);
  });

  ipcMain.handle(IPC_CHANNELS.CLI_INTERRUPT_SESSION, async (_, { sessionId }: { sessionId: string }) => {
    return cliService.interruptSession(sessionId);
  });

  ipcMain.handle(IPC_CHANNELS.CLI_KILL_SESSION, async (_, { sessionId }: { sessionId: string }) => {
    cliService.killSession(sessionId);
  });

  ipcMain.handle(IPC_CHANNELS.CLI_SET_PLAN_MODE, async (_, { sessionId, enabled }: { sessionId: string; enabled: boolean }) => {
    cliService.setPlanMode(sessionId, enabled);
  });

  // ===== Plan =====

  ipcMain.handle(IPC_CHANNELS.PLAN_GET, async (_, { slug }: { slug: string }) => {
    return sessionLoader.getPlanInfo(slug);
  });

  ipcMain.handle(IPC_CHANNELS.PLAN_EXISTS, async (_, { slug }: { slug: string }) => {
    return sessionLoader.getPlanFilePath(slug) !== null;
  });

  // ===== CLI Models =====

  ipcMain.handle(IPC_CHANNELS.CLI_GET_MODELS, async (): Promise<{ id: string; name: string }[]> => {
    // Return the available Claude models
    // These are the standard models available via --model flag
    return [
      { id: 'opus', name: 'Opus 4.5' },
      { id: 'sonnet', name: 'Sonnet 4.5' },
      { id: 'haiku', name: 'Haiku 4.5' }
    ];
  });

  ipcMain.handle(IPC_CHANNELS.CLI_SET_MODEL, async (_, { sessionId, model }: { sessionId: string; model: string }) => {
    console.log(`[IPC] CLI_SET_MODEL called: session=${sessionId}, model=${model}`);
    const result = cliService.setModel(sessionId, model);
    console.log(`[IPC] CLI_SET_MODEL result: ${result}`);
    return result;
  });

  // ===== CLI Command Execution =====
  const cliCommandService = new CliCommandService();

  ipcMain.handle(IPC_CHANNELS.CLI_EXECUTE_COMMAND, async (_, { command, args, cwd, sessionId }: { command: string; args: string; cwd: string; sessionId?: string }) => {
    console.log(`[IPC] CLI_EXECUTE_COMMAND called: command=/${command}, args=${args}, cwd=${cwd}`);
    const result = await cliCommandService.executeCommand(command, args, cwd, sessionId);
    console.log(`[IPC] CLI_EXECUTE_COMMAND result: success=${result.success}`);
    return result;
  });

  // ===== File System =====

  ipcMain.handle(IPC_CHANNELS.FS_READ_FILE, async (_, path: string) => {
    try {
      return await readFile(path, 'utf-8');
    } catch (error) {
      throw new Error(`Failed to read file: ${path}`);
    }
  });

  ipcMain.handle(IPC_CHANNELS.FS_SELECT_DIRECTORY, async () => {
    const result = await dialog.showOpenDialog({
      properties: ['openDirectory']
    });

    if (result.canceled) {
      return null;
    }

    return result.filePaths[0];
  });

  ipcMain.handle(IPC_CHANNELS.FS_GET_HOME_DIR, () => {
    return homedir();
  });

  // ===== App =====

  ipcMain.handle(IPC_CHANNELS.APP_GET_VERSION, () => {
    return app.getVersion();
  });

  // ===== Forward CLI Events to Renderer =====

  const forwardToRenderer = (channel: string) => {
    return (data: unknown) => {
      const windows = BrowserWindow.getAllWindows();
      windows.forEach(win => {
        if (!win.isDestroyed()) {
          win.webContents.send(channel, data);
        }
      });
    };
  };

  cliService.on('cli:system', forwardToRenderer(IPC_CHANNELS.CLI_EVENT_SYSTEM));
  cliService.on('cli:stream', forwardToRenderer(IPC_CHANNELS.CLI_EVENT_STREAM));
  cliService.on('cli:assistant', forwardToRenderer(IPC_CHANNELS.CLI_EVENT_ASSISTANT));
  cliService.on('cli:user', forwardToRenderer(IPC_CHANNELS.CLI_EVENT_USER));
  cliService.on('cli:result', forwardToRenderer(IPC_CHANNELS.CLI_EVENT_RESULT));
  cliService.on('cli:error', forwardToRenderer(IPC_CHANNELS.CLI_EVENT_ERROR));
  cliService.on('cli:exit', forwardToRenderer(IPC_CHANNELS.CLI_EVENT_EXIT));
  cliService.on('cli:interrupted', forwardToRenderer(IPC_CHANNELS.CLI_EVENT_INTERRUPTED));
  cliService.on('cli:plan-mode-exit', forwardToRenderer(IPC_CHANNELS.CLI_EVENT_PLAN_MODE_EXIT));

  // ===== MCP Servers (Global) =====

  ipcMain.handle(IPC_CHANNELS.MCP_GET_GLOBAL_SERVERS, async () => {
    await mcpService.loadGlobal();
    return mcpService.getGlobalServers();
  });

  ipcMain.handle(IPC_CHANNELS.MCP_ADD_GLOBAL_SERVER, async (_, { name, server }: { name: string; server: McpServer }) => {
    await mcpService.loadGlobal();
    await mcpService.addGlobalServer(name, server);
    return mcpService.getGlobalServers();
  });

  ipcMain.handle(IPC_CHANNELS.MCP_REMOVE_GLOBAL_SERVER, async (_, { name }: { name: string }) => {
    await mcpService.loadGlobal();
    await mcpService.removeGlobalServer(name);
    return mcpService.getGlobalServers();
  });

  // ===== MCP Server Status & Actions =====

  ipcMain.handle(IPC_CHANNELS.MCP_GET_SERVER_STATUS, async (_, { name }: { name: string }): Promise<{ status: string; scope: string; type: string; url?: string; command?: string }> => {
    return new Promise((resolve) => {
      const claudePath = cliService.getClaudePath();
      if (!claudePath) {
        resolve({ status: 'error', scope: 'unknown', type: 'unknown' });
        return;
      }

      const proc = spawn(claudePath, ['mcp', 'get', name], {
        stdio: ['pipe', 'pipe', 'pipe']
      });

      let output = '';
      proc.stdout.on('data', (data) => {
        output += data.toString();
      });

      proc.on('close', () => {
        // Parse the output
        const statusMatch = output.match(/Status:\s*(.+)/);
        const scopeMatch = output.match(/Scope:\s*(.+)/);
        const typeMatch = output.match(/Type:\s*(\w+)/);
        const urlMatch = output.match(/URL:\s*(.+)/);
        const commandMatch = output.match(/Command:\s*(.+)/);

        let status = 'unknown';
        if (statusMatch) {
          const statusText = statusMatch[1].trim();
          if (statusText.includes('Needs authentication')) {
            status = 'needs_auth';
          } else if (statusText.includes('Failed') || statusText.includes('✗')) {
            status = 'error';
          } else if (statusText.includes('✓') || statusText.includes('Connected')) {
            status = 'connected';
          } else {
            status = statusText;
          }
        }

        resolve({
          status,
          scope: scopeMatch ? scopeMatch[1].trim() : 'unknown',
          type: typeMatch ? typeMatch[1].trim() : 'unknown',
          url: urlMatch ? urlMatch[1].trim() : undefined,
          command: commandMatch ? commandMatch[1].trim() : undefined
        });
      });

      proc.on('error', () => {
        resolve({ status: 'error', scope: 'unknown', type: 'unknown' });
      });
    });
  });

  ipcMain.handle(IPC_CHANNELS.MCP_AUTHENTICATE_SERVER, async (_, { name }: { name: string }): Promise<{ success: boolean; error?: string }> => {
    // Spawn an interactive terminal with Claude CLI to handle MCP authentication
    // The CLI has built-in OAuth flow that we leverage instead of reimplementing
    const claudePath = cliService.getClaudePath();
    if (!claudePath) {
      return { success: false, error: 'Claude CLI not found' };
    }

    try {
      const platform = process.platform;

      // Create a command that opens Claude and immediately runs /mcp
      // User can then select the server and authenticate
      if (platform === 'win32') {
        // Windows: open new cmd window with claude
        // start "" opens with empty title, then cmd /k keeps window open
        const command = `start "" cmd /k "${claudePath}"`;
        spawn(command, [], {
          shell: true,
          detached: true,
          stdio: 'ignore'
        });
      } else if (platform === 'darwin') {
        // macOS: open Terminal with claude
        spawn('osascript', [
          '-e', `tell application "Terminal" to do script "${claudePath}"`
        ], {
          detached: true,
          stdio: 'ignore'
        });
      } else {
        // Linux: try common terminal emulators
        const terminals = ['gnome-terminal', 'konsole', 'xterm', 'x-terminal-emulator'];
        let spawned = false;

        for (const term of terminals) {
          try {
            if (term === 'gnome-terminal') {
              spawn(term, ['--', claudePath], { detached: true, stdio: 'ignore' });
            } else if (term === 'konsole') {
              spawn(term, ['-e', claudePath], { detached: true, stdio: 'ignore' });
            } else {
              spawn(term, ['-e', claudePath], { detached: true, stdio: 'ignore' });
            }
            spawned = true;
            break;
          } catch {
            continue;
          }
        }

        if (!spawned) {
          return { success: false, error: 'Could not find a terminal emulator' };
        }
      }

      console.log(`Opened terminal for MCP authentication: ${name}`);
      console.log('User should run /mcp command, select the server, and authenticate');

      return { success: true };
    } catch (error) {
      console.error('Failed to open terminal for MCP auth:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to open terminal'
      };
    }
  });

  // ===== MCP Servers (Project) =====

  ipcMain.handle(IPC_CHANNELS.MCP_GET_PROJECT_SERVERS, async (_, { projectPath }: { projectPath: string }) => {
    await mcpService.loadProject(projectPath);
    return mcpService.getProjectServers();
  });

  ipcMain.handle(IPC_CHANNELS.MCP_ADD_PROJECT_SERVER, async (_, { name, server, projectPath }: { name: string; server: McpServer; projectPath: string }) => {
    mcpService.setCurrentProject(projectPath);
    await mcpService.addProjectServer(name, server);
    return mcpService.getProjectServers();
  });

  ipcMain.handle(IPC_CHANNELS.MCP_REMOVE_PROJECT_SERVER, async (_, { name, projectPath }: { name: string; projectPath: string }) => {
    mcpService.setCurrentProject(projectPath);
    await mcpService.removeProjectServer(name);
    return mcpService.getProjectServers();
  });

  // ===== MCP Servers (Legacy - backward compatibility) =====

  ipcMain.handle(IPC_CHANNELS.MCP_GET_SERVERS, async (_, { projectPath }: { projectPath?: string } = {}) => {
    if (projectPath) {
      await mcpService.loadProject(projectPath);
    }
    return mcpService.getServers();
  });

  ipcMain.handle(IPC_CHANNELS.MCP_GET_SERVER, async (_, { name }: { name: string }) => {
    return mcpService.getServer(name);
  });

  ipcMain.handle(IPC_CHANNELS.MCP_ADD_SERVER, async (_, { name, server, projectPath }: { name: string; server: McpServer; projectPath?: string }) => {
    if (projectPath) {
      mcpService.setCurrentProject(projectPath);
    }
    await mcpService.addServer(name, server);
    return mcpService.getServers();
  });

  ipcMain.handle(IPC_CHANNELS.MCP_REMOVE_SERVER, async (_, { name, projectPath }: { name: string; projectPath?: string }) => {
    if (projectPath) {
      mcpService.setCurrentProject(projectPath);
    }
    await mcpService.removeServer(name);
    return mcpService.getServers();
  });

  // ===== Git Operations =====

  ipcMain.handle(IPC_CHANNELS.GIT_GET_STATUS, async (_, { cwd }: { cwd: string }) => {
    return gitService.getStatus(cwd);
  });

  ipcMain.handle(IPC_CHANNELS.GIT_GET_FILE_DIFF, async (_, { cwd, filePath }: { cwd: string; filePath: string }) => {
    return gitService.getFileDiff(cwd, filePath);
  });

  ipcMain.handle(IPC_CHANNELS.GIT_STAGE_FILE, async (_, { cwd, filePath }: { cwd: string; filePath: string }) => {
    return gitService.stageFile(cwd, filePath);
  });

  ipcMain.handle(IPC_CHANNELS.GIT_STAGE_ALL, async (_, { cwd }: { cwd: string }) => {
    return gitService.stageAll(cwd);
  });

  ipcMain.handle(IPC_CHANNELS.GIT_UNSTAGE_FILE, async (_, { cwd, filePath }: { cwd: string; filePath: string }) => {
    return gitService.unstageFile(cwd, filePath);
  });

  ipcMain.handle(IPC_CHANNELS.GIT_UNSTAGE_ALL, async (_, { cwd }: { cwd: string }) => {
    return gitService.unstageAll(cwd);
  });

  ipcMain.handle(IPC_CHANNELS.GIT_DISCARD_FILE, async (_, { cwd, filePath }: { cwd: string; filePath: string }) => {
    return gitService.discardFile(cwd, filePath);
  });

  ipcMain.handle(IPC_CHANNELS.GIT_DISCARD_ALL, async (_, { cwd }: { cwd: string }) => {
    return gitService.discardAll(cwd);
  });

  ipcMain.handle(IPC_CHANNELS.GIT_COMMIT, async (_, { cwd, message }: { cwd: string; message: string }) => {
    return gitService.commit(cwd, message);
  });

  ipcMain.handle(IPC_CHANNELS.GIT_PUSH, async (_, { cwd, remote, branch }: { cwd: string; remote?: string; branch?: string }) => {
    return gitService.push(cwd, remote, branch);
  });

  ipcMain.handle(IPC_CHANNELS.GIT_PULL, async (_, { cwd, remote, branch }: { cwd: string; remote?: string; branch?: string }) => {
    return gitService.pull(cwd, remote, branch);
  });

  ipcMain.handle(IPC_CHANNELS.GIT_GET_LOG, async (_, { cwd, limit }: { cwd: string; limit?: number }) => {
    return gitService.getLog(cwd, limit);
  });

  ipcMain.handle(IPC_CHANNELS.GIT_SAVE_FILE, async (_, { cwd, filePath, content }: { cwd: string; filePath: string; content: string }) => {
    return gitService.saveFile(cwd, filePath, content);
  });

  ipcMain.handle(IPC_CHANNELS.GIT_RESOLVE_CONFLICT, async (_, { cwd, filePath }: { cwd: string; filePath: string }) => {
    return gitService.resolveConflict(cwd, filePath);
  });

  ipcMain.handle(IPC_CHANNELS.GIT_ABORT_MERGE, async (_, { cwd }: { cwd: string }) => {
    return gitService.abortMerge(cwd);
  });

  ipcMain.handle(IPC_CHANNELS.GIT_STASH, async (_, { cwd, message }: { cwd: string; message?: string }) => {
    return gitService.stash(cwd, message);
  });

  ipcMain.handle(IPC_CHANNELS.GIT_STASH_POP, async (_, { cwd, index }: { cwd: string; index?: number }) => {
    return gitService.stashPop(cwd, index);
  });

  ipcMain.handle(IPC_CHANNELS.GIT_STASH_LIST, async (_, { cwd }: { cwd: string }) => {
    return gitService.stashList(cwd);
  });

  ipcMain.handle(IPC_CHANNELS.GIT_STASH_DROP, async (_, { cwd, index }: { cwd: string; index?: number }) => {
    return gitService.stashDrop(cwd, index);
  });

  // ===== Terminal =====

  ipcMain.handle(IPC_CHANNELS.TERMINAL_CREATE, async (_, { id, cwd }: { id: string; cwd?: string }) => {
    return terminalService.createTerminal(id, cwd);
  });

  ipcMain.handle(IPC_CHANNELS.TERMINAL_WRITE, async (_, { id, data }: { id: string; data: string }) => {
    return terminalService.writeToTerminal(id, data);
  });

  ipcMain.handle(IPC_CHANNELS.TERMINAL_RESIZE, async (_, { id, cols, rows }: { id: string; cols: number; rows: number }) => {
    return terminalService.resizeTerminal(id, cols, rows);
  });

  ipcMain.handle(IPC_CHANNELS.TERMINAL_DESTROY, async (_, { id }: { id: string }) => {
    return terminalService.destroyTerminal(id);
  });

  // ===== Skills =====

  ipcMain.handle(IPC_CHANNELS.SKILLS_LIST, async () => {
    return skillsService.listSkills();
  });

  ipcMain.handle(IPC_CHANNELS.SKILLS_GET, async (_, { id }: { id: string }) => {
    return skillsService.getSkill(id);
  });

  ipcMain.handle(IPC_CHANNELS.SKILLS_CREATE, async (_, { payload }: { payload: SkillPayload }) => {
    return skillsService.createSkill(payload);
  });

  ipcMain.handle(IPC_CHANNELS.SKILLS_UPDATE, async (_, { payload }: { payload: SkillPayload }) => {
    return skillsService.updateSkill(payload);
  });

  ipcMain.handle(IPC_CHANNELS.SKILLS_DELETE, async (_, { id }: { id: string }) => {
    return skillsService.deleteSkill(id);
  });

  // ===== Hooks =====

  ipcMain.handle(IPC_CHANNELS.HOOKS_LIST, async () => {
    await hooksService.loadHooks();
    return hooksService.getHooks();
  });

  ipcMain.handle(IPC_CHANNELS.HOOKS_ADD, async (_, { payload }: { payload: HookPayload }) => {
    return hooksService.addHook(payload);
  });

  ipcMain.handle(IPC_CHANNELS.HOOKS_UPDATE, async (_, { payload }: { payload: HookPayload }) => {
    return hooksService.updateHook(payload);
  });

  ipcMain.handle(IPC_CHANNELS.HOOKS_DELETE, async (_, { id }: { id: string }) => {
    return hooksService.removeHook(id);
  });

  // ===== Session File Watching =====

  sessionLoader.startWatching((event, path) => {
    const windows = BrowserWindow.getAllWindows();
    windows.forEach(win => {
      if (!win.isDestroyed()) {
        win.webContents.send(IPC_CHANNELS.SESSIONS_CHANGED, { event, path });
      }
    });
  });

  // ===== Claude PTY (Interactive Terminal) =====

  ipcMain.handle(IPC_CHANNELS.CLAUDE_PTY_CREATE, async (_, { id, options }: { id: string; options: ClaudePtyOptions }) => {
    return claudePtyService.createSession(id, options);
  });

  ipcMain.on(IPC_CHANNELS.CLAUDE_PTY_WRITE, (_, { id, data }: { id: string; data: string }) => {
    claudePtyService.write(id, data);
  });

  ipcMain.handle(IPC_CHANNELS.CLAUDE_PTY_SEND_COMMAND, async (_, { id, command }: { id: string; command: string }) => {
    return claudePtyService.sendCommand(id, command);
  });

  ipcMain.handle(IPC_CHANNELS.CLAUDE_PTY_INTERRUPT, async (_, { id }: { id: string }) => {
    return claudePtyService.interrupt(id);
  });

  ipcMain.on(IPC_CHANNELS.CLAUDE_PTY_RESIZE, (_, { id, cols, rows }: { id: string; cols: number; rows: number }) => {
    claudePtyService.resize(id, cols, rows);
  });

  ipcMain.handle(IPC_CHANNELS.CLAUDE_PTY_DESTROY, async (_, { id }: { id: string }) => {
    return claudePtyService.destroy(id);
  });
}
