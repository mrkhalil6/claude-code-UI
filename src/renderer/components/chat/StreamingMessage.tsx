import React from 'react';
import { MarkdownPreview } from '../markdown/MarkdownPreview';
import { ToolUseDisplay } from '../../store/slices/chat.slice';
import styles from './StreamingMessage.module.css';

interface StreamingMessageProps {
  content: string;
  thinking?: string;
  toolsInProgress?: ToolUseDisplay[];
}

export const StreamingMessage: React.FC<StreamingMessageProps> = ({
  content,
  thinking,
  toolsInProgress = []
}) => {
  const getToolStatusIcon = (status: ToolUseDisplay['status']) => {
    switch (status) {
      case 'pending':
        return '⏳';
      case 'running':
        return '🔄';
      case 'completed':
        return '✓';
      case 'error':
        return '✗';
      default:
        return '•';
    }
  };

  const getToolStatusClass = (status: ToolUseDisplay['status']) => {
    switch (status) {
      case 'running':
        return styles.toolRunning;
      case 'completed':
        return styles.toolCompleted;
      case 'error':
        return styles.toolError;
      default:
        return '';
    }
  };

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

        {/* Tool Uses */}
        {toolsInProgress.length > 0 && (
          <div className={styles.toolUses}>
            {toolsInProgress.map((tool) => (
              <div key={tool.id} className={`${styles.toolUse} ${getToolStatusClass(tool.status)}`}>
                <div className={styles.toolHeader}>
                  <span className={styles.toolIcon}>{getToolStatusIcon(tool.status)}</span>
                  <span className={styles.toolName}>{tool.name}</span>
                  <span className={styles.toolStatus}>{tool.status}</span>
                </div>
                {tool.input && Object.keys(tool.input).length > 0 && (
                  <div className={styles.toolInput}>
                    <pre>{JSON.stringify(tool.input, null, 2)}</pre>
                  </div>
                )}
                {tool.result && (
                  <div className={styles.toolResult}>
                    <div className={styles.toolResultHeader}>Result:</div>
                    <pre>{tool.result}</pre>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        <div className={styles.body}>
          {content ? (
            <MarkdownPreview content={content} />
          ) : toolsInProgress.length === 0 ? (
            <span className={styles.placeholder}>Thinking...</span>
          ) : null}
          <span className={styles.cursor} />
        </div>
      </div>
    </div>
  );
};
