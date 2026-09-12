<template>
  <Teleport to="body">
    <Transition
      enter-active-class="transition duration-150 ease-out"
      enter-from-class="opacity-0 scale-95"
      enter-to-class="opacity-100 scale-100"
      leave-active-class="transition duration-100 ease-in"
      leave-from-class="opacity-100 scale-100"
      leave-to-class="opacity-0 scale-95"
    >
      <div
        v-if="isOpen"
        class="fixed inset-0 z-50 flex items-start justify-center pt-[10vh] px-4 bg-black/60 backdrop-blur-xs select-none"
        @click.self="closeModal"
        @keydown.esc="closeModal"
      >
        <div
          class="w-full max-w-2xl bg-dark-850 border border-dark-650 rounded-xl shadow-2xl flex flex-col overflow-hidden text-xs font-sans ring-1 ring-white/10"
          @click.stop
        >
          <!-- Search Header Bar -->
          <div class="p-3 border-b border-dark-700 bg-dark-900/60 flex flex-col space-y-2.5">
            <div class="flex items-center space-x-2.5">
              <Search class="w-4 h-4 text-brand-400 flex-shrink-0" />
              <input
                ref="searchInputRef"
                v-model="searchQuery"
                type="text"
                placeholder="尋找資料表、檢視表、預存程序、函數... (如 uslog 或 t: xxx)"
                class="flex-1 bg-transparent border-none text-sm text-dark-100 placeholder-dark-500 focus:outline-none font-mono"
                @keydown.down.prevent="navigateDown"
                @keydown.up.prevent="navigateUp"
                @keydown.enter="handleEnterKey($event)"
                @keydown.esc.prevent="closeModal"
              />
              <button
                v-if="searchQuery"
                type="button"
                @click="searchQuery = ''; searchInputRef?.focus()"
                class="p-1 text-dark-400 hover:text-dark-200 rounded transition-colors"
                title="清除搜尋"
              >
                <X class="w-3.5 h-3.5" />
              </button>

              <div class="h-4 w-px bg-dark-700 mx-0.5"></div>

              <!-- Refresh Button -->
              <button
                type="button"
                @click="refreshObjects"
                :disabled="isLoading"
                class="p-1.5 text-dark-400 hover:text-brand-300 rounded hover:bg-dark-750 transition-colors disabled:opacity-40"
                title="重新整理物件清單"
              >
                <RotateCw :class="['w-3.5 h-3.5', isLoading ? 'animate-spin text-brand-400' : '']" />
              </button>

              <!-- Close Button -->
              <button
                type="button"
                @click="closeModal"
                class="p-1.5 text-dark-400 hover:text-dark-200 rounded hover:bg-dark-750 transition-colors"
                title="關閉 (Esc)"
              >
                <X class="w-3.5 h-3.5" />
              </button>
            </div>

            <!-- Scope Bar: Connection & Database Selector + Filter Chips -->
            <div class="flex items-center justify-between text-xxs text-dark-400 pt-0.5">
              <!-- Left: Target Connection & Database Switcher -->
              <div class="flex items-center space-x-2">
                <span class="flex items-center space-x-1">
                  <Server class="w-3 h-3 text-emerald-400" />
                  <span class="text-dark-300 font-medium truncate max-w-[120px]">
                    {{ connectionStore.activeConnection?.name || '未連線' }}
                  </span>
                </span>
                <span>/</span>
                <div class="flex items-center space-x-1">
                  <Database class="w-3 h-3 text-amber-400" />
                  <select
                    v-if="availableDatabases.length > 0"
                    v-model="currentDatabase"
                    @change="handleDatabaseChange"
                    class="bg-dark-800 text-dark-200 border border-dark-700 rounded px-1.5 py-0.5 text-xxs font-mono focus:outline-none focus:border-brand-500 cursor-pointer"
                  >
                    <option v-for="db in availableDatabases" :key="db" :value="db">
                      {{ db }}
                    </option>
                  </select>
                  <span v-else class="text-dark-300 font-mono">{{ currentDatabase || 'master' }}</span>
                </div>
              </div>

              <!-- Right: Type Filter Chips -->
              <div class="flex items-center space-x-1">
                <button
                  v-for="chip in filterChips"
                  :key="chip.type"
                  type="button"
                  @click="activeTypeTab = chip.type"
                  :class="[
                    'px-2 py-0.5 rounded font-medium transition-colors cursor-pointer',
                    activeTypeTab === chip.type
                      ? 'bg-brand-500/25 text-brand-300 border border-brand-500/40'
                      : 'bg-dark-800 hover:bg-dark-750 text-dark-400 hover:text-dark-200 border border-dark-750'
                  ]"
                >
                  <span>{{ chip.label }}</span>
                  <span class="ml-1 opacity-70 font-mono">({{ chip.count }})</span>
                </button>
              </div>
            </div>
          </div>

          <!-- Loading Progress State -->
          <div
            v-if="isLoading"
            class="px-4 py-8 flex flex-col items-center justify-center space-y-2 text-dark-400"
          >
            <RotateCw class="w-5 h-5 animate-spin text-brand-400" />
            <span class="text-xs">正在載入資料庫物件...</span>
          </div>

          <!-- Empty State (No connection) -->
          <div
            v-else-if="!connectionStore.activeConnectionId || connectionStore.status !== 'connected'"
            class="px-4 py-12 flex flex-col items-center justify-center space-y-2 text-dark-400"
          >
            <Server class="w-8 h-8 text-dark-600 mb-1" />
            <span class="text-xs text-dark-300 font-medium">尚未連線至資料庫</span>
            <span class="text-xxs text-dark-500">請先於側邊欄或頂部選單建立或啟動伺服器連線</span>
          </div>

          <!-- Empty State (No matched objects) -->
          <div
            v-else-if="scoredResults.length === 0"
            class="px-4 py-12 flex flex-col items-center justify-center space-y-1.5 text-dark-400"
          >
            <Search class="w-7 h-7 text-dark-600 mb-1" />
            <span class="text-xs text-dark-300">找不到符合「{{ searchQuery }}」的物件</span>
            <span class="text-xxs text-dark-500">可嘗試使用縮寫或前綴（如 t: 資料表、p: 預存程序）</span>
          </div>

          <!-- Results Scrollable List -->
          <div
            v-else
            ref="resultsListRef"
            class="max-h-[380px] overflow-y-auto divide-y divide-dark-800/60 p-1 font-mono text-xs"
          >
            <div
              v-for="(res, idx) in scoredResults"
              :key="res.item.id"
              :ref="(el) => setItemRef(el, idx)"
              @mouseenter="activeIndex = idx"
              @click="handlePrimaryAction(res.item)"
              :class="[
                'flex items-center justify-between px-3 py-2 rounded-lg cursor-pointer transition-colors group relative',
                activeIndex === idx
                  ? 'bg-brand-500/20 text-dark-100 ring-1 ring-brand-500/30 shadow-xs'
                  : 'text-dark-300 hover:bg-dark-800/80 hover:text-dark-100'
              ]"
            >
              <!-- Left: Type Badge & Object Name with Highlights -->
              <div class="flex items-center space-x-2.5 min-w-0 flex-1 mr-3">
                <!-- Type Badge with Icon -->
                <div
                  :class="[
                    'flex items-center space-x-1 px-1.5 py-0.5 rounded text-xxs font-sans font-semibold uppercase tracking-wider flex-shrink-0',
                    res.item.type === 'table' ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30' :
                    res.item.type === 'view' ? 'bg-purple-500/15 text-purple-300 border border-purple-500/30' :
                    res.item.type === 'procedure' ? 'bg-amber-500/15 text-amber-300 border border-amber-500/30' :
                    'bg-sky-500/15 text-sky-300 border border-sky-500/30'
                  ]"
                >
                  <Table2 v-if="res.item.type === 'table'" class="w-3 h-3" />
                  <TableProperties v-else-if="res.item.type === 'view'" class="w-3 h-3" />
                  <Play v-else-if="res.item.type === 'procedure'" class="w-3 h-3 fill-current" />
                  <Code2 v-else class="w-3 h-3" />
                  <span>{{ res.item.type === 'table' ? 'TABLE' : res.item.type === 'view' ? 'VIEW' : res.item.type === 'procedure' ? 'PROC' : 'FUNC' }}</span>
                </div>

                <!-- Highlighted Name -->
                <div class="truncate flex items-baseline space-x-0.5">
                  <span class="text-dark-500 text-xxs">
                    <span
                      v-for="(chunk, cIdx) in getHighlightedSchemaChunks(res)"
                      :key="`sch-${cIdx}`"
                      :class="chunk.highlight ? 'text-amber-300 font-bold underline decoration-amber-400/80' : ''"
                    >{{ chunk.text }}</span>.</span>
                  <span class="font-medium text-dark-100">
                    <span
                      v-for="(chunk, cIdx) in getHighlightedNameChunks(res)"
                      :key="`nm-${cIdx}`"
                      :class="chunk.highlight ? 'text-amber-300 font-bold underline decoration-amber-400/80' : ''"
                    >{{ chunk.text }}</span>
                  </span>
                </div>
              </div>

              <!-- Right: Quick Action Buttons (Hover or Active) -->
              <div class="flex items-center space-x-1 flex-shrink-0">
                <!-- For Tables & Views: Open Data, Structure, SELECT -->
                <template v-if="res.item.type === 'table' || res.item.type === 'view'">
                  <button
                    type="button"
                    @click.stop="openTableData(res.item)"
                    class="px-2 py-0.5 rounded bg-dark-750 hover:bg-emerald-600 hover:text-white text-dark-300 text-xxs font-sans transition-colors flex items-center space-x-1"
                    title="開啟資料 (Enter)"
                  >
                    <Table2 class="w-3 h-3 text-emerald-400" />
                    <span>資料</span>
                  </button>

                  <button
                    type="button"
                    @click.stop="openTableStructure(res.item)"
                    class="px-2 py-0.5 rounded bg-dark-750 hover:bg-indigo-600 hover:text-white text-dark-300 text-xxs font-sans transition-colors flex items-center space-x-1"
                    title="開啟結構 (Shift + Enter)"
                  >
                    <TableProperties class="w-3 h-3 text-indigo-400" />
                    <span>結構</span>
                  </button>

                  <button
                    type="button"
                    @click.stop="generateSelectQuery(res.item)"
                    class="px-2 py-0.5 rounded bg-dark-750 hover:bg-brand-600 hover:text-white text-dark-300 text-xxs font-sans transition-colors flex items-center space-x-1"
                    title="產生 SELECT 腳本 (Ctrl + Enter)"
                  >
                    <FileCode class="w-3 h-3 text-brand-400" />
                    <span>SELECT</span>
                  </button>
                </template>

                <!-- For Stored Procedures: Definition, EXEC -->
                <template v-else-if="res.item.type === 'procedure'">
                  <button
                    type="button"
                    @click.stop="viewDefinition(res.item)"
                    class="px-2 py-0.5 rounded bg-dark-750 hover:bg-amber-600 hover:text-white text-dark-300 text-xxs font-sans transition-colors flex items-center space-x-1"
                    title="檢視定義 (Enter)"
                  >
                    <Code2 class="w-3 h-3 text-amber-400" />
                    <span>定義</span>
                  </button>

                  <button
                    type="button"
                    @click.stop="generateExecQuery(res.item)"
                    class="px-2 py-0.5 rounded bg-dark-750 hover:bg-emerald-600 hover:text-white text-dark-300 text-xxs font-sans transition-colors flex items-center space-x-1"
                    title="產生 EXEC 範本 (Ctrl + Enter)"
                  >
                    <Play class="w-3 h-3 text-emerald-400 fill-current" />
                    <span>EXEC</span>
                  </button>
                </template>

                <!-- For Functions: Definition, SELECT -->
                <template v-else-if="res.item.type === 'function'">
                  <button
                    type="button"
                    @click.stop="viewDefinition(res.item)"
                    class="px-2 py-0.5 rounded bg-dark-750 hover:bg-sky-600 hover:text-white text-dark-300 text-xxs font-sans transition-colors flex items-center space-x-1"
                    title="檢視定義 (Enter)"
                  >
                    <Code2 class="w-3 h-3 text-sky-400" />
                    <span>定義</span>
                  </button>

                  <button
                    type="button"
                    @click.stop="generateFuncSelectQuery(res.item)"
                    class="px-2 py-0.5 rounded bg-dark-750 hover:bg-brand-600 hover:text-white text-dark-300 text-xxs font-sans transition-colors flex items-center space-x-1"
                    title="產生 SELECT 範本 (Ctrl + Enter)"
                  >
                    <FileCode class="w-3 h-3 text-sky-400" />
                    <span>SELECT</span>
                  </button>
                </template>
              </div>
            </div>
          </div>

          <!-- Bottom Status & Keyboard Guide Footer -->
          <div class="h-9 px-3 border-t border-dark-700 bg-dark-900/90 flex items-center justify-between text-xxs text-dark-400">
            <!-- Left: Shortcut Key hints -->
            <div class="flex items-center space-x-3">
              <span class="flex items-center space-x-1">
                <kbd class="px-1 py-0.2 rounded bg-dark-750 text-dark-300 font-mono border border-dark-700">↑↓</kbd>
                <span>導航</span>
              </span>
              <span class="flex items-center space-x-1">
                <kbd class="px-1 py-0.2 rounded bg-dark-750 text-dark-300 font-mono border border-dark-700">↵</kbd>
                <span>開啟資料/定義</span>
              </span>
              <span class="flex items-center space-x-1">
                <kbd class="px-1 py-0.2 rounded bg-dark-750 text-dark-300 font-mono border border-dark-700">Shift+↵</kbd>
                <span>結構</span>
              </span>
              <span class="flex items-center space-x-1">
                <kbd class="px-1 py-0.2 rounded bg-dark-750 text-dark-300 font-mono border border-dark-700">Ctrl+↵</kbd>
                <span>產生腳本</span>
              </span>
              <span class="flex items-center space-x-1">
                <kbd class="px-1 py-0.2 rounded bg-dark-750 text-dark-300 font-mono border border-dark-700">Esc</kbd>
                <span>關閉</span>
              </span>
            </div>

            <!-- Right: Item Counter -->
            <div class="font-mono text-dark-500">
              顯示 <span class="text-dark-300 font-semibold">{{ scoredResults.length }}</span> / {{ totalMatchingCount }} 個物件
            </div>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, computed, watch, nextTick } from 'vue';
