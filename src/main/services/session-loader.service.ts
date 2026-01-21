import { readdir, readFile, stat, unlink, writeFile } from 'fs/promises';
import { join, basename } from 'path';
import { watch, FSWatcher } from 'chokidar';
import { getSessionsPath, decodeProjectPath } from '../utils/paths';
import {
  Session,
  SessionMessage,
  SessionSummary,
  ProjectWithSessions,
  ContentBlock
} from '../../shared/types';

export class SessionLoaderService {
  private watcher: FSWatcher | null = null;
  private projectsPath: string;

  constructor() {
    this.projectsPath = getSessionsPath();
  }

  /**
   * Get all projects with their sessions
   */
  async getAllProjects(): Promise<ProjectWithSessions[]> {
    const projects: ProjectWithSessions[] = [];

    try {
      const projectDirs = await readdir(this.projectsPath);

      for (const projectDir of projectDirs) {
        const projectPath = join(this.projectsPath, projectDir);

        try {
          const stats = await stat(projectPath);

          if (stats.isDirectory()) {
            const decodedPath = decodeProjectPath(projectDir);
            const sessions = await this.getProjectSessions(projectPath);

            if (sessions.length > 0) {
              projects.push({
                encodedName: projectDir,
                path: decodedPath,
                sessions
              });
            }
          }
        } catch (error) {
          console.error(`Failed to process project ${projectDir}:`, error);
        }
      }
    } catch (error) {
      console.error('Failed to load projects:', error);
    }

    // Sort projects by most recent session
    return projects.sort((a, b) => {
      const aLatest = a.sessions[0]?.lastModified || '';
      const bLatest = b.sessions[0]?.lastModified || '';
      return new Date(bLatest).getTime() - new Date(aLatest).getTime();
    });
  }

  /**
   * Get all sessions for a specific project
   */
  async getProjectSessions(projectPath: string): Promise<SessionSummary[]> {
    const sessions: SessionSummary[] = [];

    try {
      const files = await readdir(projectPath);

      // Filter for .jsonl files (session files)
      const sessionFiles = files.filter(f => f.endsWith('.jsonl'));

      for (const file of sessionFiles) {
        const sessionId = basename(file, '.jsonl');
        const filePath = join(projectPath, file);

        try {
          const summary = await this.getSessionSummary(filePath, sessionId);
          sessions.push(summary);
        } catch (error) {
          console.error(`Failed to load session ${sessionId}:`, error);
        }
      }
    } catch (error) {
      console.error(`Failed to read project sessions:`, error);
    }

    // Sort by last modified (most recent first)
    return sessions.sort((a, b) =>
      new Date(b.lastModified).getTime() - new Date(a.lastModified).getTime()
    );
  }

  /**
   * Get summary info for a session without loading all messages
   */
  async getSessionSummary(filePath: string, sessionId: string): Promise<SessionSummary> {
    const stats = await stat(filePath);
    const content = await readFile(filePath, 'utf-8');
    const lines = content.split('\n').filter(Boolean);

    let title = 'Untitled Session';
    let slug = '';
    let firstUserMessage = '';

    // Parse first few lines to find the first user message
    for (const line of lines.slice(0, 20)) {
      try {
        const parsed = JSON.parse(line);
        if (parsed.type === 'user' && parsed.message?.content) {
          const msgContent = parsed.message.content;
          if (typeof msgContent === 'string') {
            firstUserMessage = msgContent;
          } else if (Array.isArray(msgContent)) {
            const textBlock = msgContent.find((c: ContentBlock) => c.type === 'text');
            if (textBlock && 'text' in textBlock) {
              firstUserMessage = textBlock.text;
            }
          }
          title = firstUserMessage.slice(0, 100).replace(/\n/g, ' ');
          slug = parsed.slug || '';
          break;
        }
      } catch {
        // Skip unparseable lines
      }
    }

    return {
      id: sessionId,
      title: slug || title || sessionId.slice(0, 8),
      slug,
      messageCount: lines.length,
      lastModified: stats.mtime.toISOString(),
      createdAt: stats.birthtime.toISOString(),
      preview: firstUserMessage.slice(0, 200)
    };
  }

