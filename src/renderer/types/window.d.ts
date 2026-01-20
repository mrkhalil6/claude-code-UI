import type { ClaudeUIApi } from '../../preload';

declare global {
  interface Window {
    claudeUI: ClaudeUIApi;
  }
}

export {};
