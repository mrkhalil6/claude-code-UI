import { create } from 'zustand';
import { devtools, subscribeWithSelector } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';
import { createSessionSlice, SessionSlice } from './slices/session.slice';
import { createChatSlice, ChatSlice } from './slices/chat.slice';
import { createPermissionSlice, PermissionSlice } from './slices/permission.slice';
import { createUISlice, UISlice } from './slices/ui.slice';

export type AppStore = SessionSlice & ChatSlice & PermissionSlice & UISlice;

export const useStore = create<AppStore>()(
  devtools(
    subscribeWithSelector(
      immer((...args) => ({
        ...createSessionSlice(...args),
        ...createChatSlice(...args),
        ...createPermissionSlice(...args),
        ...createUISlice(...args),
      }))
    ),
    { name: 'claude-ui-store' }
  )
);

// Convenience hooks for selecting specific slices
export const useSession = () => useStore((state) => ({
  projects: state.projects,
  activeSession: state.activeSession,
  activeSessionId: state.activeSessionId,
  cliSessionId: state.cliSessionId,
  activeProjectPath: state.activeProjectPath,
  currentCwd: state.currentCwd,
  isLoadingSessions: state.isLoadingSessions,
  isLoadingSession: state.isLoadingSession
}));

export const useChat = () => useStore((state) => ({
  messages: state.messages,
  isStreaming: state.isStreaming,
  streamingContent: state.streamingContent,
  streamingThinking: state.streamingThinking,
  toolsInProgress: state.toolsInProgress,
  streamingBlocks: state.streamingBlocks,
  lastUserMessage: state.lastUserMessage
}));

export const usePermissions = () => useStore((state) => ({
  pendingPermission: state.pendingPermission,
  permissionHistory: state.permissionHistory,
  pendingFileChanges: state.pendingFileChanges,
  globalPermissions: state.globalPermissions,
  knownTools: state.knownTools,
  sessionAllowedTools: state.sessionAllowedTools
}));

export const useUI = () => useStore((state) => ({
  isPlanMode: state.isPlanMode,
  sidebarWidth: state.sidebarWidth,
  isSidebarCollapsed: state.isSidebarCollapsed,
  showDiffPanel: state.showDiffPanel,
  activeDiffId: state.activeDiffId,
  showSettings: state.showSettings,
  connectionStatus: state.connectionStatus,
  errorMessage: state.errorMessage
}));

// Actions hooks
export const useSessionActions = () => useStore((state) => ({
  setProjects: state.setProjects,
  setActiveSession: state.setActiveSession,
  setActiveSessionId: state.setActiveSessionId,
  setCliSessionId: state.setCliSessionId,
  setActiveProjectPath: state.setActiveProjectPath,
  setCurrentCwd: state.setCurrentCwd,
  setIsLoadingSessions: state.setIsLoadingSessions,
  setIsLoadingSession: state.setIsLoadingSession,
  addMessageToSession: state.addMessageToSession
}));

export const useChatActions = () => useStore((state) => ({
  setMessages: state.setMessages,
  addMessage: state.addMessage,
  clearMessages: state.clearMessages,
  setIsStreaming: state.setIsStreaming,
  setStreamingContent: state.setStreamingContent,
  appendStreamingContent: state.appendStreamingContent,
  setStreamingThinking: state.setStreamingThinking,
  appendStreamingThinking: state.appendStreamingThinking,
  clearStreaming: state.clearStreaming,
  addToolInProgress: state.addToolInProgress,
  updateToolStatus: state.updateToolStatus,
  clearToolsInProgress: state.clearToolsInProgress,
  finalizeStreamingMessage: state.finalizeStreamingMessage,
  setLastUserMessage: state.setLastUserMessage
}));

export const usePermissionActions = () => useStore((state) => ({
  setPendingPermission: state.setPendingPermission,
  addToPermissionHistory: state.addToPermissionHistory,
  clearPermissionHistory: state.clearPermissionHistory,
  addPendingFileChange: state.addPendingFileChange,
  updateFileChangeStatus: state.updateFileChangeStatus,
  removePendingFileChange: state.removePendingFileChange,
  clearPendingFileChanges: state.clearPendingFileChanges,
  // Global permissions
  setGlobalPermissions: state.setGlobalPermissions,
  setKnownTools: state.setKnownTools,
  // Session permissions
  setSessionAllowedTools: state.setSessionAllowedTools,
  addSessionAllowedTool: state.addSessionAllowedTool,
  removeSessionAllowedTool: state.removeSessionAllowedTool,
  clearSessionAllowedTools: state.clearSessionAllowedTools
}));

export const useUIActions = () => useStore((state) => ({
  setIsPlanMode: state.setIsPlanMode,
  togglePlanMode: state.togglePlanMode,
  setSidebarWidth: state.setSidebarWidth,
  setIsSidebarCollapsed: state.setIsSidebarCollapsed,
  toggleSidebar: state.toggleSidebar,
  setShowDiffPanel: state.setShowDiffPanel,
  setActiveDiffId: state.setActiveDiffId,
  setShowSettings: state.setShowSettings,
  setConnectionStatus: state.setConnectionStatus,
  setErrorMessage: state.setErrorMessage
}));
