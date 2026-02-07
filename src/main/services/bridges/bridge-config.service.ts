import { readFile, writeFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import {
  BridgeConfig,
  DiscordBridgeConfig,
  CreateBridgePayload,
  DEFAULT_BRIDGE_OPTIONS,
} from '../../../shared/types';

const CONFIG_DIR = join(homedir(), '.claude-ui');
const CONFIG_FILE = join(CONFIG_DIR, 'bridges.json');

interface BridgeConfigFile {
  bridges: BridgeConfig[];
}

export class BridgeConfigService {
  private configs: BridgeConfig[] = [];

  async loadAll(): Promise<BridgeConfig[]> {
    try {
      if (!existsSync(CONFIG_FILE)) {
        this.configs = [];
        return [];
      }
      const raw = await readFile(CONFIG_FILE, 'utf-8');
      const data: BridgeConfigFile = JSON.parse(raw);
      this.configs = data.bridges || [];
      return this.configs;
    } catch (error) {
      console.error('Failed to load bridge configs:', error);
      this.configs = [];
      return [];
    }
  }

  async save(config: BridgeConfig): Promise<void> {
    const idx = this.configs.findIndex((c) => c.id === config.id);
    if (idx >= 0) {
      this.configs[idx] = config;
    } else {
      this.configs.push(config);
    }
    await this.persist();
  }

  async delete(id: string): Promise<void> {
    this.configs = this.configs.filter((c) => c.id !== id);
    await this.persist();
  }

  getAll(): BridgeConfig[] {
    return [...this.configs];
  }

  getById(id: string): BridgeConfig | undefined {
    return this.configs.find((c) => c.id === id);
  }

  createConfig(payload: CreateBridgePayload): BridgeConfig {
    const now = new Date().toISOString();
    const id = crypto.randomUUID();

    if (payload.platform === 'discord') {
      const config: DiscordBridgeConfig = {
        id,
        platform: 'discord',
        name: payload.name,
        enabled: true,
        autoConnect: payload.autoConnect ?? false,
        createdAt: now,
        updatedAt: now,
        options: { ...DEFAULT_BRIDGE_OPTIONS, ...payload.options },
        botToken: payload.botToken,
        channelMappings: [],
      };
      return config;
    }

    // Future platforms would go here
    throw new Error(`Unsupported platform: ${payload.platform}`);
  }

  private async persist(): Promise<void> {
    try {
      if (!existsSync(CONFIG_DIR)) {
        await mkdir(CONFIG_DIR, { recursive: true });
      }
      const data: BridgeConfigFile = { bridges: this.configs };
      await writeFile(CONFIG_FILE, JSON.stringify(data, null, 2), 'utf-8');
    } catch (error) {
      console.error('Failed to persist bridge configs:', error);
      throw error;
    }
  }
}
