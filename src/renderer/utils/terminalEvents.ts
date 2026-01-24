/**
 * Terminal Event Emitter
 *
 * Simple pub/sub system for terminal data events.
 * Allows components to subscribe to terminal output for specific sessions.
 */

type TerminalDataHandler = (sessionId: string, data: string) => void;
type TerminalExitHandler = (sessionId: string, exitCode: number) => void;
type TerminalInteractionHandler = (sessionId: string, needsInteraction: boolean) => void;

class TerminalEventEmitter {
  private dataHandlers: Map<string, Set<TerminalDataHandler>> = new Map();
  private exitHandlers: Map<string, Set<TerminalExitHandler>> = new Map();
  private interactionHandlers: Map<string, Set<TerminalInteractionHandler>> = new Map();
  private globalDataHandlers: Set<TerminalDataHandler> = new Set();

  /**
   * Subscribe to data events for a specific session
   */
  subscribeToData(sessionId: string, handler: TerminalDataHandler): () => void {
    if (!this.dataHandlers.has(sessionId)) {
      this.dataHandlers.set(sessionId, new Set());
    }
    this.dataHandlers.get(sessionId)!.add(handler);
    return () => this.dataHandlers.get(sessionId)?.delete(handler);
  }

  /**
   * Subscribe to data events for all sessions
   */
  subscribeToAllData(handler: TerminalDataHandler): () => void {
    this.globalDataHandlers.add(handler);
    return () => this.globalDataHandlers.delete(handler);
  }

  /**
   * Subscribe to exit events for a specific session
   */
  subscribeToExit(sessionId: string, handler: TerminalExitHandler): () => void {
    if (!this.exitHandlers.has(sessionId)) {
      this.exitHandlers.set(sessionId, new Set());
    }
    this.exitHandlers.get(sessionId)!.add(handler);
    return () => this.exitHandlers.get(sessionId)?.delete(handler);
  }

  /**
   * Subscribe to interaction events for a specific session
   */
  subscribeToInteraction(sessionId: string, handler: TerminalInteractionHandler): () => void {
    if (!this.interactionHandlers.has(sessionId)) {
      this.interactionHandlers.set(sessionId, new Set());
    }
    this.interactionHandlers.get(sessionId)!.add(handler);
    return () => this.interactionHandlers.get(sessionId)?.delete(handler);
  }

  /**
   * Emit data event
   */
  emitData(sessionId: string, data: string): void {
    // Session-specific handlers
    this.dataHandlers.get(sessionId)?.forEach(handler => handler(sessionId, data));
    // Global handlers
    this.globalDataHandlers.forEach(handler => handler(sessionId, data));
  }

  /**
   * Emit exit event
   */
  emitExit(sessionId: string, exitCode: number): void {
    this.exitHandlers.get(sessionId)?.forEach(handler => handler(sessionId, exitCode));
    // Cleanup handlers for this session
    this.dataHandlers.delete(sessionId);
    this.exitHandlers.delete(sessionId);
    this.interactionHandlers.delete(sessionId);
  }

  /**
   * Emit interaction event
   */
  emitInteraction(sessionId: string, needsInteraction: boolean): void {
    this.interactionHandlers.get(sessionId)?.forEach(handler => handler(sessionId, needsInteraction));
  }

  /**
   * Clear all handlers for a session
   */
  clearSession(sessionId: string): void {
    this.dataHandlers.delete(sessionId);
    this.exitHandlers.delete(sessionId);
    this.interactionHandlers.delete(sessionId);
  }

  /**
   * Clear all handlers
   */
  clearAll(): void {
    this.dataHandlers.clear();
    this.exitHandlers.clear();
    this.interactionHandlers.clear();
    this.globalDataHandlers.clear();
  }
}

// Singleton instance
export const terminalEvents = new TerminalEventEmitter();
