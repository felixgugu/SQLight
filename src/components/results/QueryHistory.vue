<template>
  <div class="w-full h-full flex flex-col overflow-hidden font-mono text-xs">
    <!-- Subheader with Clear Action -->
    <div class="h-6 bg-dark-850 border-b border-dark-750 flex items-center justify-between px-3 text-xxs text-dark-400 select-none flex-shrink-0">
      <span>{{ history.length }} queries executed in this session</span>
      <button
        v-if="history.length > 0"
        @click="$emit('clear')"
        class="hover:text-dark-200 transition-colors"
      >
        Clear History
      </button>
    </div>

    <!-- Empty State -->
    <div v-if="history.length === 0" class="flex-1 flex items-center justify-center text-dark-500 select-none">
      No query execution history
    </div>

    <!-- List of Query History -->
    <div v-else class="flex-1 overflow-auto divide-y divide-dark-800">
      <div
        v-for="item in history"
        :key="item.id"
        @click="$emit('select', item.sql)"
        class="p-2.5 hover:bg-dark-800/60 cursor-pointer transition-colors flex items-start justify-between space-x-3 group"
      >
        <div class="flex items-start space-x-2.5 truncate flex-1 min-w-0">
          <span
            :class="[
              'w-2 h-2 rounded-full mt-1.5 flex-shrink-0',
              item.status === 'success'
                ? 'bg-emerald-500 shadow-xs shadow-emerald-500/50'
                : item.status === 'cancelled'
                ? 'bg-amber-400 shadow-xs shadow-amber-400/50'
                : 'bg-rose-500'
            ]"
            :title="item.status === 'cancelled' ? '已取消 (Cancelled)' : item.status"
          />

          <div class="truncate flex-1 min-w-0">
            <div class="text-dark-200 truncate font-mono text-xs group-hover:text-brand-300">
              {{ item.sql }}
            </div>
            <div
              v-if="item.errorMessage"
              :class="[
                'text-xxs truncate mt-0.5',
                item.status === 'cancelled' ? 'text-amber-400/90' : 'text-rose-400'
              ]"
            >
              {{ item.errorMessage }}
            </div>
          </div>
        </div>

        <div class="flex items-center space-x-3 text-xxs text-dark-400 flex-shrink-0 font-mono">
          <span v-if="item.affectedRows !== undefined" class="text-dark-500">
            {{ item.affectedRows }} row(s)
          </span>
          <span class="text-brand-400">{{ item.executionTimeMs }}ms</span>
          <span>{{ item.executedAt }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { QueryHistoryItem } from '@/types/query';

defineProps<{
  history: QueryHistoryItem[];
}>();

defineEmits<{
  (e: 'select', sql: string): void;
  (e: 'clear'): void;
}>();
</script>
