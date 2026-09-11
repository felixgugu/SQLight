<template>
  <div
    v-if="isOpen"
    class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 select-none"
    @keydown.esc="$emit('cancel')"
  >
    <div
      class="bg-dark-850 border border-dark-700 rounded-lg shadow-2xl w-full max-w-md overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-150"
    >
      <!-- Header -->
      <div class="px-4 py-3 border-b border-dark-700 flex items-center justify-between bg-dark-800">
        <div class="flex items-center space-x-2">
          <AlertTriangle v-if="isDanger" class="w-4 h-4 text-rose-400" />
          <Info v-else class="w-4 h-4 text-brand-400" />
          <h3 class="font-semibold text-sm text-dark-100">{{ title }}</h3>
        </div>
        <button
          @click="$emit('cancel')"
          class="text-dark-400 hover:text-dark-200 p-1 rounded hover:bg-dark-700 transition-colors"
        >
          <X class="w-4 h-4" />
        </button>
      </div>

      <!-- Body -->
      <div class="p-4 text-xs text-dark-200 leading-relaxed">
        <p class="whitespace-pre-wrap">{{ message }}</p>
      </div>

      <!-- Footer Actions -->
      <div class="px-4 py-3 bg-dark-850 border-t border-dark-700 flex items-center justify-end space-x-2">
        <button
          type="button"
          @click="$emit('cancel')"
          class="px-3 py-1.5 bg-dark-800 hover:bg-dark-750 text-dark-300 hover:text-dark-100 rounded border border-dark-700 text-xs transition-colors"
        >
          {{ cancelText || 'Cancel' }}
        </button>
        <button
          type="button"
          @click="$emit('confirm')"
          :class="[
            'px-3.5 py-1.5 font-medium rounded text-xs transition-colors shadow-xs',
            isDanger
              ? 'bg-rose-600 hover:bg-rose-500 text-white'
              : 'bg-brand-600 hover:bg-brand-500 text-white'
          ]"
        >
          {{ confirmText || 'Confirm' }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { AlertTriangle, Info, X } from 'lucide-vue-next';

withDefaults(
  defineProps<{
    isOpen: boolean;
    title: string;
    message: string;
    confirmText?: string;
    cancelText?: string;
    isDanger?: boolean;
  }>(),
  {
    confirmText: 'Confirm',
    cancelText: 'Cancel',
    isDanger: false,
  }
);

defineEmits<{
  (e: 'confirm'): void;
  (e: 'cancel'): void;
}>();
</script>
