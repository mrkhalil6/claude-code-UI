import type { ITheme } from '@xterm/xterm';
import type { ResolvedTheme } from '../store/slices/ui.slice';

export const darkTerminalTheme: ITheme = {
  background: '#0d1117',
  foreground: '#e6edf3',
  cursor: '#e6edf3',
  cursorAccent: '#0d1117',
  selectionBackground: '#1a406b',
  black: '#0d1117',
  red: '#f47067',
  green: '#56d364',
  yellow: '#e0a526',
  blue: '#6dacff',
  magenta: '#d2a8ff',
  cyan: '#76e3ea',
  white: '#e6edf3',
  brightBlack: '#6e7a88',
  brightRed: '#f47067',
  brightGreen: '#7ee787',
  brightYellow: '#eac55f',
  brightBlue: '#79c0ff',
  brightMagenta: '#d97cff',
  brightCyan: '#a5d6ff',
  brightWhite: '#ffffff'
};

export const lightTerminalTheme: ITheme = {
  background: '#f8f9fb',
  foreground: '#1a1d23',
  cursor: '#1a1d23',
  cursorAccent: '#f8f9fb',
  selectionBackground: '#c5d5f7',
  black: '#1a1d23',
  red: '#dc2626',
  green: '#16a34a',
  yellow: '#d97706',
  blue: '#2563eb',
  magenta: '#7c3aed',
  cyan: '#0e7490',
  white: '#4b5563',
  brightBlack: '#6b7280',
  brightRed: '#dc2626',
  brightGreen: '#16a34a',
  brightYellow: '#d97706',
  brightBlue: '#5046e5',
  brightMagenta: '#7c3aed',
  brightCyan: '#0e7490',
  brightWhite: '#9aa3b0'
};

export const getTerminalTheme = (resolvedTheme: ResolvedTheme): ITheme => {
  return resolvedTheme === 'light' ? lightTerminalTheme : darkTerminalTheme;
};