import {
  Search,
  X,
  RotateCw,
  Server,
  Database,
  Table2,
  TableProperties,
  Play,
  Code2,
  FileCode,
} from 'lucide-vue-next';
import { useConnectionStore } from '@/stores/connectionStore';
import { useWorkspaceStore } from '@/stores/workspaceStore';
import { useSchemaStore } from '@/stores/schemaStore';
import {
  filterAndRankQuickObjects,
  highlightMatchedChunks,
  type QuickFinderItem,
  type QuickFinderObjectType,
  type ScoredQuickFinderItem,
} from '@/utils/fuzzySearch';

const props = defineProps<{
  isOpen: boolean;
}>();

const emit = defineEmits<{
  (e: 'close'): void;
}>();

const connectionStore = useConnectionStore();
const workspaceStore = useWorkspaceStore();
const schemaStore = useSchemaStore();

const searchQuery = ref('');
const activeIndex = ref(0);
const activeTypeTab = ref<'all' | QuickFinderObjectType>('all');
const searchInputRef = ref<HTMLInputElement | null>(null);
const resultsListRef = ref<HTMLDivElement | null>(null);
const itemRefs = ref<Record<number, HTMLElement>>({});

function setItemRef(el: unknown, idx: number) {
  if (el && el instanceof HTMLElement) {
    itemRefs.value[idx] = el;
  }
}

