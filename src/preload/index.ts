import { contextBridge, ipcRenderer, IpcRendererEvent } from 'electron';
import { IPC_CHANNELS } from '../shared/ipc-channels';
import {
  ProjectWithSessions,
  Session,
  StartSessionOptions,
  CLIServiceEvent,
  CLIExitEvent,
  CLIErrorEvent,
  GitStatusResult,
  GitFileDiff,
  GitCommitResult,
  GitPushResult,
  GitPullResult,
  GitLogEntry,
  GitStashEntry,
  GitStashResult,
  Skill,
  SkillPayload,
  HookWithId,
  HookPayload,
  PlanInfo,
  ReadDirectoryResult
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

    rename: (projectPath: string, sessionId: string, newName: string): Promise<boolean> =>
      ipcRenderer.invoke(IPC_CHANNELS.SESSION_RENAME, { projectPath, sessionId, newName }),

    onChanged: (callback: (data: { event: string; path: string }) => void): CleanupFn => {
      const handler = (_: IpcRendererEvent, data: { event: string; path: string }) => callback(data);
      ipcRenderer.on(IPC_CHANNELS.SESSIONS_CHANGED, handler);
      return () => ipcRenderer.removeListener(IPC_CHANNELS.SESSIONS_CHANGED, handler);
    }
  },

  // ===== Plan =====
  plan: {
    get: (slug: string): Promise<PlanInfo | null> =>
      ipcRenderer.invoke(IPC_CHANNELS.PLAN_GET, { slug }),

    exists: (slug: string): Promise<boolean> =>
      ipcRenderer.invoke(IPC_CHANNELS.PLAN_EXISTS, { slug }),

    save: (slug: string, content: string): Promise<{ success: boolean; error?: string }> =>
      ipcRenderer.invoke(IPC_CHANNELS.PLAN_SAVE, { slug, content })
  },

  // ===== CLI Control =====
  cli: {
    startSession: (options: StartSessionOptions): Promise<string> =>
      ipcRenderer.invoke(IPC_CHANNELS.CLI_START_SESSION, options),

    sendMessage: (sessionId: string, message: string): Promise<void> =>
      ipcRenderer.invoke(IPC_CHANNELS.CLI_SEND_MESSAGE, { sessionId, message }),

    interruptSession: (sessionId: string): Promise<boolean> =>
      ipcRenderer.invoke(IPC_CHANNELS.CLI_INTERRUPT_SESSION, { sessionId }),

    killSession: (sessionId: string): Promise<void> =>
      ipcRenderer.invoke(IPC_CHANNELS.CLI_KILL_SESSION, { sessionId }),

    setPlanMode: (sessionId: string, enabled: boolean): Promise<void> =>
      ipcRenderer.invoke(IPC_CHANNELS.CLI_SET_PLAN_MODE, { sessionId, enabled }),

    getModels: (): Promise<{ id: string; name: string }[]> =>
      ipcRenderer.invoke(IPC_CHANNELS.CLI_GET_MODELS),

    setModel: (sessionId: string, model: string): Promise<boolean> =>
      ipcRenderer.invoke(IPC_CHANNELS.CLI_SET_MODEL, { sessionId, model }),

    // Execute a CLI slash command and return the result
    executeCommand: (command: string, args: string, cwd: string, sessionId?: string): Promise<{ success: boolean; output: string; error?: string }> =>
      ipcRenderer.invoke(IPC_CHANNELS.CLI_EXECUTE_COMMAND, { command, args, cwd, sessionId }),

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

    onError: (callback: (data: CLIErrorEvent) => void): CleanupFn => {
      const handler = (_: IpcRendererEvent, data: CLIErrorEvent) => callback(data);
      ipcRenderer.on(IPC_CHANNELS.CLI_EVENT_ERROR, handler);
      return () => ipcRenderer.removeListener(IPC_CHANNELS.CLI_EVENT_ERROR, handler);
    },

    onExit: (callback: (data: CLIExitEvent) => void): CleanupFn => {
      const handler = (_: IpcRendererEvent, data: CLIExitEvent) => callback(data);
      ipcRenderer.on(IPC_CHANNELS.CLI_EVENT_EXIT, handler);
      return () => ipcRenderer.removeListener(IPC_CHANNELS.CLI_EVENT_EXIT, handler);
    },

    onInterrupted: (callback: (data: { sessionId: string }) => void): CleanupFn => {
      const handler = (_: IpcRendererEvent, data: { sessionId: string }) => callback(data);
      ipcRenderer.on(IPC_CHANNELS.CLI_EVENT_INTERRUPTED, handler);
      return () => ipcRenderer.removeListener(IPC_CHANNELS.CLI_EVENT_INTERRUPTED, handler);
    },

    onPlanModeExit: (callback: (data: { sessionId: string }) => void): CleanupFn => {
      const handler = (_: IpcRendererEvent, data: { sessionId: string }) => callback(data);
      ipcRenderer.on(IPC_CHANNELS.CLI_EVENT_PLAN_MODE_EXIT, handler);
      return () => ipcRenderer.removeListener(IPC_CHANNELS.CLI_EVENT_PLAN_MODE_EXIT, handler);
    }
  },

  // ===== File System =====
  fs: {
    readFile: (path: string): Promise<string> =>
      ipcRenderer.invoke(IPC_CHANNELS.FS_READ_FILE, path),

    selectDirectory: (): Promise<string | null> =>
      ipcRenderer.invoke(IPC_CHANNELS.FS_SELECT_DIRECTORY),

    getHomeDir: (): Promise<string> =>
      ipcRenderer.invoke(IPC_CHANNELS.FS_GET_HOME_DIR),

    readDirectory: (path: string): Promise<ReadDirectoryResult> =>
      ipcRenderer.invoke(IPC_CHANNELS.FS_READ_DIRECTORY, { path })
  },

  // ===== App =====
  app: {
    getVersion: (): Promise<string> =>
      ipcRenderer.invoke(IPC_CHANNELS.APP_GET_VERSION)
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
  },

  // ===== Terminal =====
  terminal: {
    create: (id: string, cwd?: string): Promise<{ id: string; pid: number }> =>
      ipcRenderer.invoke(IPC_CHANNELS.TERMINAL_CREATE, { id, cwd }),

    write: (id: string, data: string): Promise<boolean> =>
      ipcRenderer.invoke(IPC_CHANNELS.TERMINAL_WRITE, { id, data }),

    resize: (id: string, cols: number, rows: number): Promise<boolean> =>
      ipcRenderer.invoke(IPC_CHANNELS.TERMINAL_RESIZE, { id, cols, rows }),

    destroy: (id: string): Promise<boolean> =>
      ipcRenderer.invoke(IPC_CHANNELS.TERMINAL_DESTROY, { id }),

    onData: (callback: (data: { id: string; data: string }) => void): CleanupFn => {
      const handler = (_: IpcRendererEvent, data: { id: string; data: string }) => callback(data);
      ipcRenderer.on(IPC_CHANNELS.TERMINAL_DATA, handler);
      return () => ipcRenderer.removeListener(IPC_CHANNELS.TERMINAL_DATA, handler);
    },

    onExit: (callback: (data: { id: string; exitCode: number; signal?: number }) => void): CleanupFn => {
      const handler = (_: IpcRendererEvent, data: { id: string; exitCode: number; signal?: number }) => callback(data);
      ipcRenderer.on(IPC_CHANNELS.TERMINAL_EXIT, handler);
      return () => ipcRenderer.removeListener(IPC_CHANNELS.TERMINAL_EXIT, handler);
    }
  },

  // ===== Skills =====
  skills: {
    list: (): Promise<Skill[]> =>
      ipcRenderer.invoke(IPC_CHANNELS.SKILLS_LIST),

    get: (id: string): Promise<Skill | null> =>
      ipcRenderer.invoke(IPC_CHANNELS.SKILLS_GET, { id }),

    create: (payload: SkillPayload): Promise<Skill> =>
      ipcRenderer.invoke(IPC_CHANNELS.SKILLS_CREATE, { payload }),

    update: (payload: SkillPayload): Promise<Skill> =>
      ipcRenderer.invoke(IPC_CHANNELS.SKILLS_UPDATE, { payload }),

    delete: (id: string): Promise<boolean> =>
      ipcRenderer.invoke(IPC_CHANNELS.SKILLS_DELETE, { id })
  },

  // ===== Hooks =====
  hooks: {
    list: (): Promise<HookWithId[]> =>
      ipcRenderer.invoke(IPC_CHANNELS.HOOKS_LIST),

    add: (payload: HookPayload): Promise<HookWithId> =>
      ipcRenderer.invoke(IPC_CHANNELS.HOOKS_ADD, { payload }),

    update: (payload: HookPayload): Promise<HookWithId> =>
      ipcRenderer.invoke(IPC_CHANNELS.HOOKS_UPDATE, { payload }),

    delete: (id: string): Promise<boolean> =>
      ipcRenderer.invoke(IPC_CHANNELS.HOOKS_DELETE, { id })
  },

  // ===== Claude PTY (Interactive Terminal) =====
  claudePty: {
    create: (id: string, options: {
      cwd: string;
      cols?: number;
      rows?: number;
      resumeSessionId?: string;
      permissionMode?: 'default' | 'plan';
      model?: string;
      allowedTools?: string[];
      subcommand?: string;
      subcommandArgs?: string[];
      sendAsSlashCommand?: boolean;
    }): Promise<{ id: string; pid: number }> =>
      ipcRenderer.invoke(IPC_CHANNELS.CLAUDE_PTY_CREATE, { id, options }),

    write: (id: string, data: string): void => {
      ipcRenderer.send(IPC_CHANNELS.CLAUDE_PTY_WRITE, { id, data });
    },

    sendCommand: (id: string, command: string): Promise<boolean> =>
      ipcRenderer.invoke(IPC_CHANNELS.CLAUDE_PTY_SEND_COMMAND, { id, command }),

    interrupt: (id: string): Promise<boolean> =>
      ipcRenderer.invoke(IPC_CHANNELS.CLAUDE_PTY_INTERRUPT, { id }),

    resize: (id: string, cols: number, rows: number): void => {
      ipcRenderer.send(IPC_CHANNELS.CLAUDE_PTY_RESIZE, { id, cols, rows });
    },

    destroy: (id: string): Promise<boolean> =>
      ipcRenderer.invoke(IPC_CHANNELS.CLAUDE_PTY_DESTROY, { id }),

    onData: (callback: (data: { id: string; data: string }) => void): CleanupFn => {
      const handler = (_: IpcRendererEvent, data: { id: string; data: string }) => callback(data);
      ipcRenderer.on(IPC_CHANNELS.CLAUDE_PTY_DATA, handler);
      return () => ipcRenderer.removeListener(IPC_CHANNELS.CLAUDE_PTY_DATA, handler);
    },

    onExit: (callback: (data: { id: string; exitCode: number; signal?: number }) => void): CleanupFn => {
      const handler = (_: IpcRendererEvent, data: { id: string; exitCode: number; signal?: number }) => callback(data);
      ipcRenderer.on(IPC_CHANNELS.CLAUDE_PTY_EXIT, handler);
      return () => ipcRenderer.removeListener(IPC_CHANNELS.CLAUDE_PTY_EXIT, handler);
    },

    onInteraction: (callback: (data: { id: string; needsInteraction: boolean }) => void): CleanupFn => {
      const handler = (_: IpcRendererEvent, data: { id: string; needsInteraction: boolean }) => callback(data);
      ipcRenderer.on(IPC_CHANNELS.CLAUDE_PTY_INTERACTION, handler);
      return () => ipcRenderer.removeListener(IPC_CHANNELS.CLAUDE_PTY_INTERACTION, handler);
    }
  }
};

// Expose the API to the renderer process
contextBridge.exposeInMainWorld('claudeUI', api);

// TypeScript type declaration for the exposed API
export type ClaudeUIApi = typeof api;
