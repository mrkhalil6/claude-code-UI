import { loader } from '@monaco-editor/react';
import * as monaco from 'monaco-editor';

// Configure Monaco to use local files instead of CDN
// This is required for Electron's Content Security Policy
loader.config({ monaco });

// Optional: Configure Monaco editor defaults
monaco.editor.defineTheme('claude-dark', {
  base: 'vs-dark',
  inherit: true,
  rules: [],
  colors: {
    'editor.background': '#1a1a2e',
    'editor.foreground': '#e4e4e7',
    'editorLineNumber.foreground': '#71717a',
    'editorLineNumber.activeForeground': '#a1a1aa',
    'editor.selectionBackground': '#3b3b5c',
    'editor.lineHighlightBackground': '#23233d',
  }
});
