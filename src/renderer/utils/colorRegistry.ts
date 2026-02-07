export interface ColorEntry {
  variable: string;
  label: string;
  category: string;
  defaultDark: string;
  defaultLight: string;
}

export const COLOR_CATEGORIES = [
  'Background',
  'Sidebar & Header',
  'Messages',
  'Text',
  'Status Text',
  'Borders',
  'Accent',
  'Syntax',
  'Diff',
  'Terminal',
] as const;

export type ColorCategory = (typeof COLOR_CATEGORIES)[number];

export const colorRegistry: ColorEntry[] = [
  // Background
  { variable: 'bg-primary', label: 'Primary', category: 'Background', defaultDark: '#0d1117', defaultLight: '#f8f9fb' },
  { variable: 'bg-secondary', label: 'Secondary', category: 'Background', defaultDark: '#151b23', defaultLight: '#eef0f4' },
  { variable: 'bg-tertiary', label: 'Tertiary', category: 'Background', defaultDark: '#212830', defaultLight: '#e2e5eb' },
  { variable: 'bg-input', label: 'Input', category: 'Background', defaultDark: '#1a2029', defaultLight: '#ffffff' },
  { variable: 'bg-hover', label: 'Hover', category: 'Background', defaultDark: '#1c2533', defaultLight: '#e5e8ee' },
  { variable: 'bg-active', label: 'Active', category: 'Background', defaultDark: '#2b3544', defaultLight: '#d8dce4' },
  { variable: 'bg-selection', label: 'Selection', category: 'Background', defaultDark: '#1a406b', defaultLight: '#c5d5f7' },

  // Sidebar & Header
  { variable: 'bg-sidebar', label: 'Sidebar', category: 'Sidebar & Header', defaultDark: '#0d1117', defaultLight: '#f0f2f6' },
  { variable: 'bg-header', label: 'Header', category: 'Sidebar & Header', defaultDark: '#151b23', defaultLight: '#eef0f4' },

  // Messages
  { variable: 'bg-message-user', label: 'User Message', category: 'Messages', defaultDark: '#151b23', defaultLight: '#eaecf2' },
  { variable: 'bg-message-assistant', label: 'Assistant Message', category: 'Messages', defaultDark: '#0d1117', defaultLight: '#f8f9fb' },

  // Text
  { variable: 'text-primary', label: 'Primary', category: 'Text', defaultDark: '#e6edf3', defaultLight: '#1a1d23' },
  { variable: 'text-secondary', label: 'Secondary', category: 'Text', defaultDark: '#9aa5b4', defaultLight: '#4b5563' },
  { variable: 'text-muted', label: 'Muted', category: 'Text', defaultDark: '#6e7a88', defaultLight: '#6b7280' },
  { variable: 'text-link', label: 'Link', category: 'Text', defaultDark: '#6dacff', defaultLight: '#5046e5' },
  { variable: 'text-inverse', label: 'Inverse', category: 'Text', defaultDark: '#0d1117', defaultLight: '#f8f9fb' },

  // Status Text
  { variable: 'text-error', label: 'Error', category: 'Status Text', defaultDark: '#f47067', defaultLight: '#dc2626' },
  { variable: 'text-warning', label: 'Warning', category: 'Status Text', defaultDark: '#e0a526', defaultLight: '#d97706' },
  { variable: 'text-success', label: 'Success', category: 'Status Text', defaultDark: '#56d364', defaultLight: '#16a34a' },

  // Borders
  { variable: 'border-primary', label: 'Primary', category: 'Borders', defaultDark: '#262c36', defaultLight: '#d0d5dd' },
  { variable: 'border-secondary', label: 'Secondary', category: 'Borders', defaultDark: '#3a424d', defaultLight: '#9aa3b0' },
  { variable: 'border-focus', label: 'Focus', category: 'Borders', defaultDark: '#6dacff', defaultLight: '#5046e5' },

  // Accent
  { variable: 'accent-primary', label: 'Primary', category: 'Accent', defaultDark: '#7c5cfc', defaultLight: '#5046e5' },
  { variable: 'accent-hover', label: 'Hover', category: 'Accent', defaultDark: '#9178fc', defaultLight: '#4338ca' },
  { variable: 'accent-active', label: 'Active', category: 'Accent', defaultDark: '#6848d8', defaultLight: '#3730a3' },
  { variable: 'accent-secondary', label: 'Secondary', category: 'Accent', defaultDark: '#d97cff', defaultLight: '#7c3aed' },

  // Syntax
  { variable: 'syntax-keyword', label: 'Keyword', category: 'Syntax', defaultDark: '#d2a8ff', defaultLight: '#7c3aed' },
  { variable: 'syntax-string', label: 'String', category: 'Syntax', defaultDark: '#a5d6ff', defaultLight: '#16a34a' },
  { variable: 'syntax-number', label: 'Number', category: 'Syntax', defaultDark: '#79c0ff', defaultLight: '#d97706' },
  { variable: 'syntax-comment', label: 'Comment', category: 'Syntax', defaultDark: '#6e7a88', defaultLight: '#6b7280' },
  { variable: 'syntax-function', label: 'Function', category: 'Syntax', defaultDark: '#dcbdfb', defaultLight: '#2563eb' },
  { variable: 'syntax-variable', label: 'Variable', category: 'Syntax', defaultDark: '#79c0ff', defaultLight: '#0e7490' },
  { variable: 'syntax-type', label: 'Type', category: 'Syntax', defaultDark: '#7ee787', defaultLight: '#059669' },

  // Diff
  { variable: 'diff-added-line', label: 'Added Line', category: 'Diff', defaultDark: '#56d364', defaultLight: '#16a34a' },
  { variable: 'diff-removed-line', label: 'Removed Line', category: 'Diff', defaultDark: '#f47067', defaultLight: '#dc2626' },

  // Terminal
  { variable: 'terminal-background', label: 'Background', category: 'Terminal', defaultDark: '#0d1117', defaultLight: '#f8f9fb' },
  { variable: 'terminal-foreground', label: 'Foreground', category: 'Terminal', defaultDark: '#e6edf3', defaultLight: '#1a1d23' },
  { variable: 'terminal-cursor', label: 'Cursor', category: 'Terminal', defaultDark: '#e6edf3', defaultLight: '#1a1d23' },
  { variable: 'terminal-selection', label: 'Selection', category: 'Terminal', defaultDark: '#1a406b', defaultLight: '#c5d5f7' },
  { variable: 'terminal-black', label: 'Black', category: 'Terminal', defaultDark: '#0d1117', defaultLight: '#1a1d23' },
  { variable: 'terminal-red', label: 'Red', category: 'Terminal', defaultDark: '#f47067', defaultLight: '#dc2626' },
  { variable: 'terminal-green', label: 'Green', category: 'Terminal', defaultDark: '#56d364', defaultLight: '#16a34a' },
  { variable: 'terminal-yellow', label: 'Yellow', category: 'Terminal', defaultDark: '#e0a526', defaultLight: '#d97706' },
  { variable: 'terminal-blue', label: 'Blue', category: 'Terminal', defaultDark: '#6dacff', defaultLight: '#2563eb' },
  { variable: 'terminal-magenta', label: 'Magenta', category: 'Terminal', defaultDark: '#d2a8ff', defaultLight: '#7c3aed' },
  { variable: 'terminal-cyan', label: 'Cyan', category: 'Terminal', defaultDark: '#76e3ea', defaultLight: '#0e7490' },
  { variable: 'terminal-white', label: 'White', category: 'Terminal', defaultDark: '#e6edf3', defaultLight: '#4b5563' },
];

/** Get the default color for a variable given the theme */
export function getDefaultColor(variable: string, theme: 'dark' | 'light'): string | undefined {
  const entry = colorRegistry.find((e) => e.variable === variable);
  if (!entry) return undefined;
  return theme === 'dark' ? entry.defaultDark : entry.defaultLight;
}

/** Get all entries grouped by category */
export function getColorsByCategory(): Map<ColorCategory, ColorEntry[]> {
  const map = new Map<ColorCategory, ColorEntry[]>();
  for (const cat of COLOR_CATEGORIES) {
    map.set(cat, colorRegistry.filter((e) => e.category === cat));
  }
  return map;
}
