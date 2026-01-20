import React from 'react';
import { Header } from './Header';
import { Sidebar } from './Sidebar';
import { StatusBar } from './StatusBar';
import { ChatContainer } from '../chat/ChatContainer';
import { PermissionDialog } from '../permissions/PermissionDialog';
import { usePermissions } from '../../store';
import styles from './Layout.module.css';

export const Layout: React.FC = () => {
  const { pendingPermission } = usePermissions();

  return (
    <div className={styles.layout}>
      <Header />

      <div className={styles.body}>
        <Sidebar />
        <main className={styles.main}>
          <ChatContainer />
        </main>
      </div>

      <StatusBar />

      {pendingPermission && (
        <PermissionDialog permission={pendingPermission} />
      )}
    </div>
  );
};
