import { EventEmitter } from 'events';
import { ClaudeCliService } from '../claude-cli.service';
import { BridgeConfigService } from './bridge-config.service';
import { MessagingBridge, StreamingMessageHandle } from './base-bridge';
import { DiscordBridge } from './discord-bridge';
import {
  formatAssistantMessage,
} from './message-formatter';
import {
  BridgeConfig,
  BridgeStatusInfo,
  DiscordBridgeConfig,
  DiscordGuild,
  DiscordChannelMapping,
  CreateBridgePayload,
  UpdateBridgePayload,
  AddChannelMappingPayload,
  RemoveChannelMappingPayload,
  TestTokenResult,
  BridgeMessageEvent,
  BridgeStatusEvent,
  BridgeErrorEvent,
  CLIServiceEvent,
  AssistantEvent,
  ResultEvent,
  StreamEvent,
  SystemInitEvent,
  ContentDelta,
} from '../../../shared/types';

/**
 * Orchestrates all messaging bridges.
 * Routes messages between platforms and the Claude CLI.
 *
 * Events emitted:
 * - 'bridge:status' - Bridge status changed
 * - 'bridge:message' - Message sent/received
 * - 'bridge:error' - Error occurred
 */
export class BridgeManager extends EventEmitter {
  private configService: BridgeConfigService;
  private bridges: Map<string, MessagingBridge> = new Map();

  // Track active streaming handles: sessionId -> handle
  private streamingHandles: Map<string, StreamingMessageHandle> = new Map();
  // Track which CLI sessions map to which bridge channels
  private sessionToChannel: Map<string, { bridgeId: string; channelId: string }> = new Map();
  // Track accumulated content per session for streaming
  private streamingContent: Map<string, string> = new Map();
  // Track CLI resume session IDs per channel: "bridgeId:channelId" -> cliSessionId
  // This persists across session recreations so conversations can be resumed
  private cliResumeIds: Map<string, string> = new Map();

  constructor(private cliService: ClaudeCliService) {
    super();
    this.configService = new BridgeConfigService();

    // Listen for CLI events to route back to bridges
    this.cliService.on('cli:system', (event: CLIServiceEvent) => this.handleCliSystem(event));
    this.cliService.on('cli:stream', (event: CLIServiceEvent) => this.handleCliStream(event));
    this.cliService.on('cli:assistant', (event: CLIServiceEvent) => this.handleCliAssistant(event));
    this.cliService.on('cli:result', (event: CLIServiceEvent) => this.handleCliResult(event));
  }

  async initialize(): Promise<void> {
    console.log('[BridgeManager] Initializing...');
    const configs = await this.configService.loadAll();
    console.log(`[BridgeManager] Loaded ${configs.length} bridge configs`);

    // Auto-connect enabled bridges
    for (const config of configs) {
      if (config.enabled && config.autoConnect) {
        try {
          await this.connectBridge(config.id);
        } catch (error) {
          console.error(`[BridgeManager] Failed to auto-connect bridge ${config.id}:`, error);
        }
      }
    }
  }

  async shutdown(): Promise<void> {
    console.log('[BridgeManager] Shutting down...');
    const disconnectPromises: Promise<void>[] = [];
    for (const [, bridge] of this.bridges) {
      disconnectPromises.push(bridge.disconnect().catch((e) =>
        console.error(`[BridgeManager] Error disconnecting bridge:`, e)
      ));
    }
    await Promise.all(disconnectPromises);
    this.bridges.clear();
    this.streamingHandles.clear();
    this.sessionToChannel.clear();
    this.streamingContent.clear();
    this.cliResumeIds.clear();
  }

  // ===== CRUD =====

  async createBridge(payload: CreateBridgePayload): Promise<BridgeConfig> {
    const config = this.configService.createConfig(payload);
    await this.configService.save(config);
    return config;
  }

