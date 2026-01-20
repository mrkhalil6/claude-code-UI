export type GitFileStatusType = 'modified' | 'added' | 'deleted' | 'renamed' | 'untracked';

export interface GitFileStatus {
  path: string;
  status: GitFileStatusType;
  staged: boolean;
  oldPath?: string; // For renamed files
}

export interface GitStatusResult {
  isRepo: boolean;
  branch: string;
  files: GitFileStatus[];
  error?: string;
}

export interface GitFileDiff {
  path: string;
  originalContent: string;
  modifiedContent: string;
  status: GitFileStatusType;
  isBinary: boolean;
}
