import { spawn } from 'child_process';
import { readFile, writeFile, access } from 'fs/promises';
import { join } from 'path';
import {
  GitStatusResult,
  GitFileDiff,
  GitFileStatus,
  GitFileStatusType,
  GitCommitResult,
  GitPushResult,
  GitPullResult,
  GitLogEntry,
  GitStashEntry,
  GitStashResult
} from '../../shared/types';

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
        ahead: 0,
        behind: 0,
        error: 'Not a git repository'
      };
    }

    try {
      // Get current branch
      const branch = await this.getBranch(cwd);

      // Get file statuses using porcelain format
      const files = await this.getFileStatuses(cwd);

      // Get ahead/behind counts
      const { ahead, behind, remote } = await this.getAheadBehind(cwd);

      return {
        isRepo: true,
        branch,
        files,
        ahead,
        behind,
        remote
      };
    } catch (error) {
      console.error('Error getting git status:', error);
      return {
        isRepo: true,
        branch: '',
        files: [],
        ahead: 0,
        behind: 0,
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
   * Stage a file for commit
   */
  async stageFile(cwd: string, filePath: string): Promise<boolean> {
    return this.runGitCommand(cwd, ['add', '--', filePath]);
  }

  /**
   * Stage all files
   */
  async stageAll(cwd: string): Promise<boolean> {
    return this.runGitCommand(cwd, ['add', '-A']);
  }

  /**
   * Unstage a file
   */
  async unstageFile(cwd: string, filePath: string): Promise<boolean> {
    return this.runGitCommand(cwd, ['reset', 'HEAD', '--', filePath]);
  }

  /**
   * Unstage all files
   */
  async unstageAll(cwd: string): Promise<boolean> {
    return this.runGitCommand(cwd, ['reset', 'HEAD']);
  }

  /**
   * Discard changes in a file (revert to HEAD)
   */
  async discardFile(cwd: string, filePath: string): Promise<boolean> {
    const status = await this.getFileStatus(cwd, filePath);
    if (status?.status === 'untracked') {
      // For untracked files, we need to delete them
      const { unlink } = await import('fs/promises');
      try {
        await unlink(join(cwd, filePath));
        return true;
      } catch {
        return false;
      }
    }
    // For tracked files, checkout from HEAD
    return this.runGitCommand(cwd, ['checkout', 'HEAD', '--', filePath]);
  }

  /**
   * Discard all changes
   */
  async discardAll(cwd: string): Promise<boolean> {
    // First, reset staged changes
    await this.runGitCommand(cwd, ['reset', 'HEAD']);
    // Then checkout all tracked files
    await this.runGitCommand(cwd, ['checkout', '--', '.']);
    // Clean untracked files
    return this.runGitCommand(cwd, ['clean', '-fd']);
  }

  /**
   * Commit staged changes
   */
  async commit(cwd: string, message: string): Promise<GitCommitResult> {
    return new Promise((resolve) => {
      const proc = spawn('git', ['commit', '-m', message], {
        cwd,
        stdio: ['pipe', 'pipe', 'pipe']
      });

      let stdout = '';
      let stderr = '';

      proc.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      proc.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      proc.on('close', (code) => {
        if (code === 0) {
          // Extract commit hash from output
          const hashMatch = stdout.match(/\[[\w-]+ ([a-f0-9]+)\]/);
          resolve({
            success: true,
            hash: hashMatch?.[1],
            message
          });
        } else {
          resolve({
            success: false,
            error: stderr || 'Commit failed'
          });
        }
      });

      proc.on('error', (err) => {
        resolve({
          success: false,
          error: err.message
        });
      });
    });
  }

  /**
   * Push to remote
   */
  async push(cwd: string, remote: string = 'origin', branch?: string): Promise<GitPushResult> {
    return new Promise(async (resolve) => {
      // If no branch specified, get current branch
      const currentBranch = branch || await this.getBranch(cwd);

      const proc = spawn('git', ['push', remote, currentBranch], {
        cwd,
        stdio: ['pipe', 'pipe', 'pipe']
      });

      let stderr = '';

      proc.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      proc.on('close', (code) => {
        if (code === 0) {
          resolve({ success: true });
        } else {
          resolve({
            success: false,
            error: stderr || 'Push failed'
          });
        }
      });

      proc.on('error', (err) => {
        resolve({
          success: false,
          error: err.message
        });
      });
    });
  }

  /**
   * Pull from remote
   */
  async pull(cwd: string, remote: string = 'origin', branch?: string): Promise<GitPullResult> {
    return new Promise(async (resolve) => {
      const currentBranch = branch || await this.getBranch(cwd);

      const proc = spawn('git', ['pull', remote, currentBranch], {
        cwd,
        stdio: ['pipe', 'pipe', 'pipe']
      });

      let stdout = '';
      let stderr = '';

      proc.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      proc.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      proc.on('close', (code) => {
        if (code === 0) {
          resolve({ success: true });
        } else {
          // Check for merge conflicts
          const hasConflicts = stderr.includes('CONFLICT') || stdout.includes('CONFLICT');
          resolve({
            success: false,
            error: hasConflicts ? 'Merge conflicts detected' : (stderr || 'Pull failed'),
            conflicts: hasConflicts ? this.extractConflictFiles(stdout + stderr) : undefined
          });
        }
      });

      proc.on('error', (err) => {
        resolve({
          success: false,
          error: err.message
        });
      });
    });
  }

  /**
   * Get recent commits
   */
  async getLog(cwd: string, limit: number = 10): Promise<GitLogEntry[]> {
    return new Promise((resolve) => {
      const proc = spawn('git', [
        'log',
        `--max-count=${limit}`,
        '--pretty=format:%H|%h|%s|%an|%ai'
      ], {
        cwd,
        stdio: ['pipe', 'pipe', 'pipe']
      });

      let output = '';
      proc.stdout.on('data', (data) => {
        output += data.toString();
      });

      proc.on('close', (code) => {
        if (code === 0 && output.trim()) {
          const entries = output.trim().split('\n').map(line => {
            const [hash, shortHash, message, author, date] = line.split('|');
            return { hash, shortHash, message, author, date };
          });
          resolve(entries);
        } else {
          resolve([]);
        }
      });

      proc.on('error', () => {
        resolve([]);
      });
    });
  }

  /**
   * Save file content (for accepting changes)
   */
  async saveFile(cwd: string, filePath: string, content: string): Promise<boolean> {
    try {
      const fullPath = join(cwd, filePath);
      await writeFile(fullPath, content, 'utf-8');
      return true;
    } catch (error) {
      console.error('Failed to save file:', error);
      return false;
    }
  }

  /**
   * Mark conflict as resolved
   */
  async resolveConflict(cwd: string, filePath: string): Promise<boolean> {
    return this.runGitCommand(cwd, ['add', '--', filePath]);
  }

  /**
   * Abort merge
   */
  async abortMerge(cwd: string): Promise<boolean> {
    return this.runGitCommand(cwd, ['merge', '--abort']);
  }

  /**
   * Stash changes
   */
  async stash(cwd: string, message?: string): Promise<GitStashResult> {
    return new Promise((resolve) => {
      const args = ['stash', 'push'];
      if (message) {
        args.push('-m', message);
      }

      const proc = spawn('git', args, {
        cwd,
        stdio: ['pipe', 'pipe', 'pipe']
      });

      let stdout = '';
      let stderr = '';

      proc.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      proc.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      proc.on('close', (code) => {
        if (code === 0) {
          resolve({
            success: true,
            message: stdout.trim() || 'Changes stashed'
          });
        } else {
          // Check if "No local changes to save"
          if (stderr.includes('No local changes') || stdout.includes('No local changes')) {
            resolve({
              success: false,
              error: 'No local changes to stash'
            });
          } else {
            resolve({
              success: false,
              error: stderr || 'Stash failed'
            });
          }
        }
      });

      proc.on('error', (err) => {
        resolve({
          success: false,
          error: err.message
        });
      });
    });
  }

  /**
   * Pop the last stash
   */
  async stashPop(cwd: string, index?: number): Promise<GitStashResult> {
    return new Promise((resolve) => {
      const args = ['stash', 'pop'];
      if (index !== undefined) {
        args.push(`stash@{${index}}`);
      }

      const proc = spawn('git', args, {
        cwd,
        stdio: ['pipe', 'pipe', 'pipe']
      });

      let stdout = '';
      let stderr = '';

      proc.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      proc.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      proc.on('close', (code) => {
        if (code === 0) {
          resolve({
            success: true,
            message: stdout.trim() || 'Stash applied and dropped'
          });
        } else {
          // Check for conflicts
          if (stderr.includes('CONFLICT') || stdout.includes('CONFLICT')) {
            resolve({
              success: false,
              error: 'Merge conflicts - stash applied but not dropped'
            });
          } else if (stderr.includes('No stash entries') || stdout.includes('No stash entries')) {
            resolve({
              success: false,
              error: 'No stash entries found'
            });
          } else {
            resolve({
              success: false,
              error: stderr || 'Failed to pop stash'
            });
          }
        }
      });

      proc.on('error', (err) => {
        resolve({
          success: false,
          error: err.message
        });
      });
    });
  }

  /**
   * List all stashes
   */
  async stashList(cwd: string): Promise<GitStashEntry[]> {
    return new Promise((resolve) => {
      // Format: index|message|branch|date
      const proc = spawn('git', [
        'stash', 'list',
        '--format=%gd|%gs|%s|%ai'
      ], {
        cwd,
        stdio: ['pipe', 'pipe', 'pipe']
      });

      let output = '';
      proc.stdout.on('data', (data) => {
        output += data.toString();
      });

      proc.on('close', (code) => {
        if (code === 0 && output.trim()) {
          const entries = output.trim().split('\n').map((line, idx) => {
            const parts = line.split('|');
            // Parse stash@{0} to get index
            const indexMatch = parts[0]?.match(/stash@\{(\d+)\}/);
            return {
              index: indexMatch ? parseInt(indexMatch[1], 10) : idx,
              message: parts[1] || '',
              branch: parts[2] || '',
              date: parts[3] || ''
            };
          });
          resolve(entries);
        } else {
          resolve([]);
        }
      });

      proc.on('error', () => {
        resolve([]);
      });
    });
  }

  /**
   * Drop a specific stash
   */
  async stashDrop(cwd: string, index?: number): Promise<GitStashResult> {
    return new Promise((resolve) => {
      const args = ['stash', 'drop'];
      if (index !== undefined) {
        args.push(`stash@{${index}}`);
      }

      const proc = spawn('git', args, {
        cwd,
        stdio: ['pipe', 'pipe', 'pipe']
      });

      let stdout = '';
      let stderr = '';

      proc.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      proc.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      proc.on('close', (code) => {
        if (code === 0) {
          resolve({
            success: true,
            message: stdout.trim() || 'Stash dropped'
          });
        } else {
          resolve({
            success: false,
            error: stderr || 'Failed to drop stash'
          });
        }
      });

      proc.on('error', (err) => {
        resolve({
          success: false,
          error: err.message
        });
      });
    });
  }

  /**
   * Get ahead/behind count relative to remote
   */
  private async getAheadBehind(cwd: string): Promise<{ ahead: number; behind: number; remote?: string }> {
    return new Promise((resolve) => {
      const proc = spawn('git', ['rev-list', '--left-right', '--count', '@{upstream}...HEAD'], {
        cwd,
        stdio: ['pipe', 'pipe', 'pipe']
      });

      let output = '';
      proc.stdout.on('data', (data) => {
        output += data.toString();
      });

      proc.on('close', (code) => {
        if (code === 0 && output.trim()) {
          const [behind, ahead] = output.trim().split(/\s+/).map(Number);
          // Also get the remote tracking branch name
          this.getRemoteTrackingBranch(cwd).then(remote => {
            resolve({ ahead: ahead || 0, behind: behind || 0, remote });
          });
        } else {
          resolve({ ahead: 0, behind: 0 });
        }
      });

      proc.on('error', () => {
        resolve({ ahead: 0, behind: 0 });
      });
    });
  }

  /**
   * Get remote tracking branch
   */
  private getRemoteTrackingBranch(cwd: string): Promise<string | undefined> {
    return new Promise((resolve) => {
      const proc = spawn('git', ['rev-parse', '--abbrev-ref', '--symbolic-full-name', '@{upstream}'], {
        cwd,
        stdio: ['pipe', 'pipe', 'pipe']
      });

      let output = '';
      proc.stdout.on('data', (data) => {
        output += data.toString();
      });

      proc.on('close', (code) => {
        resolve(code === 0 ? output.trim() : undefined);
      });

      proc.on('error', () => {
        resolve(undefined);
      });
    });
  }

  /**
   * Extract conflict file paths from git output
   */
  private extractConflictFiles(output: string): string[] {
    const conflicts: string[] = [];
    const regex = /CONFLICT.*?:\s+.*?in\s+(.+)/g;
    let match;
    while ((match = regex.exec(output)) !== null) {
      conflicts.push(match[1]);
    }
    return conflicts;
  }

  /**
   * Run a simple git command and return success/failure
   */
  private runGitCommand(cwd: string, args: string[]): Promise<boolean> {
    return new Promise((resolve) => {
      const proc = spawn('git', args, {
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
      const { status, staged, hasConflict } = this.determineStatus(indexStatus, workTreeStatus);

      files.push({
        path: filename,
        status,
        staged,
        oldPath,
        hasConflict
      });
    }

    return files;
  }

  /**
   * Determine file status from porcelain codes
   */
  private determineStatus(indexStatus: string, workTreeStatus: string): { status: GitFileStatusType; staged: boolean; hasConflict?: boolean } {
    // Check for conflicts (UU, AA, DD, AU, UA, DU, UD)
    if (indexStatus === 'U' || workTreeStatus === 'U' ||
        (indexStatus === 'A' && workTreeStatus === 'A') ||
        (indexStatus === 'D' && workTreeStatus === 'D')) {
      return { status: 'conflicted', staged: false, hasConflict: true };
    }

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
