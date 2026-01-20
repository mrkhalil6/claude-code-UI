import React from 'react';
import clsx from 'clsx';
import { MarkdownPreview } from '../markdown/MarkdownPreview';
import { ChatMessage } from '../../store/slices/chat.slice';
import styles from './Message.module.css';

interface MessageProps {
  message: ChatMessage;
}

export const Message: React.FC<MessageProps> = ({ message }) => {
  const isUser = message.type === 'user';

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
          {isUser ? (
            <p className={styles.text}>{message.content}</p>
          ) : (
            <MarkdownPreview content={message.content} />
          )}
        </div>

        {message.toolUses && message.toolUses.length > 0 && (
          <div className={styles.tools}>
            {message.toolUses.map((tool) => (
              <div key={tool.id} className={styles.tool}>
                <span className={styles.toolName}>{tool.name}</span>
                <span className={clsx(styles.toolStatus, styles[tool.status])}>
                  {tool.status}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
