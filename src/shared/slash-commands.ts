export interface SlashCommand {
  name: string;
  description: string;
  usage?: string;
  // 'ui-only' commands are handled entirely by the UI (no CLI equivalent)
  // 'cli-subcommand' commands use CLI subcommands (e.g., `claude --help`, `claude mcp list`)
  // 'cli-skill' commands are CLI skills sent as messages to the active session
  // 'skill' commands are dynamically loaded CLI skills
  type: 'ui-only' | 'cli-subcommand' | 'cli-skill' | 'skill';
  packageName?: string;  // For skills with package prefix (e.g., frontend-design:frontend-design)
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
  {
    name: '/doctor',
    description: 'Check CLI health (opens terminal)',
    type: 'cli-subcommand'
  },
  {
    name: '/login',
    description: 'Log in to Anthropic (opens terminal)',
    type: 'cli-subcommand'
  },
  {
    name: '/logout',
    description: 'Log out from Anthropic (opens terminal)',
    type: 'cli-subcommand'
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
