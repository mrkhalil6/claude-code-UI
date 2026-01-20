import { StateCreator } from 'zustand';
import { ProjectWithSessions, Session, SessionMessage } from '../../../shared/types';

export interface SessionSlice {
  // State
  projects: ProjectWithSessions[];
  activeSession: Session | null;
  activeSessionId: string | null;  // UI session ID for main process communication
  cliSessionId: string | null;     // CLI's session ID for sidebar matching
  activeProjectPath: string | null;
  currentCwd: string;
  isLoadingSessions: boolean;
  isLoadingSession: boolean;

  // Actions
  setProjects: (projects: ProjectWithSessions[]) => void;
  setActiveSession: (session: Session | null) => void;
  setActiveSessionId: (sessionId: string | null) => void;
  setCliSessionId: (sessionId: string | null) => void;
  setActiveProjectPath: (path: string | null) => void;
  setCurrentCwd: (cwd: string) => void;
  setIsLoadingSessions: (loading: boolean) => void;
  setIsLoadingSession: (loading: boolean) => void;
  addMessageToSession: (message: SessionMessage) => void;
  clearSession: () => void;
}

export const createSessionSlice: StateCreator<SessionSlice, [], [], SessionSlice> = (set) => ({
  // Initial state
  projects: [],
  activeSession: null,
  activeSessionId: null,
  cliSessionId: null,
  activeProjectPath: null,
  currentCwd: '',
  isLoadingSessions: false,
  isLoadingSession: false,

  // Actions
  setProjects: (projects) => set({ projects }),

  setActiveSession: (session) => set({
    activeSession: session,
    activeSessionId: session?.id || null,
    cliSessionId: session?.id || null  // When loading from file, CLI session ID is the same
  }),

  setActiveSessionId: (sessionId) => set({ activeSessionId: sessionId }),

  setCliSessionId: (sessionId) => set({ cliSessionId: sessionId }),

  setActiveProjectPath: (path) => set({ activeProjectPath: path }),

  setCurrentCwd: (cwd) => set({ currentCwd: cwd }),

  setIsLoadingSessions: (loading) => set({ isLoadingSessions: loading }),

  setIsLoadingSession: (loading) => set({ isLoadingSession: loading }),

  addMessageToSession: (message) => set((state) => {
    if (!state.activeSession) return state;

    return {
      activeSession: {
        ...state.activeSession,
        messages: [...state.activeSession.messages, message]
      }
    };
  }),

  clearSession: () => set({
    activeSession: null,
    activeSessionId: null,
    cliSessionId: null
  })
});
