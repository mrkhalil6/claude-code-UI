export const IPC_CHANNELS = {
  // Session Management
  SESSIONS_GET_ALL: 'sessions:getAll',
  SESSION_LOAD: 'sessions:load',
  SESSION_DELETE: 'sessions:delete',
  SESSION_RENAME: 'sessions:rename',
  SESSIONS_CHANGED: 'sessions:changed',

  // CLI Control
  CLI_START_SESSION: 'cli:startSession',
  CLI_SEND_MESSAGE: 'cli:sendMessage',
  CLI_INTERRUPT_SESSION: 'cli:interruptSession',
  CLI_KILL_SESSION: 'cli:killSession',
  CLI_SET_PLAN_MODE: 'cli:setPlanMode',

  // CLI Models
  CLI_GET_MODELS: 'cli:getModels',
  CLI_SET_MODEL: 'cli:setModel',

  // CLI Commands (for routing slash commands to CLI)
  CLI_EXECUTE_COMMAND: 'cli:executeCommand',

  // CLI Events (Main -> Renderer)
  CLI_EVENT_SYSTEM: 'cli:event:system',
  CLI_EVENT_STREAM: 'cli:event:stream',
  CLI_EVENT_ASSISTANT: 'cli:event:assistant',
  CLI_EVENT_USER: 'cli:event:user',
  CLI_EVENT_RESULT: 'cli:event:result',
  CLI_EVENT_ERROR: 'cli:event:error',
  CLI_EVENT_EXIT: 'cli:event:exit',
  CLI_EVENT_INTERRUPTED: 'cli:event:interrupted',
  CLI_EVENT_PLAN_MODE_EXIT: 'cli:event:planModeExit',

  // File System
  FS_READ_FILE: 'fs:readFile',
  FS_SELECT_DIRECTORY: 'fs:selectDirectory',
  FS_GET_HOME_DIR: 'fs:getHomeDir',

  // App
  APP_GET_VERSION: 'app:getVersion',

  // MCP Servers (Global)
  MCP_GET_GLOBAL_SERVERS: 'mcp:getGlobalServers',
  MCP_ADD_GLOBAL_SERVER: 'mcp:addGlobalServer',
  MCP_REMOVE_GLOBAL_SERVER: 'mcp:removeGlobalServer',

  // MCP Server Status & Actions
  MCP_GET_SERVER_STATUS: 'mcp:getServerStatus',
  MCP_AUTHENTICATE_SERVER: 'mcp:authenticateServer',

  // MCP Servers (Project)
  MCP_GET_PROJECT_SERVERS: 'mcp:getProjectServers',
  MCP_ADD_PROJECT_SERVER: 'mcp:addProjectServer',
  MCP_REMOVE_PROJECT_SERVER: 'mcp:removeProjectServer',

  // MCP Servers (Legacy - for backward compatibility)
  MCP_GET_SERVERS: 'mcp:getServers',
  MCP_ADD_SERVER: 'mcp:addServer',
  MCP_REMOVE_SERVER: 'mcp:removeServer',
  MCP_GET_SERVER: 'mcp:getServer',

  // Git Operations
  GIT_GET_STATUS: 'git:getStatus',
  GIT_GET_FILE_DIFF: 'git:getFileDiff',
  GIT_STAGE_FILE: 'git:stageFile',
  GIT_STAGE_ALL: 'git:stageAll',
  GIT_UNSTAGE_FILE: 'git:unstageFile',
  GIT_UNSTAGE_ALL: 'git:unstageAll',
  GIT_DISCARD_FILE: 'git:discardFile',
  GIT_DISCARD_ALL: 'git:discardAll',
  GIT_COMMIT: 'git:commit',
  GIT_PUSH: 'git:push',
  GIT_PULL: 'git:pull',
  GIT_GET_LOG: 'git:getLog',
  GIT_SAVE_FILE: 'git:saveFile',
  GIT_RESOLVE_CONFLICT: 'git:resolveConflict',
  GIT_ABORT_MERGE: 'git:abortMerge',
  GIT_STASH: 'git:stash',
  GIT_STASH_POP: 'git:stashPop',
  GIT_STASH_LIST: 'git:stashList',
  GIT_STASH_DROP: 'git:stashDrop',

  // Terminal
  TERMINAL_CREATE: 'terminal:create',
  TERMINAL_WRITE: 'terminal:write',
  TERMINAL_RESIZE: 'terminal:resize',
  TERMINAL_DESTROY: 'terminal:destroy',
  TERMINAL_DATA: 'terminal:data',
  TERMINAL_EXIT: 'terminal:exit',

  // Skills
  SKILLS_LIST: 'skills:list',
  SKILLS_GET: 'skills:get',
  SKILLS_CREATE: 'skills:create',
  SKILLS_UPDATE: 'skills:update',
  SKILLS_DELETE: 'skills:delete',

  // Hooks
  HOOKS_LIST: 'hooks:list',
  HOOKS_ADD: 'hooks:add',
  HOOKS_UPDATE: 'hooks:update',
  HOOKS_DELETE: 'hooks:delete'
} as const;

export type IpcChannel = typeof IPC_CHANNELS[keyof typeof IPC_CHANNELS];
