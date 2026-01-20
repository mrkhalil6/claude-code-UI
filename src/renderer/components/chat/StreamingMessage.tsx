import React from 'react';
import { MarkdownPreview } from '../markdown/MarkdownPreview';
import { ToolUseDisplay, ContentBlock } from '../../store/slices/chat.slice';
import styles from './StreamingMessage.module.css';

interface StreamingMessageProps {
  content: string;
  thinking?: string;
  toolsInProgress?: ToolUseDisplay[];
  streamingBlocks?: ContentBlock[];
}

export const StreamingMessage: React.FC<StreamingMessageProps> = ({
  thinking,
  streamingBlocks = []
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

  const renderToolBlock = (tool: ToolUseDisplay) => (
    <div key={tool.id} className={`${styles.toolUse} ${getToolStatusClass(tool.status)}`}>
      <div className={styles.toolHeader}>
        <span className={styles.toolIcon}>{getToolStatusIcon(tool.status)}</span>
        <span className={styles.toolName}>{tool.name}</span>
        <span className={styles.toolStatus}>{tool.status}</span>
      </div>
      {tool.input && Object.keys(tool.input).length > 0 && (
        <details className={styles.toolInput} open>
          <summary>Input</summary>
          <pre>{JSON.stringify(tool.input, null, 2)}</pre>
        </details>
      )}
      {tool.result && (
        <details className={styles.toolResult} open>
          <summary>Result</summary>
          <pre>{tool.result}</pre>
        </details>
      )}
    </div>
  );

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

        {/* Render blocks in order */}
        <div className={styles.body}>
          {streamingBlocks.length > 0 ? (
            streamingBlocks.map((block, index) => {
              if (block.type === 'text') {
                // Skip empty text blocks
                if (!block.text.trim()) return null;
                return (
                  <div key={`text-${index}`} className={styles.textBlock}>
                    <MarkdownPreview content={block.text} />
                  </div>
                );
              } else if (block.type === 'tool') {
                return renderToolBlock(block.tool);
              }
              return null;
            })
          ) : (
            <span className={styles.placeholder}>Thinking...</span>
          )}
          <span className={styles.cursor} />
        </div>
      </div>
    </div>
  );
};
