import { readFile, writeFile } from 'fs/promises';
import { join } from 'path';
import { homedir } from 'os';

// MCP Server with stdio transport (runs local process)
export interface McpServerStdio {
  type?: 'stdio';  // Default if not specified
  command: string;
  args?: string[];
  env?: Record<string, string>;
}

// MCP Server with SSE transport (connects to remote URL via Server-Sent Events)
export interface McpServerSse {
  type: 'sse';
  url: string;
  headers?: Record<string, string>;
}

// MCP Server with HTTP transport (connects to remote URL via HTTP)
export interface McpServerHttp {
  type: 'http';
  url: string;
  headers?: Record<string, string>;
}

export type McpServer = McpServerStdio | McpServerSse | McpServerHttp;

export interface McpConfig {
  mcpServers: Record<string, McpServer>;
}

// Structure for ~/.claude.json (both global and project-specific settings)
interface ClaudeJsonConfig {
  mcpServers?: Record<string, McpServer>;  // Global/user-scope MCP servers at root level
  projects?: Record<string, {
    mcpServers?: Record<string, McpServer>;  // Project-specific MCP servers
    [key: string]: unknown;
  }>;
  [key: string]: unknown;
}

export class McpService {
  // Config path: ~/.claude.json (used for both global and project MCP servers)
  private configPath: string;

  private globalServers: Record<string, McpServer> = {};
  private projectServers: Record<string, McpServer> = {};
  private currentProject: string = '';

  constructor() {
    // Claude CLI uses ~/.claude.json for both global (root mcpServers) and project-specific servers
    this.configPath = join(homedir(), '.claude.json');
  }

  // ===== GLOBAL MCP SERVERS =====

  /**
   * Load global MCP servers from ~/.claude.json root-level mcpServers
   */
  async loadGlobal(): Promise<Record<string, McpServer>> {
    console.log('loadGlobal called, path:', this.configPath);
    try {
      const content = await readFile(this.configPath, 'utf-8');
      const config: ClaudeJsonConfig = JSON.parse(content);
      // Global servers are at root level mcpServers (not under projects)
      this.globalServers = config.mcpServers || {};
      console.log('Loaded global servers:', Object.keys(this.globalServers));
      return this.globalServers;
    } catch (error) {
      console.log('No global MCP config found, using defaults:', error);
      this.globalServers = {};
      return this.globalServers;
    }
  }

  /**
   * Save global MCP servers to ~/.claude.json root-level mcpServers
   */
  async saveGlobal(): Promise<void> {
    console.log('saveGlobal called, path:', this.configPath);
    console.log('globalServers to save:', JSON.stringify(this.globalServers, null, 2));

    try {
      // Read existing config to preserve other settings
      let config: ClaudeJsonConfig = {};
      try {
        const content = await readFile(this.configPath, 'utf-8');
        config = JSON.parse(content);
        console.log('Existing config loaded');
      } catch (err) {
        console.log('No existing config file, starting fresh:', err);
      }

      // Update root-level MCP servers (global/user scope)
      config.mcpServers = this.globalServers;

      console.log('Writing to:', this.configPath);
      await writeFile(this.configPath, JSON.stringify(config, null, 2));
      console.log('Saved global MCP config successfully');
    } catch (error) {
      console.error('Failed to save global MCP config:', error);
      throw error;
    }
  }

  /**
   * Get all global MCP servers
   */
  getGlobalServers(): Record<string, McpServer> {
    return this.globalServers;
  }

  /**
   * Add or update a global MCP server
   */
  async addGlobalServer(name: string, server: McpServer): Promise<void> {
    console.log('addGlobalServer called:', name, JSON.stringify(server));
    this.globalServers[name] = server;
    await this.saveGlobal();
  }

  /**
   * Remove a global MCP server
   */
  async removeGlobalServer(name: string): Promise<void> {
    console.log('removeGlobalServer called:', name);
    console.log('Current globalServers before delete:', Object.keys(this.globalServers));
    delete this.globalServers[name];
    console.log('globalServers after delete:', Object.keys(this.globalServers));
    await this.saveGlobal();
  }

  // ===== PROJECT MCP SERVERS =====

  /**
   * Set the current project path for project-specific MCP servers
   */
  setCurrentProject(projectPath: string): void {
    // Normalize path separators for consistent key lookup
    this.currentProject = projectPath.replace(/\\/g, '/');
    // Reload config for the new project
    this.loadProjectSync();
  }

