<template>
  <div
    :class="[
      'select-none transition-colors duration-150 flex-shrink-0 relative group z-20',
      direction === 'horizontal'
        ? 'w-1.5 cursor-col-resize hover:bg-brand-500/60 active:bg-brand-500'
        : 'h-1.5 cursor-row-resize hover:bg-brand-500/60 active:bg-brand-500',
      isDragging ? 'bg-brand-500' : 'bg-dark-700 hover:bg-dark-600'
    ]"
    @pointerdown="$emit('pointerdown', $event)"
  >
    <!-- Visual grip indicator line on hover -->
    <div
      v-if="direction === 'horizontal'"
      class="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-0.5 h-6 rounded bg-dark-500 group-hover:bg-brand-300"
    />
    <div
      v-else
      class="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-0.5 w-6 rounded bg-dark-500 group-hover:bg-brand-300"
    />
  </div>
</template>

<script setup lang="ts">
defineProps<{
  direction: 'horizontal' | 'vertical';
  isDragging?: boolean;
}>();

defineEmits<{
  (e: 'pointerdown', event: PointerEvent): void;
}>();
</script>
