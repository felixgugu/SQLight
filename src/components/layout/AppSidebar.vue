<template>
  <aside class="h-full bg-dark-850 flex flex-col overflow-hidden select-none border-r border-dark-700 relative">
    <!-- Sidebar Header -->
    <div class="h-9 px-3 border-b border-dark-700 flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-dark-400 bg-dark-850 flex-shrink-0">
      <div class="flex items-center space-x-1.5">
        <Server class="w-3.5 h-3.5 text-brand-500" />
        <span>Explorer</span>
      </div>
      <div class="flex items-center space-x-1">
        <button
          @click="$emit('open-connection-modal')"
          class="p-1 hover:bg-dark-750 text-dark-400 hover:text-dark-200 rounded transition-colors"
          title="New Connection"
        >
          <Plus class="w-3.5 h-3.5" />
        </button>
        <button
          @click="refreshCurrent"
          class="p-1 hover:bg-dark-750 text-dark-400 hover:text-dark-200 rounded transition-colors"
          title="Refresh Explorer"
        >
          <RotateCw :class="['w-3.5 h-3.5', isRefreshing ? 'animate-spin text-brand-400' : '']" />
        </button>
      </div>
    </div>

    <!-- Filter Search Box -->
    <div class="p-2 border-b border-dark-700 flex-shrink-0">
      <div class="relative flex items-center">
        <Search class="w-3 h-3 text-dark-500 absolute left-2" />
        <input
          v-model="filterQuery"
          type="text"
          placeholder="Filter tables & views..."
          class="w-full bg-dark-900 border border-dark-700 rounded px-2 py-1 pl-7 text-xs text-dark-100 placeholder-dark-500 focus:outline-none focus:border-brand-500 font-mono transition-colors"
        />
      </div>
    </div>

    <!-- Tree Content Area -->
    <div class="flex-1 overflow-y-auto px-1.5 py-2 text-xs font-mono">
      <!-- Section: Connections -->
      <div
        v-for="conn in connectionStore.connections"
        :key="conn.id"
        class="mb-2"
      >
        <!-- Connection Header Item -->
        <div
          @click="toggleConnection(conn.id)"
          @contextmenu.prevent="openConnContextMenu($event, conn)"
          :class="[
            'flex items-center space-x-1 px-1.5 py-1 rounded cursor-pointer group transition-colors relative',
            connectionStore.activeConnectionId === conn.id ? 'bg-dark-800 text-dark-100' : 'hover:bg-dark-750 text-dark-300'
          ]"
        >
          <component
            :is="expandedConns[conn.id] ? ChevronDown : ChevronRight"
            class="w-3 h-3 text-dark-500 group-hover:text-dark-300 flex-shrink-0"
          />
          <Server
            :class="[
              'w-3.5 h-3.5 flex-shrink-0',
              connectionStore.activeConnectionId === conn.id && connectionStore.status === 'connected'
                ? 'text-emerald-400'
                : 'text-dark-500'
            ]"
          />

          <!-- Normal Name Display OR Inline Rename Input -->
          <div
            v-if="inlineEditingId === conn.id"
            class="flex-1 flex flex-col min-w-0 mr-1"
            @click.stop
          >
            <div class="flex items-center space-x-1">
              <input
                ref="inlineInputRef"
                v-model="inlineEditingName"
                @keydown.enter.stop="saveInlineRename(conn)"
                @keydown.esc.stop="cancelInlineRename"
                @blur="handleInlineBlur(conn)"
                type="text"
                :class="[
                  'w-full bg-dark-900 border rounded px-1.5 py-0.5 text-xs text-dark-100 focus:outline-none font-sans',
                  inlineError ? 'border-rose-500 focus:border-rose-400' : 'border-brand-500'
                ]"
              />
              <button
                type="button"
                @mousedown.prevent
                @click.stop="saveInlineRename(conn)"
                :disabled="!!inlineError || !inlineEditingName.trim()"
                class="p-0.5 text-emerald-400 hover:text-emerald-300 disabled:opacity-30 flex-shrink-0"
                title="確定 (Enter)"
              >
                <Check class="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                @mousedown.prevent
                @click.stop="cancelInlineRename"
                class="p-0.5 text-dark-400 hover:text-dark-200 flex-shrink-0"
                title="取消 (Esc)"
              >
                <X class="w-3.5 h-3.5" />
              </button>
            </div>
            <span v-if="inlineError" class="text-rose-400 text-xxs mt-0.5 truncate font-sans">
              {{ inlineError }}
            </span>
          </div>

          <span v-else class="font-sans font-medium truncate flex-1">{{ conn.name }}</span>

          <!-- Status indicator (when connected) -->
          <span
            v-if="connectionStore.activeConnectionId === conn.id && connectionStore.status === 'connected' && inlineEditingId !== conn.id"
            class="w-2 h-2 rounded-full bg-emerald-500 flex-shrink-0 shadow-xs shadow-emerald-500/50 mr-1"
            title="Connected"
          />

          <!-- Action Buttons on Hover -->
          <div
            v-if="inlineEditingId !== conn.id"
            class="hidden group-hover:flex items-center space-x-0.5 flex-shrink-0 ml-1"
            @click.stop
          >
            <!-- Refresh connection -->
            <button
              type="button"
              @click.stop="handleRefreshConn(conn)"
              class="p-1 hover:bg-dark-700 text-dark-400 hover:text-dark-200 rounded transition-colors"
              title="重新整理 (Refresh)"
            >
              <RotateCw :class="['w-3 h-3', refreshingConnId === conn.id ? 'animate-spin text-brand-400' : '']" />
            </button>

            <!-- Inline Rename -->
            <button
              type="button"
              @click.stop="startInlineRename(conn)"
              class="p-1 hover:bg-dark-700 text-dark-400 hover:text-dark-200 rounded transition-colors"
              title="修改名稱 (Rename)"
            >
              <Pencil class="w-3 h-3" />
            </button>

            <!-- Delete connection -->
            <button
              type="button"
              @click.stop="handlePromptDelete(conn)"
              class="p-1 hover:bg-dark-700 text-dark-400 hover:text-rose-400 rounded transition-colors"
              title="刪除連線 (Delete)"
            >
              <Trash2 class="w-3 h-3" />
            </button>
          </div>
        </div>

        <!-- Connection Children: Databases -->
        <div v-if="expandedConns[conn.id]" class="pl-3.5 mt-1 space-y-0.5 border-l border-dark-750 ml-2">
          <div
            v-for="db in connectionStore.availableDatabases"
            :key="db"
            class="space-y-0.5"
          >
            <!-- Database Item -->
            <div
              @click="toggleDatabase(db)"
              :class="[
                'flex items-center space-x-1 px-1.5 py-0.5 rounded cursor-pointer transition-colors',
                connectionStore.activeDatabase === db
                  ? 'bg-brand-500/20 text-brand-300 font-semibold'
                  : 'text-dark-300 hover:bg-dark-750 hover:text-dark-100'
              ]"
            >
              <component
                :is="expandedDbs[db] ? ChevronDown : ChevronRight"
                class="w-2.5 h-2.5 text-dark-500 flex-shrink-0"
              />
              <Database class="w-3 h-3 text-amber-400/80 flex-shrink-0" />
              <span class="truncate flex-1">{{ db }}</span>
            </div>

            <!-- Database Tables & Views List -->
            <div v-if="expandedDbs[db]" class="pl-3.5 border-l border-dark-750 ml-2 space-y-0.5">
              <div
                v-if="filteredTables.length === 0"
                class="py-1 px-1.5 text-xxs text-dark-500 italic"
              >
                No matching tables
              </div>

              <div
                v-for="table in filteredTables"
                :key="table.schema + '.' + table.name"
                class="space-y-0.5"
              >
                <!-- Table Item with Right Click Context Menu -->
                <div
                  @click="toggleTable(table.schema, table.name)"
                  @contextmenu.prevent="openContextMenu($event, table.schema, table.name)"
                  class="flex items-center space-x-1 px-1.5 py-0.5 rounded hover:bg-dark-750 cursor-pointer text-dark-300 hover:text-dark-100 group"
                  :title="`${table.schema}.${table.name} (${table.kind}) - Right click for actions`"
                >
                  <component
                    :is="isTableExpanded(table.schema, table.name) ? ChevronDown : ChevronRight"
                    class="w-2.5 h-2.5 text-dark-500 group-hover:text-dark-300 flex-shrink-0"
                  />
                  <Table2 v-if="table.kind === 'BASE TABLE'" class="w-3 h-3 text-brand-400 flex-shrink-0" />
                  <FileText v-else class="w-3 h-3 text-purple-400 flex-shrink-0" />
                  <span class="text-dark-400 text-xxs flex-shrink-0">{{ table.schema }}.</span>
                  <span class="truncate flex-1 font-medium">{{ table.name }}</span>
                </div>

                <!-- Columns List -->
                <div
                  v-if="isTableExpanded(table.schema, table.name)"
                  class="pl-3.5 border-l border-dark-750 ml-2 space-y-0.5"
                >
                  <div
                    v-for="col in getTableColumns(table.schema, table.name)"
                    :key="col.name"
                    class="flex items-center space-x-1.5 px-1 py-0.2 text-xxs text-dark-400 hover:text-dark-200"
                  >
                    <Key v-if="col.isPrimaryKey" class="w-2.5 h-2.5 text-amber-400 flex-shrink-0" />
                    <Columns v-else class="w-2.5 h-2.5 text-dark-500 flex-shrink-0" />
                    <span :class="[col.isPrimaryKey ? 'text-amber-300 font-semibold' : 'text-dark-300']" class="truncate">
                      {{ col.name }}
                    </span>
                    <span class="text-dark-500 lowercase font-sans text-xxs flex-shrink-0">
                      {{ col.dataType }}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Table Context Menu Popover -->
    <div
      v-if="contextMenu.visible"
      :style="{ top: `${contextMenu.y}px`, left: `${contextMenu.x}px` }"
      class="fixed z-50 bg-dark-800 border border-dark-700 rounded shadow-xl py-1 w-44 text-xs font-sans text-dark-200 select-none"
      @click="contextMenu.visible = false"
    >
      <div class="px-2.5 py-1 text-xxs text-dark-400 border-b border-dark-750 font-mono truncate">
        {{ contextMenu.schema }}.{{ contextMenu.tableName }}
      </div>
      <button
        @click="handleOpenData"
        class="w-full text-left px-2.5 py-1.5 hover:bg-dark-750 hover:text-dark-100 flex items-center space-x-2 transition-colors"
      >
        <Table2 class="w-3.5 h-3.5 text-emerald-400" />
        <span>Open Data</span>
      </button>
      <button
        @click="handleGenerateSelect"
        class="w-full text-left px-2.5 py-1.5 hover:bg-dark-750 hover:text-dark-100 flex items-center space-x-2 transition-colors"
      >
        <FileCode class="w-3.5 h-3.5 text-brand-400" />
        <span>Generate SELECT</span>
      </button>
    </div>

    <!-- Connection Context Menu Popover -->
    <div
      v-if="connContextMenu.visible"
      :style="{ top: `${connContextMenu.y}px`, left: `${connContextMenu.x}px` }"
      class="fixed z-50 bg-dark-800 border border-dark-700 rounded shadow-xl py-1 w-44 text-xs font-sans text-dark-200 select-none"
      @click="connContextMenu.visible = false"
    >
      <div class="px-2.5 py-1 text-xxs text-dark-400 border-b border-dark-750 font-sans truncate font-medium">
        {{ connContextMenu.conn?.name }}
      </div>

      <button
        @click="handleRefreshConn(connContextMenu.conn!)"
        class="w-full text-left px-2.5 py-1.5 hover:bg-dark-750 hover:text-dark-100 flex items-center space-x-2 transition-colors"
      >
        <RotateCw class="w-3.5 h-3.5 text-brand-400" />
        <span>重新整理 (Refresh)</span>
      </button>

      <button
        @click="startInlineRename(connContextMenu.conn!)"
        class="w-full text-left px-2.5 py-1.5 hover:bg-dark-750 hover:text-dark-100 flex items-center space-x-2 transition-colors"
      >
        <Pencil class="w-3.5 h-3.5 text-sky-400" />
        <span>修改名稱 (Rename)</span>
      </button>

      <button
        @click="handleEditConn(connContextMenu.conn!)"
        class="w-full text-left px-2.5 py-1.5 hover:bg-dark-750 hover:text-dark-100 flex items-center space-x-2 transition-colors"
      >
        <Database class="w-3.5 h-3.5 text-amber-400" />
        <span>編輯設定 (Edit)</span>
      </button>

      <button
        v-if="connectionStore.activeConnectionId === connContextMenu.conn?.id && connectionStore.status === 'connected'"
        @click="handleDisconnect"
        class="w-full text-left px-2.5 py-1.5 hover:bg-dark-750 hover:text-dark-100 flex items-center space-x-2 transition-colors border-t border-dark-750"
      >
        <Unplug class="w-3.5 h-3.5 text-dark-400" />
        <span>中斷連線 (Disconnect)</span>
      </button>

      <div class="my-1 border-t border-dark-750"></div>

      <button
        @click="handlePromptDelete(connContextMenu.conn!)"
        class="w-full text-left px-2.5 py-1.5 hover:bg-rose-950/60 text-rose-400 hover:text-rose-300 flex items-center space-x-2 transition-colors"
      >
        <Trash2 class="w-3.5 h-3.5" />
        <span>刪除連線 (Delete)</span>
      </button>
    </div>

    <!-- Delete Connection Confirm Modal -->
    <ConfirmModal
      :is-open="isDeleteModalOpen"
      title="刪除連線"
      :message="`確定要刪除連線「${connToDelete?.name}」嗎？\n\n此動作將同時清除已儲存的伺服器認證資訊，且無法復原。`"
      confirm-text="刪除"
      cancel-text="取消"
      :is-danger="true"
      @confirm="confirmDelete"
      @cancel="cancelDelete"
    />
  </aside>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, reactive, nextTick } from 'vue';
