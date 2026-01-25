import { StateCreator } from 'zustand';
import { SlashCommand } from '../../../shared/slash-commands';

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

export type ThemeMode = 'light' | 'dark' | 'system';
export type ResolvedTheme = 'light' | 'dark';

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
  // Claude PTY (Interactive Terminal)
  showClaudePty: boolean;
  claudePtyHeight: number;
  claudePtySessionId: string | null;
  claudePtyNeedsInteraction: boolean;
  claudePtySubcommand: string | null;
  claudePtySubcommandArgs: string[] | null;
  claudePtySendAsSlashCommand: boolean | null;
  connectionStatus: 'disconnected' | 'connecting' | 'connected' | 'error';
  errorMessage: string | null;
  usage: UsageInfo;
  themeMode: ThemeMode;
  resolvedTheme: ResolvedTheme;
  availableSkills: SlashCommand[];

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
  // Claude PTY Actions
  setShowClaudePty: (show: boolean) => void;
  setClaudePtyHeight: (height: number) => void;
  setClaudePtySessionId: (id: string | null) => void;
  setClaudePtyNeedsInteraction: (needs: boolean) => void;
  openClaudePtySession: (sessionId: string, subcommand?: string, subcommandArgs?: string[], sendAsSlashCommand?: boolean) => void;
  closeClaudePtySession: () => void;
  setConnectionStatus: (status: UISlice['connectionStatus']) => void;
  setErrorMessage: (message: string | null) => void;
  setModelInfo: (modelName: string, contextWindow: number, maxOutputTokens: number, version: string) => void;
  updateUsage: (input: number, output: number, cacheRead: number, cacheCreation: number, cost: number) => void;
  resetUsage: () => void;
  setThemeMode: (mode: ThemeMode) => void;
  setResolvedTheme: (theme: ResolvedTheme) => void;
  setAvailableSkills: (skills: SlashCommand[]) => void;
  clearAvailableSkills: () => void;
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

const getInitialThemeMode = (): ThemeMode => {
  if (typeof window !== 'undefined') {
    const stored = localStorage.getItem('theme-mode');
    if (stored === 'light' || stored === 'dark' || stored === 'system') {
      return stored;
    }
  }
  return 'system';
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
  // Claude PTY initial state
  showClaudePty: false,
  claudePtyHeight: 350,
  claudePtySessionId: null,
  claudePtyNeedsInteraction: false,
  claudePtySubcommand: null,
  claudePtySubcommandArgs: null,
  claudePtySendAsSlashCommand: null,
  connectionStatus: 'disconnected',
  errorMessage: null,
  usage: initialUsage,
  themeMode: getInitialThemeMode(),
  resolvedTheme: 'dark',
  availableSkills: [],

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

  // Claude PTY Actions
  setShowClaudePty: (show) => set({ showClaudePty: show }),

  setClaudePtyHeight: (height) => set({ claudePtyHeight: height }),

  setClaudePtySessionId: (id) => set({ claudePtySessionId: id }),

  setClaudePtyNeedsInteraction: (needs) => set({ claudePtyNeedsInteraction: needs }),

  openClaudePtySession: (sessionId, subcommand, subcommandArgs, sendAsSlashCommand) => set({
    showClaudePty: true,
    claudePtySessionId: sessionId,
    claudePtyNeedsInteraction: false,
    claudePtySubcommand: subcommand || null,
    claudePtySubcommandArgs: subcommandArgs || null,
    claudePtySendAsSlashCommand: sendAsSlashCommand ?? null,
  }),

  closeClaudePtySession: () => set({
    showClaudePty: false,
    claudePtySessionId: null,
    claudePtyNeedsInteraction: false,
    claudePtySubcommand: null,
    claudePtySubcommandArgs: null,
    claudePtySendAsSlashCommand: null,
  }),

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

  resetUsage: () => set({ usage: initialUsage }),

  setThemeMode: (mode) => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('theme-mode', mode);
    }
    set({ themeMode: mode });
  },

  setResolvedTheme: (theme) => set({ resolvedTheme: theme }),

  setAvailableSkills: (skills) => set({ availableSkills: skills }),

  clearAvailableSkills: () => set({ availableSkills: [] })
});
