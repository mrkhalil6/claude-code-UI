export const IPC_CHANNELS = {
  // Session Management
  SESSIONS_GET_ALL: 'sessions:getAll',
  SESSION_LOAD: 'sessions:load',
  SESSIONS_CHANGED: 'sessions:changed',

  // CLI Control
  CLI_START_SESSION: 'cli:startSession',
  CLI_SEND_MESSAGE: 'cli:sendMessage',
  CLI_GRANT_PERMISSION: 'cli:grantPermission',
  CLI_DENY_PERMISSION: 'cli:denyPermission',
  CLI_ALLOW_TOOL: 'cli:allowTool',
  CLI_KILL_SESSION: 'cli:killSession',
  CLI_SET_PLAN_MODE: 'cli:setPlanMode',

  // CLI Events (Main -> Renderer)
  CLI_EVENT_SYSTEM: 'cli:event:system',
  CLI_EVENT_STREAM: 'cli:event:stream',
  CLI_EVENT_ASSISTANT: 'cli:event:assistant',
  CLI_EVENT_USER: 'cli:event:user',
  CLI_EVENT_RESULT: 'cli:event:result',
  CLI_EVENT_PERMISSION: 'cli:event:permission',
  CLI_EVENT_PERMISSION_DENIALS: 'cli:event:permissionDenials',
  CLI_EVENT_ERROR: 'cli:event:error',
  CLI_EVENT_EXIT: 'cli:event:exit',

  // File System
  FS_READ_FILE: 'fs:readFile',
  FS_SELECT_DIRECTORY: 'fs:selectDirectory',
  FS_GET_HOME_DIR: 'fs:getHomeDir',

  // App
  APP_GET_VERSION: 'app:getVersion',

  // Permissions
  PERMISSIONS_GET_GLOBAL: 'permissions:getGlobal',
  PERMISSIONS_SET_GLOBAL: 'permissions:setGlobal',
  PERMISSIONS_REMOVE_GLOBAL: 'permissions:removeGlobal',
  PERMISSIONS_GET_AUTO_ALLOWED: 'permissions:getAutoAllowed',
  PERMISSIONS_GET_KNOWN_TOOLS: 'permissions:getKnownTools'
} as const;

export type IpcChannel = typeof IPC_CHANNELS[keyof typeof IPC_CHANNELS];
