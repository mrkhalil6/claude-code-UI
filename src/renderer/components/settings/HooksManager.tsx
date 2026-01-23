import React, { useEffect, useState } from 'react';
import {
  HookWithId,
  HookPayload,
  HookEventType,
  HOOK_EVENT_TYPES,
  HOOK_EVENT_DESCRIPTIONS
} from '../../../shared/types';
import styles from './HooksManager.module.css';

export const HooksManager: React.FC = () => {
  const [hooks, setHooks] = useState<HookWithId[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingHook, setEditingHook] = useState<HookWithId | null>(null);

  // Form state
  const [formType, setFormType] = useState<HookEventType>('PreToolUse');
  const [formMatcher, setFormMatcher] = useState('');
  const [formCommand, setFormCommand] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  // Load hooks on mount
  useEffect(() => {
    const loadHooks = async () => {
      setLoading(true);
      try {
        const data = await window.claudeUI.hooks.list();
        setHooks(data);
      } catch (error) {
        console.error('Failed to load hooks:', error);
      } finally {
        setLoading(false);
      }
    };
    loadHooks();
  }, []);

  const resetForm = () => {
    setFormType('PreToolUse');
    setFormMatcher('');
    setFormCommand('');
    setFormError(null);
    setShowAddForm(false);
    setEditingHook(null);
  };

  const handleEditHook = (hook: HookWithId) => {
    setFormType(hook.type);
    setFormMatcher(hook.matcher);
    setFormCommand(hook.command);
    setEditingHook(hook);
    setShowAddForm(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    // Validate matcher
    if (!formMatcher.trim()) {
      setFormError('Matcher is required');
      return;
    }

    // Validate command
    if (!formCommand.trim()) {
      setFormError('Command is required');
      return;
    }

    try {
      const payload: HookPayload = {
        type: formType,
        matcher: formMatcher.trim(),
        command: formCommand.trim()
      };

      if (editingHook) {
        // Update existing hook
        payload.id = editingHook.id;
        const updated = await window.claudeUI.hooks.update(payload);
        setHooks(hooks.map(h => h.id === updated.id ? updated : h));
      } else {
        // Add new hook
        const newHook = await window.claudeUI.hooks.add(payload);
        setHooks([...hooks, newHook]);
      }
      resetForm();
    } catch (error) {
      console.error('Failed to save hook:', error);
      setFormError(error instanceof Error ? error.message : 'Failed to save hook');
    }
  };

  const handleRemoveHook = async (id: string) => {
    if (!confirm('Are you sure you want to delete this hook?')) {
      return;
    }

    try {
      const success = await window.claudeUI.hooks.delete(id);
      if (success) {
        setHooks(hooks.filter(h => h.id !== id));
      }
    } catch (error) {
      console.error('Failed to remove hook:', error);
    }
  };

  if (loading) {
    return <div className={styles.loading}>Loading hooks...</div>;
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h3 className={styles.title}>Hooks</h3>
      </div>

      <p className={styles.description}>
        Configure hooks that run at specific Claude CLI events.
        Hooks receive JSON via stdin and can modify or block tool calls.
      </p>

      {!showAddForm && (
        <button className={styles.addButton} onClick={() => setShowAddForm(true)}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          Add Hook
        </button>
      )}

      {showAddForm && (
        <form className={styles.form} onSubmit={handleSubmit}>
          <div className={styles.formHeader}>
            <h4 className={styles.formTitle}>
              {editingHook ? 'Edit Hook' : 'Add New Hook'}
            </h4>
            <button type="button" className={styles.cancelButton} onClick={resetForm}>
              Cancel
            </button>
          </div>

          {formError && (
            <div className={styles.formError}>{formError}</div>
          )}

          <div className={styles.formGroup}>
            <label className={styles.label}>Event Type</label>
            <select
              className={styles.select}
              value={formType}
              onChange={(e) => setFormType(e.target.value as HookEventType)}
            >
              {HOOK_EVENT_TYPES.map(type => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
            <span className={styles.hint}>{HOOK_EVENT_DESCRIPTIONS[formType]}</span>
          </div>

          <div className={styles.formGroup}>
            <label className={styles.label}>Matcher</label>
            <input
              type="text"
              className={styles.input}
              placeholder="e.g., Bash, Read, *, Write"
              value={formMatcher}
              onChange={(e) => setFormMatcher(e.target.value)}
            />
            <span className={styles.hint}>Tool name pattern. Use "*" to match all tools.</span>
          </div>

          <div className={styles.formGroup}>
            <label className={styles.label}>Command</label>
            <textarea
              className={styles.textarea}
              placeholder="e.g., jq -r '.tool_name' >> ~/.claude/log.txt"
              value={formCommand}
              onChange={(e) => setFormCommand(e.target.value)}
              rows={4}
            />
            <span className={styles.hint}>Shell command to execute. Receives JSON via stdin.</span>
          </div>

          <div className={styles.formActions}>
            <button type="submit" className={styles.submitButton}>
              {editingHook ? 'Save Changes' : 'Add Hook'}
            </button>
          </div>
        </form>
      )}

      <div className={styles.hookList}>
        {hooks.length === 0 ? (
          <div className={styles.emptyState}>
            <p>No hooks configured</p>
            <span>Add a hook to run commands at specific Claude CLI events</span>
          </div>
        ) : (
          hooks.map(hook => (
            <div key={hook.id} className={styles.hookItem}>
              <div className={styles.hookInfo}>
                <div className={styles.hookNameRow}>
                  <span className={styles.eventBadge}>{hook.type}</span>
                  <span className={styles.matcherBadge}>{hook.matcher}</span>
                </div>
                <span className={styles.hookCommand} title={hook.command}>
                  {hook.command}
                </span>
              </div>
              <div className={styles.hookActions}>
                <button
                  className={styles.editButton}
                  onClick={() => handleEditHook(hook)}
                  title="Edit hook"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                  </svg>
                </button>
                <button
                  className={styles.deleteButton}
                  onClick={() => handleRemoveHook(hook.id)}
                  title="Remove hook"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polyline points="3 6 5 6 21 6" />
                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                  </svg>
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