import {
  Server,
  Plus,
  RotateCw,
  Search,
  ChevronDown,
  ChevronRight,
  Database,
  Table2,
  FileText,
  Key,
  Columns,
  FileCode,
  Pencil,
  Trash2,
  Check,
  X,
  Unplug,
} from 'lucide-vue-next';
import ConfirmModal from '@/components/common/ConfirmModal.vue';
import { useConnectionStore } from '@/stores/connectionStore';
import { useWorkspaceStore } from '@/stores/workspaceStore';
import { schemaService } from '@/services/schemaService';
import type { TableItem, ColumnItem } from '@/types/schema';
import type { ConnectionProfile } from '@/types/connection';

const emit = defineEmits<{
  (e: 'open-connection-modal'): void;
  (e: 'edit-connection', profile: ConnectionProfile): void;
}>();

const connectionStore = useConnectionStore();
const workspaceStore = useWorkspaceStore();

const filterQuery = ref('');
const isRefreshing = ref(false);
const refreshingConnId = ref<string | null>(null);
const expandedConns = reactive<Record<string, boolean>>({});
const expandedDbs = reactive<Record<string, boolean>>({});
const expandedTables = reactive<Record<string, boolean>>({});
const loadedColumns = reactive<Record<string, ColumnItem[]>>({});
const tablesList = ref<TableItem[]>([]);

