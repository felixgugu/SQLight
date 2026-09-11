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
            v-if="tab.badge !== undefined"
            class="text-xxs px-1 rounded-full bg-dark-700 text-dark-300 font-mono"
          >
            {{ tab.badge }}
          </span>
        </button>
      </div>

      <!-- Right Panel Controls -->
      <div class="flex items-center space-x-1">
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
      <!-- Tab 1: Results Grid Placeholder -->
      <div v-if="workspaceStore.bottomPanelTab === 'results'" class="w-full h-full flex flex-col">
        <!-- Results Sub-Toolbar -->
        <div class="h-6 bg-dark-850 border-b border-dark-750 flex items-center justify-between px-3 text-xxs text-dark-400">
          <div class="flex items-center space-x-2 font-mono">
            <span>Rows: <strong class="text-emerald-400">3</strong></span>
            <span>Duration: <strong class="text-brand-400">12ms</strong></span>
          </div>
          <div class="flex items-center space-x-2">
            <span class="hover:text-dark-200 cursor-pointer">Copy All</span>
            <span>|</span>
            <span class="hover:text-dark-200 cursor-pointer">Export CSV</span>
          </div>
        </div>

        <!-- Result Table -->
        <div class="flex-1 overflow-auto">
          <table class="w-full text-left border-collapse font-mono text-xs">
            <thead class="bg-dark-850 sticky top-0 border-b border-dark-700 text-dark-300 text-xxs uppercase tracking-wider">
              <tr>
                <th class="p-2 w-12 text-center text-dark-500 border-r border-dark-750">#</th>
                <th class="p-2 border-r border-dark-750 font-semibold text-dark-200">UserID (int)</th>
                <th class="p-2 border-r border-dark-750 font-semibold text-dark-200">Username (nvarchar)</th>
                <th class="p-2 border-r border-dark-750 font-semibold text-dark-200">Email (nvarchar)</th>
                <th class="p-2 border-r border-dark-750 font-semibold text-dark-200">CreatedAt (datetime2)</th>
                <th class="p-2 font-semibold text-dark-200">LastLogin (datetime2)</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-dark-800 text-dark-200">
              <tr class="hover:bg-dark-800/60 transition-colors">
                <td class="p-2 text-center text-dark-500 bg-dark-850/40 border-r border-dark-800">1</td>
                <td class="p-2 border-r border-dark-800 text-emerald-400">1001</td>
                <td class="p-2 border-r border-dark-800">admin</td>
                <td class="p-2 border-r border-dark-800">admin@sqlight.local</td>
                <td class="p-2 border-r border-dark-800 text-dark-400">2026-01-15 08:30:00</td>
                <td class="p-2 text-dark-400">2026-09-10 14:22:18</td>
              </tr>
              <tr class="hover:bg-dark-800/60 transition-colors">
                <td class="p-2 text-center text-dark-500 bg-dark-850/40 border-r border-dark-800">2</td>
                <td class="p-2 border-r border-dark-800 text-emerald-400">1002</td>
                <td class="p-2 border-r border-dark-800">felix</td>
                <td class="p-2 border-r border-dark-800">felix@sqlight.local</td>
                <td class="p-2 border-r border-dark-800 text-dark-400">2026-02-01 11:05:42</td>
                <td class="p-2 text-dark-400">2026-09-11 09:12:04</td>
              </tr>
              <tr class="hover:bg-dark-800/60 transition-colors">
                <td class="p-2 text-center text-dark-500 bg-dark-850/40 border-r border-dark-800">3</td>
                <td class="p-2 border-r border-dark-800 text-emerald-400">1003</td>
                <td class="p-2 border-r border-dark-800">guest</td>
                <td class="p-2 border-r border-dark-800"><span class="italic text-dark-500 font-mono">NULL</span></td>
                <td class="p-2 border-r border-dark-800 text-dark-400">2026-03-12 19:40:11</td>
                <td class="p-2"><span class="italic text-dark-500 font-mono">NULL</span></td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- Tab 2: Messages Tab -->
      <div v-else-if="workspaceStore.bottomPanelTab === 'messages'" class="w-full h-full p-3 font-mono text-xs overflow-auto space-y-1">
        <div class="flex items-start space-x-2 text-dark-300">
          <span class="text-dark-500">[09:40:22]</span>
          <span class="text-emerald-400 font-semibold">SUCCESS:</span>
          <span>Query executed successfully in 12ms. (3 rows affected)</span>
        </div>
        <div class="flex items-start space-x-2 text-dark-300">
          <span class="text-dark-500">[09:38:11]</span>
          <span class="text-blue-400 font-semibold">INFO:</span>
          <span>Connected to SQL Server 2022 (v16.0.4135) - master</span>
        </div>
      </div>

      <!-- Tab 3: History Tab -->
      <div v-else-if="workspaceStore.bottomPanelTab === 'history'" class="w-full h-full p-2 overflow-auto">
        <div class="divide-y divide-dark-800 font-mono text-xs">
          <div class="py-1.5 px-2 flex items-center justify-between hover:bg-dark-800/50 rounded cursor-pointer">
            <div class="flex items-center space-x-2 truncate">
              <span class="w-2 h-2 rounded-full bg-emerald-500"></span>
              <span class="text-dark-200 truncate">SELECT TOP 100 * FROM dbo.Users;</span>
            </div>
            <div class="flex items-center space-x-3 text-xxs text-dark-400 flex-shrink-0">
              <span>12ms</span>
              <span>09:40:22</span>
            </div>
          </div>
          <div class="py-1.5 px-2 flex items-center justify-between hover:bg-dark-800/50 rounded cursor-pointer">
            <div class="flex items-center space-x-2 truncate">
              <span class="w-2 h-2 rounded-full bg-emerald-500"></span>
              <span class="text-dark-200 truncate">SELECT @@VERSION AS [SQL Server Version];</span>
            </div>
            <div class="flex items-center space-x-3 text-xxs text-dark-400 flex-shrink-0">
              <span>8ms</span>
              <span>09:38:15</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { TableProperties, MessageSquare, History, Minimize2 } from 'lucide-vue-next';
import { useWorkspaceStore } from '@/stores/workspaceStore';
import type { BottomPanelTab } from '@/types/workspace';

const workspaceStore = useWorkspaceStore();

const panelTabs: { id: BottomPanelTab; label: string; icon: typeof TableProperties; badge?: number }[] = [
  { id: 'results', label: 'Results', icon: TableProperties, badge: 3 },
  { id: 'messages', label: 'Messages', icon: MessageSquare, badge: 2 },
  { id: 'history', label: 'History', icon: History },
];
</script>