const currentDatabase = ref('');

const availableDatabases = computed(() => {
  if (!connectionStore.activeConnectionId) return [];
  return connectionStore.getDatabases(connectionStore.activeConnectionId);
});

const isLoading = computed(() => {
  const cId = connectionStore.activeConnectionId;
  const db = currentDatabase.value || connectionStore.activeDatabase;
  if (!cId || !db) return false;
  const key = `${cId}:${db}`;
  return !!(schemaStore.loadingTablesByDb[key] || schemaStore.loadingRoutinesByDb[key]);
});

// All objects loaded for active connection & selected database
const rawObjects = computed<QuickFinderItem[]>(() => {
  const cId = connectionStore.activeConnectionId;
  const db = currentDatabase.value || connectionStore.activeDatabase;
  if (!cId || !db) return [];
  return schemaStore.getDatabaseObjects(cId, db);
});

const filterChips = computed(() => {
  const all = rawObjects.value;
  const tables = all.filter((o) => o.type === 'table').length;
  const views = all.filter((o) => o.type === 'view').length;
  const procs = all.filter((o) => o.type === 'procedure').length;
  const funcs = all.filter((o) => o.type === 'function').length;

  return [
    { type: 'all' as const, label: '全部', count: all.length },
    { type: 'table' as const, label: '資料表', count: tables },
    { type: 'view' as const, label: '檢視表', count: views },
    { type: 'procedure' as const, label: '預存程序', count: procs },
    { type: 'function' as const, label: '函數', count: funcs },
  ];
});