  async updateBridge(payload: UpdateBridgePayload): Promise<BridgeConfig> {
    const existing = this.configService.getById(payload.id);
    if (!existing) throw new Error(`Bridge not found: ${payload.id}`);

    const updated: BridgeConfig = {
      ...existing,
      ...(payload.name !== undefined && { name: payload.name }),
      ...(payload.enabled !== undefined && { enabled: payload.enabled }),
      ...(payload.autoConnect !== undefined && { autoConnect: payload.autoConnect }),
      ...(payload.options && {
        options: { ...existing.options, ...payload.options },
      }),
      updatedAt: new Date().toISOString(),
    };

    // Update token for Discord
    if (payload.botToken && updated.platform === 'discord') {
      (updated as DiscordBridgeConfig).botToken = payload.botToken;
    }

    await this.configService.save(updated);

    // Update the running bridge if it exists
    const bridge = this.bridges.get(payload.id);
    if (bridge) {
      bridge.updateConfig(updated);
    }

    return updated;
  }

  async deleteBridge(id: string): Promise<void> {
    // Disconnect first if running
    const bridge = this.bridges.get(id);
    if (bridge) {
      await bridge.disconnect();
      this.bridges.delete(id);
    }
    await this.configService.delete(id);
  }

  getAllBridges(): BridgeConfig[] {
    return this.configService.getAll();
  }

  getBridge(id: string): BridgeConfig | undefined {
    return this.configService.getById(id);
  }

  // ===== Connection =====

  async connectBridge(id: string): Promise<void> {
    const config = this.configService.getById(id);
    if (!config) throw new Error(`Bridge not found: ${id}`);

    // Disconnect existing if any
    const existing = this.bridges.get(id);
    if (existing) {
      await existing.disconnect();
    }

    const bridge = this.createBridgeInstance(config);
    this.bridges.set(id, bridge);

    // Wire up events
    bridge.on('status:change', (event: BridgeStatusEvent) => {
      this.emit('bridge:status', event);
    });

    bridge.on('message:inbound', (event: BridgeMessageEvent, mapping: DiscordChannelMapping) => {
      this.handleInboundMessage(event, mapping);
    });

    bridge.on('error', (event: BridgeErrorEvent) => {
      this.emit('bridge:error', event);
    });

    await bridge.connect();
  }

  async disconnectBridge(id: string): Promise<void> {
    const bridge = this.bridges.get(id);
    if (bridge) {
      await bridge.disconnect();
      this.bridges.delete(id);
    }
  }

  getStatus(id: string): BridgeStatusInfo | null {
    const bridge = this.bridges.get(id);
    if (bridge) {
      return bridge.getStatusInfo();
    }
    // Return disconnected status for known but unconnected bridges
    const config = this.configService.getById(id);
    if (config) {
      return {
        bridgeId: id,
        platform: config.platform,
        status: 'disconnected',
      };
    }
    return null;
  }

  getAllStatuses(): Record<string, BridgeStatusInfo> {
    const statuses: Record<string, BridgeStatusInfo> = {};
    for (const config of this.configService.getAll()) {
      const bridge = this.bridges.get(config.id);
      if (bridge) {
        statuses[config.id] = bridge.getStatusInfo();
      } else {
        statuses[config.id] = {
          bridgeId: config.id,
          platform: config.platform,
          status: 'disconnected',
        };
      }
    }
    return statuses;
  }

  // ===== Discord-specific =====

  async getDiscordGuilds(bridgeId: string): Promise<DiscordGuild[]> {
    const bridge = this.bridges.get(bridgeId);
    if (!bridge || bridge.platform !== 'discord') {
      // Try using config token directly
      const config = this.configService.getById(bridgeId) as DiscordBridgeConfig | undefined;
      if (!config || config.platform !== 'discord') {
        throw new Error('Discord bridge not found');
      }
      const tempBridge = new DiscordBridge(config);
      try {
        return await tempBridge.getAvailableChannels();
      } finally {
        await tempBridge.disconnect();
      }
    }
    return (bridge as DiscordBridge).getGuilds();
  }

  async testToken(platform: string, token: string): Promise<TestTokenResult> {
    if (platform === 'discord') {
      const tempConfig: DiscordBridgeConfig = {
        id: 'temp-test',
        platform: 'discord',
        name: 'test',
        enabled: false,
        autoConnect: false,
        createdAt: '',
        updatedAt: '',
        options: { showThinking: false, showToolCalls: true, streamingEditInterval: 1500 },
        botToken: token,
        channelMappings: [],
      };
      const tempBridge = new DiscordBridge(tempConfig);
      return tempBridge.validateCredentials();
    }
    return { valid: false, error: `Unsupported platform: ${platform}` };
  }

