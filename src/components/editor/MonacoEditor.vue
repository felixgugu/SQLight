<template>
  <div ref="editorContainer" class="w-full h-full overflow-hidden" />
</template>

<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, watch } from 'vue';
import { monaco } from '@/utils/monaco';

const props = defineProps<{
  modelValue: string;
  readOnly?: boolean;
}>();

const emit = defineEmits<{
  (e: 'update:modelValue', value: string): void;
  (e: 'execute', queryToRun: string): void;
  (e: 'format'): void;
}>();

const editorContainer = ref<HTMLDivElement | null>(null);
let editorInstance: monaco.editor.IStandaloneCodeEditor | null = null;

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
    fontSize: 13,
    fontFamily: '"Fira Code", Consolas, Monaco, monospace',
    fontLigatures: true,
    minimap: { enabled: false },
    scrollBeyondLastLine: false,
    lineNumbers: 'on',
    renderLineHighlight: 'all',
    tabSize: 2,
    insertSpaces: true,
    readOnly: props.readOnly ?? false,
    cursorBlinking: 'smooth',
    wordWrap: 'on',
  });

  editorInstance.onDidChangeModelContent(() => {
    if (editorInstance) {
      const val = editorInstance.getValue();
      if (val !== props.modelValue) {
        emit('update:modelValue', val);
      }
    }
  });

  // Shortcut: Ctrl/Cmd + Enter -> Execute selected SQL or whole document
  editorInstance.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter, () => {
    if (!editorInstance) return;
    const selection = editorInstance.getSelection();
    const model = editorInstance.getModel();
    if (!model) return;

    let targetSql = '';
    if (selection && !selection.isEmpty()) {
      targetSql = model.getValueInRange(selection);
    } else {
      targetSql = model.getValue();
    }

    emit('execute', targetSql);
  });

  // Shortcut: Shift + Alt + F -> Format SQL
  editorInstance.addCommand(
    monaco.KeyMod.Shift | monaco.KeyMod.Alt | monaco.KeyCode.KeyF,
    () => {
      emit('format');
    }
  );
});

watch(
  () => props.modelValue,
  (newVal) => {
    if (editorInstance && editorInstance.getValue() !== newVal) {
      editorInstance.setValue(newVal);
    }
  }
);

onBeforeUnmount(() => {
  if (editorInstance) {
    editorInstance.dispose();
    editorInstance = null;
  }
});

function getExecutableQuery(): string {
  if (!editorInstance) return props.modelValue;
  const selection = editorInstance.getSelection();
  const model = editorInstance.getModel();
  if (selection && !selection.isEmpty() && model) {
    return model.getValueInRange(selection);
  }
  return editorInstance.getValue();
}

defineExpose({
  getExecutableQuery,
});
</script>
