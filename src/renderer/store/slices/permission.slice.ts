import { StateCreator } from 'zustand';
import { PendingPermission, FileChange } from '../../../shared/types';

export interface PermissionSlice {
  // State
  pendingPermission: PendingPermission | null;
  permissionHistory: PendingPermission[];
  pendingFileChanges: FileChange[];

  // Actions
  setPendingPermission: (permission: PendingPermission | null) => void;
  addToPermissionHistory: (permission: PendingPermission) => void;
  clearPermissionHistory: () => void;
  addPendingFileChange: (change: FileChange) => void;
  updateFileChangeStatus: (id: string, status: FileChange['status']) => void;
  removePendingFileChange: (id: string) => void;
  clearPendingFileChanges: () => void;
}

export const createPermissionSlice: StateCreator<PermissionSlice, [], [], PermissionSlice> = (set) => ({
  // Initial state
  pendingPermission: null,
  permissionHistory: [],
  pendingFileChanges: [],

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

  clearPendingFileChanges: () => set({ pendingFileChanges: [] })
});
