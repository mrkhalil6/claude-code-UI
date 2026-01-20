import React, { useState } from 'react';
import { Modal, Button } from '../common';
import { PendingPermission, PermissionScope } from '../../../shared/types';
import { usePermissionActions, useSession } from '../../store';
import styles from './PermissionDialog.module.css';

interface PermissionDialogProps {
  permission: PendingPermission;
  onRetry?: (message: string) => void;
}

export const PermissionDialog: React.FC<PermissionDialogProps> = ({ permission, onRetry }) => {
  const [scope, setScope] = useState<PermissionScope>('session');
  const { setPendingPermission, addToPermissionHistory } = usePermissionActions();
  const { activeSessionId } = useSession();

  const handleGrant = async () => {
    console.log('[PermissionDialog] handleGrant called');
    console.log('[PermissionDialog] activeSessionId:', activeSessionId);
    console.log('[PermissionDialog] permission.toolName:', permission.toolName);
    console.log('[PermissionDialog] permission.retryMessage:', permission.retryMessage);
    console.log('[PermissionDialog] onRetry defined:', !!onRetry);

    if (!activeSessionId) {
      console.error('[PermissionDialog] No activeSessionId, cannot grant permission');
      return;
    }

    try {
      // Register the tool as allowed for this session
      console.log('[PermissionDialog] Calling allowTool...');
      const result = await window.claudeUI.cli.allowTool(activeSessionId, permission.toolName);
      console.log('[PermissionDialog] allowTool result:', result);

      addToPermissionHistory(permission);
      setPendingPermission(null);

      // Automatically retry the message that triggered the permission request
      if (permission.retryMessage && onRetry) {
        console.log('[PermissionDialog] Auto-retrying message after permission grant:', permission.retryMessage);
        onRetry(permission.retryMessage);
      } else {
        console.log('[PermissionDialog] Cannot auto-retry: retryMessage=', !!permission.retryMessage, 'onRetry=', !!onRetry);
      }
    } catch (error) {
      console.error('[PermissionDialog] Failed to grant permission:', error);
    }
  };

  const handleDeny = async () => {
    setPendingPermission(null);
    setLastUserMessage(null);
  };

  const getToolDescription = () => {
    const { toolName, toolInput } = permission;

    switch (toolName) {
      case 'Write':
        return `Write to file: ${toolInput.file_path}`;
      case 'Edit':
        return `Edit file: ${toolInput.file_path}`;
      case 'Bash':
        return `Execute command: ${toolInput.command}`;
      case 'Read':
        return `Read file: ${toolInput.file_path}`;
      case 'WebSearch':
        return `Search the web: ${toolInput.query || 'perform search'}`;
      case 'WebFetch':
        return `Fetch web content: ${toolInput.url || 'fetch URL'}`;
      default:
        return `${toolName}: ${permission.description || 'perform this action'}`;
    }
  };

  const getToolIcon = () => {
    switch (permission.toolName) {
      case 'Write':
      case 'Edit':
        return (
          <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
            <path d="M14.06 9.02l.92.92L5.92 19H5v-.92l9.06-9.06M17.66 3c-.25 0-.51.1-.7.29l-1.83 1.83 3.75 3.75 1.83-1.83c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.2-.2-.45-.29-.71-.29zm-3.6 3.19L3 17.25V21h3.75L17.81 9.94l-3.75-3.75z"/>
          </svg>
        );
      case 'Bash':
        return (
          <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
            <path d="M20 19V7H4v12h16m0-14c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V7c0-1.1.9-2 2-2h16M7.5 15h5v1.5h-5V15m-2-4L7 9.5 9.5 12 7 14.5 5.5 13l1.5-1.5L5.5 10z"/>
          </svg>
        );
      default:
        return (
          <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z"/>
          </svg>
        );
    }
  };

  return (
    <Modal
      isOpen={true}
      onClose={handleDeny}
      title="Permission Required"
      size="md"
    >
      <div className={styles.content}>
        <div className={styles.iconWrapper}>
          <div className={styles.icon}>
            {getToolIcon()}
          </div>
        </div>

        <div className={styles.toolInfo}>
          <h3 className={styles.toolName}>{permission.toolName}</h3>
          <p className={styles.description}>{getToolDescription()}</p>
        </div>

        {permission.toolInput && Object.keys(permission.toolInput).length > 0 && (
          <div className={styles.details}>
            <h4 className={styles.detailsTitle}>Details</h4>
            <pre className={styles.detailsContent}>
              {JSON.stringify(permission.toolInput, null, 2)}
            </pre>
          </div>
        )}

        <div className={styles.scopeOptions}>
          <h4 className={styles.scopeTitle}>Permission Scope</h4>

          <label className={styles.scopeOption}>
            <input
              type="radio"
              name="scope"
              value="once"
              checked={scope === 'once'}
              onChange={() => setScope('once')}
            />
            <div className={styles.scopeContent}>
              <span className={styles.scopeLabel}>Allow once</span>
              <span className={styles.scopeDesc}>Only for this specific action</span>
            </div>
          </label>

          <label className={styles.scopeOption}>
            <input
              type="radio"
              name="scope"
              value="session"
              checked={scope === 'session'}
              onChange={() => setScope('session')}
            />
            <div className={styles.scopeContent}>
              <span className={styles.scopeLabel}>Allow for this session</span>
              <span className={styles.scopeDesc}>Until you close this chat</span>
            </div>
          </label>

          <label className={styles.scopeOption}>
            <input
              type="radio"
              name="scope"
              value="always"
              checked={scope === 'always'}
              onChange={() => setScope('always')}
            />
            <div className={styles.scopeContent}>
              <span className={styles.scopeLabel}>Always allow</span>
              <span className={styles.scopeDesc}>Remember this for future sessions</span>
            </div>
          </label>
        </div>

        <div className={styles.actions}>
          <Button variant="ghost" onClick={handleDeny}>
            Deny
          </Button>
          <Button variant="primary" onClick={handleGrant}>
            Allow
          </Button>
        </div>
      </div>
    </Modal>
  );
};
