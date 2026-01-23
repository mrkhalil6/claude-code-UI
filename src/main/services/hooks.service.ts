import { readFile, writeFile, mkdir } from 'fs/promises';
import { join, dirname } from 'path';
import { homedir } from 'os';
import { randomUUID } from 'crypto';
import { HookEventType, HookWithId, HookPayload, HookMatcherEntry, HOOK_EVENT_TYPES } from '../../shared/types';

/**
 * Structure of hooks in settings.json
 * Format:
 * {
 *   "hooks": {
 *     "PreToolUse": [
 *       {
 *         "matcher": "Bash",
 *         "hooks": [
 *           { "type": "command", "command": "..." }
 *         ]
 *       }
 *     ]
 *   }
 * }
 */
interface HooksConfig {
  [eventType: string]: HookMatcherEntry[];
}

interface SettingsJson {
  hooks?: HooksConfig;
  [key: string]: unknown;
}

export class HooksService {
  private settingsPath: string;
  private hooks: HookWithId[] = [];

  constructor() {
    // Hooks are stored in ~/.claude/settings.json
    this.settingsPath = join(homedir(), '.claude', 'settings.json');
  }

  /**
   * Load hooks from settings.json
   */
  async loadHooks(): Promise<HookWithId[]> {
    try {
      const content = await readFile(this.settingsPath, 'utf-8');
      const settings: SettingsJson = JSON.parse(content);

      // Convert from storage format to HookWithId array
      this.hooks = [];
      if (settings.hooks) {
        for (const eventType of Object.keys(settings.hooks)) {
          const matcherEntries = settings.hooks[eventType];
          if (Array.isArray(matcherEntries)) {
            for (const matcherEntry of matcherEntries) {
              if (matcherEntry.hooks && Array.isArray(matcherEntry.hooks)) {
                for (const hookCmd of matcherEntry.hooks) {
                  if (hookCmd.type === 'command' && hookCmd.command) {
                    this.hooks.push({
                      id: randomUUID(),
                      type: eventType as HookEventType,
                      matcher: matcherEntry.matcher,
                      command: hookCmd.command
                    });
                  }
                }
              }
            }
          }
        }
      }

      return this.hooks;
    } catch (error) {
      console.log('No hooks config found, using defaults');
      this.hooks = [];
      return this.hooks;
    }
  }

  /**
   * Save hooks to settings.json
   */
  async saveHooks(): Promise<void> {
    try {
      // Ensure directory exists
      await mkdir(dirname(this.settingsPath), { recursive: true });

      // Read existing config to preserve other settings
      let settings: SettingsJson = {};
      try {
        const content = await readFile(this.settingsPath, 'utf-8');
        settings = JSON.parse(content);
      } catch {
        // File doesn't exist, start fresh
      }

      // Convert from HookWithId array to storage format
      // Group hooks by event type, then by matcher
      const hooksConfig: HooksConfig = {};

      for (const hook of this.hooks) {
        if (!hooksConfig[hook.type]) {
          hooksConfig[hook.type] = [];
        }

        // Find existing matcher entry or create new one
        let matcherEntry = hooksConfig[hook.type].find(e => e.matcher === hook.matcher);
        if (!matcherEntry) {
          matcherEntry = { matcher: hook.matcher, hooks: [] };
          hooksConfig[hook.type].push(matcherEntry);
        }

        // Add the hook command
        matcherEntry.hooks.push({
          type: 'command',
          command: hook.command
        });
      }

      settings.hooks = hooksConfig;

      await writeFile(this.settingsPath, JSON.stringify(settings, null, 2));
      console.log('Saved hooks config successfully');
    } catch (error) {
      console.error('Failed to save hooks config:', error);
      throw error;
    }
  }

  /**
   * Get all hooks
   */
  getHooks(): HookWithId[] {
    return this.hooks;
  }

  /**
   * Add a new hook
   */
  async addHook(payload: HookPayload): Promise<HookWithId> {
    // Validate the hook
    const validation = this.validateHook(payload);
    if (!validation.valid) {
      throw new Error(validation.error);
    }

    const hook: HookWithId = {
      id: randomUUID(),
      type: payload.type,
      matcher: payload.matcher,
      command: payload.command
    };

    this.hooks.push(hook);
    await this.saveHooks();
    return hook;
  }

  /**
   * Update an existing hook
   */
  async updateHook(payload: HookPayload): Promise<HookWithId> {
    if (!payload.id) {
      throw new Error('Hook ID is required for update');
    }

    // Validate the hook
    const validation = this.validateHook(payload);
    if (!validation.valid) {
      throw new Error(validation.error);
    }

    const index = this.hooks.findIndex(h => h.id === payload.id);
    if (index === -1) {
      throw new Error(`Hook with ID ${payload.id} not found`);
    }

    const updatedHook: HookWithId = {
      id: payload.id,
      type: payload.type,
      matcher: payload.matcher,
      command: payload.command
    };

    this.hooks[index] = updatedHook;
    await this.saveHooks();
    return updatedHook;
  }

  /**
   * Remove a hook
   */
  async removeHook(id: string): Promise<boolean> {
    const index = this.hooks.findIndex(h => h.id === id);
    if (index === -1) {
      return false;
    }

    this.hooks.splice(index, 1);
    await this.saveHooks();
    return true;
  }

  /**
   * Validate a hook payload
   */
  validateHook(payload: HookPayload): { valid: boolean; error?: string } {
    // Validate event type
    if (!HOOK_EVENT_TYPES.includes(payload.type)) {
      return { valid: false, error: `Invalid event type: ${payload.type}` };
    }

    // Validate matcher
    if (!payload.matcher || payload.matcher.trim() === '') {
      return { valid: false, error: 'Matcher is required' };
    }

    // Validate command
    if (!payload.command || payload.command.trim() === '') {
      return { valid: false, error: 'Command is required' };
    }

    return { valid: true };
  }
}
