import { homedir } from 'os';
import { join } from 'path';

export function getClaudeConfigPath(): string {
  return join(homedir(), '.claude');
}

export function getSessionsPath(): string {
  return join(getClaudeConfigPath(), 'projects');
}

export function getCredentialsPath(): string {
  return join(getClaudeConfigPath(), '.credentials.json');
}

export function getPlansPath(): string {
  return join(getClaudeConfigPath(), 'plans');
}

export function getClaudePath(): string {
  // Return the full path to claude executable
  if (process.platform === 'win32') {
    // On Windows, claude is installed to .local/bin as an exe
    return join(homedir(), '.local', 'bin', 'claude.exe');
  } else {
    // On Unix, use PATH resolution
    return 'claude';
  }
}

export function decodeProjectPath(encoded: string): string {
  // Convert "D--claude-code-UI" back to "D:\claude-code-UI" on Windows
  // Convert "home-user-projects" back to "/home/user/projects" on Unix
  if (process.platform === 'win32') {
    // Windows: "D--folder-subfolder" -> "D:\folder\subfolder"
    return encoded.replace(/^([A-Za-z])-/, '$1:').replace(/-/g, '\\');
  } else {
    // Unix: "-home-user-project" -> "/home/user/project"
    return encoded.replace(/-/g, '/');
  }
}

export function encodeProjectPath(path: string): string {
  if (process.platform === 'win32') {
    return path.replace(/:/g, '-').replace(/\\/g, '-');
  } else {
    return path.replace(/\//g, '-');
  }
}
