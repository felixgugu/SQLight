<template>
  <div ref="editorContainer" class="w-full h-full overflow-hidden" />
</template>

<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, watch } from 'vue';
import { monaco } from '@/utils/monaco';
import { setupSqlCompletionProvider } from '@/utils/sqlCompletionProvider';
import { useSettingsStore } from '@/stores/settingsStore';
import { extractStatementAtCursor, type ExtractedStatement } from '@/utils/sqlStatementExtractor';
import { format as formatSql } from 'sql-formatter';

const props = defineProps<{
  modelValue: string;
  readOnly?: boolean;
}>();

const emit = defineEmits<{
  (e: 'update:modelValue', value: string): void;
  (e: 'execute', queryToRun: string, mode?: 'current' | 'all'): void;
  (e: 'format'): void;
}>();

const settingsStore = useSettingsStore();
const editorContainer = ref<HTMLDivElement | null>(null);
let editorInstance: monaco.editor.IStandaloneCodeEditor | null = null;
let highlightDecorations: monaco.editor.IEditorDecorationsCollection | null = null;

function hexToRgba(hex: string, alpha: number): string {
  let cleanHex = hex.replace('#', '');
  if (cleanHex.length === 3) {
    cleanHex = cleanHex.split('').map((c) => c + c).join('');
  }
  const num = parseInt(cleanHex, 16);
  if (isNaN(num)) return `rgba(254, 255, 224, ${alpha})`;
  const r = (num >> 16) & 255;
  const g = (num >> 8) & 255;
  const b = num & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function updateHighlightStyle() {
  const styleId = 'sqlight-editor-highlight-style';
  let styleEl = document.getElementById(styleId) as HTMLStyleElement | null;
  if (!styleEl) {
    styleEl = document.createElement('style');
    styleEl.id = styleId;
    document.head.appendChild(styleEl);
  }
  const color = settingsStore.editorHighlightColor || '#feffe0';
  const bg = hexToRgba(color, 0.22);
  const border = hexToRgba(color, 0.85);
  styleEl.textContent = `
    .sqlight-custom-highlight {
      background-color: ${bg} !important;
      border-left: 2px solid ${border} !important;
    }
  `;
}

// Configurable eye-friendly soft highlight (default #feffe0)
function highlightRange(range: { startLineNumber: number; endLineNumber: number }) {
  if (!editorInstance) return;
  if (highlightDecorations) {
    highlightDecorations.clear();
  }
  updateHighlightStyle();
  const monacoRange = new monaco.Range(range.startLineNumber, 1, range.endLineNumber, 1);
  highlightDecorations = editorInstance.createDecorationsCollection([
    {
      range: monacoRange,
      options: {
        isWholeLine: true,
        className: 'sqlight-custom-highlight',
      },
    },
  ]);
  setTimeout(() => {
    if (highlightDecorations) {
      highlightDecorations.clear();
      highlightDecorations = null;
    }
  }, 400);
}

function getStatementAtCursor(): ExtractedStatement {
  if (!editorInstance) {
    return { sql: props.modelValue, isSelection: false };
  }
  const model = editorInstance.getModel();
  if (!model) {
    return { sql: props.modelValue, isSelection: false };
  }

  const selection = editorInstance.getSelection();
  const position = editorInstance.getPosition() || { lineNumber: 1, column: 1 };
  const docText = model.getValue();

  const selectedText = selection && !selection.isEmpty() ? model.getValueInRange(selection) : undefined;

  const extracted = extractStatementAtCursor(
    docText,
    position.lineNumber,
    selectedText
  );

  if (extracted.range) {
    highlightRange(extracted.range);
  }
  return extracted;
}

function getFullDocumentQuery(): string {
  if (!editorInstance) return props.modelValue;
  return editorInstance.getValue();
}

function getExecutableQuery(mode: 'current' | 'all' = 'current'): string {
  if (mode === 'all') {
    return getFullDocumentQuery();
  }
  return getStatementAtCursor().sql;
}

/**
 * Duplicate line downwards if no selection, or duplicate selected block downwards with blank line separation if selection exists.
 */
function duplicateLineOrSelection() {
  if (!editorInstance) return;
  const model = editorInstance.getModel();
  const selection = editorInstance.getSelection();
  const position = editorInstance.getPosition();
  if (!model || !position) return;

  if (selection && !selection.isEmpty()) {
    // Has selection: duplicate selected block downwards with a blank line separator
    const selectedText = model.getValueInRange(selection);
    const endPos = selection.getEndPosition();

    // Automatically add a blank line above the duplicated content so blocks don't merge together
    const textToInsert = '\n\n' + selectedText;

    editorInstance.executeEdits('duplicate-selection', [
      {
        range: new monaco.Range(endPos.lineNumber, endPos.column, endPos.lineNumber, endPos.column),
        text: textToInsert,
        forceMoveMarkers: true,
      },
    ]);

    // Select the newly duplicated block (offset by the 2 added newlines)
    const lines = selectedText.split(/\r?\n/);
    const addedLines = lines.length - 1;
    const lastLineLength = lines[lines.length - 1]?.length ?? 0;
    const startLine = endPos.lineNumber + 2;
    const startCol = 1;
    const newEndLine = startLine + addedLines;
    const newEndCol = addedLines === 0 ? startCol + lastLineLength : 1 + lastLineLength;

    editorInstance.setSelection(
      new monaco.Selection(startLine, startCol, newEndLine, newEndCol)
    );
  } else {
    // No selection: duplicate cursor line downwards
    const lineNumber = position.lineNumber;
    const lineContent = model.getLineContent(lineNumber);
    const maxCol = model.getLineMaxColumn(lineNumber);

    editorInstance.executeEdits('duplicate-line', [
      {
        range: new monaco.Range(lineNumber, maxCol, lineNumber, maxCol),
        text: '\n' + lineContent,
        forceMoveMarkers: true,
      },
    ]);

    editorInstance.setPosition(new monaco.Position(lineNumber + 1, position.column));
  }
}

/**
 * Format selected SQL only if selection exists, otherwise format only the single statement at cursor.
 */
function formatCode() {
  if (!editorInstance) return;
  const model = editorInstance.getModel();
  if (!model) return;

  const selection = editorInstance.getSelection();
  const position = editorInstance.getPosition() || { lineNumber: 1, column: 1 };
  const docText = model.getValue();

  // 1. If user selected a range: format selection only
  if (selection && !selection.isEmpty()) {
    const rawSql = model.getValueInRange(selection);
    try {
      const formatted = formatSql(rawSql, {
        language: 'tsql',
        keywordCase: 'upper',
        tabWidth: settingsStore.editorTabSize || 2,
      });
      editorInstance.executeEdits('format-selection', [
        {
          range: selection,
          text: formatted,
          forceMoveMarkers: true,
        },
      ]);
      const newLines = formatted.split(/\r?\n/).length;
      highlightRange({
        startLineNumber: selection.startLineNumber,
        endLineNumber: selection.startLineNumber + newLines - 1,
      });
    } catch (err) {
      console.warn('SQL format selection failed:', err);
    }
    return;
  }

  // 2. If no selection: format only current standalone statement at cursor
  const extracted = extractStatementAtCursor(docText, position.lineNumber);
  if (!extracted.sql || !extracted.range) {
    return;
  }

  const { startLineNumber, endLineNumber } = extracted.range;
  const targetRange = new monaco.Range(
    startLineNumber,
    1,
    endLineNumber,
    model.getLineMaxColumn(endLineNumber)
  );
  const targetText = model.getValueInRange(targetRange);

  try {
    const formatted = formatSql(targetText, {
      language: 'tsql',
      keywordCase: 'upper',
      tabWidth: settingsStore.editorTabSize || 2,
    });

    editorInstance.executeEdits('format-statement', [
      {
        range: targetRange,
        text: formatted,
        forceMoveMarkers: true,
      },
    ]);

    const newLines = formatted.split(/\r?\n/).length;
    highlightRange({
      startLineNumber,
      endLineNumber: startLineNumber + newLines - 1,
    });
  } catch (err) {
    console.warn('SQL format statement failed:', err);
  }
}

onMounted(() => {
  if (!editorContainer.value) return;

  // Custom dark theme tailored for SQLight
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

  editorInstance = monaco.editor.create(editorContainer.value, {
    value: props.modelValue,
    language: 'sql',
    theme: 'sqlight-dark',
    automaticLayout: true,
    fontSize: settingsStore.editorFontSize,
    fontFamily: settingsStore.editorFontFamily,
    fontLigatures: true,
    minimap: { enabled: false },
    scrollBeyondLastLine: false,
    lineNumbers: 'on',
    renderLineHighlight: 'all',
    tabSize: settingsStore.editorTabSize,
    insertSpaces: true,
    readOnly: props.readOnly ?? false,
    cursorBlinking: 'smooth',
    wordWrap: settingsStore.editorWordWrap ? 'on' : 'off',
    suggestOnTriggerCharacters: true,
    quickSuggestions: {
      other: true,
      comments: false,
      strings: false,
    },
    acceptSuggestionOnCommitCharacter: true,
    acceptSuggestionOnEnter: 'on',
    tabCompletion: 'on',
    suggest: {
      showFields: true,
      showClasses: true,
      showFunctions: true,
      showKeywords: true,
      showSnippets: true,
      preview: true,
    },
  });

  setupSqlCompletionProvider();

  editorInstance.onDidChangeModelContent(() => {
    if (editorInstance) {
      const val = editorInstance.getValue();
      if (val !== props.modelValue) {
        emit('update:modelValue', val);
      }
    }
  });

  // Shortcut: Ctrl/Cmd + Enter -> Execute current single statement (or selection)
  editorInstance.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter, () => {
    const stmt = getStatementAtCursor();
    if (stmt.sql.trim()) {
      emit('execute', stmt.sql, 'current');
    }
  });

  // Shortcut: Ctrl/Cmd + Shift + Enter -> Execute whole document unconditionally
  editorInstance.addCommand(
    monaco.KeyMod.CtrlCmd | monaco.KeyMod.Shift | monaco.KeyCode.Enter,
    () => {
      const full = getFullDocumentQuery();
      if (full.trim()) {
        emit('execute', full, 'all');
      }
    }
  );

  // Shortcut: Ctrl/Cmd + D -> Duplicate Line or Selection downwards
  editorInstance.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyD, () => {
    duplicateLineOrSelection();
  });

  // Shortcut: Shift + Alt + F -> Format selected SQL or standalone SQL at cursor
  editorInstance.addCommand(
    monaco.KeyMod.Shift | monaco.KeyMod.Alt | monaco.KeyCode.KeyF,
    () => {
      formatCode();
    }
  );
});

// Sync editor options when settingsStore changes
watch(
  () => [
    settingsStore.editorFontSize,
    settingsStore.editorFontFamily,
    settingsStore.editorWordWrap,
    settingsStore.editorTabSize,
  ],
  () => {
    if (editorInstance) {
      editorInstance.updateOptions({
        fontSize: settingsStore.editorFontSize,
        fontFamily: settingsStore.editorFontFamily,
        wordWrap: settingsStore.editorWordWrap ? 'on' : 'off',
        tabSize: settingsStore.editorTabSize,
      });
    }
  }
);

watch(
  () => props.modelValue,
  (newVal) => {
    if (editorInstance && editorInstance.getValue() !== newVal) {
      editorInstance.setValue(newVal);
    }
  }
);

onBeforeUnmount(() => {
  if (highlightDecorations) {
    highlightDecorations.clear();
    highlightDecorations = null;
  }
  if (editorInstance) {
    editorInstance.dispose();
    editorInstance = null;
  }
});

defineExpose({
  getExecutableQuery,
  getStatementAtCursor,
  getFullDocumentQuery,
  duplicateLineOrSelection,
  formatCode,
});
</script>
