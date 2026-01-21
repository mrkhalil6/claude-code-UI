import { StateCreator } from 'zustand';

export interface UsageInfo {
  modelName: string;
  contextWindow: number;
  maxOutputTokens: number;
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheCreationTokens: number;
  totalCost: number;
  claudeCodeVersion: string;
}

export interface UISlice {
  // State
  isPlanMode: boolean;
  sidebarWidth: number;
  isSidebarCollapsed: boolean;
  showDiffPanel: boolean;
  activeDiffId: string | null;
  showSettings: boolean;
  showGitDiff: boolean;
  showTerminal: boolean;
  terminalHeight: number;
  connectionStatus: 'disconnected' | 'connecting' | 'connected' | 'error';
  errorMessage: string | null;
  usage: UsageInfo;

  // Actions
  setIsPlanMode: (planMode: boolean) => void;
  togglePlanMode: () => void;
  setSidebarWidth: (width: number) => void;
  setIsSidebarCollapsed: (collapsed: boolean) => void;
  toggleSidebar: () => void;
  setShowDiffPanel: (show: boolean) => void;
  setActiveDiffId: (id: string | null) => void;
  setShowSettings: (show: boolean) => void;
  setShowGitDiff: (show: boolean) => void;
  setShowTerminal: (show: boolean) => void;
  toggleTerminal: () => void;
  setTerminalHeight: (height: number) => void;
  setConnectionStatus: (status: UISlice['connectionStatus']) => void;
  setErrorMessage: (message: string | null) => void;
  setModelInfo: (modelName: string, contextWindow: number, maxOutputTokens: number, version: string) => void;
  updateUsage: (input: number, output: number, cacheRead: number, cacheCreation: number, cost: number) => void;
  resetUsage: () => void;
}

const initialUsage: UsageInfo = {
  modelName: '',
  contextWindow: 200000,
  maxOutputTokens: 64000,
  inputTokens: 0,
  outputTokens: 0,
  cacheReadTokens: 0,
  cacheCreationTokens: 0,
  totalCost: 0,
  claudeCodeVersion: ''
};

export const createUISlice: StateCreator<UISlice, [], [], UISlice> = (set) => ({
  // Initial state
  isPlanMode: false,
  sidebarWidth: 280,
  isSidebarCollapsed: false,
  showDiffPanel: false,
  activeDiffId: null,
  showSettings: false,
  showGitDiff: false,
  showTerminal: false,
  terminalHeight: 300,
  connectionStatus: 'disconnected',
  errorMessage: null,
  usage: initialUsage,

  // Actions
  setIsPlanMode: (planMode) => set({ isPlanMode: planMode }),

  togglePlanMode: () => set((state) => ({ isPlanMode: !state.isPlanMode })),

  setSidebarWidth: (width) => set({ sidebarWidth: width }),

  setIsSidebarCollapsed: (collapsed) => set({ isSidebarCollapsed: collapsed }),

  toggleSidebar: () => set((state) => ({ isSidebarCollapsed: !state.isSidebarCollapsed })),

  setShowDiffPanel: (show) => set({ showDiffPanel: show }),

  setActiveDiffId: (id) => set({ activeDiffId: id }),

  setShowSettings: (show) => set({ showSettings: show }),

  setShowGitDiff: (show) => set({ showGitDiff: show }),

  setShowTerminal: (show) => set({ showTerminal: show }),

  toggleTerminal: () => set((state) => ({ showTerminal: !state.showTerminal })),

  setTerminalHeight: (height) => set({ terminalHeight: height }),

  setConnectionStatus: (status) => set({ connectionStatus: status }),

  setErrorMessage: (message) => set({ errorMessage: message }),

  setModelInfo: (modelName, contextWindow, maxOutputTokens, version) => set((state) => ({
    usage: {
      ...state.usage,
      modelName,
      contextWindow,
      maxOutputTokens,
      claudeCodeVersion: version
    }
  })),

  updateUsage: (input, output, cacheRead, cacheCreation, cost) => set((state) => ({
    usage: {
      ...state.usage,
      inputTokens: state.usage.inputTokens + input,
      outputTokens: state.usage.outputTokens + output,
      cacheReadTokens: state.usage.cacheReadTokens + cacheRead,
      cacheCreationTokens: state.usage.cacheCreationTokens + cacheCreation,
      totalCost: state.usage.totalCost + cost
    }
  })),

  resetUsage: () => set({ usage: initialUsage })
});
