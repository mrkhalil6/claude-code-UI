import React, { useState, useEffect, useCallback } from 'react';
import { DiffEditor } from '@monaco-editor/react';
import { GitFileList } from './GitFileList';
import { GitStatusResult, GitFileDiff } from '../../../shared/types';
import { useSession } from '../../store';
import styles from './GitDiffPanel.module.css';

interface GitDiffPanelProps {
  onClose: () => void;
}

export const GitDiffPanel: React.FC<GitDiffPanelProps> = ({ onClose }) => {
  const { currentCwd } = useSession();
  const [status, setStatus] = useState<GitStatusResult | null>(null);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [currentDiff, setCurrentDiff] = useState<GitFileDiff | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isDiffLoading, setIsDiffLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load git status
  const loadStatus = useCallback(async () => {
    if (!currentCwd) {
      setError('No working directory selected');
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const result = await window.claudeUI.git.getStatus(currentCwd);
      setStatus(result);

      if (!result.isRepo) {
        setError('Not a git repository');
      } else if (result.error) {
        setError(result.error);
      }
    } catch (err) {
      console.error('Failed to get git status:', err);
      setError(err instanceof Error ? err.message : 'Failed to get git status');
    } finally {
      setIsLoading(false);
    }
  }, [currentCwd]);

  // Load diff for selected file
  const loadFileDiff = useCallback(async (filePath: string) => {
    if (!currentCwd) return;

    setIsDiffLoading(true);
    setCurrentDiff(null);

    try {
      console.log('Loading diff for:', filePath);
      const diff = await window.claudeUI.git.getFileDiff(currentCwd, filePath);
      console.log('Diff loaded:', diff.path, 'binary:', diff.isBinary);
      setCurrentDiff(diff);
    } catch (err) {
      console.error('Failed to get file diff:', err);
      setCurrentDiff(null);
    } finally {
      setIsDiffLoading(false);
    }
  }, [currentCwd]);

  // Initial load
  useEffect(() => {
    loadStatus();
  }, [loadStatus]);

  // Load diff when file is selected
  useEffect(() => {
    if (selectedFile) {
      loadFileDiff(selectedFile);
    } else {
      setCurrentDiff(null);
    }
  }, [selectedFile, loadFileDiff]);

  // Handle keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  // Get language from file extension
  const getLanguage = (filePath: string): string => {
    const ext = filePath.split('.').pop()?.toLowerCase();
    const languageMap: Record<string, string> = {
      'js': 'javascript',
      'jsx': 'javascript',
      'ts': 'typescript',
      'tsx': 'typescript',
      'py': 'python',
      'rb': 'ruby',
      'go': 'go',
      'rs': 'rust',
      'java': 'java',
      'c': 'c',
      'cpp': 'cpp',
      'h': 'cpp',
      'cs': 'csharp',
      'php': 'php',
      'html': 'html',
      'css': 'css',
      'scss': 'scss',
      'json': 'json',
      'xml': 'xml',
      'yaml': 'yaml',
      'yml': 'yaml',
      'md': 'markdown',
      'sql': 'sql',
      'sh': 'shell',
      'bash': 'shell'
    };
    return languageMap[ext || ''] || 'plaintext';
  };

  const files = status?.files || [];

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.panel} onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className={styles.header}>
          <div className={styles.headerLeft}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
              <path d="M21.007 8.222A3.738 3.738 0 0 0 15.045 5.2a3.737 3.737 0 0 0-6.09 0 3.738 3.738 0 0 0-5.962 3.022 3.737 3.737 0 0 0 2.49 6.527h.008l-.003.254c0 2.068 1.679 3.747 3.747 3.747h5.536a3.747 3.747 0 0 0 3.747-3.747l-.003-.254h.008a3.737 3.737 0 0 0 2.484-6.527zM12 18.75H9.226a1.747 1.747 0 0 1-1.747-1.747v-.254H9.5v-2H5.527a1.737 1.737 0 0 1-.74-3.306l.658-.306-.082-.71a1.737 1.737 0 0 1 1.75-1.932 1.72 1.72 0 0 1 .983.306l.655.445.465-.645A1.738 1.738 0 0 1 12 8c.585 0 1.13.29 1.455.778l.465.645.655-.445a1.72 1.72 0 0 1 .983-.306 1.738 1.738 0 0 1 1.75 1.932l-.082.71.658.306a1.737 1.737 0 0 1-.74 3.306H14.5v2h2.021v.254A1.747 1.747 0 0 1 14.773 19L12 18.75z"/>
            </svg>
            <h2 className={styles.title}>Git Changes</h2>
            {status?.branch && (
              <span className={styles.branch}>
                <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor">
                  <path d="M5 3.25a.75.75 0 11-1.5 0 .75.75 0 011.5 0zm0 2.122a2.25 2.25 0 10-1.5 0v.878A2.25 2.25 0 005.75 8.5h1.5v2.128a2.251 2.251 0 101.5 0V8.5h1.5a2.25 2.25 0 002.25-2.25v-.878a2.25 2.25 0 10-1.5 0v.878a.75.75 0 01-.75.75h-4.5A.75.75 0 015 6.25v-.878zm3.75 7.378a.75.75 0 11-1.5 0 .75.75 0 011.5 0zm3-8.75a.75.75 0 100-1.5.75.75 0 000 1.5z"/>
                </svg>
                {status.branch}
              </span>
            )}
          </div>
          <div className={styles.headerRight}>
            <button
              className={styles.refreshButton}
              onClick={loadStatus}
              title="Refresh"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M23 4v6h-6M1 20v-6h6" />
                <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
              </svg>
            </button>
            <button
              className={styles.closeButton}
              onClick={onClose}
              title="Close (Esc)"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Content */}
        <div className={styles.content}>
          {isLoading ? (
            <div className={styles.loading}>
              <div className={styles.spinner} />
              <span>Loading git status...</span>
            </div>
          ) : error ? (
            <div className={styles.error}>
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <circle cx="12" cy="12" r="10" />
                <path d="M12 8v4M12 16h.01" />
              </svg>
              <span className={styles.errorTitle}>{error}</span>
              {error === 'Not a git repository' && (
                <span className={styles.errorHint}>
                  Initialize a git repository with `git init`
                </span>
              )}
            </div>
          ) : (
            <>
              {/* File list */}
              <div className={styles.sidebar}>
                <GitFileList
                  files={files}
                  selectedFile={selectedFile}
                  onSelectFile={setSelectedFile}
                />
              </div>

              {/* Diff viewer */}
              <div className={styles.diffArea}>
                {!selectedFile ? (
                  <div className={styles.placeholder}>
                    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                      <polyline points="14 2 14 8 20 8" />
                    </svg>
                    <span>Select a file to view changes</span>
                  </div>
                ) : currentDiff?.isBinary ? (
                  <div className={styles.placeholder}>
                    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                      <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                      <circle cx="8.5" cy="8.5" r="1.5" />
                      <polyline points="21 15 16 10 5 21" />
                    </svg>
                    <span>Binary file - cannot display diff</span>
                    <span className={styles.placeholderPath}>{selectedFile}</span>
                  </div>
                ) : isDiffLoading ? (
                  <div className={styles.loading}>
                    <div className={styles.spinner} />
                    <span>Loading diff...</span>
                  </div>
                ) : currentDiff ? (
                  <>
                    <div className={styles.diffHeader}>
                      <span className={styles.diffPath}>{currentDiff.path}</span>
                      <span className={styles.diffStatus} data-status={currentDiff.status}>
                        {currentDiff.status}
                      </span>
                    </div>
                    <div className={styles.diffEditor}>
                      <DiffEditor
                        height="100%"
                        language={getLanguage(currentDiff.path)}
                        original={currentDiff.originalContent}
                        modified={currentDiff.modifiedContent}
                        theme="vs-dark"
                        options={{
                          readOnly: true,
                          renderSideBySide: true,
                          enableSplitViewResizing: true,
                          ignoreTrimWhitespace: false,
                          renderIndicators: true,
                          originalEditable: false,
                          minimap: { enabled: false },
                          scrollBeyondLastLine: false,
                          fontSize: 13,
                          lineHeight: 20,
                          wordWrap: 'on',
                          diffWordWrap: 'on'
                        }}
                      />
                    </div>
                  </>
                ) : (
                  <div className={styles.placeholder}>
                    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                      <circle cx="12" cy="12" r="10" />
                      <path d="M12 8v4M12 16h.01" />
                    </svg>
                    <span>Failed to load diff</span>
                    <span className={styles.placeholderPath}>{selectedFile}</span>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
