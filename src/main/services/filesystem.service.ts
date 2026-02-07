import { readdir } from 'fs/promises';
import { join } from 'path';
import { FileSystemEntry, ReadDirectoryResult } from '../../shared/types';

export class FileSystemService {
  /**
   * Read directory contents
   * - Sorts: directories first, then alphabetical
   * - Filters hidden files (starting with .)
   */
  async readDirectory(dirPath: string): Promise<ReadDirectoryResult> {
    try {
      const entries = await readdir(dirPath, { withFileTypes: true });

      // Filter hidden files and map to FileSystemEntry
      const fileEntries: FileSystemEntry[] = entries
        .filter(entry => !entry.name.startsWith('.'))
        .map(entry => ({
          name: entry.name,
          path: join(dirPath, entry.name),
          isDirectory: entry.isDirectory()
        }))
        // Sort: directories first, then alphabetical
        .sort((a, b) => {
          if (a.isDirectory && !b.isDirectory) return -1;
          if (!a.isDirectory && b.isDirectory) return 1;
          return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
        });

      return { entries: fileEntries };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error reading directory';
      return { entries: [], error: errorMessage };
    }
  }
}

export const filesystemService = new FileSystemService();
