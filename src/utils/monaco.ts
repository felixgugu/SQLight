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
}

// Automatically register theme on module load
ensureSqlightTheme();

export { monaco };

