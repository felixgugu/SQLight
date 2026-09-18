<template>
  <div class="w-full h-full flex flex-col overflow-hidden font-mono text-xs">
    <!-- Subheader with Clear Action and Expand/Collapse All -->
    <div class="h-6 bg-dark-850 border-b border-dark-750 flex items-center justify-between px-3 text-xxs text-dark-400 select-none flex-shrink-0">
      <span>{{ messages.length }} messages in this session</span>
      <div class="flex items-center space-x-3">
        <button
          type="button"
          @click="handleOpenLog"
          class="hover:text-brand-300 transition-colors cursor-pointer flex items-center space-x-1"
          title="開啟與應用程式同目錄的實體日誌檔 (sqlight.log)"
        >
          <FileText class="w-3 h-3" />
          <span>實體日誌 (Log)</span>
        </button>
        <span v-if="messages.length > 0" class="text-dark-600">|</span>
        <button
          v-if="messages.length > 0"
          type="button"
          @click="toggleExpandAll"
          class="hover:text-brand-300 transition-colors cursor-pointer"
        >
          {{ isAllExpanded ? '全部收合' : '全部展開' }}
        </button>
        <span v-if="messages.length > 0" class="text-dark-600">|</span>
        <button
          v-if="messages.length > 0"
          type="button"
          @click="$emit('clear')"
          class="hover:text-rose-400 transition-colors cursor-pointer"
        >
          Clear Messages
        </button>
      </div>
    </div>

    <!-- Empty State -->
    <div v-if="messages.length === 0" class="flex-1 flex items-center justify-center text-dark-500 italic select-none">
      No messages in this session
    </div>

    <!-- Messages List (Newest at the top) -->
    <div v-else class="flex-1 overflow-auto p-3 space-y-2 select-text">
      <div
        v-for="(msg, idx) in messages"
        :key="getMsgKey(msg, idx)"
        :class="[
          'p-2.5 rounded-md border flex flex-col space-y-1.5 transition-colors group',
          msg.level === 'error'
            ? 'bg-rose-950/20 border-rose-900/60 text-rose-300'
            : msg.level === 'warning'
            ? 'bg-amber-950/20 border-amber-900/60 text-amber-300'
            : 'bg-dark-850/60 border-dark-750 text-dark-200'
        ]"
      >
        <!-- Line 1: [序號][時間] 資訊與右上角操作按鈕 -->
        <div class="flex items-center justify-between text-xxs font-mono flex-shrink-0 gap-2">
          <div class="flex items-center space-x-2 flex-wrap min-w-0">
            <span class="text-brand-400 font-bold font-mono">[{{ '#' + (msg.seq ?? (messages.length - idx)) }}]</span>
            <span class="text-dark-400 font-mono">[{{ formatTime(msg.timestamp) }}]</span>
            <span
              :class="[
                'uppercase tracking-wide px-1.5 py-0.2 rounded font-semibold text-xxs',
                msg.level === 'error'
                  ? 'bg-rose-900/80 text-rose-200'
                  : msg.level === 'warning'
                  ? 'bg-amber-900/80 text-amber-200'
                  : 'bg-dark-700 text-dark-300'
              ]"
            >
              {{ msg.level }}
            </span>
            <span v-if="msg.code !== undefined && msg.code !== null" class="text-dark-400">
              Msg {{ msg.code }}
            </span>
            <span v-if="msg.lineNumber !== undefined && msg.lineNumber !== null" class="text-dark-400">
              Line {{ msg.lineNumber }}
            </span>
          </div>

          <!-- 右上角按鈕：展開|收合 與 複製 -->
          <div class="flex items-center space-x-1 flex-shrink-0 select-none">
            <button
              type="button"
              @click.stop="toggleExpand(getMsgKey(msg, idx))"
              class="opacity-0 group-hover:opacity-100 hover:text-dark-100 text-dark-400 transition-opacity p-0.5 rounded cursor-pointer"
              :title="isExpanded(getMsgKey(msg, idx)) ? '收合 (Collapse)' : '展開 (Expand)'"
            >
              <ChevronUp v-if="isExpanded(getMsgKey(msg, idx))" class="w-3.5 h-3.5" />
              <ChevronDown v-else class="w-3.5 h-3.5" />
            </button>

            <button
              type="button"
              @click.stop="copyMessage(msg.message, msg.seq ?? idx)"
              class="opacity-0 group-hover:opacity-100 hover:text-dark-100 text-dark-400 transition-opacity p-0.5 rounded cursor-pointer"
              :title="copiedKey === (msg.seq ?? idx) ? '已複製 (Copied)' : '複製訊息 (Copy message)'"
            >
              <Check v-if="copiedKey === (msg.seq ?? idx)" class="w-3.5 h-3.5 text-emerald-400" />
              <Copy v-else class="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        <!-- Line 2: 執行訊息 (收合時為單行截斷二行高度，展開時為多行換行完整呈現) -->
        <div
          :class="[
            'font-mono select-text text-xs transition-all',
            isExpanded(getMsgKey(msg, idx))
              ? 'whitespace-pre-wrap leading-relaxed break-words'
              : 'truncate leading-normal'
          ]"
          :title="!isExpanded(getMsgKey(msg, idx)) ? msg.message : undefined"
        >
          {{ msg.message }}
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import { Copy, Check, ChevronDown, ChevronUp, FileText } from 'lucide-vue-next';
import type { SessionMessageItem, QueryMessage } from '@/types/query';
import { queryService } from '@/services/queryService';
import { useWorkspaceStore } from '@/stores/workspaceStore';

