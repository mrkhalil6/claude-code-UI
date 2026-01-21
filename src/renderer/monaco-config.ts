import { loader } from '@monaco-editor/react';
import * as monaco from 'monaco-editor';
import type { ResolvedTheme } from './store/slices/ui.slice';

// Configure Monaco to use local files instead of CDN
// This is required for Electron's Content Security Policy
loader.config({ monaco });

// Dark theme - VS Code Dark+ inspired
monaco.editor.defineTheme('claude-dark', {
  base: 'vs-dark',
  inherit: true,
  rules: [],
  colors: {
    'editor.background': '#1e1e1e',
    'editor.foreground': '#cccccc',
    'editorLineNumber.foreground': '#6e7681',
    'editorLineNumber.activeForeground': '#9d9d9d',
    'editor.selectionBackground': '#264f78',
    'editor.lineHighlightBackground': '#2d2d30',
  }
});

// Light theme - VS Code Light+ inspired
monaco.editor.defineTheme('claude-light', {
  base: 'vs',
  inherit: true,
  rules: [],
  colors: {
    'editor.background': '#ffffff',
    'editor.foreground': '#1f1f1f',
    'editorLineNumber.foreground': '#8b8b8b',
    'editorLineNumber.activeForeground': '#616161',
    'editor.selectionBackground': '#add6ff',
    'editor.lineHighlightBackground': '#f3f3f3',
  }
});

// Export theme name resolver for Monaco Editor
export const getMonacoTheme = (resolvedTheme: ResolvedTheme): string => {
  return resolvedTheme === 'light' ? 'claude-light' : 'claude-dark';
};

// Export theme name resolver for Monaco DiffEditor
export const getDiffEditorTheme = (resolvedTheme: ResolvedTheme): string => {
  return resolvedTheme === 'light' ? 'vs' : 'vs-dark';
};
