import { contextBridge, ipcRenderer, IpcRendererEvent } from 'electron';
import { IPC_CHANNELS } from '../shared/ipc-channels';
import {
  ProjectWithSessions,
  Session,
  StartSessionOptions,
  CLIServiceEvent,
  CLIPermissionRequiredEvent,
  CLIExitEvent,
  CLIErrorEvent
} from '../shared/types';

// Type for cleanup function
type CleanupFn = () => void;

// API exposed to renderer
const api = {
  // ===== Session Management =====
  sessions: {
    getAll: (): Promise<ProjectWithSessions[]> =>
      ipcRenderer.invoke(IPC_CHANNELS.SESSIONS_GET_ALL),

    load: (projectPath: string, sessionId: string): Promise<Session> =>
      ipcRenderer.invoke(IPC_CHANNELS.SESSION_LOAD, { projectPath, sessionId }),

    onChanged: (callback: (data: { event: string; path: string }) => void): CleanupFn => {
      const handler = (_: IpcRendererEvent, data: { event: string; path: string }) => callback(data);
      ipcRenderer.on(IPC_CHANNELS.SESSIONS_CHANGED, handler);
      return () => ipcRenderer.removeListener(IPC_CHANNELS.SESSIONS_CHANGED, handler);
    }
  },

  // ===== CLI Control =====
  cli: {
    startSession: (options: StartSessionOptions): Promise<string> =>
      ipcRenderer.invoke(IPC_CHANNELS.CLI_START_SESSION, options),

    sendMessage: (sessionId: string, message: string): Promise<void> =>
      ipcRenderer.invoke(IPC_CHANNELS.CLI_SEND_MESSAGE, { sessionId, message }),

    grantPermission: (sessionId: string, toolUseId: string, scope: 'once' | 'session' | 'always'): Promise<void> =>
      ipcRenderer.invoke(IPC_CHANNELS.CLI_GRANT_PERMISSION, { sessionId, toolUseId, scope }),

    denyPermission: (sessionId: string, toolUseId: string): Promise<void> =>
      ipcRenderer.invoke(IPC_CHANNELS.CLI_DENY_PERMISSION, { sessionId, toolUseId }),

    killSession: (sessionId: string): Promise<void> =>
      ipcRenderer.invoke(IPC_CHANNELS.CLI_KILL_SESSION, { sessionId }),

    setPlanMode: (sessionId: string, enabled: boolean): Promise<void> =>
      ipcRenderer.invoke(IPC_CHANNELS.CLI_SET_PLAN_MODE, { sessionId, enabled }),

    allowTool: (sessionId: string, toolName: string): Promise<void> =>
      ipcRenderer.invoke(IPC_CHANNELS.CLI_ALLOW_TOOL, { sessionId, toolName }),

    // Event listeners
    onSystem: (callback: (data: CLIServiceEvent) => void): CleanupFn => {
      const handler = (_: IpcRendererEvent, data: CLIServiceEvent) => callback(data);
      ipcRenderer.on(IPC_CHANNELS.CLI_EVENT_SYSTEM, handler);
      return () => ipcRenderer.removeListener(IPC_CHANNELS.CLI_EVENT_SYSTEM, handler);
    },

    onStream: (callback: (data: CLIServiceEvent) => void): CleanupFn => {
      const handler = (_: IpcRendererEvent, data: CLIServiceEvent) => callback(data);
      ipcRenderer.on(IPC_CHANNELS.CLI_EVENT_STREAM, handler);
      return () => ipcRenderer.removeListener(IPC_CHANNELS.CLI_EVENT_STREAM, handler);
    },

    onAssistant: (callback: (data: CLIServiceEvent) => void): CleanupFn => {
      const handler = (_: IpcRendererEvent, data: CLIServiceEvent) => callback(data);
      ipcRenderer.on(IPC_CHANNELS.CLI_EVENT_ASSISTANT, handler);
      return () => ipcRenderer.removeListener(IPC_CHANNELS.CLI_EVENT_ASSISTANT, handler);
    },

    onUser: (callback: (data: CLIServiceEvent) => void): CleanupFn => {
      const handler = (_: IpcRendererEvent, data: CLIServiceEvent) => callback(data);
      ipcRenderer.on(IPC_CHANNELS.CLI_EVENT_USER, handler);
      return () => ipcRenderer.removeListener(IPC_CHANNELS.CLI_EVENT_USER, handler);
    },

    onResult: (callback: (data: CLIServiceEvent) => void): CleanupFn => {
      const handler = (_: IpcRendererEvent, data: CLIServiceEvent) => callback(data);
      ipcRenderer.on(IPC_CHANNELS.CLI_EVENT_RESULT, handler);
      return () => ipcRenderer.removeListener(IPC_CHANNELS.CLI_EVENT_RESULT, handler);
    },

    onPermissionRequired: (callback: (data: CLIPermissionRequiredEvent) => void): CleanupFn => {
      const handler = (_: IpcRendererEvent, data: CLIPermissionRequiredEvent) => callback(data);
      ipcRenderer.on(IPC_CHANNELS.CLI_EVENT_PERMISSION, handler);
      return () => ipcRenderer.removeListener(IPC_CHANNELS.CLI_EVENT_PERMISSION, handler);
    },

    onError: (callback: (data: CLIErrorEvent) => void): CleanupFn => {
      const handler = (_: IpcRendererEvent, data: CLIErrorEvent) => callback(data);
      ipcRenderer.on(IPC_CHANNELS.CLI_EVENT_ERROR, handler);
      return () => ipcRenderer.removeListener(IPC_CHANNELS.CLI_EVENT_ERROR, handler);
    },

    onExit: (callback: (data: CLIExitEvent) => void): CleanupFn => {
      const handler = (_: IpcRendererEvent, data: CLIExitEvent) => callback(data);
      ipcRenderer.on(IPC_CHANNELS.CLI_EVENT_EXIT, handler);
      return () => ipcRenderer.removeListener(IPC_CHANNELS.CLI_EVENT_EXIT, handler);
    }
  },

  // ===== File System =====
  fs: {
    readFile: (path: string): Promise<string> =>
      ipcRenderer.invoke(IPC_CHANNELS.FS_READ_FILE, path),

    selectDirectory: (): Promise<string | null> =>
      ipcRenderer.invoke(IPC_CHANNELS.FS_SELECT_DIRECTORY),

    getHomeDir: (): Promise<string> =>
      ipcRenderer.invoke(IPC_CHANNELS.FS_GET_HOME_DIR)
  },

  // ===== App =====
  app: {
    getVersion: (): Promise<string> =>
      ipcRenderer.invoke(IPC_CHANNELS.APP_GET_VERSION)
  },

  // ===== Permissions =====
  permissions: {
    getGlobal: (): Promise<Array<{ tool: string; allowed: boolean; scope: 'always' | 'ask' }>> =>
      ipcRenderer.invoke(IPC_CHANNELS.PERMISSIONS_GET_GLOBAL),

    setGlobal: (tool: string, allowed: boolean, scope: 'always' | 'ask'): Promise<Array<{ tool: string; allowed: boolean; scope: 'always' | 'ask' }>> =>
      ipcRenderer.invoke(IPC_CHANNELS.PERMISSIONS_SET_GLOBAL, { tool, allowed, scope }),

    removeGlobal: (tool: string): Promise<Array<{ tool: string; allowed: boolean; scope: 'always' | 'ask' }>> =>
      ipcRenderer.invoke(IPC_CHANNELS.PERMISSIONS_REMOVE_GLOBAL, { tool }),

    getAutoAllowed: (): Promise<string[]> =>
      ipcRenderer.invoke(IPC_CHANNELS.PERMISSIONS_GET_AUTO_ALLOWED),

    getKnownTools: (): Promise<string[]> =>
      ipcRenderer.invoke(IPC_CHANNELS.PERMISSIONS_GET_KNOWN_TOOLS)
  }
};

// Expose the API to the renderer process
contextBridge.exposeInMainWorld('claudeUI', api);

// TypeScript type declaration for the exposed API
export type ClaudeUIApi = typeof api;
