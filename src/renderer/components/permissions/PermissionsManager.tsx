import React, { useEffect, useState } from 'react';
import { usePermissions, usePermissionActions } from '../../store';
import { ToolPermission } from '../../store/slices/permission.slice';
import styles from './PermissionsManager.module.css';

interface PermissionsManagerProps {
  type: 'global' | 'session';
  onClose?: () => void;
}

export const PermissionsManager: React.FC<PermissionsManagerProps> = ({ type, onClose }) => {
  const { globalPermissions, knownTools, sessionAllowedTools } = usePermissions();
  const { setGlobalPermissions, setKnownTools, addSessionAllowedTool, removeSessionAllowedTool } = usePermissionActions();
  const [loading, setLoading] = useState(true);

  // Load permissions on mount
  useEffect(() => {
    const loadData = async () => {
      try {
        const [permissions, tools] = await Promise.all([
          window.claudeUI.permissions.getGlobal(),
          window.claudeUI.permissions.getKnownTools()
        ]);
        setGlobalPermissions(permissions);
        setKnownTools(tools);
      } catch (error) {
        console.error('Failed to load permissions:', error);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [setGlobalPermissions, setKnownTools]);

  const handleGlobalPermissionChange = async (tool: string, allowed: boolean, scope: 'always' | 'ask') => {
    try {
      const updated = await window.claudeUI.permissions.setGlobal(tool, allowed, scope);
      setGlobalPermissions(updated);
    } catch (error) {
      console.error('Failed to update permission:', error);
    }
  };

  const handleRemoveGlobalPermission = async (tool: string) => {
    try {
      const updated = await window.claudeUI.permissions.removeGlobal(tool);
      setGlobalPermissions(updated);
    } catch (error) {
      console.error('Failed to remove permission:', error);
    }
  };

  const handleSessionToolToggle = (tool: string) => {
    if (sessionAllowedTools.includes(tool)) {
      removeSessionAllowedTool(tool);
    } else {
      addSessionAllowedTool(tool);
    }
  };

  const getPermissionForTool = (tool: string): ToolPermission | undefined => {
    return globalPermissions.find(p => p.tool === tool);
  };

  if (loading) {
    return <div className={styles.loading}>Loading permissions...</div>;
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h3 className={styles.title}>
          {type === 'global' ? 'Global Tool Permissions' : 'Session Permissions'}
        </h3>
        {onClose && (
          <button className={styles.closeButton} onClick={onClose}>
            &times;
          </button>
        )}
      </div>

      <p className={styles.description}>
        {type === 'global'
          ? 'These permissions persist across all sessions and app restarts.'
          : 'These permissions only apply to the current chat session.'}
      </p>

      <div className={styles.toolList}>
        {knownTools.map(tool => {
          const permission = getPermissionForTool(tool);
          const isSessionAllowed = sessionAllowedTools.includes(tool);

          return (
            <div key={tool} className={styles.toolItem}>
              <div className={styles.toolInfo}>
                <span className={styles.toolName}>{tool}</span>
                {type === 'global' && permission && (
                  <span className={`${styles.badge} ${permission.allowed ? styles.allowed : styles.denied}`}>
                    {permission.allowed ? (permission.scope === 'always' ? 'Auto-allow' : 'Ask') : 'Denied'}
                  </span>
                )}
                {type === 'session' && isSessionAllowed && (
                  <span className={`${styles.badge} ${styles.allowed}`}>Allowed</span>
                )}
              </div>

              <div className={styles.toolActions}>
                {type === 'global' ? (
                  <>
                    <select
                      className={styles.select}
                      value={permission ? (permission.allowed ? permission.scope : 'deny') : 'default'}
                      onChange={(e) => {
                        const value = e.target.value;
                        if (value === 'default') {
                          handleRemoveGlobalPermission(tool);
                        } else if (value === 'deny') {
                          handleGlobalPermissionChange(tool, false, 'ask');
                        } else {
                          handleGlobalPermissionChange(tool, true, value as 'always' | 'ask');
                        }
                      }}
                    >
                      <option value="default">Default (Ask)</option>
                      <option value="always">Auto-allow</option>
                      <option value="ask">Allow (Ask each time)</option>
                      <option value="deny">Always Deny</option>
                    </select>
                  </>
                ) : (
                  <label className={styles.toggle}>
                    <input
                      type="checkbox"
                      checked={isSessionAllowed}
                      onChange={() => handleSessionToolToggle(tool)}
                    />
                    <span className={styles.toggleSlider}></span>
                  </label>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {type === 'session' && sessionAllowedTools.length > 0 && (
        <div className={styles.summary}>
          <strong>Session allowed:</strong> {sessionAllowedTools.join(', ')}
        </div>
      )}
    </div>
  );
};
