<template>
  <div class="w-full h-full flex flex-col overflow-hidden font-mono text-xs">
    <!-- Subheader with Clear Action -->
    <div class="h-6 bg-dark-850 border-b border-dark-750 flex items-center justify-between px-3 text-xxs text-dark-400 select-none flex-shrink-0">
      <span>{{ history.length }} queries executed in this session</span>
      <button
        v-if="history.length > 0"
        type="button"
        @click="$emit('clear')"
        class="hover:text-rose-400 transition-colors cursor-pointer"
      >
        Clear History
      </button>
    </div>

    <!-- Empty State -->
    <div v-if="history.length === 0" class="flex-1 flex items-center justify-center text-dark-500 italic select-none">
      No query execution history in this session
    </div>

    <!-- Query History List (Newest at the top) -->
    <div v-else class="flex-1 overflow-auto p-3 space-y-2 select-text">
      <div
        v-for="(item, idx) in history"
        :key="item.id ?? idx"
        @click="$emit('select', item.sql)"
        :class="[
          'p-2.5 rounded-md border flex flex-col space-y-1.5 transition-colors cursor-pointer group',
          item.status === 'error'
            ? 'bg-rose-950/20 border-rose-900/60 text-rose-300 hover:border-rose-700/80'
            : item.status === 'cancelled'
            ? 'bg-amber-950/20 border-amber-900/60 text-amber-300 hover:border-amber-700/80'
            : 'bg-dark-850/60 border-dark-750 text-dark-200 hover:border-dark-600 hover:bg-dark-850/90'
        ]"
      >
        <!-- Line 1: [序號][時間] 資訊 -->
        <div class="flex items-center justify-between text-xxs font-mono">
          <div class="flex items-center space-x-2 flex-wrap">
            <span class="text-brand-400 font-bold font-mono">[{{ '#' + (item.seq ?? (history.length - idx)) }}]</span>
            <span class="text-dark-400 font-mono">[{{ item.executedAt }}]</span>
            <span class="text-brand-400 font-medium">{{ item.executionTimeMs }}ms</span>
            <span
              v-if="item.status === 'cancelled'"
              class="px-1.5 py-0.2 rounded text-xxs font-semibold bg-amber-900/80 text-amber-200 uppercase tracking-wide"
            >
              Cancelled
            </span>
            <span
              v-else-if="item.status === 'error'"
              class="px-1.5 py-0.2 rounded text-xxs font-semibold bg-rose-900/80 text-rose-200 uppercase tracking-wide"
            >
              Error
            </span>
            <span v-else-if="item.affectedRows !== undefined" class="text-emerald-400 font-mono">
              {{ item.affectedRows }} row(s)
            </span>
            <span v-if="item.database" class="text-dark-500 text-xxs">
              ({{ item.database }})
            </span>
          </div>

          <button
            type="button"
            @click.stop="copySql(item.sql, item.id ?? idx)"
            class="opacity-0 group-hover:opacity-100 hover:text-dark-100 text-dark-400 transition-opacity p-0.5 rounded cursor-pointer"
            :title="copiedKey === (item.id ?? idx) ? '已複製 (Copied)' : '複製 SQL (Copy SQL)'"
          >
            <Check v-if="copiedKey === (item.id ?? idx)" class="w-3.5 h-3.5 text-emerald-400" />
            <Copy v-else class="w-3.5 h-3.5" />
          </button>
        </div>

        <!-- Line 2: SQL 語法 -->
        <div class="whitespace-pre-wrap leading-relaxed text-xs font-mono select-text break-words text-dark-200 group-hover:text-brand-300">
          {{ item.sql }}
        </div>
        <div
          v-if="item.errorMessage && item.status !== 'cancelled'"
          class="text-xxs text-rose-400/90 whitespace-pre-wrap font-mono mt-0.5"
        >
          {{ item.errorMessage }}
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { Copy, Check } from 'lucide-vue-next';
import type { QueryHistoryItem } from '@/types/query';

defineProps<{
  history: QueryHistoryItem[];
}>();

defineEmits<{
  (e: 'select', sql: string): void;
  (e: 'clear'): void;
}>();

const copiedKey = ref<string | number | null>(null);
let copyTimeout: ReturnType<typeof setTimeout> | null = null;

async function copySql(text: string, key: string | number) {
  try {
    await navigator.clipboard.writeText(text);
    copiedKey.value = key;
    if (copyTimeout) clearTimeout(copyTimeout);
    copyTimeout = setTimeout(() => {
      copiedKey.value = null;
    }, 1500);
  } catch (err) {
    console.error('Failed to copy SQL:', err);
  }
}
</script>