  /**
   * Load project MCP configuration synchronously (for use after setCurrentProject)
   */
  private loadProjectSync(): void {
    try {
      const fs = require('fs');
      const content = fs.readFileSync(this.configPath, 'utf-8');
      const config: ClaudeJsonConfig = JSON.parse(content);

      // Get MCP servers for current project
      if (config.projects && this.currentProject && config.projects[this.currentProject]) {
        this.projectServers = config.projects[this.currentProject].mcpServers || {};
      } else {
        this.projectServers = {};
      }
    } catch {
      this.projectServers = {};
    }
  }

  /**
   * Load project MCP configuration from Claude's config file
   */
  async loadProject(projectPath?: string): Promise<Record<string, McpServer>> {
    if (projectPath) {
      this.currentProject = projectPath.replace(/\\/g, '/');
    }

    try {
      const content = await readFile(this.configPath, 'utf-8');
      const config: ClaudeJsonConfig = JSON.parse(content);

      // Get MCP servers for current project
      if (config.projects && this.currentProject && config.projects[this.currentProject]) {
        this.projectServers = config.projects[this.currentProject].mcpServers || {};
      } else {
        this.projectServers = {};
      }

      return this.projectServers;
    } catch (error) {
      console.log('No project MCP config found, using defaults');
      this.projectServers = {};
      return this.projectServers;
    }
  }

  /**
   * Save project MCP configuration to Claude's config file
   */
  async saveProject(): Promise<void> {
    if (!this.currentProject) {
      console.warn('No project set, cannot save project MCP config');
      return;
    }

    try {
      // Read existing config to preserve it
      let config: ClaudeJsonConfig = {};
      try {
        const content = await readFile(this.configPath, 'utf-8');
        config = JSON.parse(content);
      } catch {
        // File doesn't exist, start fresh
      }

      // Ensure projects object exists
      if (!config.projects) {
        config.projects = {};
      }

      // Ensure project entry exists
      if (!config.projects[this.currentProject]) {
        config.projects[this.currentProject] = {
          allowedTools: [],
          mcpContextUris: [],
          mcpServers: {},
          enabledMcpjsonServers: [],
          disabledMcpjsonServers: [],
          hasTrustDialogAccepted: false,
          ignorePatterns: [],
          projectOnboardingSeenCount: 0,
          hasClaudeMdExternalIncludesApproved: false,
          hasClaudeMdExternalIncludesWarningShown: false,
          exampleFiles: []
        };
      }

      // Update MCP servers for this project
      config.projects[this.currentProject].mcpServers = this.projectServers;

      await writeFile(this.configPath, JSON.stringify(config, null, 2));
      console.log(`Saved project MCP config for: ${this.currentProject}`);
    } catch (error) {
      console.error('Failed to save project MCP config:', error);
      throw error;
    }
  }

  /**
   * Get all project MCP servers
   */
  getProjectServers(): Record<string, McpServer> {
    return this.projectServers;
  }

  /**
   * Add or update a project MCP server
   */
  async addProjectServer(name: string, server: McpServer): Promise<void> {
    this.projectServers[name] = server;
    await this.saveProject();
  }

  /**
   * Remove a project MCP server
   */
  async removeProjectServer(name: string): Promise<void> {
    delete this.projectServers[name];
    await this.saveProject();
  }

  // ===== LEGACY METHODS (for backward compatibility) =====

  /**
   * @deprecated Use loadProject instead
   */
  async load(projectPath?: string): Promise<McpConfig> {
    await this.loadProject(projectPath);
    return { mcpServers: this.projectServers };
  }

  /**
   * @deprecated Use saveProject instead
   */
  async save(): Promise<void> {
    await this.saveProject();
  }

  /**
   * @deprecated Use getProjectServers instead
   */
  getServers(): Record<string, McpServer> {
    return this.getProjectServers();
  }

  /**
   * @deprecated Use addProjectServer instead
   */
  async addServer(name: string, server: McpServer): Promise<void> {
    await this.addProjectServer(name, server);
  }

  /**
   * @deprecated Use removeProjectServer instead
   */
  async removeServer(name: string): Promise<void> {
    await this.removeProjectServer(name);
  }

  getServer(name: string): McpServer | undefined {
    return this.projectServers[name];
  }

  getServerNames(): string[] {
    return Object.keys(this.projectServers);
  }

  hasServer(name: string): boolean {
    return name in this.projectServers;
  }
}