const props = defineProps<{
  messages: (SessionMessageItem | QueryMessage)[];
}>();

defineEmits<{
  (e: 'clear'): void;
}>();

const workspaceStore = useWorkspaceStore();

async function handleOpenLog() {
  try {
    const path = await queryService.openQueryLogFile();
    workspaceStore.showToast(`已在預設編輯器開啟日誌：${path}`, 'info', 3000);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    workspaceStore.showToast(`開啟日誌檔失敗：${msg}`, 'error', 3500);
  }
}

const copiedKey = ref<string | number | null>(null);
let copyTimeout: ReturnType<typeof setTimeout> | null = null;

const expandedKeys = ref<Set<string | number>>(new Set());

function getMsgKey(msg: SessionMessageItem | QueryMessage, idx: number): string | number {
  return (msg as SessionMessageItem).id ?? msg.seq ?? idx;
}

function isExpanded(key: string | number): boolean {
  return expandedKeys.value.has(key);
}

function toggleExpand(key: string | number) {
  const next = new Set(expandedKeys.value);
  if (next.has(key)) {
    next.delete(key);
  } else {
    next.add(key);
  }
  expandedKeys.value = next;
}

const isAllExpanded = computed(() => {
  if (props.messages.length === 0) return false;
  return props.messages.every((msg, idx) => expandedKeys.value.has(getMsgKey(msg, idx)));
});

function toggleExpandAll() {
  if (isAllExpanded.value) {
    expandedKeys.value = new Set();
  } else {
    const next = new Set<string | number>();
    props.messages.forEach((msg, idx) => next.add(getMsgKey(msg, idx)));
    expandedKeys.value = next;
  }
}

async function copyMessage(text: string, key: string | number) {
  try {
    await navigator.clipboard.writeText(text);
    copiedKey.value = key;
    if (copyTimeout) clearTimeout(copyTimeout);
    copyTimeout = setTimeout(() => {
      copiedKey.value = null;
    }, 1500);
  } catch (err) {
    console.error('Failed to copy message:', err);
  }
}

function formatTime(isoOrTime: string) {
  if (!isoOrTime) return '';
  try {
    const d = new Date(isoOrTime);
    if (!isNaN(d.getTime())) {
      return d.toLocaleTimeString();
    }
    return isoOrTime;
  } catch {
    return isoOrTime;
  }
}
</script>
