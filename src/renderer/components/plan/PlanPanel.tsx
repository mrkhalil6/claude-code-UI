import React, { useEffect, useState, useCallback } from 'react';
import Editor from '@monaco-editor/react';
import { MarkdownPreview } from '../markdown/MarkdownPreview';
import { useUI } from '../../store';
import { PlanInfo } from '../../../shared/types';
import styles from './PlanPanel.module.css';

interface PlanPanelProps {
  slug: string;
  onClose: () => void;
}

export const PlanPanel: React.FC<PlanPanelProps> = ({ slug, onClose }) => {
  const { resolvedTheme } = useUI();
  const [planInfo, setPlanInfo] = useState<PlanInfo | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copySuccess, setCopySuccess] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [editContent, setEditContent] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  useEffect(() => {
    const loadPlan = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const info = await window.claudeUI.plan.get(slug);
        if (info) {
          setPlanInfo(info);
          setEditContent(info.content);
        } else {
          setError('Plan file not found');
        }
      } catch (err) {
        console.error('Failed to load plan:', err);
        setError('Failed to load plan');
      } finally {
        setIsLoading(false);
      }
    };

    loadPlan();
  }, [slug]);

  const handleCopy = async () => {
    const contentToCopy = isEditMode ? editContent : planInfo?.content;
    if (!contentToCopy) return;

    try {
      await navigator.clipboard.writeText(contentToCopy);
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const handleEditorChange = useCallback((value: string | undefined) => {
    const newContent = value || '';
    setEditContent(newContent);
    setHasUnsavedChanges(newContent !== planInfo?.content);
  }, [planInfo?.content]);

  const handleSave = async () => {
    if (!slug || isSaving) return;

    setIsSaving(true);
    try {
      const result = await window.claudeUI.plan.save(slug, editContent);
      if (result.success) {
        // Update the planInfo with new content
        setPlanInfo(prev => prev ? {
          ...prev,
          content: editContent,
          lastModified: new Date().toISOString()
        } : null);
        setHasUnsavedChanges(false);
      } else {
        setError(result.error || 'Failed to save plan');
      }
    } catch (err) {
      console.error('Failed to save plan:', err);
      setError('Failed to save plan');
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggleEditMode = () => {
    if (isEditMode && hasUnsavedChanges) {
      // Ask for confirmation before discarding changes
      if (!confirm('You have unsaved changes. Discard them?')) {
        return;
      }
      // Reset to original content
      setEditContent(planInfo?.content || '');
      setHasUnsavedChanges(false);
    }
    setIsEditMode(!isEditMode);
  };

  const handleDiscard = () => {
    if (hasUnsavedChanges) {
      if (!confirm('Discard all changes?')) {
        return;
      }
    }
    setEditContent(planInfo?.content || '');
    setHasUnsavedChanges(false);
  };

  const handleClose = () => {
    if (hasUnsavedChanges) {
      if (!confirm('You have unsaved changes. Close anyway?')) {
        return;
      }
    }
    onClose();
  };

  const formatLastModified = (isoString: string) => {
    const date = new Date(isoString);
    return date.toLocaleString();
  };

  return (
    <div className={styles.overlay} onClick={handleClose}>
      <div className={styles.panel} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <div className={styles.headerInfo}>
            <h2 className={styles.title}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
                <line x1="16" y1="13" x2="8" y2="13" />
                <line x1="16" y1="17" x2="8" y2="17" />
                <polyline points="10 9 9 9 8 9" />
              </svg>
              Implementation Plan
              {hasUnsavedChanges && <span className={styles.unsavedBadge}>Unsaved</span>}
            </h2>
            {planInfo && (
              <span className={styles.metadata}>
                {slug} - Last modified: {formatLastModified(planInfo.lastModified)}
              </span>
            )}
          </div>
          <div className={styles.headerActions}>
            {/* Edit/Preview Toggle */}
            <button
              className={`${styles.actionButton} ${isEditMode ? styles.active : ''}`}
              onClick={handleToggleEditMode}
              disabled={isLoading || !!error}
              title={isEditMode ? "Switch to Preview" : "Edit Plan"}
            >
              {isEditMode ? (
                <>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                    <circle cx="12" cy="12" r="3" />
                  </svg>
                  Preview
                </>
              ) : (
                <>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
                    <path d="m15 5 4 4" />
                  </svg>
                  Edit
                </>
              )}
            </button>

            {/* Save Button (only in edit mode) */}
            {isEditMode && (
              <>
                <button
                  className={`${styles.actionButton} ${styles.saveButton}`}
                  onClick={handleSave}
                  disabled={!hasUnsavedChanges || isSaving}
                  title="Save changes (Ctrl+S)"
                >
                  {isSaving ? (
                    <>
                      <div className={styles.buttonSpinner} />
                      Saving...
                    </>
                  ) : (
                    <>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
                        <polyline points="17 21 17 13 7 13 7 21" />
                        <polyline points="7 3 7 8 15 8" />
                      </svg>
                      Save
                    </>
                  )}
                </button>
                <button
                  className={styles.actionButton}
                  onClick={handleDiscard}
                  disabled={!hasUnsavedChanges || isSaving}
                  title="Discard changes"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M3 6h18" />
                    <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
                    <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
                  </svg>
                  Discard
                </button>
              </>
            )}

            {/* Copy Button */}
            <button
              className={`${styles.actionButton} ${copySuccess ? styles.success : ''}`}
              onClick={handleCopy}
              disabled={!planInfo?.content && !editContent}
              title="Copy plan content"
            >
              {copySuccess ? (
                <>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                  Copied
                </>
              ) : (
                <>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                  </svg>
                  Copy
                </>
              )}
            </button>

            {/* Close Button */}
            <button className={styles.closeButton} onClick={handleClose} title="Close">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        <div className={styles.content}>
          {isLoading && (
            <div className={styles.loading}>
              <div className={styles.spinner} />
              <span>Loading plan...</span>
            </div>
          )}

          {error && (
            <div className={styles.error}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
              <span>{error}</span>
            </div>
          )}

          {!isLoading && !error && planInfo && (
            <>
              {isEditMode ? (
                <div className={styles.editorWrapper}>
                  <Editor
                    height="100%"
                    defaultLanguage="markdown"
                    value={editContent}
                    onChange={handleEditorChange}
                    theme={resolvedTheme === 'dark' ? 'vs-dark' : 'light'}
                    options={{
                      minimap: { enabled: false },
                      fontSize: 14,
                      lineNumbers: 'on',
                      wordWrap: 'on',
                      wrappingStrategy: 'advanced',
                      scrollBeyondLastLine: false,
                      automaticLayout: true,
                      tabSize: 2,
                      padding: { top: 16, bottom: 16 },
                      lineHeight: 1.6,
                      renderLineHighlight: 'line',
                      cursorBlinking: 'smooth',
                      smoothScrolling: true,
                    }}
                    onMount={(editor) => {
                      // Add Ctrl+S save shortcut
                      editor.addCommand(
                        // Monaco.KeyMod.CtrlCmd | Monaco.KeyCode.KeyS
                        2048 | 49, // CtrlCmd + S
                        () => {
                          if (hasUnsavedChanges && !isSaving) {
                            handleSave();
                          }
                        }
                      );
                    }}
                  />
                </div>
              ) : (
                <div className={styles.markdownWrapper}>
                  <MarkdownPreview content={planInfo.content} />
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};
