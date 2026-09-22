<template>
  <div class="flex items-stretch flex-shrink-0 select-none">
    <!-- Minimize -->
    <button
      type="button"
      class="w-[46px] shrink-0 h-10 flex items-center justify-center bg-transparent border-0 cursor-default text-dark-200 transition-colors duration-100 hover:bg-dark-700 hover:text-dark-100 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-brand-500"
      aria-label="最小化"
      v-tooltip.bottom="'最小化'"
      @click="handleMinimize"
    >
      <svg
        width="10"
        height="10"
        viewBox="0 0 10 10"
        fill="none"
        stroke="currentColor"
        stroke-width="1"
        aria-hidden="true"
      >
        <line x1="0.5" y1="5.5" x2="9.5" y2="5.5" />
      </svg>
    </button>

    <!-- Restore / Maximize -->
    <button
      type="button"
      class="w-[46px] shrink-0 h-10 flex items-center justify-center bg-transparent border-0 cursor-default text-dark-200 transition-colors duration-100 hover:bg-dark-700 hover:text-dark-100 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-brand-500"
      :aria-label="isMaximized ? '還原' : '最大化'"
      v-tooltip.bottom="isMaximized ? '還原' : '最大化'"
      @click="handleToggleMaximize"
    >
      <!-- Restore glyph: front square with the visible edges of the back square -->
      <svg
        v-if="isMaximized"
        width="10"
        height="10"
        viewBox="0 0 10 10"
        fill="none"
        stroke="currentColor"
        stroke-width="1"
        aria-hidden="true"
      >
        <path d="M2.5 2.5V0.5H9.5V7.5H7.5" />
        <rect x="0.5" y="2.5" width="7" height="7" />
      </svg>
      <!-- Maximize glyph -->
      <svg
        v-else
        width="10"
        height="10"
        viewBox="0 0 10 10"
        fill="none"
        stroke="currentColor"
        stroke-width="1"
        aria-hidden="true"
      >
        <rect x="0.5" y="0.5" width="9" height="9" />
      </svg>
    </button>

    <!-- Close -->
    <button
      type="button"
      class="w-[46px] shrink-0 h-10 flex items-center justify-center bg-transparent border-0 cursor-default text-dark-200 transition-colors duration-100 hover:bg-[#c42b1c] hover:text-white active:bg-[#b3251a] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-brand-500"
      aria-label="關閉"
      v-tooltip.bottom="'關閉'"
      @click="handleClose"
    >
      <svg
        width="10"
        height="10"
        viewBox="0 0 10 10"
        fill="none"
        stroke="currentColor"
        stroke-width="1"
        aria-hidden="true"
      >
        <line x1="0.5" y1="0.5" x2="9.5" y2="9.5" />
        <line x1="9.5" y1="0.5" x2="0.5" y2="9.5" />
      </svg>
    </button>
  </div>
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue';
import { windowService } from '@/services/windowService';

const isMaximized = ref(false);
let unlistenResized: (() => void) | null = null;
let isDisposed = false;

async function syncMaximizedState() {
  if (isDisposed) return;
  isMaximized.value = await windowService.isMaximized();
}

async function handleMinimize() {
  await windowService.minimize();
}

async function handleToggleMaximize() {
  await windowService.toggleMaximize();
  await syncMaximizedState();
}

async function handleClose() {
  await windowService.close();
}

onMounted(async () => {
  await syncMaximizedState();
  unlistenResized = await windowService.onResized(() => {
    void syncMaximizedState();
  });
  if (isDisposed && unlistenResized) {
    unlistenResized();
    unlistenResized = null;
  }
});

onBeforeUnmount(() => {
  isDisposed = true;
  if (unlistenResized) {
    unlistenResized();
    unlistenResized = null;
  }
});
</script>
