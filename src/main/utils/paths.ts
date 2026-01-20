import { homedir } from 'os';
import { join } from 'path';
import { existsSync } from 'fs';

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
  // Convert "-home-user-projects" back to "/home/user/projects" on Unix
  if (process.platform === 'win32') {
    // Windows: First decode the drive prefix "X--" to "X:\"
    const withDrive = encoded.replace(/^([A-Za-z])--/, '$1:\\');

    // Now we need to figure out which dashes are path separators vs literal dashes
    // Try progressively replacing dashes with backslashes and check if path exists
    const parts = withDrive.split('\\');
    if (parts.length < 2) return withDrive;

    const drivePart = parts[0]; // e.g., "D:"
    const restPart = parts.slice(1).join('\\'); // e.g., "Iris-code-iris"

    // Try to find valid path by testing different dash-to-backslash combinations
    const dashPositions: number[] = [];
    for (let i = 0; i < restPart.length; i++) {
      if (restPart[i] === '-') dashPositions.push(i);
    }

    // Try all combinations (2^n where n is number of dashes)
    // Start with most backslashes (deepest path) and work backwards
    const numDashes = dashPositions.length;
    for (let mask = (1 << numDashes) - 1; mask >= 0; mask--) {
      const chars = restPart.split('');
      for (let i = 0; i < numDashes; i++) {
        if (mask & (1 << i)) {
          chars[dashPositions[i]] = '\\';
        }
      }
      const candidate = drivePart + '\\' + chars.join('');
      if (existsSync(candidate)) {
        return candidate;
      }
    }

    // Fallback: just return with drive prefix decoded
    return withDrive;
  } else {
    // Unix: "-home-user-project" -> "/home/user/project"
    // Leading dash represents root "/", subsequent dashes are path separators
    return '/' + encoded.slice(1).replace(/-/g, '/');
  }
}

export function encodeProjectPath(path: string): string {
  if (process.platform === 'win32') {
    return path.replace(/:/g, '-').replace(/\\/g, '-');
  } else {
    return path.replace(/\//g, '-');
  }
}
