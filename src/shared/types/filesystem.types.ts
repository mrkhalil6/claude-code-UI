export interface FileSystemEntry {
  name: string;
  path: string;
  isDirectory: boolean;
  children?: FileSystemEntry[];
}

export interface ReadDirectoryResult {
  entries: FileSystemEntry[];
  error?: string;
}
