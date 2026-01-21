export type GitFileStatusType = 'modified' | 'added' | 'deleted' | 'renamed' | 'untracked' | 'conflicted';

export interface GitFileStatus {
  path: string;
  status: GitFileStatusType;
  staged: boolean;
  oldPath?: string; // For renamed files
  hasConflict?: boolean;
}

export interface GitStatusResult {
  isRepo: boolean;
  branch: string;
  files: GitFileStatus[];
  ahead: number;  // Commits ahead of remote
  behind: number; // Commits behind remote
  remote?: string; // Remote tracking branch
  error?: string;
}

export interface GitFileDiff {
  path: string;
  originalContent: string;
  modifiedContent: string;
  status: GitFileStatusType;
  isBinary: boolean;
}

export interface GitConflictMarkers {
  hasConflicts: boolean;
  ours: string;
  theirs: string;
  base?: string;
}

export interface GitCommitResult {
  success: boolean;
  hash?: string;
  message?: string;
  error?: string;
}

export interface GitPushResult {
  success: boolean;
  error?: string;
  pushed?: number;
}

export interface GitPullResult {
  success: boolean;
  error?: string;
  updated?: number;
  conflicts?: string[];
}

export interface GitLogEntry {
  hash: string;
  shortHash: string;
  message: string;
  author: string;
  date: string;
}

export interface GitRemote {
  name: string;
  fetchUrl: string;
  pushUrl: string;
}
