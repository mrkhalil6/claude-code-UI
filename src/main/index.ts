import { app, BrowserWindow } from 'electron';
import { createMainWindow } from './windows/main-window';
import { registerIpcHandlers } from './ipc/handlers';
import { ClaudeCliService } from './services/claude-cli.service';
import { SessionLoaderService } from './services/session-loader.service';
import { CredentialsService } from './services/credentials.service';
import { PermissionsService } from './services/permissions.service';
import { McpService } from './services/mcp.service';
import { GitService } from './services/git.service';
import { terminalService } from './services/terminal.service';

class Application {
  private mainWindow: BrowserWindow | null = null;
  private cliService: ClaudeCliService;
  private sessionLoader: SessionLoaderService;
  private credentialsService: CredentialsService;
  private permissionsService: PermissionsService;
  private mcpService: McpService;
  private gitService: GitService;

  constructor() {
    this.cliService = new ClaudeCliService();
    this.sessionLoader = new SessionLoaderService();
    this.credentialsService = new CredentialsService();
    this.permissionsService = new PermissionsService();
    this.mcpService = new McpService();
    this.gitService = new GitService();
  }

  async initialize(): Promise<void> {
    // Handle app ready
    await app.whenReady();

    console.log('Claude Code UI starting...');

    // Verify credentials exist
    const hasCredentials = await this.credentialsService.verifyCredentials();
    if (!hasCredentials) {
      console.warn('No Claude credentials found. User will need to authenticate.');
    }

    // Load permissions
    await this.permissionsService.load();
    console.log('Permissions loaded');

    // Load MCP config
    await this.mcpService.load();
    console.log('MCP config loaded');

    // Register IPC handlers before creating window
    registerIpcHandlers(
      this.cliService,
      this.sessionLoader,
      this.credentialsService,
      this.permissionsService,
      this.mcpService,
      this.gitService
    );

    // Create the main window
    this.mainWindow = createMainWindow();

    // Handle window close
    this.mainWindow.on('closed', () => {
      this.mainWindow = null;
    });

    // Handle all windows closed
    app.on('window-all-closed', () => {
      console.log('All windows closed, cleaning up...');
      this.cleanup();

      if (process.platform !== 'darwin') {
        app.quit();
      }
    });

    // Handle activate (macOS)
    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        this.mainWindow = createMainWindow();
      }
    });

    // Handle before quit
    app.on('before-quit', () => {
      console.log('App quitting, cleaning up...');
      this.cleanup();
    });

    console.log('Claude Code UI initialized');
  }

  private cleanup(): void {
    // Kill all CLI processes
    this.cliService.killAllSessions();

    // Stop file watching
    this.sessionLoader.stopWatching();

    // Destroy all terminal sessions
    terminalService.destroyAllTerminals();
  }
}

// Start the application
const application = new Application();
application.initialize().catch((error) => {
  console.error('Failed to initialize application:', error);
  app.quit();
});
