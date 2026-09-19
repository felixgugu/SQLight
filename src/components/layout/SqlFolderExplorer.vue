<template>
  <div class="flex flex-col h-full bg-dark-850 font-sans">
    <!-- Header & Toolbar -->
    <div class="h-9 px-3 border-b border-dark-700 flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-dark-400 bg-dark-850 flex-shrink-0 select-none">
      <!-- Left: Title -->
      <div class="flex items-center space-x-1.5">
        <FolderGit2 class="w-3.5 h-3.5 text-brand-500" />
        <span>SQL 檔案</span>
      </div>

      <!-- Right: Toolbar (新增, 重新整理, 全部收合) -->
      <div class="flex items-center space-x-1">
        <!-- 新增 (Add Folder) -->
        <Button
          icon="pi pi-plus"
          severity="secondary"
          size="small"
          text
          rounded
          class="!h-6 !w-6 !p-0"
          :disabled="sqlFolderStore.isLoading"
          v-tooltip.bottom="'新增監控資料夾 (Add Folder)'"
          @click="handleAddFolder"
        />

        <!-- 重新整理 (Refresh) -->
        <Button
          :icon="sqlFolderStore.isLoading ? 'pi pi-spin pi-spinner' : 'pi pi-refresh'"
          severity="secondary"
          size="small"
          text
          rounded
          class="!h-6 !w-6 !p-0"
          :disabled="sqlFolderStore.isLoading"
          v-tooltip.bottom="'重新整理 (Refresh)'"
          @click="handleRefreshAll"
        />

        <!-- 全部收合 (Collapse All) -->
        <Button
          icon="pi pi-angle-double-up"
          severity="secondary"
          size="small"
          text
          rounded
          class="!h-6 !w-6 !p-0"
          v-tooltip.bottom="'全部收合 (Collapse All)'"
          @click="sqlFolderStore.collapseAll"
        />
      </div>
    </div>

    <!-- Tree Content Area -->
    <div class="flex-1 overflow-y-auto px-1.5 py-2 text-xs font-mono">
      <!-- Empty State -->
      <div
        v-if="sqlFolderStore.monitoredFolders.length === 0"
        class="py-6 px-3 text-center text-dark-400 space-y-2"
      >
        <FolderSearch class="w-8 h-8 text-dark-600 mx-auto stroke-1" />
        <div class="text-xxs leading-relaxed">
          尚未加入 SQL 監控資料夾<br />
          可加入本機目錄隨時瀏覽與直接開啟編輯 .sql 檔案
        </div>
        <Button
          type="button"
          size="small"
          label="新增資料夾"
          icon="pi pi-folder-open"
          severity="secondary"
          class="!text-xxs !py-1 !px-2.5"
          @click="handleAddFolder"
        />
      </div>

      <!-- Monitored Folders List -->
      <div v-else class="space-y-1">
        <div
          v-for="folder in sqlFolderStore.monitoredFolders"
          :key="folder.id"
          class="space-y-0.5"
        >
          <!-- Root Folder Item -->
          <div
            @click="sqlFolderStore.toggleNode(folder.path)"
            @contextmenu.prevent="openFolderContextMenu($event, folder)"
            :class="[
              'flex items-center space-x-1.5 px-1.5 py-1 rounded cursor-pointer transition-colors group select-none',
              'hover:bg-dark-750 text-dark-200'
            ]"
            :title="`${folder.name}\n路徑: ${folder.path}\n(右鍵開啟選單)`"
          >
            <!-- Chevron -->
            <button
              type="button"
              @click.stop="sqlFolderStore.toggleNode(folder.path)"
              class="p-0.5 hover:bg-dark-700 text-dark-500 hover:text-dark-200 rounded transition-colors flex-shrink-0 flex items-center justify-center"
            >
              <component
                :is="sqlFolderStore.expandedNodes[folder.path] ? ChevronDown : ChevronRight"
                class="w-3 h-3"
              />
            </button>

            <!-- Folder Icon -->
            <component
              :is="sqlFolderStore.expandedNodes[folder.path] ? FolderOpen : Folder"
              class="w-3.5 h-3.5 text-amber-400 flex-shrink-0"
            />

            <!-- Name & Path -->
            <span class="truncate flex-1 font-semibold text-dark-100 text-xs">
              {{ folder.name }}
            </span>

            <!-- Actions on hover -->
            <div class="opacity-0 group-hover:opacity-100 flex items-center space-x-0.5 flex-shrink-0 transition-opacity">
              <!-- Single Refresh -->
              <button
                type="button"
                @click.stop="sqlFolderStore.refreshFolder(folder.path)"
                class="p-0.5 hover:bg-dark-700 text-dark-400 hover:text-dark-200 rounded"
                title="重新整理此資料夾"
              >
                <RotateCw :class="['w-2.5 h-2.5', sqlFolderStore.refreshingPath === folder.path ? 'animate-spin text-brand-400' : '']" />
              </button>

              <!-- Remove from monitoring -->
              <button
                type="button"
                @click.stop="sqlFolderStore.removeFolder(folder.path)"
                class="p-0.5 hover:bg-dark-700 text-dark-400 hover:text-rose-400 rounded"
                title="自監控清單移除"
              >
                <X class="w-2.5 h-2.5" />
              </button>
            </div>
          </div>

          <!-- Tree Children -->
          <div
            v-if="sqlFolderStore.expandedNodes[folder.path]"
            class="pl-1 border-l border-dark-750 ml-2"
          >
            <!-- Loading state -->
            <div
              v-if="!sqlFolderStore.folderTrees[folder.path] && sqlFolderStore.isLoading"
              class="py-1 px-2 text-xxs text-dark-500 flex items-center space-x-1.5"
            >
              <RotateCw class="w-2.5 h-2.5 animate-spin text-brand-400" />
              <span>掃描中...</span>
            </div>

            <!-- No .sql files -->
            <div
              v-else-if="!sqlFolderStore.folderTrees[folder.path]?.children || sqlFolderStore.folderTrees[folder.path]?.children?.length === 0"
              class="py-1 px-2 text-xxs text-dark-500 italic"
            >
              (無 .sql 檔案)
            </div>

            <!-- Children Nodes -->
            <template v-else>
              <SqlFileTreeNode
                v-for="child in sqlFolderStore.folderTrees[folder.path]?.children"
                :key="child.path"
                :node="child"
                :depth="0"
              />
            </template>
          </div>
        </div>
      </div>
    </div>

    <!-- PrimeVue ContextMenu for Root Folders -->
    <ContextMenu ref="folderMenuRef" :model="folderMenuItems" />

    <!-- Manual Path Input Modal (Alternative to native picker) -->
    <Dialog
      v-model:visible="isManualPathModalOpen"
      modal
      header="新增 SQL 監控資料夾"
      class="w-full max-w-md font-sans"
    >
      <div class="space-y-3 text-xs py-1">
        <p class="text-dark-300 leading-relaxed">
          請輸入或貼上本機資料夾之絕對路徑：
        </p>
        <div>
          <label class="block text-xxs text-dark-400 mb-1">資料夾完整路徑</label>
          <InputText
            v-model="manualPathInput"
            placeholder="例如: D:\Projects\Database\Scripts"
            class="w-full font-mono text-xs"
            @keyup.enter="handleConfirmManualPath"
          />
        </div>
      </div>

      <template #footer>
        <div class="flex items-center justify-end space-x-2 pt-2">
          <Button
            type="button"
            label="取消"
            severity="secondary"
            size="small"
            text
            @click="isManualPathModalOpen = false"
          />
          <Button
            type="button"
            label="新增"
            icon="pi pi-check"
            severity="primary"
            size="small"
            :disabled="!manualPathInput.trim()"
            @click="handleConfirmManualPath"
          />
        </div>
      </template>
    </Dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import Button from 'primevue/button';
