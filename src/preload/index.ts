import { contextBridge, ipcRenderer, IpcRendererEvent } from 'electron';
import { IPC_CHANNELS } from '../shared/ipc-channels';
import {
  ProjectWithSessions,
  Session,
  StartSessionOptions,
  CLIServiceEvent,
  CLIPermissionRequiredEvent,
  CLIExitEvent,
  CLIErrorEvent,
  GitStatusResult,
  GitFileDiff,
  GitCommitResult,
  GitPushResult,
  GitPullResult,
  GitLogEntry,
  GitStashEntry,
  GitStashResult
} from '../shared/types';

// MCP Server types
type McpServerStdio = { type?: 'stdio'; command: string; args?: string[]; env?: Record<string, string> };
type McpServerSse = { type: 'sse'; url: string; headers?: Record<string, string> };
type McpServerHttp = { type: 'http'; url: string; headers?: Record<string, string> };
type McpServer = McpServerStdio | McpServerSse | McpServerHttp;

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

    delete: (projectPath: string, sessionId: string): Promise<boolean> =>
      ipcRenderer.invoke(IPC_CHANNELS.SESSION_DELETE, { projectPath, sessionId }),

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

    allowTool: (sessionId: string, toolName: string): Promise<boolean> =>
      ipcRenderer.invoke(IPC_CHANNELS.CLI_ALLOW_TOOL, { sessionId, toolName }),

    getModels: (): Promise<{ id: string; name: string }[]> =>
      ipcRenderer.invoke(IPC_CHANNELS.CLI_GET_MODELS),

    setModel: (sessionId: string, model: string): Promise<boolean> =>
      ipcRenderer.invoke(IPC_CHANNELS.CLI_SET_MODEL, { sessionId, model }),

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
      ipcRenderer.invoke(IPC_CHANNELS.PERMISSIONS_GET_KNOWN_TOOLS),

    // Sync permissions to a specific session (combines global + session tools)
    syncSession: (sessionId: string, sessionTools: string[]): Promise<boolean> =>
      ipcRenderer.invoke(IPC_CHANNELS.PERMISSIONS_SYNC_SESSION, { sessionId, sessionTools }),

    // Sync global permissions to all active sessions
    syncAllSessions: (): Promise<{ synced: number }> =>
      ipcRenderer.invoke(IPC_CHANNELS.PERMISSIONS_SYNC_ALL_SESSIONS)
  },

  // ===== MCP Servers =====
  mcp: {
    // Global MCP servers (stored in ~/.claude/settings.json)
    getGlobalServers: (): Promise<Record<string, McpServer>> =>
      ipcRenderer.invoke(IPC_CHANNELS.MCP_GET_GLOBAL_SERVERS),

    addGlobalServer: (name: string, server: McpServer): Promise<Record<string, McpServer>> =>
      ipcRenderer.invoke(IPC_CHANNELS.MCP_ADD_GLOBAL_SERVER, { name, server }),

    removeGlobalServer: (name: string): Promise<Record<string, McpServer>> =>
      ipcRenderer.invoke(IPC_CHANNELS.MCP_REMOVE_GLOBAL_SERVER, { name }),

    // Project MCP servers (stored in ~/.claude.json per project)
    getProjectServers: (projectPath: string): Promise<Record<string, McpServer>> =>
      ipcRenderer.invoke(IPC_CHANNELS.MCP_GET_PROJECT_SERVERS, { projectPath }),

    addProjectServer: (name: string, server: McpServer, projectPath: string): Promise<Record<string, McpServer>> =>
      ipcRenderer.invoke(IPC_CHANNELS.MCP_ADD_PROJECT_SERVER, { name, server, projectPath }),

    removeProjectServer: (name: string, projectPath: string): Promise<Record<string, McpServer>> =>
      ipcRenderer.invoke(IPC_CHANNELS.MCP_REMOVE_PROJECT_SERVER, { name, projectPath }),

    // Server status and authentication
    getServerStatus: (name: string): Promise<{ status: string; scope: string; type: string; url?: string; command?: string }> =>
      ipcRenderer.invoke(IPC_CHANNELS.MCP_GET_SERVER_STATUS, { name }),

    authenticateServer: (name: string): Promise<{ success: boolean; error?: string }> =>
      ipcRenderer.invoke(IPC_CHANNELS.MCP_AUTHENTICATE_SERVER, { name }),

    // Legacy methods (backward compatibility)
    getServers: (projectPath?: string): Promise<Record<string, McpServer>> =>
      ipcRenderer.invoke(IPC_CHANNELS.MCP_GET_SERVERS, { projectPath }),

    getServer: (name: string): Promise<McpServer | undefined> =>
      ipcRenderer.invoke(IPC_CHANNELS.MCP_GET_SERVER, { name }),

    addServer: (name: string, server: McpServer, projectPath?: string): Promise<Record<string, McpServer>> =>
      ipcRenderer.invoke(IPC_CHANNELS.MCP_ADD_SERVER, { name, server, projectPath }),

    removeServer: (name: string, projectPath?: string): Promise<Record<string, McpServer>> =>
      ipcRenderer.invoke(IPC_CHANNELS.MCP_REMOVE_SERVER, { name, projectPath })
  },

  // ===== Git Operations =====
  git: {
    getStatus: (cwd: string): Promise<GitStatusResult> =>
      ipcRenderer.invoke(IPC_CHANNELS.GIT_GET_STATUS, { cwd }),

    getFileDiff: (cwd: string, filePath: string): Promise<GitFileDiff> =>
      ipcRenderer.invoke(IPC_CHANNELS.GIT_GET_FILE_DIFF, { cwd, filePath }),

    stageFile: (cwd: string, filePath: string): Promise<boolean> =>
      ipcRenderer.invoke(IPC_CHANNELS.GIT_STAGE_FILE, { cwd, filePath }),

    stageAll: (cwd: string): Promise<boolean> =>
      ipcRenderer.invoke(IPC_CHANNELS.GIT_STAGE_ALL, { cwd }),

    unstageFile: (cwd: string, filePath: string): Promise<boolean> =>
      ipcRenderer.invoke(IPC_CHANNELS.GIT_UNSTAGE_FILE, { cwd, filePath }),

    unstageAll: (cwd: string): Promise<boolean> =>
      ipcRenderer.invoke(IPC_CHANNELS.GIT_UNSTAGE_ALL, { cwd }),

    discardFile: (cwd: string, filePath: string): Promise<boolean> =>
      ipcRenderer.invoke(IPC_CHANNELS.GIT_DISCARD_FILE, { cwd, filePath }),

    discardAll: (cwd: string): Promise<boolean> =>
      ipcRenderer.invoke(IPC_CHANNELS.GIT_DISCARD_ALL, { cwd }),

    commit: (cwd: string, message: string): Promise<GitCommitResult> =>
      ipcRenderer.invoke(IPC_CHANNELS.GIT_COMMIT, { cwd, message }),

    push: (cwd: string, remote?: string, branch?: string): Promise<GitPushResult> =>
      ipcRenderer.invoke(IPC_CHANNELS.GIT_PUSH, { cwd, remote, branch }),

    pull: (cwd: string, remote?: string, branch?: string): Promise<GitPullResult> =>
      ipcRenderer.invoke(IPC_CHANNELS.GIT_PULL, { cwd, remote, branch }),

    getLog: (cwd: string, limit?: number): Promise<GitLogEntry[]> =>
      ipcRenderer.invoke(IPC_CHANNELS.GIT_GET_LOG, { cwd, limit }),

    saveFile: (cwd: string, filePath: string, content: string): Promise<boolean> =>
      ipcRenderer.invoke(IPC_CHANNELS.GIT_SAVE_FILE, { cwd, filePath, content }),

    resolveConflict: (cwd: string, filePath: string): Promise<boolean> =>
      ipcRenderer.invoke(IPC_CHANNELS.GIT_RESOLVE_CONFLICT, { cwd, filePath }),

    abortMerge: (cwd: string): Promise<boolean> =>
      ipcRenderer.invoke(IPC_CHANNELS.GIT_ABORT_MERGE, { cwd }),

    stash: (cwd: string, message?: string): Promise<GitStashResult> =>
      ipcRenderer.invoke(IPC_CHANNELS.GIT_STASH, { cwd, message }),

    stashPop: (cwd: string, index?: number): Promise<GitStashResult> =>
      ipcRenderer.invoke(IPC_CHANNELS.GIT_STASH_POP, { cwd, index }),

    stashList: (cwd: string): Promise<GitStashEntry[]> =>
      ipcRenderer.invoke(IPC_CHANNELS.GIT_STASH_LIST, { cwd }),

    stashDrop: (cwd: string, index?: number): Promise<GitStashResult> =>
      ipcRenderer.invoke(IPC_CHANNELS.GIT_STASH_DROP, { cwd, index })
  }
};

// Expose the API to the renderer process
contextBridge.exposeInMainWorld('claudeUI', api);

// TypeScript type declaration for the exposed API
export type ClaudeUIApi = typeof api;