// Inline rename state
const inlineEditingId = ref<string | null>(null);
const inlineEditingName = ref('');
const inlineInputRef = ref<HTMLInputElement | null>(null);

const inlineError = computed(() => {
  if (!inlineEditingId.value) return null;
  const trimmed = inlineEditingName.value.trim();
  if (!trimmed) {
    return '名稱不可為空';
  }
  if (connectionStore.isNameDuplicate(trimmed, inlineEditingId.value)) {
    return '此名稱已被使用';
  }
  return null;
});

function startInlineRename(conn: ConnectionProfile) {
  connContextMenu.visible = false;
  inlineEditingId.value = conn.id;
  inlineEditingName.value = conn.name;
  nextTick(() => {
    inlineInputRef.value?.focus();
    inlineInputRef.value?.select();
  });
}

async function saveInlineRename(conn: ConnectionProfile) {
  if (inlineError.value) return;
  const trimmed = inlineEditingName.value.trim();
  if (!trimmed) return;
  if (trimmed === conn.name) {
    inlineEditingId.value = null;
    return;
  }
  try {
    await connectionStore.renameConnection(conn.id, trimmed);
    inlineEditingId.value = null;
  } catch (err) {
    console.error('Rename failed:', err);
  }
}

function cancelInlineRename() {
  inlineEditingId.value = null;
  inlineEditingName.value = '';
}

