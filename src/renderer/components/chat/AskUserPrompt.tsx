import React, { useState, useCallback } from 'react';
import { MarkdownPreview } from '../markdown/MarkdownPreview';
import { AskUserOption } from '../../store/slices/chat.slice';
import styles from './AskUserPrompt.module.css';

interface AskUserPromptProps {
  question: string;
  header?: string;
  options?: AskUserOption[];
  multiSelect?: boolean;
  onAnswer: (answer: string) => void;
  onCancel: () => void;
}

export const AskUserPrompt: React.FC<AskUserPromptProps> = ({
  question,
  header,
  options,
  multiSelect = false,
  onAnswer,
  onCancel
}) => {
  const [textAnswer, setTextAnswer] = useState('');
  const [selectedOptions, setSelectedOptions] = useState<Set<string>>(new Set());

  const handleOptionClick = useCallback((option: AskUserOption) => {
    if (multiSelect) {
      setSelectedOptions(prev => {
        const newSet = new Set(prev);
        if (newSet.has(option.label)) {
          newSet.delete(option.label);
        } else {
          newSet.add(option.label);
        }
        return newSet;
      });
    } else {
      // Single select - submit immediately
      onAnswer(option.label);
    }
  }, [multiSelect, onAnswer]);

  const handleMultiSelectSubmit = useCallback(() => {
    if (selectedOptions.size > 0) {
      onAnswer(Array.from(selectedOptions).join(', '));
    }
  }, [selectedOptions, onAnswer]);

  const handleTextSubmit = useCallback(() => {
    if (textAnswer.trim()) {
      onAnswer(textAnswer.trim());
    }
  }, [textAnswer, onAnswer]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleTextSubmit();
    } else if (e.key === 'Escape') {
      onCancel();
    }
  }, [handleTextSubmit, onCancel]);

  return (
    <div className={styles.overlay}>
      <div className={styles.container}>
        <div className={styles.header}>
          <span className={styles.icon}>?</span>
          <span className={styles.label}>{header || 'Claude needs your input'}</span>
        </div>

        <div className={styles.question}>
          <MarkdownPreview content={question} />
        </div>

        {options && options.length > 0 ? (
          <div className={styles.optionsContainer}>
            <div className={styles.options}>
              {options.map((option, index) => (
                <button
                  key={index}
                  className={`${styles.optionButton} ${
                    multiSelect && selectedOptions.has(option.label) ? styles.selected : ''
                  }`}
                  onClick={() => handleOptionClick(option)}
                >
                  {multiSelect && (
                    <span className={styles.checkbox}>
                      {selectedOptions.has(option.label) ? '✓' : ''}
                    </span>
                  )}
                  <span className={styles.optionLabel}>{option.label}</span>
                  {option.description && (
                    <span className={styles.optionDescription}>{option.description}</span>
                  )}
                </button>
              ))}
            </div>
            {multiSelect && (
              <div className={styles.multiSelectActions}>
                <button
                  className={styles.submitButton}
                  onClick={handleMultiSelectSubmit}
                  disabled={selectedOptions.size === 0}
                >
                  Submit ({selectedOptions.size} selected)
                </button>
              </div>
            )}
            <div className={styles.orDivider}>
              <span>or type a custom answer</span>
            </div>
          </div>
        ) : null}

        <div className={styles.textInputContainer}>
          <textarea
            className={styles.textInput}
            value={textAnswer}
            onChange={(e) => setTextAnswer(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type your answer..."
            autoFocus={!options || options.length === 0}
            rows={2}
          />
          <div className={styles.actions}>
            <button className={styles.cancelButton} onClick={onCancel}>
              Cancel
            </button>
            <button
              className={styles.submitButton}
              onClick={handleTextSubmit}
              disabled={!textAnswer.trim()}
            >
              Submit
            </button>
          </div>
        </div>

        <div className={styles.hint}>
          Press <kbd>Enter</kbd> to submit, <kbd>Esc</kbd> to cancel
        </div>
      </div>
    </div>
  );
};
