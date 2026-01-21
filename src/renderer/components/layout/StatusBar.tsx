import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useUI, useChat, useSession } from '../../store';
import styles from './StatusBar.module.css';

interface ModelInfo {
  id: string;
  name: string;
}

// Format model name for display
const formatModelName = (model: string, availableModels: ModelInfo[]): string => {
  if (!model) return '';
  // Check if it matches a known model
  const knownModel = availableModels.find(m => m.id === model);
  if (knownModel) return knownModel.name;
  // claude-opus-4-5-20251101 -> Opus 4.5
  // claude-sonnet-4-20250514 -> Sonnet 4
  const match = model.match(/claude-(\w+)-(\d+)(?:-(\d+))?/);
  if (match) {
    const [, name, major, minor] = match;
    const version = minor ? `${major}.${minor}` : major;
    return `${name.charAt(0).toUpperCase() + name.slice(1)} ${version}`;
  }
  return model;
};


export const StatusBar: React.FC = () => {
  const { connectionStatus, isPlanMode, usage } = useUI();
  const { isStreaming, messages, todos } = useChat();
  const { activeSessionId } = useSession();
  const [showTodoPopup, setShowTodoPopup] = useState(false);
  const [showModelSelector, setShowModelSelector] = useState(false);
  const [availableModels, setAvailableModels] = useState<ModelInfo[]>([]);
  const [modelsLoaded, setModelsLoaded] = useState(false);
  const [selectedModel, setSelectedModel] = useState<ModelInfo | null>(null);
  const todoRef = useRef<HTMLDivElement>(null);
  const modelRef = useRef<HTMLDivElement>(null);

  // Fetch available models
  const fetchModels = useCallback(async () => {
    if (modelsLoaded) return;
    try {
      const models = await window.claudeUI.cli.getModels();
      setAvailableModels(models);
      setModelsLoaded(true);
    } catch (err) {
      console.error('Failed to fetch models:', err);
    }
  }, [modelsLoaded]);

  // Fetch models when dropdown opens
  useEffect(() => {
    if (showModelSelector && !modelsLoaded) {
      fetchModels();
    }
  }, [showModelSelector, modelsLoaded, fetchModels]);

  // Todo stats
  const completedCount = todos.filter(t => t.status === 'completed').length;
  const inProgressItem = todos.find(t => t.status === 'in_progress');
  const hasTodos = todos.length > 0;

  // Close popups when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (todoRef.current && !todoRef.current.contains(e.target as Node)) {
        setShowTodoPopup(false);
      }
      if (modelRef.current && !modelRef.current.contains(e.target as Node)) {
        setShowModelSelector(false);
      }
    };
    if (showTodoPopup || showModelSelector) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showTodoPopup, showModelSelector]);

  // Handle model change
  const handleModelChange = async (model: ModelInfo) => {
    if (!activeSessionId) return;
    setSelectedModel(model);
    setShowModelSelector(false);
    try {
      const result = await window.claudeUI.cli.setModel(activeSessionId, model.id);
      if (!result) {
        console.error('Failed to set model');
        setSelectedModel(null);
      }
    } catch (err) {
      console.error('Failed to change model:', err);
      setSelectedModel(null); // Revert on error
    }
  };

  // Clear selected model when CLI confirms model change
  useEffect(() => {
    if (selectedModel && usage.modelName?.toLowerCase().includes(selectedModel.id)) {
      setSelectedModel(null);
    }
  }, [usage.modelName, selectedModel]);

  return (
    <footer className={styles.statusBar}>
      <div className={styles.left}>
        <div className={styles.modelContainer} ref={modelRef}>
          <button
            className={styles.modelButton}
            onClick={() => setShowModelSelector(!showModelSelector)}
            title={usage.modelName ? `Current model: ${usage.modelName}` : 'Select model'}
            disabled={isStreaming}
          >
            <span className={styles.modelName}>
              {selectedModel ? selectedModel.name : (usage.modelName ? formatModelName(usage.modelName, availableModels) : 'Model')}
            </span>
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </button>
          {showModelSelector && (
            <div className={styles.modelDropdown}>
              <div className={styles.modelDropdownHeader}>Select Model</div>
              {availableModels.length === 0 ? (
                <div className={styles.modelLoading}>Loading models...</div>
              ) : (
                availableModels.map((model) => {
                  const isActive = selectedModel?.id === model.id || (!selectedModel && usage.modelName?.toLowerCase().includes(model.id));
                  return (
                    <button
                      key={model.id}
                      className={`${styles.modelOption} ${isActive ? styles.modelOptionActive : ''}`}
                      onClick={() => handleModelChange(model)}
                    >
                      <span className={styles.modelOptionName}>{model.name}</span>
                      {isActive && (
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                      )}
                    </button>
                  );
                })
              )}
            </div>
          )}
        </div>
        <span className={styles.separator}>|</span>
        <span className={styles.item}>
          {isPlanMode ? 'Plan Mode' : 'Normal Mode'}
        </span>
        <span className={styles.separator}>|</span>
        <span className={styles.item}>
          {messages.length} messages
        </span>
      </div>

      <div className={styles.center}>
        {/* Todo indicator - show current task or streaming status */}
        {hasTodos ? (
          <div className={styles.todoContainer} ref={todoRef}>
            <button
              className={styles.todoIndicator}
              onClick={() => setShowTodoPopup(!showTodoPopup)}
            >
              <span className={styles.todoProgress}>
                {completedCount}/{todos.length}
              </span>
              {inProgressItem ? (
                <>
                  <span className={styles.todoSpinner} />
                  <span className={styles.todoText}>{inProgressItem.activeForm}</span>
                </>
              ) : (
                <span className={styles.todoText}>
                  {completedCount === todos.length ? 'All tasks complete' : 'Tasks paused'}
                </span>
              )}
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="18 15 12 9 6 15" />
              </svg>
            </button>

            {showTodoPopup && (
              <div className={styles.todoPopup}>
                <div className={styles.todoPopupHeader}>
                  <span className={styles.todoPopupTitle}>Tasks</span>
                  <span className={styles.todoPopupCount}>{completedCount}/{todos.length} complete</span>
                </div>
                <div className={styles.todoPopupList}>
                  {todos.map((todo, index) => (
                    <div
                      key={index}
                      className={`${styles.todoPopupItem} ${styles[`todo_${todo.status}`]}`}
                    >
                      <div className={styles.todoCheckbox}>
                        {todo.status === 'completed' && (
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                            <polyline points="20 6 9 17 4 12" />
                          </svg>
                        )}
                        {todo.status === 'in_progress' && (
                          <div className={styles.todoCheckboxSpinner} />
                        )}
                      </div>
                      <span className={styles.todoItemText}>{todo.content}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : isStreaming ? (
          <span className={styles.streaming}>
            <span className={styles.streamingDot} />
            Claude is thinking...
          </span>
        ) : null}
      </div>

      <div className={styles.right}>
        <span className={styles.item}>
          {connectionStatus}
        </span>
      </div>
    </footer>
  );
};
