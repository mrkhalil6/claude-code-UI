import React from 'react';
import { GitFileStatus, GitFileStatusType } from '../../../shared/types';
import styles from './GitFileList.module.css';

interface GitFileListProps {
  files: GitFileStatus[];
  selectedFile: string | null;
  onSelectFile: (path: string) => void;
}

const STATUS_ICONS: Record<GitFileStatusType, { icon: string; color: string; label: string }> = {
  modified: { icon: 'M', color: '#e2b714', label: 'Modified' },
  added: { icon: 'A', color: '#3fb950', label: 'Added' },
  deleted: { icon: 'D', color: '#f85149', label: 'Deleted' },
  renamed: { icon: 'R', color: '#a371f7', label: 'Renamed' },
  untracked: { icon: '?', color: '#8b949e', label: 'Untracked' }
};

export const GitFileList: React.FC<GitFileListProps> = ({
  files,
  selectedFile,
  onSelectFile
}) => {
  // Group files by staged/unstaged
  const stagedFiles = files.filter(f => f.staged);
  const unstagedFiles = files.filter(f => !f.staged);

  const renderFile = (file: GitFileStatus) => {
    const statusInfo = STATUS_ICONS[file.status];
    const isSelected = selectedFile === file.path;

    return (
      <button
        key={file.path}
        className={`${styles.fileItem} ${isSelected ? styles.selected : ''}`}
        onClick={() => onSelectFile(file.path)}
        title={`${statusInfo.label}: ${file.path}${file.oldPath ? ` (from ${file.oldPath})` : ''}`}
      >
        <span
          className={styles.statusIcon}
          style={{ color: statusInfo.color }}
        >
          {statusInfo.icon}
        </span>
        <span className={styles.fileName}>
          {file.path.split('/').pop()}
        </span>
        <span className={styles.filePath}>
          {file.path.includes('/') ? file.path.substring(0, file.path.lastIndexOf('/')) : ''}
        </span>
      </button>
    );
  };

  return (
    <div className={styles.container}>
      {files.length === 0 ? (
        <div className={styles.empty}>
          <span className={styles.emptyIcon}>
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </span>
          <span className={styles.emptyText}>Working directory clean</span>
          <span className={styles.emptySubtext}>No uncommitted changes</span>
        </div>
      ) : (
        <>
          {stagedFiles.length > 0 && (
            <div className={styles.section}>
              <div className={styles.sectionHeader}>
                <span className={styles.sectionTitle}>Staged Changes</span>
                <span className={styles.sectionCount}>{stagedFiles.length}</span>
              </div>
              <div className={styles.fileList}>
                {stagedFiles.map(renderFile)}
              </div>
            </div>
          )}

          {unstagedFiles.length > 0 && (
            <div className={styles.section}>
              <div className={styles.sectionHeader}>
                <span className={styles.sectionTitle}>Changes</span>
                <span className={styles.sectionCount}>{unstagedFiles.length}</span>
              </div>
              <div className={styles.fileList}>
                {unstagedFiles.map(renderFile)}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};
