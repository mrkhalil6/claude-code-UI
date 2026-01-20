import { readFile, writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { app } from 'electron';

export interface ToolPermission {
  tool: string;
  allowed: boolean;
  scope: 'always' | 'ask';  // 'always' = auto-allow, 'ask' = prompt each time
}

export interface PermissionsConfig {
  globalPermissions: ToolPermission[];
  updatedAt: string;
}

// Default list of known tools (fallback before session starts)
// The actual list is updated dynamically from the CLI's system event
// which includes MCP tools and any new tools added to Claude Code
export const KNOWN_TOOLS = [
  'Read',
  'Write',
  'Edit',
  'Bash',
  'Glob',
  'Grep',
  'WebFetch',
  'WebSearch',
  'NotebookEdit',
  'TodoWrite',
  'Task',
  'AskUserQuestion'
] as const;

export class PermissionsService {
  private configPath: string;
  private config: PermissionsConfig;

  constructor() {
    const userDataPath = app.getPath('userData');
    this.configPath = join(userDataPath, 'permissions.json');
    this.config = {
      globalPermissions: [],
      updatedAt: new Date().toISOString()
    };
  }

  /**
   * Load permissions from disk
   */
  async load(): Promise<PermissionsConfig> {
    try {
      const content = await readFile(this.configPath, 'utf-8');
      this.config = JSON.parse(content);
      return this.config;
    } catch (error) {
      // File doesn't exist or is invalid, use defaults
      console.log('No permissions config found, using defaults');
      return this.config;
    }
  }

  /**
   * Save permissions to disk
   */
  async save(): Promise<void> {
    try {
      const userDataPath = app.getPath('userData');
      await mkdir(userDataPath, { recursive: true });
      this.config.updatedAt = new Date().toISOString();
      await writeFile(this.configPath, JSON.stringify(this.config, null, 2));
    } catch (error) {
      console.error('Failed to save permissions:', error);
      throw error;
    }
  }

  /**
   * Get all global permissions
   */
  getGlobalPermissions(): ToolPermission[] {
    return this.config.globalPermissions;
  }

  /**
   * Set a global permission for a tool
   */
  async setGlobalPermission(tool: string, allowed: boolean, scope: 'always' | 'ask'): Promise<void> {
    const existing = this.config.globalPermissions.findIndex(p => p.tool === tool);

    if (existing >= 0) {
      this.config.globalPermissions[existing] = { tool, allowed, scope };
    } else {
      this.config.globalPermissions.push({ tool, allowed, scope });
    }

    await this.save();
  }

  /**
   * Remove a global permission
   */
  async removeGlobalPermission(tool: string): Promise<void> {
    this.config.globalPermissions = this.config.globalPermissions.filter(p => p.tool !== tool);
    await this.save();
  }

  /**
   * Check if a tool is globally allowed
   */
  isToolGloballyAllowed(tool: string): { allowed: boolean; scope: 'always' | 'ask' } | null {
    const permission = this.config.globalPermissions.find(p => p.tool === tool);
    if (permission) {
      return { allowed: permission.allowed, scope: permission.scope };
    }
    return null;
  }

  /**
   * Get tools that should be auto-allowed
   */
  getAutoAllowedTools(): string[] {
    return this.config.globalPermissions
      .filter(p => p.allowed && p.scope === 'always')
      .map(p => p.tool);
  }
}
