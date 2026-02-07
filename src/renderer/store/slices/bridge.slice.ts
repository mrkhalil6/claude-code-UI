import { StateCreator } from 'zustand';
import {
  BridgeConfig,
  BridgeStatusInfo,
  BridgeMessageEvent,
} from '../../../shared/types';

export interface BridgeSlice {
  // State
  bridges: BridgeConfig[];
  bridgeStatuses: Record<string, BridgeStatusInfo>;
  bridgeMessages: BridgeMessageEvent[];
  isBridgesLoading: boolean;

  // Actions
  setBridges: (bridges: BridgeConfig[]) => void;
  addBridge: (bridge: BridgeConfig) => void;
  updateBridgeConfig: (bridge: BridgeConfig) => void;
  removeBridge: (id: string) => void;
  setBridgeStatus: (id: string, status: BridgeStatusInfo) => void;
  addBridgeMessage: (message: BridgeMessageEvent) => void;
  setIsBridgesLoading: (loading: boolean) => void;
}

export const createBridgeSlice: StateCreator<BridgeSlice, [], [], BridgeSlice> = (set) => ({
  // Initial state
  bridges: [],
  bridgeStatuses: {},
  bridgeMessages: [],
  isBridgesLoading: false,

  // Actions
  setBridges: (bridges) =>
    set({ bridges }),

  addBridge: (bridge) =>
    set((state) => ({ bridges: [...state.bridges, bridge] })),

  updateBridgeConfig: (bridge) =>
    set((state) => ({
      bridges: state.bridges.map((b) => (b.id === bridge.id ? bridge : b)),
    })),

  removeBridge: (id) =>
    set((state) => ({
      bridges: state.bridges.filter((b) => b.id !== id),
    })),

  setBridgeStatus: (id, status) =>
    set((state) => ({
      bridgeStatuses: { ...state.bridgeStatuses, [id]: status },
    })),

  addBridgeMessage: (message) =>
    set((state) => ({
      bridgeMessages: [...state.bridgeMessages.slice(-99), message], // Keep last 100
    })),

  setIsBridgesLoading: (loading) =>
    set({ isBridgesLoading: loading }),
});
