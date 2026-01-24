import { create } from 'zustand';
import { devtools, subscribeWithSelector } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';
import { createSessionSlice, SessionSlice } from './slices/session.slice';
import { createChatSlice, ChatSlice } from './slices/chat.slice';
import { createUISlice, UISlice } from './slices/ui.slice';

export type AppStore = SessionSlice & ChatSlice & UISlice;

export const useStore = create<AppStore>()(
  devtools(
    subscribeWithSelector(
      immer((...args) => ({
        ...createSessionSlice(...args),
        ...createChatSlice(...args),
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
  lastUserMessage: state.lastUserMessage,
  todos: state.todos
}));

export const useUI = () => useStore((state) => ({
  isPlanMode: state.isPlanMode,
  sidebarWidth: state.sidebarWidth,
  isSidebarCollapsed: state.isSidebarCollapsed,
  showDiffPanel: state.showDiffPanel,
  activeDiffId: state.activeDiffId,
  showSettings: state.showSettings,
  showGitDiff: state.showGitDiff,
  showTerminal: state.showTerminal,
  terminalHeight: state.terminalHeight,
  // Claude PTY state
  showClaudePty: state.showClaudePty,
  claudePtyHeight: state.claudePtyHeight,
  claudePtySessionId: state.claudePtySessionId,
  claudePtyNeedsInteraction: state.claudePtyNeedsInteraction,
  connectionStatus: state.connectionStatus,
  errorMessage: state.errorMessage,
  usage: state.usage,
  themeMode: state.themeMode,
  resolvedTheme: state.resolvedTheme,
  availableSkills: state.availableSkills
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
  addMessageToSession: state.addMessageToSession,
  clearSession: state.clearSession
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
  setLastUserMessage: state.setLastUserMessage,
  setTodos: state.setTodos,
  clearTodos: state.clearTodos
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
  setShowGitDiff: state.setShowGitDiff,
  setShowTerminal: state.setShowTerminal,
  toggleTerminal: state.toggleTerminal,
  setTerminalHeight: state.setTerminalHeight,
  // Claude PTY actions
  setShowClaudePty: state.setShowClaudePty,
  setClaudePtyHeight: state.setClaudePtyHeight,
  setClaudePtySessionId: state.setClaudePtySessionId,
  setClaudePtyNeedsInteraction: state.setClaudePtyNeedsInteraction,
  openClaudePtySession: state.openClaudePtySession,
  closeClaudePtySession: state.closeClaudePtySession,
  setConnectionStatus: state.setConnectionStatus,
  setErrorMessage: state.setErrorMessage,
  setModelInfo: state.setModelInfo,
  updateUsage: state.updateUsage,
  resetUsage: state.resetUsage,
  setThemeMode: state.setThemeMode,
  setResolvedTheme: state.setResolvedTheme,
  setAvailableSkills: state.setAvailableSkills,
  clearAvailableSkills: state.clearAvailableSkills
}));
