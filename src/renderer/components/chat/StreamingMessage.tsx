import React from 'react';
import { MarkdownPreview } from '../markdown/MarkdownPreview';
import styles from './StreamingMessage.module.css';

interface StreamingMessageProps {
  content: string;
  thinking?: string;
}

export const StreamingMessage: React.FC<StreamingMessageProps> = ({
  content,
  thinking
}) => {
  return (
    <div className={styles.message}>
      <div className={styles.avatar}>
        <span className={styles.claudeAvatar}>C</span>
      </div>

      <div className={styles.content}>
        <div className={styles.header}>
          <span className={styles.role}>Claude</span>
          <span className={styles.indicator}>
            <span className={styles.dot} />
            <span className={styles.dot} />
            <span className={styles.dot} />
          </span>
        </div>

        {thinking && (
          <div className={styles.thinking}>
            <div className={styles.thinkingHeader}>Thinking...</div>
            <div className={styles.thinkingContent}>{thinking}</div>
          </div>
        )}

        <div className={styles.body}>
          {content ? (
            <MarkdownPreview content={content} />
          ) : (
            <span className={styles.placeholder}>Thinking...</span>
          )}
          <span className={styles.cursor} />
        </div>
      </div>
    </div>
  );
};
