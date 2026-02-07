// ===== Bridge Platform Types =====

export type BridgePlatform = 'discord' | 'telegram' | 'whatsapp' | 'slack';

export type BridgeStatus =
  | 'disconnected'
  | 'connecting'
  | 'connected'
  | 'error'
  | 'reconnecting';

// ===== Bridge Configuration =====

export interface BridgeConfigBase {
  id: string;
  platform: BridgePlatform;
  name: string;
  enabled: boolean;
  autoConnect: boolean;
  createdAt: string;
  updatedAt: string;
  options: BridgeOptions;
}

export interface BridgeOptions {
  showThinking: boolean;
  showToolCalls: boolean;
  streamingEditInterval: number; // ms between Discord message edits (min ~1500)
}

export const DEFAULT_BRIDGE_OPTIONS: BridgeOptions = {
  showThinking: false,
  showToolCalls: true,
  streamingEditInterval: 1500,
};

// ===== Discord-Specific =====

export interface DiscordBridgeConfig extends BridgeConfigBase {
  platform: 'discord';
  botToken: string;
  channelMappings: DiscordChannelMapping[];
}

export interface DiscordChannelMapping {
  discordChannelId: string;
  discordChannelName: string;
  discordGuildId: string;
  discordGuildName: string;
  claudeSessionId: string | null; // null = create new session on first message
  cwd: string;
}

export interface DiscordGuild {
  id: string;
  name: string;
  icon: string | null;
  channels: DiscordChannel[];
}

export interface DiscordChannel {
  id: string;
  name: string;
  type: 'text' | 'voice' | 'category' | 'other';
}

// ===== Union type for all bridge configs =====

export type BridgeConfig = DiscordBridgeConfig;
// Future: | TelegramBridgeConfig | WhatsAppBridgeConfig | SlackBridgeConfig

// ===== Status & Events =====

export interface BridgeStatusInfo {
  bridgeId: string;
  platform: BridgePlatform;
  status: BridgeStatus;
  error?: string;
  connectedAt?: string;
  botUsername?: string;
}

export interface BridgeStatusEvent {
  bridgeId: string;
  status: BridgeStatus;
  error?: string;
  botUsername?: string;
}

export interface BridgeMessageEvent {
  bridgeId: string;
  platform: BridgePlatform;
  channelId: string;
  authorId: string;
  authorName: string;
  content: string;
  timestamp: string;
  direction: 'inbound' | 'outbound';
}

export interface BridgeErrorEvent {
  bridgeId: string;
  error: string;
  timestamp: string;
}

// ===== IPC Payload Types =====

export interface CreateBridgePayload {
  platform: BridgePlatform;
  name: string;
  botToken: string;
  autoConnect?: boolean;
  options?: Partial<BridgeOptions>;
}

export interface UpdateBridgePayload {
  id: string;
  name?: string;
  botToken?: string;
  enabled?: boolean;
  autoConnect?: boolean;
  options?: Partial<BridgeOptions>;
}

export interface AddChannelMappingPayload {
  bridgeId: string;
  discordChannelId: string;
  discordChannelName: string;
  discordGuildId: string;
  discordGuildName: string;
  cwd: string;
}

export interface RemoveChannelMappingPayload {
  bridgeId: string;
  discordChannelId: string;
}

export interface TestTokenPayload {
  platform: BridgePlatform;
  token: string;
}

export interface TestTokenResult {
  valid: boolean;
  botUsername?: string;
  error?: string;
}
