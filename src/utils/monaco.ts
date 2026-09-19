import * as monaco from 'monaco-editor';
import EditorWorker from './editorWorker?worker';

self.MonacoEnvironment = {
  getWorker: function (_moduleId: unknown, _label: string) {
    return new EditorWorker();
  },
};

export function ensureSqlightTheme() {
  monaco.editor.defineTheme('sqlight-dark', {
    base: 'vs-dark',
    inherit: true,
    rules: [
      { token: 'keyword', foreground: '38bdf8', fontStyle: 'bold' },
      { token: 'string', foreground: '34d399' },
      { token: 'number', foreground: 'fbbf24' },
      { token: 'comment', foreground: '6b7280', fontStyle: 'italic' },
      { token: 'operator.sql', foreground: 'f472b6' },
    ],
    colors: {
      'editor.background': '#141418',
      'editor.foreground': '#f0f0f5',
      'editorLineNumber.foreground': '#4b5563',
      'editorLineNumber.activeForeground': '#93c5fd',
      'editor.lineHighlightBackground': '#1e1e26',
      'editor.selectionBackground': '#2563eb40',
      'editorCursor.foreground': '#60a5fa',
    },
  });

  monaco.editor.defineTheme('sqlight-light', {
    base: 'vs',
    inherit: true,
    rules: [
      { token: 'keyword', foreground: '0284c7', fontStyle: 'bold' },
      { token: 'string', foreground: '059669' },
      { token: 'number', foreground: 'd97706' },
      { token: 'comment', foreground: '64748b', fontStyle: 'italic' },
      { token: 'operator.sql', foreground: 'db2777' },
    ],
    colors: {
      'editor.background': '#ffffff',
      'editor.foreground': '#0f172a',
      'editorLineNumber.foreground': '#94a3b8',
      'editorLineNumber.activeForeground': '#2563eb',
      'editor.lineHighlightBackground': '#f1f5f9',
      'editor.selectionBackground': '#bfdbfe80',
      'editorCursor.foreground': '#2563eb',
    },
  });
}

// Automatically register theme on module load
ensureSqlightTheme();

export { monaco };

