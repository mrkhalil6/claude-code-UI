export interface SlashCommand {
  name: string;
  description: string;
  usage?: string;
  // 'local' commands are handled by the UI
  // 'cli-local' commands are CLI commands we can handle locally (like /mcp, /doctor)
  // 'cli-passthrough' commands are sent as regular messages (not recommended)
  // 'skill' commands are CLI skills that get sent as messages to the CLI
  type: 'local' | 'cli-local' | 'cli-passthrough' | 'skill';
  packageName?: string;  // For skills with package prefix (e.g., frontend-design:frontend-design)
}

export const SLASH_COMMANDS: SlashCommand[] = [
  // Local commands (handled by UI)
  {
    name: '/clear',
    description: 'Clear the current conversation',
    type: 'local'
  },
  {
    name: '/help',
    description: 'Show available commands',
    type: 'local'
  },
  {
    name: '/settings',
    description: 'Open settings panel',
    type: 'local'
  },
  {
    name: '/new',
    description: 'Start a new chat session',
    type: 'local'
  },
  {
    name: '/rename',
    description: 'Rename the current chat session',
    usage: '/rename <new name>',
    type: 'local'
  },

  // CLI-local commands (CLI commands we handle in UI)
  {
    name: '/mcp',
    description: 'Show MCP server status',
    type: 'cli-local'
  },
  {
    name: '/cost',
    description: 'Show token usage and cost for this session',
    type: 'cli-local'
  },
  {
    name: '/model',
    description: 'Show current model',
    type: 'cli-local'
  },
  {
    name: '/status',
    description: 'Show current session status',
    type: 'cli-local'
  },

  // CLI passthrough commands (sent to Claude as regular prompts - use carefully)
  {
    name: '/compact',
    description: 'Ask Claude to summarize the conversation',
    type: 'cli-passthrough'
  },
  {
    name: '/review',
    description: 'Ask Claude to review the conversation',
    type: 'cli-passthrough'
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
