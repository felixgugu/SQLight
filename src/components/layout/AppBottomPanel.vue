<template>
  <div class="h-full bg-dark-850 flex flex-col overflow-hidden select-none border-t border-dark-700">
    <!-- Bottom Panel Header Tabs -->
    <div class="h-8 bg-dark-850 border-b border-dark-700 flex items-center justify-between px-2 text-xs flex-shrink-0">
      <!-- Tabs Switcher -->
      <div class="flex items-center space-x-1">
        <button
          v-for="tab in panelTabs"
          :key="tab.id"
          @click="workspaceStore.setBottomPanelTab(tab.id)"
          :class="[
            'h-6 px-2.5 flex items-center space-x-1.5 rounded text-xs font-medium transition-colors',
            workspaceStore.bottomPanelTab === tab.id
              ? 'bg-dark-750 text-dark-100 shadow-sm'
              : 'text-dark-400 hover:text-dark-200 hover:bg-dark-800'
          ]"
        >
          <component :is="tab.icon" class="w-3.5 h-3.5" />
          <span>{{ tab.label }}</span>
          <span
            v-if="tab.badge !== undefined && tab.badge > 0"
            :class="[
              'text-xxs px-1 rounded-full font-mono',
              tab.id === 'messages' && hasErrorMessages
                ? 'bg-rose-900/80 text-rose-200'
                : 'bg-dark-700 text-dark-300'
            ]"
          >
            {{ tab.badge }}
          </span>
        </button>
      </div>

      <!-- Right Summary & Panel Controls -->
      <div class="flex items-center space-x-3 text-xxs font-mono text-dark-400">
        <span v-if="queryStore.activeResult">
          Duration: <strong class="text-brand-400">{{ queryStore.activeResult.executionTimeMs }}ms</strong>
        </span>
        <span v-if="queryStore.activeResult">
          Affected: <strong class="text-emerald-400">{{ queryStore.activeResult.affectedRows }}</strong>
        </span>

        <button
          @click="workspaceStore.toggleBottomPanel()"
          class="p-1 text-dark-400 hover:text-dark-200 hover:bg-dark-750 rounded transition-colors"
          title="Minimize Panel"
        >
          <Minimize2 class="w-3.5 h-3.5" />
        </button>
      </div>
    </div>

    <!-- Panel Body -->
    <div class="flex-1 overflow-hidden bg-dark-900">
      <!-- Tab 1: Results Grid -->
      <ResultGrid
        v-if="workspaceStore.bottomPanelTab === 'results'"
        :result-sets="queryStore.activeResult?.resultSets ?? []"
      />

      <!-- Tab 2: Messages -->
      <ResultMessages
        v-else-if="workspaceStore.bottomPanelTab === 'messages'"
        :messages="queryStore.activeResult?.messages ?? []"
      />

      <!-- Tab 3: History -->
      <QueryHistory
        v-else-if="workspaceStore.bottomPanelTab === 'history'"
        :history="queryStore.history"
        @select="onSelectHistory"
        @clear="queryStore.clearHistory()"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { TableProperties, MessageSquare, History, Minimize2 } from 'lucide-vue-next';
import { useWorkspaceStore } from '@/stores/workspaceStore';
import { useQueryStore } from '@/stores/queryStore';
import ResultGrid from '@/components/results/ResultGrid.vue';
import ResultMessages from '@/components/results/ResultMessages.vue';
import QueryHistory from '@/components/results/QueryHistory.vue';
import type { BottomPanelTab } from '@/types/workspace';

const workspaceStore = useWorkspaceStore();
const queryStore = useQueryStore();

const hasErrorMessages = computed(() => {
  return queryStore.activeResult?.messages.some((m) => m.level === 'error') ?? false;
});

const panelTabs = computed<{ id: BottomPanelTab; label: string; icon: typeof TableProperties; badge?: number }[]>(() => [
  {
    id: 'results',
    label: 'Results',
    icon: TableProperties,
    badge: queryStore.activeResult?.resultSets[0]?.rowCount ?? 0,
  },
  {
    id: 'messages',
    label: 'Messages',
    icon: MessageSquare,
    badge: queryStore.activeResult?.messages.length ?? 0,
  },
  {
    id: 'history',
    label: 'History',
    icon: History,
    badge: queryStore.history.length,
  },
]);

function onSelectHistory(sql: string) {
  workspaceStore.addSqlTab(sql);
}
</script>
