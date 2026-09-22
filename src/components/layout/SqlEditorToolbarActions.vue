<template>
  <div class="flex items-center space-x-1">
    <Button
      v-for="item in actions"
      :key="item.action"
      severity="secondary"
      size="small"
      text
      :disabled="disabled"
      class="!h-7 !w-7 !p-0"
      :aria-label="item.label"
      v-tooltip.bottom="item.tooltip"
      @click="emit('action', item.action)"
    >
      <template #icon>
        <component :is="item.icon" class="w-3.5 h-3.5" />
      </template>
    </Button>
  </div>
</template>

<script setup lang="ts">
import type { Component } from 'vue';
import Button from 'primevue/button';
import {
  ClipboardPaste,
  Copy,
  FoldVertical,
  Scissors,
  UnfoldVertical,
} from 'lucide-vue-next';
import type { SqlEditorToolbarAction } from '@/types/editor';

defineProps<{
  disabled?: boolean;
}>();

const emit = defineEmits<{
  (e: 'action', action: SqlEditorToolbarAction): void;
}>();

interface SqlEditorToolbarItem {
  action: SqlEditorToolbarAction;
  label: string;
  tooltip: string;
  icon: Component;
}

const actions: SqlEditorToolbarItem[] = [
  {
    action: 'cut',
    label: '剪下',
    tooltip: '剪下選取內容 (Ctrl + X)',
    icon: Scissors,
  },
  {
    action: 'copy',
    label: '複製',
    tooltip: '複製選取內容 (Ctrl + C)',
    icon: Copy,
  },
  {
    action: 'paste',
    label: '貼上',
    tooltip: '貼上剪貼簿內容 (Ctrl + V)',
    icon: ClipboardPaste,
  },
  {
    action: 'unfoldAll',
    label: '展開',
    tooltip: '展開整份 SQL 的所有區塊',
    icon: UnfoldVertical,
  },
  {
    action: 'foldAll',
    label: '收合',
    tooltip: '收合整份 SQL 的所有區塊',
    icon: FoldVertical,
  },
];
</script>
