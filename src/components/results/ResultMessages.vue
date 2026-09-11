<template>
  <div class="w-full h-full p-3 font-mono text-xs overflow-auto space-y-2 select-text">
    <div v-if="messages.length === 0" class="text-dark-500 italic">
      No messages
    </div>

    <div
      v-for="(msg, idx) in messages"
      :key="idx"
      :class="[
        'p-2 rounded border flex flex-col space-y-1',
        msg.level === 'error'
          ? 'bg-rose-950/30 border-rose-900/60 text-rose-300'
          : msg.level === 'warning'
          ? 'bg-amber-950/30 border-amber-900/60 text-amber-300'
          : 'bg-dark-850/60 border-dark-750 text-dark-200'
      ]"
    >
      <div class="flex items-center space-x-2 text-xxs font-semibold">
        <span class="text-dark-500 font-normal">[{{ formatTime(msg.timestamp) }}]</span>
        <span
          :class="[
            'uppercase tracking-wide px-1 rounded',
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

      <div class="whitespace-pre-wrap leading-relaxed text-xs">
        {{ msg.message }}
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { QueryMessage } from '@/types/query';

defineProps<{
  messages: QueryMessage[];
}>();

function formatTime(iso: string) {
  try {
    return new Date(iso).toLocaleTimeString();
  } catch {
    return iso;
  }
}
</script>
