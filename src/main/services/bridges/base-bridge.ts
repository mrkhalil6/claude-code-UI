import { EventEmitter } from 'events';
import {
  BridgeConfig,
  BridgePlatform,
  BridgeStatus,
  BridgeStatusInfo,
  BridgeOptions,
  DiscordGuild,
} from '../../../shared/types';

/**
 * Handle for streaming messages to a platform.
 * Allows progressive edits (e.g., Discord message editing).
 */
export interface StreamingMessageHandle {
  /** Update the message with new accumulated content */
  update(content: string): Promise<void>;
  /** Finalize the message with complete content */
  finalize(content: string): Promise<void>;
  /** Send overflow content as a new message (for long responses) */
  overflow(content: string): Promise<void>;
}

/**
 * Abstract base class for all messaging platform bridges.
 * Extend this to add support for a new platform.
 *
 * Events emitted:
 * - 'message:inbound' - Message received from platform user
 * - 'status:change' - Bridge connection status changed
 * - 'error' - An error occurred
 */
export abstract class MessagingBridge extends EventEmitter {
  protected _status: BridgeStatus = 'disconnected';
  protected _error: string | undefined;
  protected _connectedAt: string | undefined;
  protected _botUsername: string | undefined;

  constructor(
    public readonly platform: BridgePlatform,
    protected config: BridgeConfig
  ) {
    super();
  }

  get id(): string {
    return this.config.id;
  }

  get status(): BridgeStatus {
    return this._status;
  }

  get options(): BridgeOptions {
    return this.config.options;
  }

  /** Connect the bridge (login bot, set up listeners) */
  abstract connect(): Promise<void>;

  /** Disconnect the bridge cleanly */
  abstract disconnect(): Promise<void>;

  /** Send a complete message to a channel */
  abstract sendMessage(channelId: string, content: string): Promise<void>;

  /** Start a streaming message (returns a handle for progressive edits) */
  abstract sendStreamingMessage(channelId: string, initialContent: string): Promise<StreamingMessageHandle>;

  /** Validate credentials without fully connecting */
  abstract validateCredentials(): Promise<{ valid: boolean; botUsername?: string; error?: string }>;

  /** Get available channels/servers for the platform */
  abstract getAvailableChannels(): Promise<DiscordGuild[]>;

  /** Get current status info */
  getStatusInfo(): BridgeStatusInfo {
    return {
      bridgeId: this.config.id,
      platform: this.platform,
      status: this._status,
      error: this._error,
      connectedAt: this._connectedAt,
      botUsername: this._botUsername,
    };
  }

  /** Update config in-place */
  updateConfig(config: BridgeConfig): void {
    this.config = config;
  }

  getConfig(): BridgeConfig {
    return this.config;
  }

  protected setStatus(status: BridgeStatus, error?: string): void {
    this._status = status;
    this._error = error;
    if (status === 'connected') {
      this._connectedAt = new Date().toISOString();
    }
    this.emit('status:change', {
      bridgeId: this.config.id,
      status,
      error,
      botUsername: this._botUsername,
    });
  }
}
