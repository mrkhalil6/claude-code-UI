import React from 'react';
import clsx from 'clsx';
import { MarkdownPreview } from '../markdown/MarkdownPreview';
import { ChatMessage, ToolUseDisplay } from '../../store/slices/chat.slice';
import styles from './Message.module.css';

interface MessageProps {
  message: ChatMessage;
}

export const Message: React.FC<MessageProps> = ({ message }) => {
  const isUser = message.type === 'user';

  const renderToolBlock = (tool: ToolUseDisplay) => (
    <div key={tool.id} className={clsx(styles.tool, styles[`tool${tool.status.charAt(0).toUpperCase() + tool.status.slice(1)}`])}>
      <div className={styles.toolHeader}>
        <span className={styles.toolIcon}>
          {tool.status === 'completed' ? '✓' : tool.status === 'error' ? '✗' : '•'}
        </span>
        <span className={styles.toolName}>{tool.name}</span>
        <span className={clsx(styles.toolStatus, styles[tool.status])}>
          {tool.status}
        </span>
      </div>
      {tool.input && Object.keys(tool.input).length > 0 && (
        <details className={styles.toolDetails} open>
          <summary>Input</summary>
          <pre>{JSON.stringify(tool.input, null, 2)}</pre>
        </details>
      )}
      {tool.result && (
        <details className={styles.toolDetails} open>
          <summary>Result</summary>
          <pre>{tool.result}</pre>
        </details>
      )}
    </div>
  );

  // Render content blocks in order (if available) or fall back to old format
  const renderContent = () => {
    if (isUser) {
      return <p className={styles.text}>{message.content}</p>;
    }

    // Use contentBlocks if available (preserves order)
    if (message.contentBlocks && message.contentBlocks.length > 0) {
      return (
        <div className={styles.orderedContent}>
          {message.contentBlocks.map((block, index) => {
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
          })}
        </div>
      );
    }

    // Fall back to old format (text content + tools at end)
    return (
      <>
        {message.content && <MarkdownPreview content={message.content} />}
        {message.toolUses && message.toolUses.length > 0 && (
          <div className={styles.tools}>
            {message.toolUses.map((tool) => renderToolBlock(tool))}
          </div>
        )}
      </>
    );
  };

  return (
    <div className={clsx(styles.message, isUser ? styles.user : styles.assistant)}>
      <div className={styles.avatar}>
        {isUser ? (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>
          </svg>
        ) : (
          <span className={styles.claudeAvatar}>C</span>
        )}
      </div>

      <div className={styles.content}>
        <div className={styles.header}>
          <span className={styles.role}>{isUser ? 'You' : 'Claude'}</span>
          <span className={styles.time}>
            {new Date(message.timestamp).toLocaleTimeString([], {
              hour: '2-digit',
              minute: '2-digit'
            })}
          </span>
        </div>

        {message.thinking && (
          <div className={styles.thinking}>
            <div className={styles.thinkingHeader}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
              </svg>
              Thinking
            </div>
            <div className={styles.thinkingContent}>
              {message.thinking}
            </div>
          </div>
        )}

        <div className={styles.body}>
          {renderContent()}
        </div>
      </div>
    </div>
  );
};
