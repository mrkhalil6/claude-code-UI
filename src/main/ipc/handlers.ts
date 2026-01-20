import { ipcMain, BrowserWindow, dialog, app, shell } from 'electron';
import { readFile } from 'fs/promises';
import { homedir } from 'os';
import { spawn } from 'child_process';
import { IPC_CHANNELS } from '../../shared/ipc-channels';
import { ClaudeCliService } from '../services/claude-cli.service';
import { SessionLoaderService } from '../services/session-loader.service';
import { CredentialsService } from '../services/credentials.service';
import { PermissionsService, KNOWN_TOOLS } from '../services/permissions.service';
import { McpService, McpServer } from '../services/mcp.service';
import { StartSessionOptions } from '../../shared/types';

export function registerIpcHandlers(
  cliService: ClaudeCliService,
  sessionLoader: SessionLoaderService,
  _credentialsService: CredentialsService,
  permissionsService: PermissionsService,
  mcpService: McpService
): void {
  // ===== Session Management =====

  ipcMain.handle(IPC_CHANNELS.SESSIONS_GET_ALL, async () => {
    return sessionLoader.getAllProjects();
  });

  ipcMain.handle(IPC_CHANNELS.SESSION_LOAD, async (_, { projectPath, sessionId }: { projectPath: string; sessionId: string }) => {
    return sessionLoader.loadFullSession(projectPath, sessionId);
  });

  // ===== CLI Session Control =====

  ipcMain.handle(IPC_CHANNELS.CLI_START_SESSION, async (_, options: StartSessionOptions) => {
    return cliService.startSession(options);
  });

  ipcMain.handle(IPC_CHANNELS.CLI_SEND_MESSAGE, async (_, { sessionId, message }: { sessionId: string; message: string }) => {
    cliService.sendMessage(sessionId, message);
  });

  ipcMain.handle(IPC_CHANNELS.CLI_GRANT_PERMISSION, async (_, { sessionId, toolUseId, scope }: { sessionId: string; toolUseId: string; scope: 'once' | 'session' | 'always' }) => {
    cliService.grantPermission(sessionId, toolUseId, scope);
  });

  ipcMain.handle(IPC_CHANNELS.CLI_DENY_PERMISSION, async (_, { sessionId, toolUseId }: { sessionId: string; toolUseId: string }) => {
    cliService.denyPermission(sessionId, toolUseId);
  });

  ipcMain.handle(IPC_CHANNELS.CLI_KILL_SESSION, async (_, { sessionId }: { sessionId: string }) => {
    cliService.killSession(sessionId);
  });

  ipcMain.handle(IPC_CHANNELS.CLI_SET_PLAN_MODE, async (_, { sessionId, enabled }: { sessionId: string; enabled: boolean }) => {
    cliService.setPlanMode(sessionId, enabled);
  });

  ipcMain.handle(IPC_CHANNELS.CLI_ALLOW_TOOL, async (_, { sessionId, toolName }: { sessionId: string; toolName: string }) => {
    console.log(`[IPC] CLI_ALLOW_TOOL called: session=${sessionId}, tool=${toolName}`);
    const result = cliService.allowTool(sessionId, toolName);
    console.log(`[IPC] CLI_ALLOW_TOOL result: ${result}`);
    return result;
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
  cliService.on('cli:permission-required', forwardToRenderer(IPC_CHANNELS.CLI_EVENT_PERMISSION));
  cliService.on('cli:error', forwardToRenderer(IPC_CHANNELS.CLI_EVENT_ERROR));
  cliService.on('cli:exit', forwardToRenderer(IPC_CHANNELS.CLI_EVENT_EXIT));

  // ===== Permissions =====

  ipcMain.handle(IPC_CHANNELS.PERMISSIONS_GET_GLOBAL, async () => {
    return permissionsService.getGlobalPermissions();
  });

  ipcMain.handle(IPC_CHANNELS.PERMISSIONS_SET_GLOBAL, async (_, { tool, allowed, scope }: { tool: string; allowed: boolean; scope: 'always' | 'ask' }) => {
    await permissionsService.setGlobalPermission(tool, allowed, scope);
    return permissionsService.getGlobalPermissions();
  });

  ipcMain.handle(IPC_CHANNELS.PERMISSIONS_REMOVE_GLOBAL, async (_, { tool }: { tool: string }) => {
    await permissionsService.removeGlobalPermission(tool);
    return permissionsService.getGlobalPermissions();
  });

  ipcMain.handle(IPC_CHANNELS.PERMISSIONS_GET_AUTO_ALLOWED, async () => {
    return permissionsService.getAutoAllowedTools();
  });

  ipcMain.handle(IPC_CHANNELS.PERMISSIONS_GET_KNOWN_TOOLS, async () => {
    return [...KNOWN_TOOLS];
  });

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

  // ===== Session File Watching =====

  sessionLoader.startWatching((event, path) => {
    const windows = BrowserWindow.getAllWindows();
    windows.forEach(win => {
      if (!win.isDestroyed()) {
        win.webContents.send(IPC_CHANNELS.SESSIONS_CHANGED, { event, path });
      }
    });
  });
}
