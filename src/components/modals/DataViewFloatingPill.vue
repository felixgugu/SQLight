<template>
  <Teleport to="body">
    <div
      v-if="dataViewStore.isOpen && dataViewStore.isMinimized"
      class="fixed bottom-6 right-6 z-[9998] animate-fade-in select-none"
    >
      <div
        class="flex items-center space-x-2.5 px-3.5 py-2 rounded-full shadow-2xl border border-sky-500/40 bg-dark-850 dark:bg-[#18181f] text-dark-100 hover:border-sky-400 transition-all duration-200 cursor-pointer backdrop-blur-md group"
        @click="dataViewStore.restore()"
      >
        <!-- Icon -->
        <div class="w-6 h-6 rounded-full bg-sky-500/20 text-sky-400 flex items-center justify-center flex-shrink-0">
          <Eye class="w-3.5 h-3.5" />
        </div>

        <!-- Text Info -->
        <div class="flex items-center space-x-1.5 text-xs">
          <span class="font-medium text-dark-100">資料檢視</span>
          <span class="text-dark-400 font-mono text-xxs">
            #{{ dataViewStore.currentDisplayIndex }}
          </span>
          <Tag
            v-if="dataViewStore.filterText"
            value="過濾中"
            severity="warn"
            class="!text-[9px] !py-0 !px-1 font-mono"
          />
        </div>

        <!-- Actions -->
        <div class="flex items-center space-x-0.5 pl-1 border-l border-dark-700" @click.stop>
          <Button
            type="button"
            icon="pi pi-window-maximize"
            severity="secondary"
            text
            rounded
            size="small"
            v-tooltip.top="'還原檢視視窗'"
            class="!w-6 !h-6 !p-0 hover:text-sky-300"
            @click="dataViewStore.restore()"
          />
          <Button
            type="button"
            icon="pi pi-times"
            severity="secondary"
            text
            rounded
            size="small"
            v-tooltip.top="'關閉'"
            class="!w-6 !h-6 !p-0 hover:text-rose-400"
            @click="dataViewStore.closeDataView()"
          />
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { Eye } from 'lucide-vue-next';
import Button from 'primevue/button';
import Tag from 'primevue/tag';
import { useDataViewStore } from '@/stores/dataViewStore';

const dataViewStore = useDataViewStore();
</script>

<style scoped>
@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(6px) scale(0.96);
  }
  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}

.animate-fade-in {
  animation: fadeIn 0.18s cubic-bezier(0.16, 1, 0.3, 1) forwards;
}
</style>