const scoredResults = computed<ScoredQuickFinderItem[]>(() => {
  return filterAndRankQuickObjects(
    rawObjects.value,
    searchQuery.value,
    activeTypeTab.value,
    100
  );
});

const totalMatchingCount = computed(() => {
  const all = rawObjects.value;
  if (activeTypeTab.value === 'all') return all.length;
  return all.filter((o) => o.type === activeTypeTab.value).length;
});

// Keep activeIndex within valid bounds when results change
watch(scoredResults, (newList) => {
  if (activeIndex.value >= newList.length) {
    activeIndex.value = 0;
  }
});

watch(
  () => props.isOpen,
  async (isOpen) => {
    if (isOpen) {
      currentDatabase.value = connectionStore.activeDatabase || 'master';
      activeIndex.value = 0;
      await nextTick();
      searchInputRef.value?.focus();
      searchInputRef.value?.select();

      const cId = connectionStore.activeConnectionId;
      const db = currentDatabase.value;
      if (cId && db && connectionStore.status === 'connected') {
        const key = `${cId}:${db}`;
        if (schemaStore.tablesByDb[key] === undefined || schemaStore.routinesByDb[key] === undefined) {
          schemaStore.ensureDatabaseObjectsLoaded(cId, db).catch((err) => {
            console.warn('[QuickFinder] Error loading objects:', err);
          });
        }
      }
    }
  }
);