import InputText from 'primevue/inputtext';
import Dialog from 'primevue/dialog';
import ContextMenu from 'primevue/contextmenu';
import {
  FolderGit2,
  RotateCw,
  Folder,
  FolderOpen,
  FolderSearch,
  ChevronRight,
  ChevronDown,
  X,
} from 'lucide-vue-next';
import { useSqlFolderStore } from '@/stores/sqlFolderStore';
import type { MonitoredFolder } from '@/types/sqlFolder';
import SqlFileTreeNode from './SqlFileTreeNode.vue';

const sqlFolderStore = useSqlFolderStore();

const folderMenuRef = ref();
const targetContextMenuFolder = ref<MonitoredFolder | null>(null);

const isManualPathModalOpen = ref(false);
const manualPathInput = ref('');

onMounted(async () => {
  await sqlFolderStore.init();
});

async function handleAddFolder() {
  const success = await sqlFolderStore.addFolder();
  if (!success) {
    // If native picker wasn't invoked or returned nothing, user can choose manual input
  }
}

async function handleRefreshAll() {
  await sqlFolderStore.refreshAll();
}

function openFolderContextMenu(event: MouseEvent, folder: MonitoredFolder) {
  targetContextMenuFolder.value = folder;
  folderMenuRef.value?.show(event);
}

const folderMenuItems = computed(() => {
  const folder = targetContextMenuFolder.value;
  if (!folder) return [];

  return [
    {
      label: folder.name,
      disabled: true,
    },
    { separator: true },
    {
      label: '重新整理此資料夾',
      icon: 'pi pi-refresh',
      command: () => sqlFolderStore.refreshFolder(folder.path),
    },
    {
      label: '複製完整路徑',
      icon: 'pi pi-copy',
      command: () => {
        try {
          navigator.clipboard.writeText(folder.path);
        } catch {}
      },
    },
    { separator: true },
    {
      label: '自監控清單移除',
      icon: 'pi pi-trash',
      class: '!text-rose-400',
      command: () => sqlFolderStore.removeFolder(folder.path),
    },
  ];
});

async function handleConfirmManualPath() {
  const path = manualPathInput.value.trim();
  if (!path) return;
  const success = await sqlFolderStore.addFolder(path);
  if (success) {
    manualPathInput.value = '';
    isManualPathModalOpen.value = false;
  }
}
</script>
