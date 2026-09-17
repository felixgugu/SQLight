<template>
  <div class="w-full h-full flex flex-col overflow-hidden font-mono text-xs">
    <!-- Subheader with Clear Action -->
    <div class="h-6 bg-dark-850 border-b border-dark-750 flex items-center justify-between px-3 text-xxs text-dark-400 select-none flex-shrink-0">
      <span>{{ messages.length }} messages in this session</span>
      <button
        v-if="messages.length > 0"
        type="button"
        @click="$emit('clear')"
        class="hover:text-rose-400 transition-colors cursor-pointer"
      >
        Clear Messages
      </button>
    </div>

    <!-- Empty State -->
    <div v-if="messages.length === 0" class="flex-1 flex items-center justify-center text-dark-500 italic select-none">
      No messages in this session
    </div>

    <!-- Messages List (Newest at the top) -->
    <div v-else class="flex-1 overflow-auto p-3 space-y-2 select-text">
      <div
        v-for="(msg, idx) in messages"
        :key="msg.id ?? idx"
        :class="[
          'p-2.5 rounded-md border flex flex-col space-y-1.5 transition-colors group',
          msg.level === 'error'
            ? 'bg-rose-950/20 border-rose-900/60 text-rose-300'
            : msg.level === 'warning'
            ? 'bg-amber-950/20 border-amber-900/60 text-amber-300'
            : 'bg-dark-850/60 border-dark-750 text-dark-200'
        ]"
      >
        <!-- Line 1: [序號][時間] 資訊 -->
        <div class="flex items-center justify-between text-xxs font-mono">
          <div class="flex items-center space-x-2 flex-wrap">
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

        <!-- Line 2: 執行訊息 -->
        <div class="whitespace-pre-wrap leading-relaxed text-xs font-mono select-text break-words">
          {{ msg.message }}
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { Copy, Check } from 'lucide-vue-next';
import type { SessionMessageItem, QueryMessage } from '@/types/query';

defineProps<{
  messages: (SessionMessageItem | QueryMessage)[];
}>();

defineEmits<{
  (e: 'clear'): void;
}>();

const copiedKey = ref<string | number | null>(null);
let copyTimeout: ReturnType<typeof setTimeout> | null = null;

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