function getHighlightedSchemaChunks(res: ScoredQuickFinderItem) {
  return highlightMatchedChunks(res.item.schema, res.schemaIndices);
}

function getHighlightedNameChunks(res: ScoredQuickFinderItem) {
  return highlightMatchedChunks(res.item.name, res.nameIndices);
}

async function handleDatabaseChange() {
  if (!currentDatabase.value || !connectionStore.activeConnectionId) return;
  try {
    await connectionStore.switchDatabase(currentDatabase.value);
    await schemaStore.ensureDatabaseObjectsLoaded(
      connectionStore.activeConnectionId,
      currentDatabase.value
    );
  } catch (err) {
    console.error('Failed to switch database in QuickFinder:', err);
  }
}

async function refreshObjects() {
  const cId = connectionStore.activeConnectionId;
  const db = currentDatabase.value || connectionStore.activeDatabase;
  if (cId && db) {
    await schemaStore.ensureDatabaseObjectsLoaded(cId, db, true);
  }
}

function navigateDown() {
  if (scoredResults.value.length === 0) return;
  activeIndex.value = (activeIndex.value + 1) % scoredResults.value.length;
  scrollActiveItemIntoView();
}

function navigateUp() {
  if (scoredResults.value.length === 0) return;
  activeIndex.value =
    (activeIndex.value - 1 + scoredResults.value.length) % scoredResults.value.length;
  scrollActiveItemIntoView();
}

