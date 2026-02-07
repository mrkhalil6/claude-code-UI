import {
  Client,
  GatewayIntentBits,
  Message,
  TextChannel,
  ChannelType,
} from 'discord.js';
import { MessagingBridge, StreamingMessageHandle } from './base-bridge';
import { chunkMessage } from './message-formatter';
import {
  DiscordBridgeConfig,
  DiscordGuild,
  BridgeMessageEvent,
} from '../../../shared/types';

export class DiscordBridge extends MessagingBridge {
  private client: Client | null = null;

  constructor(config: DiscordBridgeConfig) {
    super('discord', config);
  }

  private get discordConfig(): DiscordBridgeConfig {
    return this.config as DiscordBridgeConfig;
  }

  async connect(): Promise<void> {
    if (this._status === 'connected' || this._status === 'connecting') {
      return;
    }

    this.setStatus('connecting');

    try {
      this.client = new Client({
        intents: [
          GatewayIntentBits.Guilds,
          GatewayIntentBits.GuildMessages,
          GatewayIntentBits.MessageContent,
        ],
      });

      this.client.on('ready', () => {
        this._botUsername = this.client?.user?.username;
        console.log(`[DiscordBridge] Bot logged in as ${this._botUsername}`);
        this.setStatus('connected');
      });

      this.client.on('messageCreate', (message: Message) => {
        this.handleIncomingMessage(message);
      });

      this.client.on('error', (error: Error) => {
        console.error(`[DiscordBridge] Client error:`, error);
        this.emit('error', {
          bridgeId: this.id,
          error: error.message,
          timestamp: new Date().toISOString(),
        });
      });

      this.client.on('disconnect', () => {
        console.log(`[DiscordBridge] Disconnected`);
        this.setStatus('disconnected');
      });

      await this.client.login(this.discordConfig.botToken);
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Unknown error';
      console.error(`[DiscordBridge] Failed to connect:`, msg);
      this.setStatus('error', msg);
      this.client?.destroy();
      this.client = null;
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    if (this.client) {
      this.client.removeAllListeners();
      this.client.destroy();
      this.client = null;
    }
    this.setStatus('disconnected');
  }

  async sendMessage(channelId: string, content: string): Promise<void> {
    if (!this.client) throw new Error('Not connected');

    const channel = await this.client.channels.fetch(channelId);
    if (!channel || !channel.isTextBased()) {
      throw new Error(`Channel ${channelId} not found or not text-based`);
    }

    const textChannel = channel as TextChannel;
    const chunks = chunkMessage(content);

    for (const chunk of chunks) {
      await textChannel.send(chunk);
    }
  }

  async sendStreamingMessage(
    channelId: string,
    initialContent: string
  ): Promise<StreamingMessageHandle> {
    if (!this.client) throw new Error('Not connected');

    const channel = await this.client.channels.fetch(channelId);
    if (!channel || !channel.isTextBased()) {
      throw new Error(`Channel ${channelId} not found or not text-based`);
    }

    const textChannel = channel as TextChannel;
    const message = await textChannel.send(initialContent || '*Thinking...*');

    const editInterval = this.discordConfig.options.streamingEditInterval;
    let lastEditTime = Date.now();
    let pendingContent: string | null = null;
    let editTimer: ReturnType<typeof setTimeout> | null = null;

    const doEdit = async (content: string) => {
      try {
        const truncated = content.length > 2000
          ? content.slice(0, 1950) + '\n*...(streaming)*'
          : content;
        await message.edit(truncated);
        lastEditTime = Date.now();
      } catch (err) {
        console.error('[DiscordBridge] Failed to edit message:', err);
      }
    };

    const handle: StreamingMessageHandle = {
      async update(content: string) {
        const now = Date.now();
        const elapsed = now - lastEditTime;

        if (elapsed >= editInterval) {
          // Enough time has passed, edit immediately
          if (editTimer) {
            clearTimeout(editTimer);
            editTimer = null;
          }
          pendingContent = null;
          await doEdit(content);
        } else {
          // Debounce the edit
          pendingContent = content;
          if (!editTimer) {
            editTimer = setTimeout(async () => {
              editTimer = null;
              if (pendingContent) {
                const c = pendingContent;
                pendingContent = null;
                await doEdit(c);
              }
            }, editInterval - elapsed);
          }
        }
      },

      async finalize(content: string) {
        if (editTimer) {
          clearTimeout(editTimer);
          editTimer = null;
        }
        pendingContent = null;

        // Final content may need chunking
        const chunks = chunkMessage(content);
        if (chunks.length === 1) {
          try {
            await message.edit(chunks[0]);
          } catch {
            // If edit fails (message deleted, etc), send new
            await textChannel.send(chunks[0]);
          }
        } else {
          // Edit first chunk into original message, send rest as new
          try {
            await message.edit(chunks[0]);
          } catch {
            await textChannel.send(chunks[0]);
          }
          for (let i = 1; i < chunks.length; i++) {
            await textChannel.send(chunks[i]);
          }
        }
      },

      async overflow(content: string) {
        const chunks = chunkMessage(content);
        for (const chunk of chunks) {
          await textChannel.send(chunk);
        }
      },
    };

    return handle;
  }

  async validateCredentials(): Promise<{
    valid: boolean;
    botUsername?: string;
    error?: string;
  }> {
    const tempClient = new Client({
      intents: [GatewayIntentBits.Guilds],
    });

    try {
      await tempClient.login(this.discordConfig.botToken);
      const username = tempClient.user?.username;
      tempClient.destroy();
      return { valid: true, botUsername: username };
    } catch (error) {
      tempClient.destroy();
      const msg = error instanceof Error ? error.message : 'Invalid token';
      return { valid: false, error: msg };
    }
  }

  async getAvailableChannels(): Promise<DiscordGuild[]> {
    // Use existing connected client, or connect temporarily
    let client = this.client;
    let tempClient = false;

    if (!client || !client.isReady()) {
      client = new Client({
        intents: [GatewayIntentBits.Guilds],
      });
      await client.login(this.discordConfig.botToken);
      tempClient = true;
    }

    try {
      const guilds: DiscordGuild[] = [];

      for (const [, oauthGuild] of client.guilds.cache) {
        // Fetch full guild to get channels
        const guild = await oauthGuild.fetch();
        const channels = await guild.channels.fetch();

        const discordChannels = channels
          .filter((ch) => ch !== null)
          .map((ch) => ({
            id: ch!.id,
            name: ch!.name,
            type: ch!.type === ChannelType.GuildText
              ? 'text' as const
              : ch!.type === ChannelType.GuildVoice
              ? 'voice' as const
              : ch!.type === ChannelType.GuildCategory
              ? 'category' as const
              : 'other' as const,
          }))
          .filter((ch) => ch.type === 'text');

        guilds.push({
          id: guild.id,
          name: guild.name,
          icon: guild.iconURL(),
          channels: discordChannels,
        });
      }

      return guilds;
    } finally {
      if (tempClient) {
        client.destroy();
      }
    }
  }

  /** Get guilds/channels from the bot's connected servers */
  async getGuilds(): Promise<DiscordGuild[]> {
    return this.getAvailableChannels();
  }

  private handleIncomingMessage(message: Message): void {
    // Ignore bot messages (including our own)
    if (message.author.bot) return;

    // Check if this channel has a mapping
    const mapping = this.discordConfig.channelMappings.find(
      (m) => m.discordChannelId === message.channel.id
    );
    if (!mapping) return;

    const event: BridgeMessageEvent = {
      bridgeId: this.id,
      platform: 'discord',
      channelId: message.channel.id,
      authorId: message.author.id,
      authorName: message.author.username,
      content: message.content,
      timestamp: message.createdAt.toISOString(),
      direction: 'inbound',
    };

    this.emit('message:inbound', event, mapping);
  }
}
