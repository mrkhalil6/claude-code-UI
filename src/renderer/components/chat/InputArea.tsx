import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Button } from '../common';
import { filterCommands, parseSlashCommand, SlashCommand, SLASH_COMMANDS } from '../../../shared/slash-commands';
import { useUI } from '../../store';
import styles from './InputArea.module.css';

interface InputAreaProps {
  onSend: (message: string) => void;
  onSlashCommand?: (command: SlashCommand, args: string) => void;
  onInterrupt?: () => void;
  disabled?: boolean;
  isStreaming?: boolean;
  placeholder?: string;
}

export const InputArea: React.FC<InputAreaProps> = ({
  onSend,
  onSlashCommand,
  onInterrupt,
  disabled = false,
  isStreaming = false,
  placeholder = 'Type a message... (/ for commands)'
}) => {
  const [value, setValue] = useState('');
  const [suggestions, setSuggestions] = useState<SlashCommand[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);
  const { availableSkills } = useUI();

  // Auto-resize textarea
  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      textarea.style.height = `${Math.min(textarea.scrollHeight, 200)}px`;
    }
  }, [value]);

  // Update suggestions when value changes
  useEffect(() => {
    const trimmed = value.trim();

    if (trimmed.startsWith('/') && !trimmed.includes(' ')) {
      const filtered = filterCommands(trimmed, availableSkills);
      setSuggestions(filtered);
      setShowSuggestions(filtered.length > 0);
      setSelectedIndex(0);
    } else if (trimmed === '') {
      // Show all commands when input is empty and user types /
      setSuggestions([]);
      setShowSuggestions(false);
    } else {
      setSuggestions([]);
      setShowSuggestions(false);
    }
  }, [value, availableSkills]);

  // Scroll selected item into view
  useEffect(() => {
    if (showSuggestions && suggestionsRef.current) {
      const selectedEl = suggestionsRef.current.children[selectedIndex] as HTMLElement;
      if (selectedEl) {
        selectedEl.scrollIntoView({ block: 'nearest' });
      }
    }
  }, [selectedIndex, showSuggestions]);

  const handleSelectCommand = useCallback((command: SlashCommand) => {
    setValue(command.name + ' ');
    setShowSuggestions(false);
    textareaRef.current?.focus();
  }, []);

  const handleSubmit = useCallback(() => {
    if (value.trim() && !disabled) {
      // Check if it's a slash command
      const parsed = parseSlashCommand(value, availableSkills);

      if (parsed && onSlashCommand) {
        onSlashCommand(parsed.command, parsed.args);
        setValue('');
        return;
      }

      onSend(value);
      setValue('');
    }
  }, [value, disabled, onSend, onSlashCommand, availableSkills]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    // Handle suggestions navigation
    if (showSuggestions && suggestions.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex(prev => (prev + 1) % suggestions.length);
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex(prev => (prev - 1 + suggestions.length) % suggestions.length);
        return;
      }
      if (e.key === 'Tab' || (e.key === 'Enter' && suggestions.length > 0)) {
        e.preventDefault();
        handleSelectCommand(suggestions[selectedIndex]);
        return;
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        setShowSuggestions(false);
        return;
      }
    }

    // Show all commands when pressing / on empty input
    if (e.key === '/' && value === '') {
      setSuggestions([...SLASH_COMMANDS, ...availableSkills]);
      setShowSuggestions(true);
      setSelectedIndex(0);
    }

    // Normal submit
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setValue(e.target.value);
  };

  const handleBlur = () => {
    // Delay hiding to allow click on suggestion
    setTimeout(() => setShowSuggestions(false), 150);
  };

  return (
    <div className={styles.container}>
      <div className={styles.inputWrapper}>
        {showSuggestions && suggestions.length > 0 && (
          <div className={styles.suggestions} ref={suggestionsRef}>
            {suggestions.map((cmd, index) => (
              <div
                key={cmd.name}
                className={`${styles.suggestion} ${index === selectedIndex ? styles.selected : ''}`}
                onClick={() => handleSelectCommand(cmd)}
                onMouseEnter={() => setSelectedIndex(index)}
              >
                <span className={styles.commandName}>{cmd.name}</span>
                <span className={styles.commandDesc}>{cmd.description}</span>
                <span className={`${styles.commandType} ${
                    cmd.type === 'ui-only' ? styles.localType
                    : cmd.type === 'skill' ? styles.skillType
                    : styles.cliType
                  }`}>
                  {cmd.type === 'ui-only' ? 'UI' : cmd.type === 'skill' ? 'Skill' : 'CLI'}
                </span>
              </div>
            ))}
          </div>
        )}

        <textarea
          ref={textareaRef}
          className={styles.textarea}
          value={value}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          onBlur={handleBlur}
          placeholder={placeholder}
          disabled={disabled}
          rows={1}
        />

        <div className={styles.actions}>
          <span className={styles.hint}>
            {isStreaming
              ? 'Claude is responding... Press Stop to interrupt'
              : <>Press <kbd>Enter</kbd> to send, <kbd>Shift+Enter</kbd> for new line, <kbd>/</kbd> for commands</>
            }
          </span>
          {isStreaming && onInterrupt ? (
            <Button
              variant="danger"
              size="sm"
              onClick={onInterrupt}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <rect x="6" y="6" width="12" height="12" rx="2"/>
              </svg>
              Stop
            </Button>
          ) : (
            <Button
              variant="primary"
              size="sm"
              onClick={handleSubmit}
              disabled={disabled || !value.trim()}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/>
              </svg>
              Send
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};