function scrollActiveItemIntoView() {
  nextTick(() => {
    const el = itemRefs.value[activeIndex.value];
    if (el) {
      el.scrollIntoView({ block: 'nearest' });
    }
  });
}

function handleEnterKey(event: KeyboardEvent) {
  if (scoredResults.value.length === 0) return;
  const current = scoredResults.value[activeIndex.value]?.item;
  if (!current) return;

  event.preventDefault();

  if (event.shiftKey) {
    if (current.type === 'table' || current.type === 'view') {
      openTableStructure(current);
    } else {
      viewDefinition(current);
    }
    return;
  }

  if (event.ctrlKey || event.metaKey) {
    if (current.type === 'table' || current.type === 'view') {
      generateSelectQuery(current);
    } else if (current.type === 'procedure') {
      generateExecQuery(current);
    } else if (current.type === 'function') {
      generateFuncSelectQuery(current);
    }
    return;
  }

  handlePrimaryAction(current);
}

function handlePrimaryAction(item: QuickFinderItem) {
  if (item.type === 'table' || item.type === 'view') {
    openTableData(item);
  } else {
    viewDefinition(item);
  }
}

function openTableData(item: QuickFinderItem) {
  workspaceStore.addTableDataTab(item.schema, item.name, item.connId, item.database);
  closeModal();
}

function openTableStructure(item: QuickFinderItem) {
  workspaceStore.addTableStructureTab(item.schema, item.name, item.connId, item.database);
  closeModal();
}

function generateSelectQuery(item: QuickFinderItem) {
  const sql = `SELECT TOP 1000\n  *\nFROM [${item.database}].[${item.schema}].[${item.name}];\n`;
  workspaceStore.addSqlTab(sql, `${item.name}.sql`, item.connId, item.database);
  closeModal();
}

async function viewDefinition(item: QuickFinderItem) {
  try {
    const def = await schemaStore.getObjectDefinition(
      item.connId,
      item.database,
      item.schema,
      item.name
    );
    if (def) {
      workspaceStore.addSqlTab(def, `${item.schema}.${item.name}.sql`, item.connId, item.database);
      workspaceStore.showToast(`已載入 [${item.schema}].[${item.name}] 定義`, 'success', 2500);
    } else {
      const fallback = `USE [${item.database}];\nGO\n\nSELECT OBJECT_DEFINITION(OBJECT_ID(N'[${item.schema}].[${item.name}]')) AS [Definition];\n`;
      workspaceStore.addSqlTab(fallback, `${item.schema}.${item.name}.sql`, item.connId, item.database);
    }
  } catch (err) {
    console.error('Failed to view definition:', err);
  } finally {
    closeModal();
  }
}

function generateExecQuery(item: QuickFinderItem) {
  const sql = `-- 執行預存程序 [${item.schema}].[${item.name}]\nUSE [${item.database}];\nGO\n\nEXEC [${item.schema}].[${item.name}];\n`;
  workspaceStore.addSqlTab(sql, `EXEC_${item.name}.sql`, item.connId, item.database);
  closeModal();
}

function generateFuncSelectQuery(item: QuickFinderItem) {
  const sql = `-- 呼叫自訂函數 [${item.schema}].[${item.name}]\nUSE [${item.database}];\nGO\n\nSELECT [${item.schema}].[${item.name}]();\n`;
  workspaceStore.addSqlTab(sql, `FUNC_${item.name}.sql`, item.connId, item.database);
  closeModal();
}

function closeModal() {
  emit('close');
}
</script>