  /**
   * Load full session with all messages
   */
  async loadFullSession(projectPath: string, sessionId: string): Promise<Session> {
    const filePath = join(projectPath, `${sessionId}.jsonl`);
    const content = await readFile(filePath, 'utf-8');
    const lines = content.split('\n').filter(Boolean);

    const messages: SessionMessage[] = [];
    let metadata = {
      cwd: '',
      version: '',
      gitBranch: undefined as string | undefined,
      slug: ''
    };

    for (const line of lines) {
      try {
        const parsed = JSON.parse(line);

        // Skip internal entries
        if (parsed.type === 'file-history-snapshot') {
          continue;
        }

        // Extract metadata from first message
        if (messages.length === 0 && parsed.cwd) {
          metadata = {
            cwd: parsed.cwd,
            version: parsed.version || '',
            gitBranch: parsed.gitBranch,
            slug: parsed.slug || ''
          };
        }

        if (parsed.type === 'user' || parsed.type === 'assistant') {
          messages.push(this.parseSessionMessage(parsed));
        }
      } catch (error) {
        console.error('Failed to parse session line:', error);
      }
    }

    return {
      id: sessionId,
      messages,
      metadata
    };
  }

  private parseSessionMessage(raw: Record<string, unknown>): SessionMessage {
    return {
      uuid: raw.uuid as string,
      parentUuid: (raw.parentUuid as string) || null,
      type: raw.type as 'user' | 'assistant',
      timestamp: raw.timestamp as string,
      message: raw.message as SessionMessage['message'],
      toolUseResult: raw.tool_use_result as string | undefined,
      isSidechain: raw.isSidechain as boolean | undefined
    };
  }

  /**
   * Watch for session changes
   */
  startWatching(callback: (event: string, path: string) => void): void {
    if (this.watcher) {
      this.watcher.close();
    }

    this.watcher = watch(this.projectsPath, {
      persistent: true,
      ignoreInitial: true,
      depth: 2
    });

    this.watcher
      .on('add', (path) => callback('add', path))
      .on('change', (path) => callback('change', path))
      .on('unlink', (path) => callback('unlink', path));
  }

  /**
   * Stop watching for changes
   */
  stopWatching(): void {
    if (this.watcher) {
      this.watcher.close();
      this.watcher = null;
    }
  }

  /**
   * Delete a session file
   */
  async deleteSession(projectPath: string, sessionId: string): Promise<boolean> {
    const filePath = join(projectPath, `${sessionId}.jsonl`);

    try {
      await unlink(filePath);
      console.log(`Deleted session: ${filePath}`);
      return true;
    } catch (error) {
      console.error(`Failed to delete session ${sessionId}:`, error);
      return false;
    }
  }

  /**
   * Rename a session by updating the slug field
   */
  async renameSession(projectPath: string, sessionId: string, newName: string): Promise<boolean> {
    const filePath = join(projectPath, `${sessionId}.jsonl`);

    try {
      const content = await readFile(filePath, 'utf-8');
      const lines = content.split('\n');
      let updated = false;

      const updatedLines = lines.map(line => {
        if (!line.trim() || updated) return line;

        try {
          const parsed = JSON.parse(line);
          // Find the first user message and update its slug
          if (parsed.type === 'user') {
            parsed.slug = newName.trim();
            updated = true;
            return JSON.stringify(parsed);
          }
        } catch {
          // Skip unparseable lines
        }
        return line;
      });

      if (updated) {
        await writeFile(filePath, updatedLines.join('\n'));
        console.log(`Renamed session ${sessionId} to: ${newName}`);
        return true;
      }

      console.warn(`No user message found in session ${sessionId} to attach slug`);
      return false;
    } catch (error) {
      console.error(`Failed to rename session ${sessionId}:`, error);
      return false;
    }
  }
}
