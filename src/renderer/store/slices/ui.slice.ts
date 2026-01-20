import { StateCreator } from 'zustand';

export interface UISlice {
  // State
  isPlanMode: boolean;
  sidebarWidth: number;
  isSidebarCollapsed: boolean;
  showDiffPanel: boolean;
  activeDiffId: string | null;
  showSettings: boolean;
  connectionStatus: 'disconnected' | 'connecting' | 'connected' | 'error';
  errorMessage: string | null;

  // Actions
  setIsPlanMode: (planMode: boolean) => void;
  togglePlanMode: () => void;
  setSidebarWidth: (width: number) => void;
  setIsSidebarCollapsed: (collapsed: boolean) => void;
  toggleSidebar: () => void;
  setShowDiffPanel: (show: boolean) => void;
  setActiveDiffId: (id: string | null) => void;
  setShowSettings: (show: boolean) => void;
  setConnectionStatus: (status: UISlice['connectionStatus']) => void;
  setErrorMessage: (message: string | null) => void;
}

export const createUISlice: StateCreator<UISlice, [], [], UISlice> = (set) => ({
  // Initial state
  isPlanMode: false,
  sidebarWidth: 280,
  isSidebarCollapsed: false,
  showDiffPanel: false,
  activeDiffId: null,
  showSettings: false,
  connectionStatus: 'disconnected',
  errorMessage: null,

  // Actions
  setIsPlanMode: (planMode) => set({ isPlanMode: planMode }),

  togglePlanMode: () => set((state) => ({ isPlanMode: !state.isPlanMode })),

  setSidebarWidth: (width) => set({ sidebarWidth: width }),

  setIsSidebarCollapsed: (collapsed) => set({ isSidebarCollapsed: collapsed }),

  toggleSidebar: () => set((state) => ({ isSidebarCollapsed: !state.isSidebarCollapsed })),

  setShowDiffPanel: (show) => set({ showDiffPanel: show }),

  setActiveDiffId: (id) => set({ activeDiffId: id }),

  setShowSettings: (show) => set({ showSettings: show }),

  setConnectionStatus: (status) => set({ connectionStatus: status }),

  setErrorMessage: (message) => set({ errorMessage: message })
});
