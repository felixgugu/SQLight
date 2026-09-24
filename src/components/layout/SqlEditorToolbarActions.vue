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
import { computed, type Component } from 'vue';
import { useI18n } from 'vue-i18n';
import Button from 'primevue/button';
import {
  ClipboardPaste,
  Copy,
  FoldVertical,
  Scissors,
  UnfoldVertical,
} from 'lucide-vue-next';
import type { SqlEditorToolbarAction } from '@/types/editor';

const { t } = useI18n();

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

const actions = computed<SqlEditorToolbarItem[]>(() => [
  {
    action: 'cut',
    label: t('common.cut'),
    tooltip: t('editor.cutTooltip'),
    icon: Scissors,
  },
  {
    action: 'copy',
    label: t('common.copy'),
    tooltip: t('editor.copyTooltip'),
    icon: Copy,
  },
  {
    action: 'paste',
    label: t('common.paste'),
    tooltip: t('editor.pasteTooltip'),
    icon: ClipboardPaste,
  },
  {
    action: 'unfoldAll',
    label: t('common.expand'),
    tooltip: t('editor.unfoldAllTooltip'),
    icon: UnfoldVertical,
  },
  {
    action: 'foldAll',
    label: t('common.collapse'),
    tooltip: t('editor.foldAllTooltip'),
    icon: FoldVertical,
  },
]);
</script>
