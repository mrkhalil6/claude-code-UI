import React, { useState, useEffect, useCallback } from 'react';
import { FileSystemEntry } from '../../../shared/types';
import { FileTreeItem } from './FileTreeItem';
import styles from './DirectoryTree.module.css';

interface DirectoryTreeProps {
  cwd: string;
  onFileClick: (path: string) => void;
}

// Refresh icon
const RefreshIcon: React.FC = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <polyline points="23 4 23 10 17 10"/>
    <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
  </svg>
);

export const DirectoryTree: React.FC<DirectoryTreeProps> = ({ cwd, onFileClick }) => {
  const [entries, setEntries] = useState<FileSystemEntry[]>([]);
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
  const [loadingFolders, setLoadingFolders] = useState<Set<string>>(new Set());
  const [childrenMap, setChildrenMap] = useState<Map<string, FileSystemEntry[]>>(new Map());
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load root directory
  const loadDirectory = useCallback(async (path: string, isRoot = false) => {
    if (isRoot) {
      setIsLoading(true);
      setError(null);
    } else {
      setLoadingFolders(prev => new Set(prev).add(path));
    }

    try {
      const result = await window.claudeUI.fs.readDirectory(path);

      if (result.error) {
        if (isRoot) {
          setError(result.error);
        }
        return;
      }

      if (isRoot) {
        setEntries(result.entries);
      } else {
        setChildrenMap(prev => new Map(prev).set(path, result.entries));
      }
    } catch (err) {
      if (isRoot) {
        setError(err instanceof Error ? err.message : 'Failed to load directory');
      }
    } finally {
      if (isRoot) {
        setIsLoading(false);
      } else {
        setLoadingFolders(prev => {
          const next = new Set(prev);
          next.delete(path);
          return next;
        });
      }
    }
  }, []);

  // Load root on mount and when cwd changes
  useEffect(() => {
    setExpandedFolders(new Set());
    setChildrenMap(new Map());
    loadDirectory(cwd, true);
  }, [cwd, loadDirectory]);

  const handleToggle = useCallback(async (path: string) => {
    const isExpanded = expandedFolders.has(path);

    if (isExpanded) {
      // Collapse
      setExpandedFolders(prev => {
        const next = new Set(prev);
        next.delete(path);
        return next;
      });
    } else {
      // Expand - load children if not already loaded
      setExpandedFolders(prev => new Set(prev).add(path));

      if (!childrenMap.has(path)) {
        await loadDirectory(path);
      }
    }
  }, [expandedFolders, childrenMap, loadDirectory]);

  const handleRefresh = () => {
    setExpandedFolders(new Set());
    setChildrenMap(new Map());
    loadDirectory(cwd, true);
  };

  // Get display path (truncate if too long)
  const displayPath = cwd.length > 30 ? '...' + cwd.slice(-27) : cwd;

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <span className={styles.path} title={cwd}>{displayPath}</span>
        <button className={styles.refreshButton} onClick={handleRefresh} title="Refresh">
          <RefreshIcon />
        </button>
      </div>

      <div className={styles.content}>
        {isLoading ? (
          <div className={styles.loading}>Loading...</div>
        ) : error ? (
          <div className={styles.error}>{error}</div>
        ) : entries.length === 0 ? (
          <div className={styles.empty}>Empty directory</div>
        ) : (
          entries.map((entry) => (
            <FileTreeItem
              key={entry.path}
              entry={entry}
              depth={0}
              isExpanded={expandedFolders.has(entry.path)}
              isLoading={loadingFolders.has(entry.path)}
              onToggle={handleToggle}
              onFileClick={onFileClick}
              expandedFolders={expandedFolders}
              loadingFolders={loadingFolders}
              childrenMap={childrenMap}
            />
          ))
        )}
      </div>
    </div>
  );
};
