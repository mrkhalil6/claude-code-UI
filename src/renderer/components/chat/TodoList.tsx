import React from 'react';
import { useChat } from '../../store';
import styles from './TodoList.module.css';

export const TodoList: React.FC = () => {
  const { todos } = useChat();

  if (todos.length === 0) {
    return null;
  }

  const completedCount = todos.filter(t => t.status === 'completed').length;
  const inProgressItem = todos.find(t => t.status === 'in_progress');
  const progress = todos.length > 0 ? (completedCount / todos.length) * 100 : 0;

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div className={styles.title}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M9 11l3 3L22 4" />
            <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
          </svg>
          <span>Tasks</span>
        </div>
        <div className={styles.progress}>
          <span className={styles.progressText}>{completedCount}/{todos.length}</span>
          <div className={styles.progressBar}>
            <div
              className={styles.progressFill}
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      </div>

      {inProgressItem && (
        <div className={styles.currentTask}>
          <div className={styles.spinner} />
          <span>{inProgressItem.activeForm}</span>
        </div>
      )}

      <div className={styles.list}>
        {todos.map((todo, index) => (
          <div
            key={index}
            className={`${styles.item} ${styles[todo.status]}`}
          >
            <div className={styles.checkbox}>
              {todo.status === 'completed' && (
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              )}
              {todo.status === 'in_progress' && (
                <div className={styles.checkboxSpinner} />
              )}
            </div>
            <span className={styles.content}>{todo.content}</span>
          </div>
        ))}
      </div>
    </div>
  );
};
