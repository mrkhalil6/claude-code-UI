import React from 'react';
import { Button } from '../common';
import { FileChange } from '../../../shared/types';
import styles from './DiffToolbar.module.css';

interface DiffToolbarProps {
  filePath: string;
  onAccept: () => void;
  onReject: () => void;
  status: FileChange['status'];
}

export const DiffToolbar: React.FC<DiffToolbarProps> = ({
  filePath,
  onAccept,
  onReject,
  status
}) => {
  const fileName = filePath.split(/[/\\]/).pop() || filePath;

  return (
    <div className={styles.toolbar}>
      <div className={styles.fileInfo}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
          <path d="M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z"/>
        </svg>
        <span className={styles.fileName} title={filePath}>
          {fileName}
        </span>
        <span className={styles.filePath} title={filePath}>
          {filePath}
        </span>
      </div>

      {status === 'pending' && (
        <div className={styles.actions}>
          <Button variant="ghost" size="sm" onClick={onReject}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
              <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
            </svg>
            Reject
          </Button>
          <Button variant="primary" size="sm" onClick={onAccept}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
              <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
            </svg>
            Accept
          </Button>
        </div>
      )}

      {status === 'accepted' && (
        <span className={styles.statusAccepted}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
            <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
          </svg>
          Accepted
        </span>
      )}

      {status === 'rejected' && (
        <span className={styles.statusRejected}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
            <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
          </svg>
          Rejected
        </span>
      )}
    </div>
  );
};