function handleInlineBlur(conn: ConnectionProfile) {
  setTimeout(() => {
    if (inlineEditingId.value === conn.id) {
      if (!inlineError.value && inlineEditingName.value.trim() && inlineEditingName.value.trim() !== conn.name) {
        saveInlineRename(conn);
      } else {
        cancelInlineRename();
      }
    }
  }, 150);
}

// Delete connection state
const isDeleteModalOpen = ref(false);
const connToDelete = ref<ConnectionProfile | null>(null);

function handlePromptDelete(conn: ConnectionProfile) {
  connContextMenu.visible = false;
  connToDelete.value = conn;
  isDeleteModalOpen.value = true;
}

async function confirmDelete() {
  if (connToDelete.value) {
    try {
      await connectionStore.deleteConnection(connToDelete.value.id);
    } catch (err) {
      console.error('Failed to delete connection:', err);
    } finally {
      connToDelete.value = null;
      isDeleteModalOpen.value = false;
    }
  }
}

function cancelDelete() {
  connToDelete.value = null;
  isDeleteModalOpen.value = false;
}

// Table Context Menu
const contextMenu = reactive({
  visible: false,
  x: 0,
  y: 0,
  schema: '',
  tableName: '',
});

// Connection Context Menu
const connContextMenu = reactive<{
  visible: boolean;
  x: number;
  y: number;
  conn: ConnectionProfile | null;
}>({
  visible: false,
  x: 0,
  y: 0,
  conn: null,
});

