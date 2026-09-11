<template>
  <aside class="h-full bg-dark-850 flex flex-col overflow-hidden select-none border-r border-dark-700">
    <!-- Sidebar Header -->
    <div class="h-9 px-3 border-b border-dark-700 flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-dark-400 bg-dark-850">
      <div class="flex items-center space-x-1.5">
        <Server class="w-3.5 h-3.5 text-brand-500" />
        <span>Explorer</span>
      </div>
      <div class="flex items-center space-x-1">
        <button
          class="p-1 hover:bg-dark-750 text-dark-400 hover:text-dark-200 rounded transition-colors"
          title="Add New Connection"
        >
          <Plus class="w-3.5 h-3.5" />
        </button>
        <button
          class="p-1 hover:bg-dark-750 text-dark-400 hover:text-dark-200 rounded transition-colors"
          title="Refresh Explorer"
        >
          <RotateCw class="w-3.5 h-3.5" />
        </button>
      </div>
    </div>

    <!-- Filter Search Box -->
    <div class="p-2 border-b border-dark-700">
      <div class="relative flex items-center">
        <Search class="w-3 h-3 text-dark-500 absolute left-2" />
        <input
          v-model="filterQuery"
          type="text"
          placeholder="Filter tables & views..."
          class="w-full bg-dark-900 border border-dark-700 rounded px-2 py-1 pl-7 text-xs text-dark-100 placeholder-dark-500 focus:outline-none focus:border-brand-500 transition-colors"
        />
      </div>
    </div>

    <!-- Tree Content -->
    <div class="flex-1 overflow-y-auto px-1 py-2 text-xs font-mono">
      <!-- Active Connection Item -->
      <div class="mb-2">
        <div
          @click="isConnExpanded = !isConnExpanded"
          class="flex items-center space-x-1 px-1.5 py-1 rounded hover:bg-dark-750 cursor-pointer text-dark-200 group"
        >
          <component
            :is="isConnExpanded ? ChevronDown : ChevronRight"
            class="w-3 h-3 text-dark-500 group-hover:text-dark-300"
          />
          <Server class="w-3.5 h-3.5 text-emerald-400" />
          <span class="font-sans font-medium truncate flex-1">
            {{ connectionStore.activeConnection?.name ?? 'No Connection' }}
          </span>
          <span class="w-2 h-2 rounded-full bg-emerald-500" title="Connected"></span>
        </div>

        <!-- Databases Sub-tree -->
        <div v-if="isConnExpanded" class="pl-4 mt-1 space-y-0.5">
          <div
            v-for="db in connectionStore.availableDatabases"
            :key="db"
            @click="connectionStore.setActiveDatabase(db)"
            :class="[
              'flex items-center space-x-1 px-1.5 py-1 rounded cursor-pointer transition-colors',
              connectionStore.activeDatabase === db
                ? 'bg-brand-500/20 text-brand-300 font-semibold'
                : 'text-dark-300 hover:bg-dark-750 hover:text-dark-100'
            ]"
          >
            <Database class="w-3 h-3 text-amber-400/80" />
            <span class="truncate flex-1">{{ db }}</span>
          </div>

          <!-- Active Database Schema Tree Preview (Mock/Placeholder for Phase 1) -->
          <div class="pl-3 pt-1 border-l border-dark-700 mt-1 space-y-0.5">
            <div class="flex items-center space-x-1 px-1 py-0.5 text-dark-400">
              <Folder class="w-3 h-3 text-blue-400" />
              <span>dbo</span>
            </div>
            <div class="pl-3 space-y-0.5 text-dark-300">
              <div class="flex items-center space-x-1 px-1 py-0.5 hover:bg-dark-750 rounded cursor-pointer group">
                <Table2 class="w-3 h-3 text-brand-400" />
                <span class="truncate group-hover:text-brand-300">Users</span>
              </div>
              <div class="flex items-center space-x-1 px-1 py-0.5 hover:bg-dark-750 rounded cursor-pointer group">
                <Table2 class="w-3 h-3 text-brand-400" />
                <span class="truncate group-hover:text-brand-300">Orders</span>
              </div>
              <div class="flex items-center space-x-1 px-1 py-0.5 hover:bg-dark-750 rounded cursor-pointer group">
                <Table2 class="w-3 h-3 text-brand-400" />
                <span class="truncate group-hover:text-brand-300">OrderItems</span>
              </div>
              <div class="flex items-center space-x-1 px-1 py-0.5 hover:bg-dark-750 rounded cursor-pointer group">
                <Table2 class="w-3 h-3 text-brand-400" />
                <span class="truncate group-hover:text-brand-300">Products</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </aside>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import {
  Server,
  Plus,
  RotateCw,
  Search,
  ChevronDown,
  ChevronRight,
  Database,
  Folder,
  Table2,
} from 'lucide-vue-next';
import { useConnectionStore } from '@/stores/connectionStore';

const connectionStore = useConnectionStore();
const filterQuery = ref('');
const isConnExpanded = ref(true);
</script>
