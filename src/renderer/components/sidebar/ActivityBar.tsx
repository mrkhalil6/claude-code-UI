import React from 'react';
import { SidebarView } from '../../store/slices/ui.slice';
import styles from './ActivityBar.module.css';

interface ActivityBarProps {
  activeView: SidebarView;
  onViewChange: (view: SidebarView) => void;
}

// Projects/Chat icon
const ProjectsIcon: React.FC = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
  </svg>
);

// Files/Folder icon
const FilesIcon: React.FC = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
  </svg>
);

export const ActivityBar: React.FC<ActivityBarProps> = ({ activeView, onViewChange }) => {
  return (
    <div className={styles.activityBar}>
      <button
        className={`${styles.iconButton} ${activeView === 'projects' ? styles.active : ''}`}
        onClick={() => onViewChange('projects')}
        title="Chat History"
      >
        <ProjectsIcon />
      </button>
      <button
        className={`${styles.iconButton} ${activeView === 'files' ? styles.active : ''}`}
        onClick={() => onViewChange('files')}
        title="File Explorer"
      >
        <FilesIcon />
      </button>
    </div>
  );
};