onMounted(async () => {
  await connectionStore.loadConnections();
  if (connectionStore.activeConnectionId) {
    expandedConns[connectionStore.activeConnectionId] = true;
    expandedDbs[connectionStore.activeDatabase] = true;
    await loadTables();
  }
});

async function loadTables() {
  if (!connectionStore.activeConnectionId) return;
  try {
    tablesList.value = await schemaService.getTables(
      connectionStore.activeConnectionId,
      connectionStore.activeDatabase
    );
  } catch (err) {
    console.warn('Failed to load tables:', err);
  }
}

async function refreshCurrent() {
  isRefreshing.value = true;
  await connectionStore.refreshDatabases();
  await loadTables();
  isRefreshing.value = false;
}

async function handleRefreshConn(conn: ConnectionProfile) {
  connContextMenu.visible = false;
  refreshingConnId.value = conn.id;
  try {
    if (connectionStore.activeConnectionId !== conn.id) {
      await connectionStore.connect(conn.id);
      expandedConns[conn.id] = true;
    } else {
      await connectionStore.refreshDatabases();
    }
    await loadTables();
  } catch (err) {
    console.warn('Failed to refresh connection:', err);
  } finally {
    refreshingConnId.value = null;
  }
}

function handleEditConn(conn: ConnectionProfile) {
  connContextMenu.visible = false;
  emit('edit-connection', conn);
}

