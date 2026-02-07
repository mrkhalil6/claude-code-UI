import React from 'react';
import { FileSystemEntry } from '../../../shared/types';
import styles from './DirectoryTree.module.css';

interface FileTreeItemProps {
  entry: FileSystemEntry;
  depth: number;
  isExpanded: boolean;
  isLoading: boolean;
  onToggle: (path: string) => void;
  onFileClick: (path: string) => void;
  expandedFolders: Set<string>;
  loadingFolders: Set<string>;
  childrenMap: Map<string, FileSystemEntry[]>;
}

// Chevron icon for folder expand/collapse
const ChevronIcon: React.FC<{ isExpanded: boolean }> = ({ isExpanded }) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    className={`${styles.chevron} ${isExpanded ? styles.expanded : ''}`}
  >
    <polyline points="9 18 15 12 9 6"/>
  </svg>
);

// Folder icon
const FolderIcon: React.FC<{ isOpen: boolean }> = ({ isOpen }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={styles.icon}>
    {isOpen ? (
      <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2v11z"/>
    ) : (
      <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
    )}
  </svg>
);

// File icon
const FileIcon: React.FC = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={styles.icon}>
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
    <polyline points="14 2 14 8 20 8"/>
  </svg>
);

export const FileTreeItem: React.FC<FileTreeItemProps> = ({
  entry,
  depth,
  isExpanded,
  isLoading,
  onToggle,
  onFileClick,
  expandedFolders,
  loadingFolders,
  childrenMap
}) => {
  const handleClick = () => {
    if (entry.isDirectory) {
      onToggle(entry.path);
    } else {
      onFileClick(entry.path);
    }
  };

  const children = childrenMap.get(entry.path) || [];

  return (
    <div className={styles.treeItem}>
      <div
        className={styles.itemRow}
        style={{ paddingLeft: `${depth * 16 + 8}px` }}
        onClick={handleClick}
      >
        {entry.isDirectory && (
          <span className={styles.chevronWrapper}>
            {isLoading ? (
              <span className={styles.spinner} />
            ) : (
              <ChevronIcon isExpanded={isExpanded} />
            )}
          </span>
        )}
        {!entry.isDirectory && <span className={styles.spacer} />}
        {entry.isDirectory ? (
          <FolderIcon isOpen={isExpanded} />
        ) : (
          <FileIcon />
        )}
        <span className={styles.name}>{entry.name}</span>
      </div>
      {entry.isDirectory && isExpanded && children.length > 0 && (
        <div className={styles.children}>
          {children.map((child) => (
            <FileTreeItem
              key={child.path}
              entry={child}
              depth={depth + 1}
              isExpanded={expandedFolders.has(child.path)}
              isLoading={loadingFolders.has(child.path)}
              onToggle={onToggle}
              onFileClick={onFileClick}
              expandedFolders={expandedFolders}
              loadingFolders={loadingFolders}
              childrenMap={childrenMap}
            />
          ))}
        </div>
      )}
    </div>
  );
};
