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
    </div>

    <!-- Right: Metrics & Environment -->
    <div class="flex items-center space-x-4 font-mono">
      <div class="flex items-center space-x-1">
        <span class="text-dark-500">Status:</span>
        <span class="text-emerald-400">Ready</span>
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
import { useConnectionStore } from '@/stores/connectionStore';

const connectionStore = useConnectionStore();
</script>
