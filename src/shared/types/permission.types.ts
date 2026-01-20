export interface PendingPermission {
  sessionId: string;
  toolUseId: string;
  toolName: string;
  toolInput: Record<string, unknown>;
  description: string;
  timestamp: string;
  retryMessage?: string;  // Message to retry after permission is granted
}

export type PermissionScope = 'once' | 'session' | 'always';

export interface PermissionGrant {
  toolUseId: string;
  scope: PermissionScope;
  granted: boolean;
}

export interface PermissionRule {
  pattern: string;
  scope: PermissionScope;
  createdAt: string;
}

export interface FileChange {
  id: string;
  filePath: string;
  originalContent: string;
  modifiedContent: string;
  toolUseId: string;
  status: 'pending' | 'accepted' | 'rejected';
  timestamp: string;
}
