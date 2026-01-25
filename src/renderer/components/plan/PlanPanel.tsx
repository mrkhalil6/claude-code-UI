import React, { useEffect, useState } from 'react';
import { MarkdownPreview } from '../markdown/MarkdownPreview';
import { PlanInfo } from '../../../shared/types';
import styles from './PlanPanel.module.css';

interface PlanPanelProps {
  slug: string;
  onClose: () => void;
}

export const PlanPanel: React.FC<PlanPanelProps> = ({ slug, onClose }) => {
  const [planInfo, setPlanInfo] = useState<PlanInfo | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copySuccess, setCopySuccess] = useState(false);

  useEffect(() => {
    const loadPlan = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const info = await window.claudeUI.plan.get(slug);
        if (info) {
          setPlanInfo(info);
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
    if (!planInfo?.content) return;

    try {
      await navigator.clipboard.writeText(planInfo.content);
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const formatLastModified = (isoString: string) => {
    const date = new Date(isoString);
    return date.toLocaleString();
  };

  return (
    <div className={styles.overlay} onClick={onClose}>
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
            </h2>
            {planInfo && (
              <span className={styles.metadata}>
                {slug} - Last modified: {formatLastModified(planInfo.lastModified)}
              </span>
            )}
          </div>
          <div className={styles.headerActions}>
            <button
              className={`${styles.actionButton} ${copySuccess ? styles.success : ''}`}
              onClick={handleCopy}
              disabled={!planInfo?.content}
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
            <button className={styles.closeButton} onClick={onClose} title="Close">
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
            <div className={styles.markdownWrapper}>
              <MarkdownPreview content={planInfo.content} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
