import React from 'react';
import { useUI, useChat } from '../../store';
import styles from './StatusBar.module.css';

export const StatusBar: React.FC = () => {
  const { connectionStatus, isPlanMode } = useUI();
  const { isStreaming, messages } = useChat();

  return (
    <footer className={styles.statusBar}>
      <div className={styles.left}>
        <span className={styles.item}>
          {isPlanMode ? 'Plan Mode' : 'Normal Mode'}
        </span>
        <span className={styles.separator}>|</span>
        <span className={styles.item}>
          {messages.length} messages
        </span>
      </div>

      <div className={styles.center}>
        {isStreaming && (
          <span className={styles.streaming}>
            <span className={styles.streamingDot} />
            Claude is thinking...
          </span>
        )}
      </div>

      <div className={styles.right}>
        <span className={styles.item}>
          Status: {connectionStatus}
        </span>
      </div>
    </footer>
  );
};
