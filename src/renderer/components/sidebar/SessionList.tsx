import React, { useState } from 'react';
import { SessionItem } from './SessionItem';
import { ProjectWithSessions } from '../../../shared/types';
import styles from './SessionList.module.css';

interface SessionListProps {
  projects: ProjectWithSessions[];
}

export const SessionList: React.FC<SessionListProps> = ({ projects }) => {
  const [expandedProjects, setExpandedProjects] = useState<Set<string>>(
    new Set(projects.slice(0, 3).map(p => p.encodedName))
  );

  const toggleProject = (encodedName: string) => {
    setExpandedProjects(prev => {
      const next = new Set(prev);
      if (next.has(encodedName)) {
        next.delete(encodedName);
      } else {
        next.add(encodedName);
      }
      return next;
    });
  };

  return (
    <div className={styles.list}>
      {projects.map(project => (
        <div key={project.encodedName} className={styles.projectGroup}>
          <button
            className={styles.projectHeader}
            onClick={() => toggleProject(project.encodedName)}
          >
            <svg
              className={`${styles.chevron} ${expandedProjects.has(project.encodedName) ? styles.expanded : ''}`}
              width="12"
              height="12"
              viewBox="0 0 12 12"
              fill="currentColor"
            >
              <path d="M4.5 2l4 4-4 4" />
            </svg>
            <span className={styles.projectPath} title={project.path}>
              {project.path.split(/[/\\]/).pop()}
            </span>
            <span className={styles.sessionCount}>
              {project.sessions.length}
            </span>
          </button>

          {expandedProjects.has(project.encodedName) && (
            <div className={styles.sessions}>
              {project.sessions.map(session => (
                <SessionItem
                  key={session.id}
                  session={session}
                  projectPath={project.path}
                  projectEncodedName={project.encodedName}
                />
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
};
