import { ipcMain, BrowserWindow, dialog, app } from 'electron';
import { readFile } from 'fs/promises';
import { homedir } from 'os';
import { IPC_CHANNELS } from '../../shared/ipc-channels';
import { ClaudeCliService } from '../services/claude-cli.service';
import { SessionLoaderService } from '../services/session-loader.service';
import { CredentialsService } from '../services/credentials.service';
import { PermissionsService, KNOWN_TOOLS } from '../services/permissions.service';
import { StartSessionOptions } from '../../shared/types';

export function registerIpcHandlers(
  cliService: ClaudeCliService,
  sessionLoader: SessionLoaderService,
  _credentialsService: CredentialsService,
  permissionsService: PermissionsService
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
    cliService.allowTool(sessionId, toolName);
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
