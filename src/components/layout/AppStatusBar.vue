<template>
  <footer class="h-6 bg-dark-900 border-t border-dark-700 flex items-center justify-between px-3 text-xxs text-dark-400 select-none flex-shrink-0">
    <!-- Left: Connection & Server Info -->
    <div class="flex items-center space-x-3">
      <div class="flex items-center space-x-1.5">
        <span
          :class="[
            'w-2 h-2 rounded-full',
            connectionStore.status === 'connected' ? 'bg-emerald-500 shadow-sm shadow-emerald-500/50' : 'bg-rose-500'
          ]"
        />
        <span class="text-dark-200 font-medium">
          {{ connectionStore.activeConnection?.name ?? 'Disconnected' }}
        </span>
        <span class="text-dark-500">({{ connectionStore.activeConnection?.host }}:{{ connectionStore.activeConnection?.port }})</span>
      </div>

      <div class="h-3 w-px bg-dark-750" />

      <div class="flex items-center space-x-1">
        <span class="text-dark-500">Database:</span>
        <span class="text-dark-300 font-mono">{{ connectionStore.activeDatabase }}</span>
      </div>

      <template v-if="connectionStore.activeSpid">
        <div class="h-3 w-px bg-dark-750" />
        <div class="flex items-center space-x-1" title="SQL Server 伺服器工作階段識別碼 (Server Process ID)">
          <span class="text-dark-500">SPID:</span>
          <span class="text-sky-400 font-mono font-medium">{{ connectionStore.activeSpid }}</span>
        </div>
      </template>
    </div>

    <!-- Right: Metrics & Environment -->
    <div class="flex items-center space-x-4 font-mono">
      <div class="flex items-center space-x-1.5">
        <span class="text-dark-500">Status:</span>
        <template v-if="queryStore.isCancelling">
          <span class="w-1.5 h-1.5 rounded-full bg-rose-500 animate-ping" />
          <span class="text-rose-400 font-medium">中斷中 (Cancelling)...</span>
        </template>
        <template v-else-if="queryStore.isExecuting">
          <span class="w-1.5 h-1.5 rounded-full bg-amber-400 animate-ping" />
          <span class="text-amber-300 font-medium">執行中 ({{ formattedElapsedTime }})...</span>
        </template>
        <template v-else>
          <span class="text-emerald-400">Ready</span>
        </template>
      </div>

      <div class="h-3 w-px bg-dark-750" />

      <div class="flex items-center space-x-1">
        <span class="text-dark-500">Engine:</span>
        <span class="text-dark-300">MS SQL Server</span>
      </div>

      <div class="h-3 w-px bg-dark-750" />

      <div class="flex items-center space-x-1">
        <span class="text-brand-400">SQLight v0.1.0</span>
      </div>
    </div>
  </footer>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useConnectionStore } from '@/stores/connectionStore';
import { useQueryStore } from '@/stores/queryStore';

const connectionStore = useConnectionStore();
const queryStore = useQueryStore();

const formattedElapsedTime = computed(() => {
  const totalSeconds = Math.floor(queryStore.elapsedExecutionMs / 1000);
  const mins = Math.floor(totalSeconds / 60);
  const secs = totalSeconds % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
});
</script>
