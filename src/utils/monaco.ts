import * as monaco from 'monaco-editor';
import EditorWorker from './editorWorker?worker';
import { SURFACE_PALETTES } from '../services/themeManager';

self.MonacoEnvironment = {
  getWorker: function (_moduleId: unknown, _label: string) {
    return new EditorWorker();
  },
};

export function ensureSqlightTheme(surfaceName = 'slate') {
  const pal = (SURFACE_PALETTES[surfaceName] ?? SURFACE_PALETTES['slate'])!;

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
      'editor.background': pal['900'],
      'editor.foreground': pal['100'],
      'editorLineNumber.foreground': pal['500'],
      'editorLineNumber.activeForeground': '#93c5fd',
      'editor.lineHighlightBackground': pal['800'],
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
      'editor.foreground': pal['900'],
      'editorLineNumber.foreground': pal['400'],
      'editorLineNumber.activeForeground': '#2563eb',
      'editor.lineHighlightBackground': pal['100'],
      'editor.selectionBackground': '#bfdbfe80',
      'editorCursor.foreground': '#2563eb',
    },
  });
}

// Automatically register theme on module load
ensureSqlightTheme();

// Listen for surface changes and update Monaco theme dynamically
if (typeof window !== 'undefined') {
  window.addEventListener('sqlight:surface-changed', (e: any) => {
    const surfaceName = e.detail?.surface || 'slate';
    ensureSqlightTheme(surfaceName);
    const isDark = document.documentElement.classList.contains('dark');
    monaco.editor.setTheme(isDark ? 'sqlight-dark' : 'sqlight-light');
  });
}

export { monaco };

