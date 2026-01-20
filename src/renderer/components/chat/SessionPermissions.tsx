import React, { useState, useEffect, useRef } from 'react';
import { usePermissions, usePermissionActions, useSession } from '../../store';
import styles from './SessionPermissions.module.css';

export const SessionPermissions: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const { sessionAllowedTools, knownTools } = usePermissions();
  const { addSessionAllowedTool, removeSessionAllowedTool, setKnownTools } = usePermissionActions();
  const { activeSessionId } = useSession();

  // Load known tools on mount
  useEffect(() => {
    const loadTools = async () => {
      try {
        const tools = await window.claudeUI.permissions.getKnownTools();
        setKnownTools(tools);
      } catch (error) {
        console.error('Failed to load known tools:', error);
      }
    };
    loadTools();
  }, [setKnownTools]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const handleToolToggle = (tool: string) => {
    if (sessionAllowedTools.includes(tool)) {
      removeSessionAllowedTool(tool);
    } else {
      addSessionAllowedTool(tool);
    }
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      // First, get the default tools from main process
      const defaultTools = await window.claudeUI.permissions.getKnownTools();

      // Merge with any tools we've seen (keep MCP tools that were discovered)
      const mergedTools = [...new Set([...defaultTools, ...knownTools])];
      setKnownTools(mergedTools.sort());

      // Note: Full refresh with MCP tools requires restarting the session
      // The tools will be fully updated when the next session starts
    } catch (error) {
      console.error('Failed to refresh tools:', error);
    } finally {
      setIsRefreshing(false);
    }
  };

  return (
    <div className={styles.container} ref={dropdownRef}>
      <button
        className={styles.trigger}
        onClick={() => setIsOpen(!isOpen)}
        title="Session permissions"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
          <path d="M7 11V7a5 5 0 0 1 10 0v4" />
        </svg>
        {sessionAllowedTools.length > 0 && (
          <span className={styles.badge}>{sessionAllowedTools.length}</span>
        )}
      </button>

      {isOpen && (
        <div className={styles.dropdown}>
          <div className={styles.dropdownHeader}>
            <div className={styles.dropdownTitleRow}>
              <span className={styles.dropdownTitle}>Session Permissions</span>
              <button
                className={styles.refreshButton}
                onClick={handleRefresh}
                disabled={isRefreshing}
                title="Refresh tools list"
              >
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  className={isRefreshing ? styles.spinning : ''}
                >
                  <path d="M23 4v6h-6M1 20v-6h6" />
                  <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
                </svg>
              </button>
            </div>
            <span className={styles.dropdownHint}>
              {activeSessionId
                ? 'Tools allowed for this session only'
                : 'Start a chat to see all available tools (including MCP)'}
            </span>
          </div>

          <div className={styles.toolList}>
            {knownTools.map(tool => {
              const isAllowed = sessionAllowedTools.includes(tool);
              return (
                <label key={tool} className={styles.toolItem}>
                  <input
                    type="checkbox"
                    checked={isAllowed}
                    onChange={() => handleToolToggle(tool)}
                  />
                  <span className={styles.toolName}>{tool}</span>
                  {isAllowed && <span className={styles.allowedBadge}>Allowed</span>}
                </label>
              );
            })}
          </div>

          {sessionAllowedTools.length > 0 && (
            <div className={styles.dropdownFooter}>
              <button
                className={styles.clearButton}
                onClick={() => sessionAllowedTools.forEach(t => removeSessionAllowedTool(t))}
              >
                Clear all
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
