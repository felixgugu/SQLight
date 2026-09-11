<template>
  <div ref="editorContainer" class="w-full h-full overflow-hidden" />
</template>

<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, watch } from 'vue';
import { monaco } from '@/utils/monaco';
import { setupSqlCompletionProvider } from '@/utils/sqlCompletionProvider';
import { useSettingsStore } from '@/stores/settingsStore';
import { extractStatementAtCursor, type ExtractedStatement } from '@/utils/sqlStatementExtractor';

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

function highlightRange(range: { startLineNumber: number; endLineNumber: number }) {
  if (!editorInstance) return;
  if (highlightDecorations) {
    highlightDecorations.clear();
  }
  const monacoRange = new monaco.Range(range.startLineNumber, 1, range.endLineNumber, 1);
  highlightDecorations = editorInstance.createDecorationsCollection([
    {
      range: monacoRange,
      options: {
        isWholeLine: true,
        className: 'bg-emerald-500/20 border-l-2 border-emerald-400',
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

  // Shortcut: Shift + Alt + F -> Format SQL
  editorInstance.addCommand(
    monaco.KeyMod.Shift | monaco.KeyMod.Alt | monaco.KeyCode.KeyF,
    () => {
      emit('format');
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
});
</script>