  // ===== Channel Mappings =====

  async addChannelMapping(payload: AddChannelMappingPayload): Promise<BridgeConfig> {
    const config = this.configService.getById(payload.bridgeId);
    if (!config || config.platform !== 'discord') {
      throw new Error('Discord bridge not found');
    }

    const discordConfig = config as DiscordBridgeConfig;

    // Remove existing mapping for same channel if any
    discordConfig.channelMappings = discordConfig.channelMappings.filter(
      (m) => m.discordChannelId !== payload.discordChannelId
    );

    discordConfig.channelMappings.push({
      discordChannelId: payload.discordChannelId,
      discordChannelName: payload.discordChannelName,
      discordGuildId: payload.discordGuildId,
      discordGuildName: payload.discordGuildName,
      claudeSessionId: null,
      cwd: payload.cwd,
    });

    discordConfig.updatedAt = new Date().toISOString();
    await this.configService.save(discordConfig);

    // Update running bridge
    const bridge = this.bridges.get(payload.bridgeId);
    if (bridge) {
      bridge.updateConfig(discordConfig);
    }

    return discordConfig;
  }

  async removeChannelMapping(payload: RemoveChannelMappingPayload): Promise<BridgeConfig> {
    const config = this.configService.getById(payload.bridgeId);
    if (!config || config.platform !== 'discord') {
      throw new Error('Discord bridge not found');
    }

    const discordConfig = config as DiscordBridgeConfig;
    discordConfig.channelMappings = discordConfig.channelMappings.filter(
      (m) => m.discordChannelId !== payload.discordChannelId
    );
    discordConfig.updatedAt = new Date().toISOString();
    await this.configService.save(discordConfig);

    const bridge = this.bridges.get(payload.bridgeId);
    if (bridge) {
      bridge.updateConfig(discordConfig);
    }

    return discordConfig;
  }

  // ===== Inbound Message Routing (Platform -> Claude) =====

