import { StateCreator } from 'zustand';
import { PendingPermission, FileChange } from '../../../shared/types';

export interface ToolPermission {
  tool: string;
  allowed: boolean;
  scope: 'always' | 'ask';
}

export interface PermissionSlice {
  // State
  pendingPermission: PendingPermission | null;
  permissionHistory: PendingPermission[];
  pendingFileChanges: FileChange[];

  // Global permissions (persisted)
  globalPermissions: ToolPermission[];
  knownTools: string[];

  // Session-level permissions (in memory, per session)
  sessionAllowedTools: string[];

  // Actions
  setPendingPermission: (permission: PendingPermission | null) => void;
  addToPermissionHistory: (permission: PendingPermission) => void;
  clearPermissionHistory: () => void;
  addPendingFileChange: (change: FileChange) => void;
  updateFileChangeStatus: (id: string, status: FileChange['status']) => void;
  removePendingFileChange: (id: string) => void;
  clearPendingFileChanges: () => void;

  // Global permission actions
  setGlobalPermissions: (permissions: ToolPermission[]) => void;
  setKnownTools: (tools: string[]) => void;

  // Session permission actions
  setSessionAllowedTools: (tools: string[]) => void;
  addSessionAllowedTool: (tool: string) => void;
  removeSessionAllowedTool: (tool: string) => void;
  clearSessionAllowedTools: () => void;
}

export const createPermissionSlice: StateCreator<PermissionSlice, [], [], PermissionSlice> = (set) => ({
  // Initial state
  pendingPermission: null,
  permissionHistory: [],
  pendingFileChanges: [],
  globalPermissions: [],
  knownTools: [],
  sessionAllowedTools: [],

  // Actions
  setPendingPermission: (permission) => set({ pendingPermission: permission }),

  addToPermissionHistory: (permission) => set((state) => ({
    permissionHistory: [...state.permissionHistory, permission]
  })),

  clearPermissionHistory: () => set({ permissionHistory: [] }),

  addPendingFileChange: (change) => set((state) => ({
    pendingFileChanges: [...state.pendingFileChanges, change]
  })),

  updateFileChangeStatus: (id, status) => set((state) => ({
    pendingFileChanges: state.pendingFileChanges.map((change) =>
      change.id === id ? { ...change, status } : change
    )
  })),

  removePendingFileChange: (id) => set((state) => ({
    pendingFileChanges: state.pendingFileChanges.filter((change) => change.id !== id)
  })),

  clearPendingFileChanges: () => set({ pendingFileChanges: [] }),

  // Global permission actions
  setGlobalPermissions: (permissions) => set({ globalPermissions: permissions }),
  setKnownTools: (tools) => set({ knownTools: tools }),

  // Session permission actions
  setSessionAllowedTools: (tools) => set({ sessionAllowedTools: tools }),

  addSessionAllowedTool: (tool) => set((state) => ({
    sessionAllowedTools: state.sessionAllowedTools.includes(tool)
      ? state.sessionAllowedTools
      : [...state.sessionAllowedTools, tool]
  })),

  removeSessionAllowedTool: (tool) => set((state) => ({
    sessionAllowedTools: state.sessionAllowedTools.filter(t => t !== tool)
  })),

  clearSessionAllowedTools: () => set({ sessionAllowedTools: [] })
});
