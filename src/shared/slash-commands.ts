export interface SlashCommand {
  name: string;
  description: string;
  usage?: string;
  // 'ui-only' commands are handled entirely by the UI (no CLI equivalent)
  // 'cli-subcommand' commands use CLI subcommands (e.g., `claude --help`, `claude mcp list`)
  // 'cli-skill' commands are CLI skills sent as messages to the active session
  // 'skill' commands are dynamically loaded CLI skills
  // 'interactive' commands need to run in the PTY terminal (e.g., /doctor, /login, /model)
  type: 'ui-only' | 'cli-subcommand' | 'cli-skill' | 'skill' | 'interactive';
  packageName?: string;  // For skills with package prefix (e.g., frontend-design:frontend-design)
  // The actual CLI command to run (for interactive commands)
  cliCommand?: string;
  // If true, the command should be sent as a slash command to the REPL (e.g., /logout)
  // rather than as a CLI subcommand (e.g., claude logout)
  sendAsSlashCommand?: boolean;
}

export const SLASH_COMMANDS: SlashCommand[] = [
  // UI-only commands (must stay in UI, no CLI equivalent)
  {
    name: '/clear',
    description: 'Clear the current conversation',
    type: 'ui-only'
  },
  {
    name: '/settings',
    description: 'Open settings panel',
    type: 'ui-only'
  },
  {
    name: '/new',
    description: 'Start a new chat session',
    type: 'ui-only'
  },
  {
    name: '/status',
    description: 'Show current session status',
    type: 'ui-only'
  },
  {
    name: '/model',
    description: 'Show current model',
    type: 'ui-only'
  },

  // CLI subcommands (use `claude <subcommand>`, no active session needed)
  {
    name: '/help',
    description: 'Show available commands',
    type: 'cli-subcommand'
  },
  {
    name: '/mcp',
    description: 'Show MCP server status',
    type: 'cli-subcommand'
  },

  // Interactive commands (open PTY terminal)
  // Some commands are valid CLI subcommands (e.g., `claude doctor`)
  // Others must be sent as slash commands to the REPL (e.g., `/logout`)
  {
    name: '/doctor',
    description: 'Check CLI health (opens terminal)',
    type: 'interactive',
    cliCommand: 'doctor',
    sendAsSlashCommand: false  // `claude doctor` is a valid CLI subcommand
  },
  {
    name: '/login',
    description: 'Log in to Anthropic (opens terminal)',
    type: 'interactive',
    cliCommand: 'login',
    sendAsSlashCommand: true  // Must send as /login to REPL
  },
  {
    name: '/logout',
    description: 'Log out from Anthropic (opens terminal)',
    type: 'interactive',
    cliCommand: 'logout',
    sendAsSlashCommand: true  // Must send as /logout to REPL
  },
  {
    name: '/config',
    description: 'Configure Claude settings (opens terminal)',
    type: 'interactive',
    cliCommand: 'config',
    sendAsSlashCommand: true  // Must send as /config to REPL
  },

  // CLI skills (sent as messages to active session)
  {
    name: '/cost',
    description: 'Show token usage and cost for this session',
    type: 'cli-skill'
  },
  {
    name: '/compact',
    description: 'Compact conversation to save context',
    type: 'cli-skill'
  },
  {
    name: '/context',
    description: 'Show context usage',
    type: 'cli-skill'
  },
  {
    name: '/init',
    description: 'Initialize project configuration',
    type: 'cli-skill'
  },
  {
    name: '/review',
    description: 'Review conversation and changes',
    type: 'cli-skill'
  }
];

/**
 * Parse CLI slash commands (skills) into SlashCommand objects
 */
export function parseCliSlashCommands(cliCommands: string[]): SlashCommand[] {
  return cliCommands.map(cmd => {
    const hasPackage = cmd.includes(':');
    const [packageName, skillName] = hasPackage ? cmd.split(':') : [undefined, cmd];
    return {
      name: `/${skillName}`,
      description: hasPackage ? `${packageName} skill` : 'CLI skill',
      type: 'skill' as const,
      packageName: hasPackage ? packageName : undefined
    };
  });
}

/**
 * Filter commands based on input
 */
export function filterCommands(input: string, additionalCommands: SlashCommand[] = []): SlashCommand[] {
  const trimmed = input.trim().toLowerCase();

  if (!trimmed.startsWith('/')) {
    return [];
  }

  const allCommands = [...SLASH_COMMANDS, ...additionalCommands];
  return allCommands.filter(cmd =>
    cmd.name.toLowerCase().startsWith(trimmed)
  );
}

/**
 * Check if input is a complete slash command
 */
export function parseSlashCommand(input: string, additionalCommands: SlashCommand[] = []): { command: SlashCommand; args: string } | null {
  const trimmed = input.trim();

  if (!trimmed.startsWith('/')) {
    return null;
  }

  const parts = trimmed.split(/\s+/);
  const cmdName = parts[0].toLowerCase();
  const args = parts.slice(1).join(' ');

  const allCommands = [...SLASH_COMMANDS, ...additionalCommands];
  const command = allCommands.find(cmd => cmd.name.toLowerCase() === cmdName);

  if (command) {
    return { command, args };
  }

  return null;
}
