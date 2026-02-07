import React from 'react';
import { GitFileStatus, GitFileStatusType } from '../../../shared/types';
import styles from './GitFileList.module.css';

interface GitFileListProps {
  files: GitFileStatus[];
  selectedFile: string | null;
  onSelectFile: (path: string) => void;
  onStageFile?: (path: string) => void;
  onUnstageFile?: (path: string) => void;
  onDiscardFile?: (path: string) => void;
  onStageAll?: () => void;
  onUnstageAll?: () => void;
}

const STATUS_ICONS: Record<GitFileStatusType, { icon: string; color: string; label: string }> = {
  modified: { icon: 'M', color: 'var(--text-warning)', label: 'Modified' },
  added: { icon: 'A', color: 'var(--text-success)', label: 'Added' },
  deleted: { icon: 'D', color: 'var(--text-error)', label: 'Deleted' },
  renamed: { icon: 'R', color: 'var(--accent-secondary)', label: 'Renamed' },
  untracked: { icon: '?', color: 'var(--text-secondary)', label: 'Untracked' },
  conflicted: { icon: '!', color: 'var(--text-error)', label: 'Conflict' }
};

export const GitFileList: React.FC<GitFileListProps> = ({
  files,
  selectedFile,
  onSelectFile,
  onStageFile,
  onUnstageFile,
  onDiscardFile,
  onStageAll,
  onUnstageAll
}) => {
  // Group files by staged/unstaged
  const stagedFiles = files.filter(f => f.staged);
  const unstagedFiles = files.filter(f => !f.staged);

  const renderFile = (file: GitFileStatus, isStaged: boolean) => {
    const statusInfo = STATUS_ICONS[file.status];
    const isSelected = selectedFile === file.path;

    return (
      <div
        key={file.path}
        className={`${styles.fileItem} ${isSelected ? styles.selected : ''}`}
      >
        <button
          className={styles.fileButton}
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
        <div className={styles.fileActions}>
          {isStaged ? (
            <button
              className={styles.actionButton}
              onClick={(e) => { e.stopPropagation(); onUnstageFile?.(file.path); }}
              title="Unstage"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M5 12h14M12 5l-7 7 7 7" />
              </svg>
            </button>
          ) : (
            <>
              <button
                className={styles.actionButton}
                onClick={(e) => { e.stopPropagation(); onStageFile?.(file.path); }}
                title="Stage"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M5 12h14M12 5l7 7-7 7" />
                </svg>
              </button>
              <button
                className={`${styles.actionButton} ${styles.danger}`}
                onClick={(e) => { e.stopPropagation(); onDiscardFile?.(file.path); }}
                title="Discard changes"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2m3 0v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6h14" />
                </svg>
              </button>
            </>
          )}
        </div>
      </div>
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
          {/* Staged Changes */}
          <div className={styles.section}>
            <div className={styles.sectionHeader}>
              <span className={styles.sectionTitle}>Staged Changes</span>
              <span className={styles.sectionCount}>{stagedFiles.length}</span>
              {stagedFiles.length > 0 && (
                <button
                  className={styles.sectionAction}
                  onClick={onUnstageAll}
                  title="Unstage all"
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M5 12h14M12 5l-7 7 7 7" />
                  </svg>
                </button>
              )}
            </div>
            <div className={styles.fileList}>
              {stagedFiles.length === 0 ? (
                <div className={styles.emptySection}>No staged changes</div>
              ) : (
                stagedFiles.map(file => renderFile(file, true))
              )}
            </div>
          </div>

          {/* Unstaged Changes */}
          <div className={styles.section}>
            <div className={styles.sectionHeader}>
              <span className={styles.sectionTitle}>Changes</span>
              <span className={styles.sectionCount}>{unstagedFiles.length}</span>
              {unstagedFiles.length > 0 && (
                <button
                  className={styles.sectionAction}
                  onClick={onStageAll}
                  title="Stage all"
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M5 12h14M12 5l7 7-7 7" />
                  </svg>
                </button>
              )}
            </div>
            <div className={styles.fileList}>
              {unstagedFiles.length === 0 ? (
                <div className={styles.emptySection}>No unstaged changes</div>
              ) : (
                unstagedFiles.map(file => renderFile(file, false))
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
};
