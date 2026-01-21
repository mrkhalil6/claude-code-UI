import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { DiffEditor, Editor } from '@monaco-editor/react';
import type { editor } from 'monaco-editor';
import { GitFileList } from './GitFileList';
import { GitStatusResult, GitFileDiff, GitStashEntry } from '../../../shared/types';
import { useSession } from '../../store';
import styles from './GitDiffPanel.module.css';

interface GitDiffPanelProps {
  onClose: () => void;
}

type ViewMode = 'diff' | 'final' | 'conflict';

interface DiffChange {
  originalStartLineNumber: number;
  originalEndLineNumber: number;
  modifiedStartLineNumber: number;
  modifiedEndLineNumber: number;
  originalContent: string;
  modifiedContent: string;
}

interface ConflictSection {
  start: number;
  end: number;
  ours: string;
  theirs: string;
  marker: string;
}

export const GitDiffPanel: React.FC<GitDiffPanelProps> = ({ onClose }) => {
  const { currentCwd } = useSession();
  const [status, setStatus] = useState<GitStatusResult | null>(null);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [currentDiff, setCurrentDiff] = useState<GitFileDiff | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isDiffLoading, setIsDiffLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('diff');
  const [editedContent, setEditedContent] = useState<string>('');
  const [commitMessage, setCommitMessage] = useState('');
  const [diffChanges, setDiffChanges] = useState<DiffChange[]>([]);
  const [changePositions, setChangePositions] = useState<{ top: number; index: number }[]>([]);
  const diffEditorRef = useRef<editor.IStandaloneDiffEditor | null>(null);
  const diffContainerRef = useRef<HTMLDivElement | null>(null);
  const [isCommitting, setIsCommitting] = useState(false);
  const [isPushing, setIsPushing] = useState(false);
  const [isPulling, setIsPulling] = useState(false);
  const [isStashing, setIsStashing] = useState(false);
  const [stashList, setStashList] = useState<GitStashEntry[]>([]);
  const [showStashMenu, setShowStashMenu] = useState(false);
  const [actionMessage, setActionMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const commitInputRef = useRef<HTMLTextAreaElement>(null);
  const stashMenuRef = useRef<HTMLDivElement>(null);

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
      const diff = await window.claudeUI.git.getFileDiff(currentCwd, filePath);
      setCurrentDiff(diff);
      setEditedContent(diff.modifiedContent);
      setDiffChanges([]);
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
      setViewMode('diff');
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

  // Clear action message after delay
  useEffect(() => {
    if (actionMessage) {
      const timer = setTimeout(() => setActionMessage(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [actionMessage]);

  // Get language from file extension
  const getLanguage = (filePath: string): string => {
    const ext = filePath.split('.').pop()?.toLowerCase();
    const languageMap: Record<string, string> = {
      'js': 'javascript', 'jsx': 'javascript', 'ts': 'typescript', 'tsx': 'typescript',
      'py': 'python', 'rb': 'ruby', 'go': 'go', 'rs': 'rust', 'java': 'java',
      'c': 'c', 'cpp': 'cpp', 'h': 'cpp', 'cs': 'csharp', 'php': 'php',
      'html': 'html', 'css': 'css', 'scss': 'scss', 'json': 'json', 'xml': 'xml',
      'yaml': 'yaml', 'yml': 'yaml', 'md': 'markdown', 'sql': 'sql',
      'sh': 'shell', 'bash': 'shell'
    };
    return languageMap[ext || ''] || 'plaintext';
  };

  // Stage a file
  const handleStageFile = async (filePath: string) => {
    if (!currentCwd) return;
    const success = await window.claudeUI.git.stageFile(currentCwd, filePath);
    if (success) {
      await loadStatus();
      setActionMessage({ type: 'success', text: `Staged ${filePath}` });
    }
  };

  // Unstage a file
  const handleUnstageFile = async (filePath: string) => {
    if (!currentCwd) return;
    const success = await window.claudeUI.git.unstageFile(currentCwd, filePath);
    if (success) {
      await loadStatus();
      setActionMessage({ type: 'success', text: `Unstaged ${filePath}` });
    }
  };

  // Discard changes in a file
  const handleDiscardFile = async (filePath: string) => {
    if (!currentCwd) return;
    if (!confirm(`Discard all changes to ${filePath}? This cannot be undone.`)) return;

    const success = await window.claudeUI.git.discardFile(currentCwd, filePath);
    if (success) {
      await loadStatus();
      if (selectedFile === filePath) {
        setSelectedFile(null);
        setCurrentDiff(null);
      }
      setActionMessage({ type: 'success', text: `Discarded changes to ${filePath}` });
    }
  };

  // Stage all files
  const handleStageAll = async () => {
    if (!currentCwd) return;
    const success = await window.claudeUI.git.stageAll(currentCwd);
    if (success) {
      await loadStatus();
      setActionMessage({ type: 'success', text: 'Staged all files' });
    }
  };

  // Unstage all files
  const handleUnstageAll = async () => {
    if (!currentCwd) return;
    const success = await window.claudeUI.git.unstageAll(currentCwd);
    if (success) {
      await loadStatus();
      setActionMessage({ type: 'success', text: 'Unstaged all files' });
    }
  };

  // Commit staged changes
  const handleCommit = async () => {
    if (!currentCwd || !commitMessage.trim()) return;

    setIsCommitting(true);
    try {
      const result = await window.claudeUI.git.commit(currentCwd, commitMessage.trim());
      if (result.success) {
        setCommitMessage('');
        await loadStatus();
        setActionMessage({ type: 'success', text: `Committed: ${result.hash?.slice(0, 7)}` });
      } else {
        setActionMessage({ type: 'error', text: result.error || 'Commit failed' });
      }
    } catch (err) {
      setActionMessage({ type: 'error', text: 'Commit failed' });
    } finally {
      setIsCommitting(false);
    }
  };

  // Push to remote
  const handlePush = async () => {
    if (!currentCwd) return;

    setIsPushing(true);
    try {
      const result = await window.claudeUI.git.push(currentCwd);
      if (result.success) {
        await loadStatus();
        setActionMessage({ type: 'success', text: 'Pushed to remote' });
      } else {
        setActionMessage({ type: 'error', text: result.error || 'Push failed' });
      }
    } catch (err) {
      setActionMessage({ type: 'error', text: 'Push failed' });
    } finally {
      setIsPushing(false);
    }
  };

  // Pull from remote
  const handlePull = async () => {
    if (!currentCwd) return;

    setIsPulling(true);
    try {
      const result = await window.claudeUI.git.pull(currentCwd);
      if (result.success) {
        await loadStatus();
        setActionMessage({ type: 'success', text: 'Pulled from remote' });
      } else {
        setActionMessage({ type: 'error', text: result.error || 'Pull failed' });
      }
    } catch (err) {
      setActionMessage({ type: 'error', text: 'Pull failed' });
    } finally {
      setIsPulling(false);
    }
  };

  // Load stash list
  const loadStashList = useCallback(async () => {
    if (!currentCwd) return;
    const list = await window.claudeUI.git.stashList(currentCwd);
    setStashList(list);
  }, [currentCwd]);

  // Stash changes
  const handleStash = async () => {
    if (!currentCwd) return;

    setIsStashing(true);
    try {
      const result = await window.claudeUI.git.stash(currentCwd);
      if (result.success) {
        await loadStatus();
        await loadStashList();
        setSelectedFile(null);
        setCurrentDiff(null);
        setActionMessage({ type: 'success', text: result.message || 'Changes stashed' });
      } else {
        setActionMessage({ type: 'error', text: result.error || 'Stash failed' });
      }
    } catch (err) {
      setActionMessage({ type: 'error', text: 'Stash failed' });
    } finally {
      setIsStashing(false);
    }
  };

  // Pop stash (apply and remove)
  const handleStashPop = async (index?: number) => {
    if (!currentCwd) return;

    setIsStashing(true);
    setShowStashMenu(false);
    try {
      const result = await window.claudeUI.git.stashPop(currentCwd, index);
      if (result.success) {
        await loadStatus();
        await loadStashList();
        setActionMessage({ type: 'success', text: result.message || 'Stash applied' });
      } else {
        setActionMessage({ type: 'error', text: result.error || 'Failed to apply stash' });
      }
    } catch (err) {
      setActionMessage({ type: 'error', text: 'Failed to apply stash' });
    } finally {
      setIsStashing(false);
    }
  };

  // Drop stash
  const handleStashDrop = async (index: number) => {
    if (!currentCwd) return;
    if (!confirm(`Drop stash@{${index}}? This cannot be undone.`)) return;

    try {
      const result = await window.claudeUI.git.stashDrop(currentCwd, index);
      if (result.success) {
        await loadStashList();
        setActionMessage({ type: 'success', text: 'Stash dropped' });
      } else {
        setActionMessage({ type: 'error', text: result.error || 'Failed to drop stash' });
      }
    } catch (err) {
      setActionMessage({ type: 'error', text: 'Failed to drop stash' });
    }
  };

  // Load stash list when panel opens
  useEffect(() => {
    if (currentCwd && !isLoading) {
      loadStashList();
    }
  }, [currentCwd, isLoading, loadStashList]);

  // Close stash menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (stashMenuRef.current && !stashMenuRef.current.contains(e.target as Node)) {
        setShowStashMenu(false);
      }
    };
    if (showStashMenu) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showStashMenu]);

  // Save edited file
  const handleSaveFile = async () => {
    if (!currentCwd || !selectedFile) return;

    const success = await window.claudeUI.git.saveFile(currentCwd, selectedFile, editedContent);
    if (success) {
      await loadFileDiff(selectedFile);
      await loadStatus();
      setActionMessage({ type: 'success', text: `Saved ${selectedFile}` });
    } else {
      setActionMessage({ type: 'error', text: 'Failed to save file' });
    }
  };

  // Accept original (discard this file's changes)
  const handleAcceptOriginal = async () => {
    if (!currentCwd || !selectedFile || !currentDiff) return;
    if (!confirm('Revert to the original version? Your changes will be lost.')) return;

    const success = await window.claudeUI.git.saveFile(currentCwd, selectedFile, currentDiff.originalContent);
    if (success) {
      await loadFileDiff(selectedFile);
      await loadStatus();
      setActionMessage({ type: 'success', text: 'Reverted to original' });
    }
  };

  // Accept a specific change (keep modified version for that hunk)
  const handleAcceptChange = useCallback(async (change: DiffChange) => {
    if (!currentCwd || !selectedFile || !currentDiff) return;

    // The change is already in modifiedContent, so we just need to save it
    // For a single change acceptance, we're keeping the modified version
    setActionMessage({ type: 'success', text: `Accepted change at line ${change.modifiedStartLineNumber}` });
  }, [currentCwd, selectedFile, currentDiff]);

  // Reject a specific change (revert to original for that hunk)
  const handleRejectChange = useCallback(async (change: DiffChange) => {
    if (!currentCwd || !selectedFile || !currentDiff) return;

    // Replace the modified content for this specific hunk with original
    const modifiedLines = currentDiff.modifiedContent.split('\n');
    const originalLines = currentDiff.originalContent.split('\n');

    // Calculate the replacement
    const beforeChange = modifiedLines.slice(0, change.modifiedStartLineNumber - 1);
    const afterChange = modifiedLines.slice(change.modifiedEndLineNumber);
    const originalHunk = originalLines.slice(
      change.originalStartLineNumber - 1,
      change.originalEndLineNumber
    );

    const newContent = [...beforeChange, ...originalHunk, ...afterChange].join('\n');

    const success = await window.claudeUI.git.saveFile(currentCwd, selectedFile, newContent);
    if (success) {
      await loadFileDiff(selectedFile);
      setActionMessage({ type: 'success', text: `Rejected change at line ${change.modifiedStartLineNumber}` });
    }
  }, [currentCwd, selectedFile, currentDiff, loadFileDiff]);

  // Store diffChanges in a ref for use in callbacks
  const diffChangesRef = useRef<DiffChange[]>([]);
  diffChangesRef.current = diffChanges;

  // Calculate button positions for inline display
  const updateButtonPositions = useCallback(() => {
    if (!diffEditorRef.current || diffChangesRef.current.length === 0) {
      setChangePositions([]);
      return;
    }

    const modifiedEditor = diffEditorRef.current.getModifiedEditor();
    const positions: { top: number; index: number }[] = [];

    diffChangesRef.current.forEach((change, index) => {
      // Get the top position for the start line of each change
      const top = modifiedEditor.getTopForLineNumber(change.modifiedStartLineNumber);
      const scrollTop = modifiedEditor.getScrollTop();
      positions.push({ top: top - scrollTop, index });
    });

    setChangePositions(positions);
  }, []);

  // Update positions when diffChanges changes
  useEffect(() => {
    if (diffChanges.length > 0 && diffEditorRef.current) {
      // Small delay to ensure editor has rendered
      const timer = setTimeout(updateButtonPositions, 100);
      return () => clearTimeout(timer);
    } else {
      setChangePositions([]);
    }
  }, [diffChanges, updateButtonPositions]);

  // Handle DiffEditor mount to get changes
  const handleDiffEditorMount = useCallback((diffEditor: editor.IStandaloneDiffEditor) => {
    diffEditorRef.current = diffEditor;

    // Get line changes when diff is computed
    const updateChanges = () => {
      const lineChanges = diffEditor.getLineChanges();
      if (lineChanges && currentDiff) {
        const originalLines = currentDiff.originalContent.split('\n');
        const modifiedLines = currentDiff.modifiedContent.split('\n');

        const changes: DiffChange[] = lineChanges.map(change => ({
          originalStartLineNumber: change.originalStartLineNumber,
          originalEndLineNumber: change.originalEndLineNumber,
          modifiedStartLineNumber: change.modifiedStartLineNumber,
          modifiedEndLineNumber: change.modifiedEndLineNumber,
          originalContent: originalLines.slice(
            change.originalStartLineNumber - 1,
            change.originalEndLineNumber
          ).join('\n'),
          modifiedContent: modifiedLines.slice(
            change.modifiedStartLineNumber - 1,
            change.modifiedEndLineNumber
          ).join('\n')
        }));

        setDiffChanges(changes);
      }
    };

    // Update button positions on scroll
    const modifiedEditor = diffEditor.getModifiedEditor();
    modifiedEditor.onDidScrollChange(() => {
      updateButtonPositions();
    });

    // Also update on layout changes
    modifiedEditor.onDidLayoutChange(() => {
      updateButtonPositions();
    });

    // Update on mount and when diff changes
    diffEditor.onDidUpdateDiff(() => {
      updateChanges();
    });

    setTimeout(updateChanges, 100); // Initial update after render
  }, [currentDiff, updateButtonPositions]);

  const files = status?.files || [];
  const stagedFiles = files.filter(f => f.staged);
  const hasChanges = stagedFiles.length > 0;
  const conflictedFiles = files.filter(f => f.status === 'conflicted');
  const hasConflicts = conflictedFiles.length > 0;

  // Parse conflict markers from content
  const parseConflicts = useCallback((content: string): ConflictSection[] => {
    const conflicts: ConflictSection[] = [];
    const lines = content.split('\n');
    let i = 0;

    while (i < lines.length) {
      if (lines[i].startsWith('<<<<<<<')) {
        const start = i;
        const marker = lines[i];
        let oursLines: string[] = [];
        let theirsLines: string[] = [];
        let inOurs = true;

        i++;
        while (i < lines.length && !lines[i].startsWith('>>>>>>>')) {
          if (lines[i].startsWith('=======')) {
            inOurs = false;
          } else if (inOurs) {
            oursLines.push(lines[i]);
          } else {
            theirsLines.push(lines[i]);
          }
          i++;
        }

        conflicts.push({
          start,
          end: i,
          ours: oursLines.join('\n'),
          theirs: theirsLines.join('\n'),
          marker
        });
      }
      i++;
    }

    return conflicts;
  }, []);

  // Check if current file has conflicts
  const currentConflicts = useMemo(() => {
    if (!currentDiff?.modifiedContent) return [];
    return parseConflicts(currentDiff.modifiedContent);
  }, [currentDiff, parseConflicts]);

  const isConflictedFile = currentConflicts.length > 0;

  // Auto-switch to conflict view when selecting conflicted file
  useEffect(() => {
    if (isConflictedFile && viewMode === 'diff') {
      setViewMode('conflict');
    }
  }, [isConflictedFile, viewMode]);

  // Accept "ours" version (current branch changes)
  const handleAcceptOurs = async () => {
    if (!currentCwd || !selectedFile || !currentDiff) return;

    let content = currentDiff.modifiedContent;
    const lines = content.split('\n');
    let result: string[] = [];
    let i = 0;

    while (i < lines.length) {
      if (lines[i].startsWith('<<<<<<<')) {
        // Skip to our content
        i++;
        while (i < lines.length && !lines[i].startsWith('=======')) {
          result.push(lines[i]);
          i++;
        }
        // Skip separator and theirs content
        while (i < lines.length && !lines[i].startsWith('>>>>>>>')) {
          i++;
        }
        i++; // Skip closing marker
      } else {
        result.push(lines[i]);
        i++;
      }
    }

    const newContent = result.join('\n');
    const success = await window.claudeUI.git.saveFile(currentCwd, selectedFile, newContent);
    if (success) {
      await loadFileDiff(selectedFile);
      await loadStatus();
      setActionMessage({ type: 'success', text: 'Accepted your changes' });
    }
  };

  // Accept "theirs" version (incoming changes)
  const handleAcceptTheirs = async () => {
    if (!currentCwd || !selectedFile || !currentDiff) return;

    let content = currentDiff.modifiedContent;
    const lines = content.split('\n');
    let result: string[] = [];
    let i = 0;

    while (i < lines.length) {
      if (lines[i].startsWith('<<<<<<<')) {
        // Skip our content
        while (i < lines.length && !lines[i].startsWith('=======')) {
          i++;
        }
        i++; // Skip separator
        // Take theirs content
        while (i < lines.length && !lines[i].startsWith('>>>>>>>')) {
          result.push(lines[i]);
          i++;
        }
        i++; // Skip closing marker
      } else {
        result.push(lines[i]);
        i++;
      }
    }

    const newContent = result.join('\n');
    const success = await window.claudeUI.git.saveFile(currentCwd, selectedFile, newContent);
    if (success) {
      await loadFileDiff(selectedFile);
      await loadStatus();
      setActionMessage({ type: 'success', text: 'Accepted incoming changes' });
    }
  };

  // Mark conflict as resolved and stage file
  const handleMarkResolved = async () => {
    if (!currentCwd || !selectedFile) return;

    // Check if there are still conflict markers
    if (isConflictedFile) {
      setActionMessage({ type: 'error', text: 'File still contains conflict markers' });
      return;
    }

    const success = await window.claudeUI.git.resolveConflict(currentCwd, selectedFile);
    if (success) {
      await loadStatus();
      setActionMessage({ type: 'success', text: 'Conflict marked as resolved' });
    }
  };

  // Abort merge
  const handleAbortMerge = async () => {
    if (!currentCwd) return;
    if (!confirm('Abort merge and reset to HEAD? All merge progress will be lost.')) return;

    const success = await window.claudeUI.git.abortMerge(currentCwd);
    if (success) {
      await loadStatus();
      setSelectedFile(null);
      setCurrentDiff(null);
      setActionMessage({ type: 'success', text: 'Merge aborted' });
    }
  };

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.panel} onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className={styles.header}>
          <div className={styles.headerLeft}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
              <path d="M2.6 10.59L8.38 4.8l1.69 1.7c-.24.85.15 1.78.93 2.23v5.54c-.6.34-1 .99-1 1.73a2 2 0 0 0 2 2 2 2 0 0 0 2-2c0-.74-.4-1.39-1-1.73V9.41l2.07 2.09c-.07.15-.07.32-.07.5a2 2 0 0 0 2 2 2 2 0 0 0 2-2 2 2 0 0 0-2-2c-.18 0-.35 0-.5.07L13.93 7.5a2 2 0 0 0-1.15-2.34c-.43-.16-.88-.2-1.28-.09L9.8 3.38l.79-.78c.78-.79 2.04-.79 2.82 0l7.99 7.99c.79.78.79 2.04 0 2.82l-7.99 7.99c-.78.79-2.04.79-2.82 0L2.6 13.41c-.79-.78-.79-2.04 0-2.82z"/>
            </svg>
            <h2 className={styles.title}>Git</h2>
            {status?.branch && (
              <span className={styles.branch}>
                <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor">
                  <path d="M5 3.25a.75.75 0 11-1.5 0 .75.75 0 011.5 0zm0 2.122a2.25 2.25 0 10-1.5 0v.878A2.25 2.25 0 005.75 8.5h1.5v2.128a2.251 2.251 0 101.5 0V8.5h1.5a2.25 2.25 0 002.25-2.25v-.878a2.25 2.25 0 10-1.5 0v.878a.75.75 0 01-.75.75h-4.5A.75.75 0 015 6.25v-.878zm3.75 7.378a.75.75 0 11-1.5 0 .75.75 0 011.5 0zm3-8.75a.75.75 0 100-1.5.75.75 0 000 1.5z"/>
                </svg>
                {status.branch}
              </span>
            )}
            {status && (status.ahead > 0 || status.behind > 0) && (
              <span className={styles.syncStatus}>
                {status.ahead > 0 && <span className={styles.ahead}>↑{status.ahead}</span>}
                {status.behind > 0 && <span className={styles.behind}>↓{status.behind}</span>}
              </span>
            )}
          </div>
          <div className={styles.headerRight}>
            {actionMessage && (
              <span className={`${styles.actionMessage} ${styles[actionMessage.type]}`}>
                {actionMessage.text}
              </span>
            )}
            {hasConflicts && (
              <>
                <span className={styles.conflictWarning}>
                  {conflictedFiles.length} conflict{conflictedFiles.length > 1 ? 's' : ''}
                </span>
                <button
                  className={styles.headerButtonDanger}
                  onClick={handleAbortMerge}
                  title="Abort merge"
                >
                  Abort Merge
                </button>
              </>
            )}
            <button
              className={styles.headerButton}
              onClick={handleStash}
              disabled={isStashing || files.length === 0 || hasConflicts}
              title="Stash changes"
            >
              {isStashing ? '...' : '📦 Stash'}
            </button>
            <div className={styles.stashMenuContainer} ref={stashMenuRef}>
              <button
                className={styles.headerButton}
                onClick={() => setShowStashMenu(!showStashMenu)}
                disabled={isStashing || stashList.length === 0}
                title={stashList.length > 0 ? `${stashList.length} stash${stashList.length > 1 ? 'es' : ''}` : 'No stashes'}
              >
                📤 Unstash {stashList.length > 0 && `(${stashList.length})`}
              </button>
              {showStashMenu && stashList.length > 0 && (
                <div className={styles.stashMenu}>
                  <div className={styles.stashMenuHeader}>Stashes</div>
                  {stashList.map((entry) => (
                    <div key={entry.index} className={styles.stashMenuItem}>
                      <div className={styles.stashItemInfo}>
                        <span className={styles.stashIndex}>stash@{`{${entry.index}}`}</span>
                        <span className={styles.stashMessage}>{entry.message}</span>
                      </div>
                      <div className={styles.stashItemActions}>
                        <button
                          className={styles.stashApplyBtn}
                          onClick={() => handleStashPop(entry.index)}
                          title="Apply and remove this stash"
                        >
                          Apply
                        </button>
                        <button
                          className={styles.stashDropBtn}
                          onClick={() => handleStashDrop(entry.index)}
                          title="Drop this stash"
                        >
                          ×
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <button
              className={styles.headerButton}
              onClick={handlePull}
              disabled={isPulling || !status?.remote || hasConflicts}
              title="Pull from remote"
            >
              {isPulling ? '...' : '↓ Pull'}
            </button>
            <button
              className={styles.headerButton}
              onClick={handlePush}
              disabled={isPushing || !status?.remote || status?.ahead === 0 || hasConflicts}
              title="Push to remote"
            >
              {isPushing ? '...' : '↑ Push'}
            </button>
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
              {/* Left sidebar - File list and commit area */}
              <div className={styles.sidebar}>
                <GitFileList
                  files={files}
                  selectedFile={selectedFile}
                  onSelectFile={setSelectedFile}
                  onStageFile={handleStageFile}
                  onUnstageFile={handleUnstageFile}
                  onDiscardFile={handleDiscardFile}
                  onStageAll={handleStageAll}
                  onUnstageAll={handleUnstageAll}
                />

                {/* Commit area */}
                <div className={styles.commitArea}>
                  <textarea
                    ref={commitInputRef}
                    className={styles.commitInput}
                    placeholder="Commit message..."
                    value={commitMessage}
                    onChange={(e) => setCommitMessage(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                        handleCommit();
                      }
                    }}
                  />
                  <button
                    className={styles.commitButton}
                    onClick={handleCommit}
                    disabled={isCommitting || !hasChanges || !commitMessage.trim()}
                  >
                    {isCommitting ? 'Committing...' : `Commit (${stagedFiles.length})`}
                  </button>
                </div>
              </div>

              {/* Diff/Editor area */}
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
                      <div className={styles.diffHeaderLeft}>
                        <span className={styles.diffPath}>{currentDiff.path}</span>
                        <span className={styles.diffStatus} data-status={currentDiff.status}>
                          {currentDiff.status}
                        </span>
                        {viewMode === 'diff' && diffChanges.length > 0 && (
                          <div className={styles.diffActions}>
                            <span className={styles.changeCount}>{diffChanges.length} change{diffChanges.length > 1 ? 's' : ''}</span>
                            <button
                              className={styles.acceptAllBtn}
                              onClick={handleSaveFile}
                              title="Accept all changes (keep modified)"
                            >
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <polyline points="20 6 9 17 4 12" />
                              </svg>
                              Accept All
                            </button>
                            <button
                              className={styles.rejectAllBtn}
                              onClick={handleAcceptOriginal}
                              title="Reject all changes (revert to original)"
                            >
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <line x1="18" y1="6" x2="6" y2="18" />
                                <line x1="6" y1="6" x2="18" y2="18" />
                              </svg>
                              Reject All
                            </button>
                          </div>
                        )}
                      </div>
                      <div className={styles.diffHeaderRight}>
                        <div className={styles.viewModeToggle}>
                          <button
                            className={`${styles.viewModeBtn} ${viewMode === 'diff' ? styles.active : ''}`}
                            onClick={() => setViewMode('diff')}
                            title="Side-by-side diff view with accept/reject"
                          >
                            Diff
                          </button>
                          <button
                            className={`${styles.viewModeBtn} ${viewMode === 'final' ? styles.active : ''}`}
                            onClick={() => setViewMode('final')}
                            title="Edit final result"
                          >
                            Edit
                          </button>
                          {isConflictedFile && (
                            <button
                              className={`${styles.viewModeBtn} ${viewMode === 'conflict' ? styles.active : ''}`}
                              onClick={() => setViewMode('conflict')}
                            >
                              Conflicts ({currentConflicts.length})
                            </button>
                          )}
                        </div>
                        {viewMode === 'final' && (
                          <>
                            <button className={styles.actionBtn} onClick={handleSaveFile}>
                              Save
                            </button>
                            <button className={styles.actionBtnDanger} onClick={handleAcceptOriginal}>
                              Revert
                            </button>
                          </>
                        )}
                        {isConflictedFile && viewMode === 'conflict' && (
                          <>
                            <button className={styles.actionBtn} onClick={handleAcceptOurs}>
                              Accept Ours
                            </button>
                            <button className={styles.actionBtn} onClick={handleAcceptTheirs}>
                              Accept Theirs
                            </button>
                            <button
                              className={styles.actionBtn}
                              onClick={handleMarkResolved}
                              disabled={isConflictedFile}
                              title={isConflictedFile ? 'Remove conflict markers first' : 'Mark as resolved'}
                            >
                              Mark Resolved
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                    <div className={styles.diffEditor}>
                      {viewMode === 'diff' ? (
                        <div className={styles.diffEditorWrapper} ref={diffContainerRef}>
                          <DiffEditor
                            height="100%"
                            language={getLanguage(currentDiff.path)}
                            original={currentDiff.originalContent}
                            modified={currentDiff.modifiedContent}
                            theme="vs-dark"
                            onMount={handleDiffEditorMount}
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
                              glyphMargin: true
                            }}
                          />
                          {/* Inline change action buttons */}
                          {diffChanges.length > 0 && (
                            <div className={styles.inlineButtonsOverlay}>
                              {changePositions.length > 0 ? (
                                changePositions.map(({ top, index }) => {
                                  const change = diffChanges[index];
                                  if (!change) return null;
                                  // Only hide if completely out of view
                                  const containerHeight = diffContainerRef.current?.clientHeight || 2000;
                                  if (top < -50 || top > containerHeight + 50) return null;

                                  return (
                                    <div
                                      key={index}
                                      className={styles.inlineChangeButtons}
                                      style={{ top: `${Math.max(0, top)}px` }}
                                    >
                                      <span className={styles.inlineLineLabel}>L{change.modifiedStartLineNumber}</span>
                                      <button
                                        className={styles.inlineAcceptBtn}
                                        onClick={() => handleAcceptChange(change)}
                                        title={`Accept change at line ${change.modifiedStartLineNumber}`}
                                      >
                                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                                          <polyline points="20 6 9 17 4 12" />
                                        </svg>
                                      </button>
                                      <button
                                        className={styles.inlineRejectBtn}
                                        onClick={() => handleRejectChange(change)}
                                        title={`Reject change at line ${change.modifiedStartLineNumber}`}
                                      >
                                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                                          <line x1="18" y1="6" x2="6" y2="18" />
                                          <line x1="6" y1="6" x2="18" y2="18" />
                                        </svg>
                                      </button>
                                    </div>
                                  );
                                })
                              ) : (
                                // Fallback: Show buttons based on diffChanges directly if positions aren't calculated
                                diffChanges.map((change, index) => (
                                  <div
                                    key={index}
                                    className={styles.inlineChangeButtons}
                                    style={{ top: `${(change.modifiedStartLineNumber - 1) * 20}px` }}
                                                                      >
                                    <span className={styles.inlineLineLabel}>L{change.modifiedStartLineNumber}</span>
                                    <button
                                      className={styles.inlineAcceptBtn}
                                      onClick={() => handleAcceptChange(change)}
                                      title={`Accept change at line ${change.modifiedStartLineNumber}`}
                                    >
                                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                                        <polyline points="20 6 9 17 4 12" />
                                      </svg>
                                    </button>
                                    <button
                                      className={styles.inlineRejectBtn}
                                      onClick={() => handleRejectChange(change)}
                                      title={`Reject change at line ${change.modifiedStartLineNumber}`}
                                    >
                                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                                        <line x1="18" y1="6" x2="6" y2="18" />
                                        <line x1="6" y1="6" x2="18" y2="18" />
                                      </svg>
                                    </button>
                                  </div>
                                ))
                              )}
                            </div>
                          )}
                        </div>
                      ) : viewMode === 'conflict' ? (
                        <>
                          {isConflictedFile && (
                            <div className={styles.conflictBanner}>
                              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                              </svg>
                              <span>This file has {currentConflicts.length} conflict{currentConflicts.length > 1 ? 's' : ''}. Edit the file to resolve them or use the buttons above to accept changes.</span>
                            </div>
                          )}
                          <Editor
                            height="100%"
                            language={getLanguage(currentDiff.path)}
                            value={editedContent}
                            onChange={(value) => setEditedContent(value || '')}
                            theme="vs-dark"
                            options={{
                              minimap: { enabled: false },
                              scrollBeyondLastLine: false,
                              fontSize: 13,
                              lineHeight: 20,
                              wordWrap: 'on'
                            }}
                          />
                        </>
                      ) : (
                        <Editor
                          height="100%"
                          language={getLanguage(currentDiff.path)}
                          value={editedContent}
                          onChange={(value) => setEditedContent(value || '')}
                          theme="vs-dark"
                          options={{
                            minimap: { enabled: false },
                            scrollBeyondLastLine: false,
                            fontSize: 13,
                            lineHeight: 20,
                            wordWrap: 'on'
                          }}
                        />
                      )}
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
