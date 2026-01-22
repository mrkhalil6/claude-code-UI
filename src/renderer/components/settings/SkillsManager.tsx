import React, { useEffect, useState, useCallback } from 'react';
import styles from './SkillsManager.module.css';

interface Skill {
  id: string;
  name: string;
  description?: string;
  path: string;
  content: string;
  metadata: Record<string, unknown>;
  modifiedAt: Date;
}

interface SkillsManagerProps {
  onClose?: () => void;
}

const DEFAULT_SKILL_TEMPLATE = `---
name: My Skill
description: A brief description of what this skill does
allowed-tools:
  - Read
  - Grep
  - Glob
---

# My Skill

This is a personal skill that extends Claude's capabilities.

## Instructions

Add your instructions here...
`;

export const SkillsManager: React.FC<SkillsManagerProps> = ({ onClose }) => {
  const [skills, setSkills] = useState<Skill[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingSkill, setEditingSkill] = useState<string | null>(null);
  const [viewingSkill, setViewingSkill] = useState<Skill | null>(null);

  // Form state
  const [formId, setFormId] = useState('');
  const [formContent, setFormContent] = useState(DEFAULT_SKILL_TEMPLATE);
  const [formError, setFormError] = useState<string | null>(null);

  // Load skills on mount
  const loadSkills = useCallback(async () => {
    setLoading(true);
    try {
      const data = await window.claudeUI.skills.list();
      setSkills(data);
    } catch (error) {
      console.error('Failed to load skills:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSkills();
  }, [loadSkills]);

  const resetForm = () => {
    setFormId('');
    setFormContent(DEFAULT_SKILL_TEMPLATE);
    setFormError(null);
    setShowAddForm(false);
    setEditingSkill(null);
  };

  const handleEditSkill = async (skill: Skill) => {
    setFormId(skill.id);
    setFormContent(skill.content);
    setEditingSkill(skill.id);
    setShowAddForm(true);
    setViewingSkill(null);
  };

  const handleViewSkill = (skill: Skill) => {
    setViewingSkill(skill);
    setShowAddForm(false);
  };

  const handleCloseView = () => {
    setViewingSkill(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    // Validate ID
    const skillId = formId.trim().toLowerCase().replace(/\s+/g, '-');
    if (!skillId) {
      setFormError('Skill ID is required');
      return;
    }

    // Validate ID format (alphanumeric and hyphens only)
    if (!/^[a-z0-9-]+$/.test(skillId)) {
      setFormError('Skill ID can only contain lowercase letters, numbers, and hyphens');
      return;
    }

    // Check for duplicate ID (only when creating)
    if (!editingSkill && skills.some(s => s.id === skillId)) {
      setFormError('A skill with this ID already exists');
      return;
    }

    // Validate content
    if (!formContent.trim()) {
      setFormError('Skill content is required');
      return;
    }

    try {
      if (editingSkill) {
        await window.claudeUI.skills.update({ id: editingSkill, content: formContent });
      } else {
        await window.claudeUI.skills.create({ id: skillId, content: formContent });
      }
      await loadSkills();
      resetForm();
    } catch (error) {
      console.error('Failed to save skill:', error);
      setFormError(error instanceof Error ? error.message : 'Failed to save skill');
    }
  };

  const handleDeleteSkill = async (id: string) => {
    if (!confirm(`Are you sure you want to delete the skill "${id}"?`)) {
      return;
    }

    try {
      await window.claudeUI.skills.delete(id);
      if (viewingSkill?.id === id) {
        setViewingSkill(null);
      }
      await loadSkills();
    } catch (error) {
      console.error('Failed to delete skill:', error);
    }
  };

  const formatDate = (date: Date) => {
    return new Date(date).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  if (loading) {
    return <div className={styles.loading}>Loading skills...</div>;
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h3 className={styles.title}>Personal Skills</h3>
        {onClose && (
          <button className={styles.closeButton} onClick={onClose}>
            &times;
          </button>
        )}
      </div>

      <p className={styles.description}>
        Create and manage personal skills stored in <code>~/.claude/skills/</code>.
        <br />
        <span className={styles.hint}>
          Skills extend Claude's capabilities with custom instructions and allowed tools.
        </span>
      </p>

      {!showAddForm && !viewingSkill && (
        <button className={styles.addButton} onClick={() => setShowAddForm(true)}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          Create New Skill
        </button>
      )}

      {showAddForm && (
        <form className={styles.form} onSubmit={handleSubmit}>
          <div className={styles.formHeader}>
            <h4 className={styles.formTitle}>
              {editingSkill ? `Edit "${editingSkill}"` : 'Create New Skill'}
            </h4>
            <button type="button" className={styles.cancelButton} onClick={resetForm}>
              Cancel
            </button>
          </div>

          {formError && (
            <div className={styles.formError}>{formError}</div>
          )}

          <div className={styles.formGroup}>
            <label className={styles.label}>Skill ID</label>
            <input
              type="text"
              className={styles.input}
              placeholder="e.g., my-custom-skill"
              value={formId}
              onChange={(e) => setFormId(e.target.value)}
              disabled={!!editingSkill}
            />
            <span className={styles.hint}>
              Unique identifier (lowercase letters, numbers, and hyphens only)
            </span>
          </div>

          <div className={styles.formGroup}>
            <label className={styles.label}>SKILL.md Content</label>
            <textarea
              className={styles.contentTextarea}
              placeholder="Enter your SKILL.md content..."
              value={formContent}
              onChange={(e) => setFormContent(e.target.value)}
              rows={15}
            />
            <span className={styles.hint}>
              Use YAML frontmatter for metadata (name, description, allowed-tools)
            </span>
          </div>

          <div className={styles.formActions}>
            <button type="submit" className={styles.submitButton}>
              {editingSkill ? 'Save Changes' : 'Create Skill'}
            </button>
          </div>
        </form>
      )}

      {viewingSkill && (
        <div className={styles.viewPanel}>
          <div className={styles.viewHeader}>
            <h4 className={styles.viewTitle}>{viewingSkill.name}</h4>
            <div className={styles.viewActions}>
              <button
                className={styles.editButton}
                onClick={() => handleEditSkill(viewingSkill)}
                title="Edit skill"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                </svg>
              </button>
              <button
                className={styles.cancelButton}
                onClick={handleCloseView}
              >
                Close
              </button>
            </div>
          </div>
          {viewingSkill.description && (
            <p className={styles.viewDescription}>{viewingSkill.description}</p>
          )}
          <div className={styles.viewMeta}>
            <span className={styles.viewPath}>{viewingSkill.path}</span>
            <span className={styles.viewDate}>Modified: {formatDate(viewingSkill.modifiedAt)}</span>
          </div>
          <pre className={styles.viewContent}>{viewingSkill.content}</pre>
        </div>
      )}

      {!showAddForm && !viewingSkill && (
        <div className={styles.skillList}>
          {skills.length === 0 ? (
            <div className={styles.emptyState}>
              <p>No personal skills created</p>
              <span>Create a skill to extend Claude's capabilities</span>
            </div>
          ) : (
            skills.map(skill => (
              <div key={skill.id} className={styles.skillItem}>
                <div className={styles.skillInfo}>
                  <div className={styles.skillNameRow}>
                    <span className={styles.skillName}>{skill.name}</span>
                    <span className={styles.skillId}>{skill.id}</span>
                  </div>
                  {skill.description && (
                    <span className={styles.skillDescription}>{skill.description}</span>
                  )}
                  <span className={styles.skillMeta}>
                    Modified: {formatDate(skill.modifiedAt)}
                  </span>
                </div>
                <div className={styles.skillActions}>
                  <button
                    className={styles.viewButton}
                    onClick={() => handleViewSkill(skill)}
                    title="View skill"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                      <circle cx="12" cy="12" r="3" />
                    </svg>
                  </button>
                  <button
                    className={styles.editButton}
                    onClick={() => handleEditSkill(skill)}
                    title="Edit skill"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                    </svg>
                  </button>
                  <button
                    className={styles.deleteButton}
                    onClick={() => handleDeleteSkill(skill.id)}
                    title="Delete skill"
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
      )}
    </div>
  );
};