async function handleDisconnect() {
  connContextMenu.visible = false;
  try {
    await connectionStore.disconnect();
  } catch (err) {
    console.warn('Disconnect error:', err);
  }
}

const filteredTables = computed(() => {
  const q = filterQuery.value.trim().toLowerCase();
  if (!q) return tablesList.value;
  return tablesList.value.filter(
    (t: TableItem) => t.name.toLowerCase().includes(q) || t.schema.toLowerCase().includes(q)
  );
});

async function toggleConnection(connId: string) {
  if (inlineEditingId.value === connId) return;
  expandedConns[connId] = !expandedConns[connId];
  if (expandedConns[connId] && connectionStore.activeConnectionId !== connId) {
    await connectionStore.connect(connId);
    await loadTables();
  }
}

async function toggleDatabase(db: string) {
  expandedDbs[db] = !expandedDbs[db];
  if (expandedDbs[db]) {
    await connectionStore.switchDatabase(db);
    await loadTables();
  }
}

function tableKey(schema: string, tableName: string) {
  return `${schema}.${tableName}`;
}

function isTableExpanded(schema: string, tableName: string) {
  return !!expandedTables[tableKey(schema, tableName)];
}

async function toggleTable(schema: string, tableName: string) {
  const key = tableKey(schema, tableName);
  expandedTables[key] = !expandedTables[key];

  if (expandedTables[key] && !loadedColumns[key]) {
    if (connectionStore.activeConnectionId) {
      try {
        const cols = await schemaService.getColumns(
          connectionStore.activeConnectionId,
          schema,
          tableName,
          connectionStore.activeDatabase
        );
        loadedColumns[key] = cols;
      } catch (err) {
        console.warn('Failed to load columns:', err);
      }
    }
  }
}

function getTableColumns(schema: string, tableName: string) {
  return loadedColumns[tableKey(schema, tableName)] ?? [];
}

function openContextMenu(event: MouseEvent, schema: string, tableName: string) {
  connContextMenu.visible = false;
  contextMenu.visible = true;
  contextMenu.x = event.clientX;
  contextMenu.y = event.clientY;
  contextMenu.schema = schema;
  contextMenu.tableName = tableName;

  function closeMenu() {
    contextMenu.visible = false;
    document.removeEventListener('click', closeMenu);
  }
  setTimeout(() => {
    document.addEventListener('click', closeMenu);
  }, 0);
}

function openConnContextMenu(event: MouseEvent, conn: ConnectionProfile) {
  contextMenu.visible = false;
  connContextMenu.visible = true;
  connContextMenu.x = event.clientX;
  connContextMenu.y = event.clientY;
  connContextMenu.conn = conn;

  function closeMenu() {
    connContextMenu.visible = false;
    document.removeEventListener('click', closeMenu);
  }
  setTimeout(() => {
    document.addEventListener('click', closeMenu);
  }, 0);
}

function handleOpenData() {
  workspaceStore.addTableDataTab(contextMenu.schema, contextMenu.tableName);
  contextMenu.visible = false;
}

function handleGenerateSelect() {
  const sql = `SELECT TOP 1000\n  *\nFROM [${contextMenu.schema}].[${contextMenu.tableName}];\n`;
  workspaceStore.addSqlTab(sql, `${contextMenu.tableName}.sql`);
  contextMenu.visible = false;
}
</script>
