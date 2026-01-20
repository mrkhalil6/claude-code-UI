import { spawn } from 'child_process';
import { readFile, access } from 'fs/promises';
import { join } from 'path';
import { GitStatusResult, GitFileDiff, GitFileStatus, GitFileStatusType } from '../../shared/types';

export class GitService {
  /**
   * Get git status for a directory
   */
  async getStatus(cwd: string): Promise<GitStatusResult> {
    // First check if this is a git repo
    const isRepo = await this.isGitRepo(cwd);
    if (!isRepo) {
      return {
        isRepo: false,
        branch: '',
        files: [],
        error: 'Not a git repository'
      };
    }

    try {
      // Get current branch
      const branch = await this.getBranch(cwd);

      // Get file statuses using porcelain format
      const files = await this.getFileStatuses(cwd);

      return {
        isRepo: true,
        branch,
        files
      };
    } catch (error) {
      console.error('Error getting git status:', error);
      return {
        isRepo: true,
        branch: '',
        files: [],
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Get diff for a specific file
   */
  async getFileDiff(cwd: string, filePath: string): Promise<GitFileDiff> {
    const status = await this.getFileStatus(cwd, filePath);
    const fileStatus = status?.status || 'modified';

    // For untracked/added files, check binary by reading the file directly
    // For tracked files, use git diff
    let isBinary = false;
    if (fileStatus === 'untracked' || fileStatus === 'added') {
      isBinary = await this.isBinaryFileByContent(cwd, filePath);
    } else if (fileStatus !== 'deleted') {
      isBinary = await this.isBinaryFile(cwd, filePath);
    }

    if (isBinary) {
      return {
        path: filePath,
        originalContent: '',
        modifiedContent: '',
        status: fileStatus,
        isBinary: true
      };
    }

    let originalContent = '';
    let modifiedContent = '';

    // Get original content from HEAD (for tracked files)
    if (fileStatus !== 'untracked' && fileStatus !== 'added') {
      try {
        originalContent = await this.getFileFromHead(cwd, filePath);
      } catch (error) {
        console.log(`Could not get original content for ${filePath}:`, error);
        originalContent = '';
      }
    }

    // Get current content from disk
    if (fileStatus !== 'deleted') {
      try {
        const fullPath = join(cwd, filePath);
        modifiedContent = await readFile(fullPath, 'utf-8');
      } catch (error) {
        console.error(`Could not read current file ${filePath}:`, error);
        modifiedContent = '';
      }
    }

    return {
      path: filePath,
      originalContent,
      modifiedContent,
      status: fileStatus,
      isBinary: false
    };
  }

  /**
   * Check if directory is a git repository
   */
  private async isGitRepo(cwd: string): Promise<boolean> {
    try {
      await access(join(cwd, '.git'));
      return true;
    } catch {
      // Also try git rev-parse to handle worktrees
      return new Promise((resolve) => {
        const proc = spawn('git', ['rev-parse', '--git-dir'], {
          cwd,
          stdio: ['pipe', 'pipe', 'pipe']
        });

        proc.on('close', (code) => {
          resolve(code === 0);
        });

        proc.on('error', () => {
          resolve(false);
        });
      });
    }
  }

  /**
   * Get current branch name
   */
  private getBranch(cwd: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const proc = spawn('git', ['branch', '--show-current'], {
        cwd,
        stdio: ['pipe', 'pipe', 'pipe']
      });

      let output = '';
      proc.stdout.on('data', (data) => {
        output += data.toString();
      });

      proc.on('close', (code) => {
        if (code === 0) {
          resolve(output.trim());
        } else {
          // Fallback for detached HEAD
          this.getHeadRef(cwd).then(resolve).catch(reject);
        }
      });

      proc.on('error', reject);
    });
  }

  /**
   * Get HEAD reference when detached
   */
  private getHeadRef(cwd: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const proc = spawn('git', ['rev-parse', '--short', 'HEAD'], {
        cwd,
        stdio: ['pipe', 'pipe', 'pipe']
      });

      let output = '';
      proc.stdout.on('data', (data) => {
        output += data.toString();
      });

      proc.on('close', (code) => {
        if (code === 0) {
          resolve(`HEAD (${output.trim()})`);
        } else {
          resolve('HEAD');
        }
      });

      proc.on('error', reject);
    });
  }

  /**
   * Get file statuses from git status --porcelain
   */
  private getFileStatuses(cwd: string): Promise<GitFileStatus[]> {
    return new Promise((resolve, reject) => {
      const proc = spawn('git', ['status', '--porcelain=v1'], {
        cwd,
        stdio: ['pipe', 'pipe', 'pipe']
      });

      let output = '';
      proc.stdout.on('data', (data) => {
        output += data.toString();
      });

      proc.on('close', (code) => {
        if (code === 0) {
          const files = this.parsePortelainOutput(output);
          resolve(files);
        } else {
          resolve([]);
        }
      });

      proc.on('error', reject);
    });
  }

  /**
   * Parse git status --porcelain=v1 output
   * Format: XY filename
   * X = index status, Y = worktree status
   */
  private parsePortelainOutput(output: string): GitFileStatus[] {
    const files: GitFileStatus[] = [];
    const lines = output.trim().split('\n').filter(Boolean);

    for (const line of lines) {
      if (line.length < 3) continue;

      const indexStatus = line[0];
      const workTreeStatus = line[1];
      let filename = line.slice(3);

      // Handle renamed files (format: "R  old -> new")
      let oldPath: string | undefined;
      if (filename.includes(' -> ')) {
        const parts = filename.split(' -> ');
        oldPath = parts[0];
        filename = parts[1];
      }

      // Determine status and staged state
      const { status, staged } = this.determineStatus(indexStatus, workTreeStatus);

      files.push({
        path: filename,
        status,
        staged,
        oldPath
      });
    }

    return files;
  }

  /**
   * Determine file status from porcelain codes
   */
  private determineStatus(indexStatus: string, workTreeStatus: string): { status: GitFileStatusType; staged: boolean } {
    // Check for untracked
    if (indexStatus === '?' && workTreeStatus === '?') {
      return { status: 'untracked', staged: false };
    }

    // Check for added (new file)
    if (indexStatus === 'A') {
      return { status: 'added', staged: true };
    }

    // Check for deleted
    if (indexStatus === 'D' || workTreeStatus === 'D') {
      return { status: 'deleted', staged: indexStatus === 'D' };
    }

    // Check for renamed
    if (indexStatus === 'R') {
      return { status: 'renamed', staged: true };
    }

    // Check for modified
    if (indexStatus === 'M' || workTreeStatus === 'M') {
      return { status: 'modified', staged: indexStatus === 'M' };
    }

    // Default to modified
    return { status: 'modified', staged: false };
  }

  /**
   * Get status for a specific file
   */
  private async getFileStatus(cwd: string, filePath: string): Promise<GitFileStatus | null> {
    const files = await this.getFileStatuses(cwd);
    return files.find(f => f.path === filePath) || null;
  }

  /**
   * Get file content from HEAD
   */
  private getFileFromHead(cwd: string, filePath: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const proc = spawn('git', ['show', `HEAD:${filePath}`], {
        cwd,
        stdio: ['pipe', 'pipe', 'pipe']
      });

      // Add timeout to prevent hanging
      const timeout = setTimeout(() => {
        proc.kill();
        reject(new Error('git show timed out'));
      }, 10000);

      const chunks: Buffer[] = [];
      proc.stdout.on('data', (data) => {
        chunks.push(data);
      });

      let stderrOutput = '';
      proc.stderr.on('data', (data) => {
        stderrOutput += data.toString();
      });

      proc.on('close', (code) => {
        clearTimeout(timeout);
        if (code === 0) {
          resolve(Buffer.concat(chunks).toString('utf-8'));
        } else {
          reject(new Error(stderrOutput || `git show failed with code ${code}`));
        }
      });

      proc.on('error', (err) => {
        clearTimeout(timeout);
        reject(err);
      });
    });
  }

  /**
   * Check if a tracked file is binary using git diff
   */
  private isBinaryFile(cwd: string, filePath: string): Promise<boolean> {
    return new Promise((resolve) => {
      const proc = spawn('git', ['diff', '--numstat', 'HEAD', '--', filePath], {
        cwd,
        stdio: ['pipe', 'pipe', 'pipe']
      });

      // Add timeout to prevent hanging
      const timeout = setTimeout(() => {
        proc.kill();
        resolve(false);
      }, 5000);

      let output = '';
      proc.stdout.on('data', (data) => {
        output += data.toString();
      });

      proc.on('close', () => {
        clearTimeout(timeout);
        // Binary files show as "-\t-\tfilename"
        resolve(output.startsWith('-\t-\t'));
      });

      proc.on('error', () => {
        clearTimeout(timeout);
        resolve(false);
      });
    });
  }

  /**
   * Check if a file is binary by reading its content
   * Used for untracked files that can't be checked with git diff
   */
  private async isBinaryFileByContent(cwd: string, filePath: string): Promise<boolean> {
    try {
      const fullPath = join(cwd, filePath);
      // Read first 8KB to check for binary content
      const buffer = await readFile(fullPath);
      const checkLength = Math.min(buffer.length, 8192);

      // Check for null bytes which indicate binary content
      for (let i = 0; i < checkLength; i++) {
        if (buffer[i] === 0) {
          return true;
        }
      }
      return false;
    } catch {
      return false;
    }
  }
}
