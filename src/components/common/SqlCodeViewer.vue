<template>
  <div ref="container" class="w-full h-full min-h-0 overflow-hidden" />
</template>

<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, watch } from 'vue';
import { monaco, ensureSqlightTheme } from '@/utils/monaco';
import { useSettingsStore } from '@/stores/settingsStore';

const props = withDefaults(
  defineProps<{
    code: string;
    language?: string;
    readOnly?: boolean;
  }>(),
  {
    language: 'sql',
    readOnly: true,
  }
);

const settingsStore = useSettingsStore();
const container = ref<HTMLDivElement | null>(null);
let editorInstance: monaco.editor.IStandaloneCodeEditor | null = null;

onMounted(() => {
  if (!container.value) return;

  ensureSqlightTheme();

  editorInstance = monaco.editor.create(container.value, {
    value: props.code,
    language: props.language,
    theme: 'sqlight-dark',
    readOnly: props.readOnly,
    domReadOnly: props.readOnly,
    automaticLayout: true,
    fontSize: settingsStore.editorFontSize || 12,
    fontFamily: settingsStore.editorFontFamily || 'Consolas, monospace',
    fontLigatures: true,
    lineNumbers: 'on',
    minimap: { enabled: false },
    scrollBeyondLastLine: false,
    renderLineHighlight: 'all',
    wordWrap: 'on',
    contextmenu: false,
    scrollbar: {
      vertical: 'visible',
      horizontal: 'visible',
      verticalScrollbarSize: 10,
      horizontalScrollbarSize: 10,
    },
  });
});

watch(
  () => props.code,
  (newCode) => {
    if (editorInstance && editorInstance.getValue() !== newCode) {
      editorInstance.setValue(newCode);
    }
  }
);

onBeforeUnmount(() => {
  if (editorInstance) {
    editorInstance.dispose();
    editorInstance = null;
  }
});
</script>
