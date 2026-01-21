import React from 'react';
import { DiffEditor } from '@monaco-editor/react';
import { DiffToolbar } from './DiffToolbar';
import { FileChange } from '../../../shared/types';
import { useUI } from '../../store';
import { getDiffEditorTheme } from '../../monaco-config';
import styles from './DiffViewer.module.css';

interface DiffViewerProps {
  change: FileChange;
  onAccept: () => void;
  onReject: () => void;
}

export const DiffViewer: React.FC<DiffViewerProps> = ({
  change,
  onAccept,
  onReject
}) => {
  const { resolvedTheme } = useUI();

  // Detect language from file extension
  const getLanguage = (filePath: string): string => {
    const ext = filePath.split('.').pop()?.toLowerCase();
    const languageMap: Record<string, string> = {
      'js': 'javascript',
      'jsx': 'javascript',
      'ts': 'typescript',
      'tsx': 'typescript',
      'py': 'python',
      'rb': 'ruby',
      'go': 'go',
      'rs': 'rust',
      'java': 'java',
      'c': 'c',
      'cpp': 'cpp',
      'h': 'cpp',
      'cs': 'csharp',
      'php': 'php',
      'html': 'html',
      'css': 'css',
      'scss': 'scss',
      'json': 'json',
      'xml': 'xml',
      'yaml': 'yaml',
      'yml': 'yaml',
      'md': 'markdown',
      'sql': 'sql',
      'sh': 'shell',
      'bash': 'shell'
    };
    return languageMap[ext || ''] || 'plaintext';
  };

  return (
    <div className={styles.container}>
      <DiffToolbar
        filePath={change.filePath}
        onAccept={onAccept}
        onReject={onReject}
        status={change.status}
      />

      <div className={styles.editorContainer}>
        <DiffEditor
          height="100%"
          language={getLanguage(change.filePath)}
          original={change.originalContent}
          modified={change.modifiedContent}
          theme={getDiffEditorTheme(resolvedTheme)}
          options={{
            readOnly: true,
            renderSideBySide: true,
            enableSplitViewResizing: true,
            ignoreTrimWhitespace: false,
            renderIndicators: true,
            originalEditable: false,
            minimap: { enabled: false },
            scrollBeyondLastLine: false,
            fontSize: 13,
            lineHeight: 20,
            wordWrap: 'on',
            diffWordWrap: 'on'
          }}
        />
      </div>
    </div>
  );
};