  private async handleInboundMessage(
    event: BridgeMessageEvent,
    mapping: DiscordChannelMapping
  ): Promise<void> {
    console.log(`[BridgeManager] Inbound message from ${event.authorName} in ${event.channelId}: "${event.content.slice(0, 100)}"`);

    this.emit('bridge:message', event);

    const bridge = this.bridges.get(event.bridgeId);
    if (!bridge) return;

    try {
      const channelKey = `${event.bridgeId}:${event.channelId}`;
      const resumeId = this.cliResumeIds.get(channelKey) || undefined;

      console.log(`[BridgeManager] channelKey="${channelKey}", resumeId=${resumeId || '(none)'}, cliResumeIds size=${this.cliResumeIds.size}`);

      const sessionId = await this.cliService.startSession({
        cwd: mapping.cwd,
        resumeSessionId: resumeId,
      });

      console.log(`[BridgeManager] Created session ${sessionId} for channel ${event.channelId}${resumeId ? ` (resuming ${resumeId})` : ' (new conversation)'}`);

      // Track the session -> channel mapping
      this.sessionToChannel.set(sessionId, {
        bridgeId: event.bridgeId,
        channelId: event.channelId,
      });

      // Start streaming handle
      const handle = await bridge.sendStreamingMessage(event.channelId, '*Thinking...*');
      this.streamingHandles.set(sessionId, handle);
      this.streamingContent.set(sessionId, '');

      // Send message to Claude
      this.cliService.sendMessage(sessionId, event.content);
    } catch (error) {
      console.error('[BridgeManager] Error routing inbound message:', error);
      try {
        await bridge.sendMessage(event.channelId, `Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
      } catch {
        // ignore send failure
      }
    }
  }

  // ===== Outbound Event Routing (Claude -> Platform) =====

  private handleCliSystem(serviceEvent: CLIServiceEvent): void {
    const { sessionId, event } = serviceEvent;
    const mapping = this.sessionToChannel.get(sessionId);
    if (!mapping) {
      console.log(`[BridgeManager] handleCliSystem: session ${sessionId} not in sessionToChannel (not a bridge session)`);
      return;
    }

    const systemEvent = event as SystemInitEvent;
    if (systemEvent.session_id) {
      const channelKey = `${mapping.bridgeId}:${mapping.channelId}`;
      this.cliResumeIds.set(channelKey, systemEvent.session_id);
      console.log(`[BridgeManager] Captured CLI session ID "${systemEvent.session_id}" for channelKey="${channelKey}"`);
    } else {
      console.log(`[BridgeManager] handleCliSystem: no session_id in system event`);
    }
  }

  /** Also capture session_id from result events as a fallback */
  private captureResumeIdFromEvent(serviceEvent: CLIServiceEvent): void {
    const { sessionId, event } = serviceEvent;
    const mapping = this.sessionToChannel.get(sessionId);
    if (!mapping) return;

    // All CLI events have session_id at the top level
    const eventAny = event as unknown as Record<string, unknown>;
    const cliSessionId = eventAny.session_id as string | undefined;
    if (cliSessionId) {
      const channelKey = `${mapping.bridgeId}:${mapping.channelId}`;
      if (!this.cliResumeIds.has(channelKey)) {
        this.cliResumeIds.set(channelKey, cliSessionId);
        console.log(`[BridgeManager] Fallback: captured CLI session ID "${cliSessionId}" from ${eventAny.type} event`);
      }
    }
  }

  private handleCliStream(serviceEvent: CLIServiceEvent): void {
    const { sessionId, event } = serviceEvent;
    const mapping = this.sessionToChannel.get(sessionId);
    if (!mapping) return; // Not a bridge session

    const handle = this.streamingHandles.get(sessionId);
    if (!handle) return;

    const streamEvent = event as StreamEvent;
    if (streamEvent.event?.type === 'content_block_delta') {
      const delta = streamEvent.event.delta as ContentDelta;
      if (delta.type === 'text_delta') {
        const current = (this.streamingContent.get(sessionId) || '') + delta.text;
        this.streamingContent.set(sessionId, current);
        handle.update(current).catch((e) =>
          console.error('[BridgeManager] Stream update error:', e)
        );
      }
    }
  }

  private handleCliAssistant(serviceEvent: CLIServiceEvent): void {
    this.captureResumeIdFromEvent(serviceEvent);

    const { sessionId, event } = serviceEvent;
    const mapping = this.sessionToChannel.get(sessionId);
    if (!mapping) return;

    const bridge = this.bridges.get(mapping.bridgeId);
    if (!bridge) return;

    const assistantEvent = event as AssistantEvent;
    const formatted = formatAssistantMessage(assistantEvent, bridge.options);

    if (formatted) {
      this.streamingContent.set(sessionId, formatted);
      const handle = this.streamingHandles.get(sessionId);
      if (handle) {
        handle.update(formatted).catch((e) =>
          console.error('[BridgeManager] Assistant update error:', e)
        );
      }
    }
  }

  private handleCliResult(serviceEvent: CLIServiceEvent): void {
    // Ensure we've captured the resume ID before cleaning up
    this.captureResumeIdFromEvent(serviceEvent);

    const { sessionId, event } = serviceEvent;
    const mapping = this.sessionToChannel.get(sessionId);
    if (!mapping) return;

    const bridge = this.bridges.get(mapping.bridgeId);
    if (!bridge) return;

    const resultEvent = event as ResultEvent;
    const handle = this.streamingHandles.get(sessionId);

    const finalContent = this.streamingContent.get(sessionId) || resultEvent.result || '(No response)';

    if (handle) {
      handle.finalize(finalContent).catch((e) =>
        console.error('[BridgeManager] Finalize error:', e)
      );
    } else {
      // No streaming handle, send directly
      bridge.sendMessage(mapping.channelId, finalContent).catch((e) =>
        console.error('[BridgeManager] Send error:', e)
      );
    }

    // Cleanup
    this.streamingHandles.delete(sessionId);
    this.streamingContent.delete(sessionId);
    // Keep sessionToChannel for future messages in same channel
  }

  // ===== Bridge Instance Factory =====

  private createBridgeInstance(config: BridgeConfig): MessagingBridge {
    switch (config.platform) {
      case 'discord':
        return new DiscordBridge(config as DiscordBridgeConfig);
      default:
        throw new Error(`Unsupported platform: ${config.platform}`);
    }
  }
}
