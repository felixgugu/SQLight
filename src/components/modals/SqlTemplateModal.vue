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
        class="fixed inset-0 z-50 flex items-start justify-center pt-[5vh] px-4 bg-black/65 backdrop-blur-xs select-none"
        @click.self="closeModal"
        @keydown.esc="closeModal"
      >
        <div
          class="w-full max-w-5xl h-[84vh] bg-dark-850 border border-dark-650 rounded-xl shadow-2xl flex flex-col overflow-hidden text-xs font-sans ring-1 ring-white/10"
          @click.stop
        >
          <!-- Top Header & Search Area -->
          <div class="p-3.5 border-b border-dark-700 bg-dark-900/80 flex flex-col space-y-2.5 flex-shrink-0">
            <div class="flex items-center space-x-2.5">
              <BookOpen class="w-4 h-4 text-amber-400 flex-shrink-0" />
              <span class="text-sm font-semibold text-dark-100 flex items-center space-x-2">
                <span>常用 SQL 範本庫</span>
                <span class="text-xxs px-1.5 py-0.2 bg-dark-750 text-dark-300 rounded-full font-mono border border-dark-700">
                  {{ templateStore.allTemplates.length }}
                </span>
              </span>

              <div class="h-4 w-px bg-dark-700 mx-1"></div>

              <!-- Search Input -->
              <div class="flex-1 relative flex items-center">
                <Search class="w-3.5 h-3.5 text-brand-400 absolute left-2.5 pointer-events-none" />
                <input
                  ref="searchInputRef"
                  v-model="templateStore.searchQuery"
                  type="text"
                  placeholder="搜尋常用語法、CTE、遞迴、分頁、PIVOT、說明關鍵字... (如 cte, merge, json)"
                  class="w-full bg-dark-800 border border-dark-700 focus:border-brand-500 rounded-lg pl-8 pr-7 py-1.5 text-xs text-dark-100 placeholder-dark-500 focus:outline-none font-mono"
                  @keydown.down.prevent="navigateDown"
                  @keydown.up.prevent="navigateUp"
                  @keydown.enter="handleEnterKey"
                  @keydown.esc.prevent="closeModal"
                />
                <button
                  v-if="templateStore.searchQuery"
                  type="button"
                  @click="templateStore.searchQuery = ''; searchInputRef?.focus()"
                  class="absolute right-2 p-0.5 text-dark-400 hover:text-dark-200 rounded transition-colors"
                  title="清除搜尋"
                >
                  <X class="w-3 h-3" />
                </button>
              </div>

              <!-- Close Button -->
              <button
                type="button"
                @click="closeModal"
                class="p-1.5 text-dark-400 hover:text-dark-200 rounded hover:bg-dark-750 transition-colors"
                title="關閉 (Esc)"
              >
                <X class="w-4 h-4" />
              </button>
            </div>

            <!-- Category Filter Chips -->
            <div class="flex items-center justify-between text-xxs text-dark-400 pt-0.5">
              <div class="flex items-center space-x-1.5 overflow-x-auto">
                <button
                  v-for="chip in categoryChips"
                  :key="chip.category"
                  type="button"
                  @click="templateStore.activeCategory = chip.category"
                  :class="[
                    'px-2.5 py-1 rounded-md font-medium transition-colors cursor-pointer flex items-center space-x-1.5',
                    templateStore.activeCategory === chip.category
                      ? 'bg-brand-500/25 text-brand-300 border border-brand-500/50 shadow-xs'
                      : 'bg-dark-800 hover:bg-dark-750 text-dark-400 hover:text-dark-200 border border-dark-750'
                  ]"
                >
                  <span>{{ chip.label }}</span>
                  <span class="text-xxs opacity-70 font-mono">({{ chip.count }})</span>
                </button>
              </div>

              <!-- Reload & Add New Buttons -->
              <div class="flex items-center space-x-1.5 flex-shrink-0">
                <button
                  type="button"
                  @click="handleReloadFromDisk"
                  :disabled="templateStore.isLoading"
                  class="px-2 py-1 bg-dark-800 hover:bg-dark-750 text-dark-300 hover:text-dark-100 rounded border border-dark-700 transition-colors cursor-pointer flex items-center space-x-1"
                  title="從應用程式同層檔案 (sql_custom_templates.json) 重新載入自訂語法"
                >
                  <RotateCw :class="['w-3 h-3 text-brand-400', templateStore.isLoading ? 'animate-spin' : '']" />
                  <span>重新載入</span>
                </button>

                <button
                  type="button"
                  @click="openAddTemplateModal"
                  class="px-2 py-1 bg-brand-600 hover:bg-brand-500 text-white rounded font-medium transition-colors cursor-pointer flex items-center space-x-1 shadow-xs"
                  title="新增自訂 SQL 範本並儲存至應用程式同層檔案"
                >
                  <Plus class="w-3 h-3" />
                  <span>＋ 新增自訂範本</span>
                </button>
              </div>
            </div>
          </div>

          <!-- Main Content Area: Split View (Left: List, Right: Preview) -->
          <div class="flex-1 flex overflow-hidden min-h-0 divide-x divide-dark-750">
            <!-- Left Pane: Templates List (40%) -->
            <div class="w-[40%] flex flex-col overflow-hidden bg-dark-900/40">
              <div class="px-3 py-1.5 border-b border-dark-750/70 text-xxs text-dark-400 flex items-center justify-between">
                <span>搜尋結果 ({{ templateStore.filteredTemplates.length }})</span>
                <span class="text-dark-500">按 ↑↓ 選擇 · Enter 插入</span>
              </div>

              <!-- Scrollable List -->
              <div
                v-if="templateStore.filteredTemplates.length > 0"
                ref="listContainerRef"
                class="flex-1 overflow-y-auto p-1.5 space-y-1"
              >
                <div
                  v-for="(tpl, idx) in templateStore.filteredTemplates"
                  :key="tpl.id"
                  :ref="(el) => setItemRef(el, idx)"
                  @click="selectTemplate(tpl)"
                  @mouseenter="hoverIndex = idx"
                  :class="[
                    'p-2.5 rounded-lg cursor-pointer transition-all border text-left group relative',
                    templateStore.selectedTemplate?.id === tpl.id
                      ? 'bg-brand-500/15 border-brand-500/40 text-dark-100 ring-1 ring-brand-500/30 shadow-xs'
                      : 'bg-dark-800/60 hover:bg-dark-800 border-dark-750/60 hover:border-dark-700 text-dark-300 hover:text-dark-200'
                  ]"
                >
                  <div class="flex items-center justify-between space-x-1 mb-1">
                    <!-- Category Badge -->
                    <div class="flex items-center space-x-1.5 min-w-0">
                      <span
                        :class="[
                          'px-1.5 py-0.2 rounded text-[10px] font-sans font-semibold uppercase tracking-wider flex-shrink-0 border',
                          getCategoryBadgeClass(tpl.category, tpl.isCustom)
                        ]"
                      >
                        {{ tpl.categoryLabel || tpl.category }}
                      </span>

                      <span
                        v-if="tpl.isCustom"
                        class="px-1.5 py-0.2 rounded text-[10px] font-sans bg-rose-500/15 text-rose-300 border border-rose-500/30 font-semibold"
                      >
                        自訂文件
                      </span>
                    </div>

                    <span class="text-dark-500 text-xxs font-mono flex-shrink-0">
                      #{{ idx + 1 }}
                    </span>
                  </div>

                  <!-- Template Title -->
                  <div class="font-medium text-xs text-dark-100 group-hover:text-brand-300 transition-colors line-clamp-1 mb-1">
                    {{ tpl.title }}
                  </div>

                  <!-- Short Description -->
                  <div class="text-xxs text-dark-400 line-clamp-2 leading-relaxed">
                    {{ tpl.description }}
                  </div>

                  <!-- Tags -->
                  <div v-if="tpl.tags && tpl.tags.length > 0" class="flex flex-wrap gap-1 mt-1.5">
                    <span
                      v-for="tag in tpl.tags.slice(0, 3)"
                      :key="tag"
                      class="text-[10px] px-1 py-0.2 bg-dark-750/80 text-dark-400 rounded"
                    >
                      #{{ tag }}
                    </span>
                  </div>
                </div>
              </div>

              <!-- Empty State -->
              <div
                v-else
                class="flex-1 flex flex-col items-center justify-center p-6 text-center space-y-2 text-dark-400"
              >
                <Search class="w-8 h-8 text-dark-600 mb-1" />
                <span class="text-xs text-dark-300 font-medium">找不到符合的範本</span>
                <span class="text-xxs text-dark-500 max-w-xs">
                  嘗試輸入其他關鍵字，或切換至「全部」分類檢視完整語法清單
                </span>
                <button
                  type="button"
                  @click="templateStore.searchQuery = ''; templateStore.activeCategory = 'all'"
                  class="mt-2 px-2.5 py-1 text-xxs bg-dark-800 hover:bg-dark-750 text-dark-300 rounded border border-dark-700 transition-colors"
                >
                  重設搜尋條件
                </button>
              </div>
            </div>

            <!-- Right Pane: Preview & Actions (60%) -->
            <div class="w-[60%] flex flex-col overflow-hidden bg-dark-900/70">
              <template v-if="templateStore.selectedTemplate">
                <!-- Header / Action Bar -->
                <div class="p-3.5 border-b border-dark-750 bg-dark-850/60 flex items-center justify-between flex-shrink-0">
                  <div class="min-w-0 flex-1 pr-3">
                    <div class="flex items-center space-x-2 mb-1">
                      <span
                        :class="[
                          'px-1.5 py-0.2 rounded text-xxs font-semibold uppercase tracking-wider border',
                          getCategoryBadgeClass(templateStore.selectedTemplate.category, templateStore.selectedTemplate.isCustom)
                        ]"
                      >
                        {{ templateStore.selectedTemplate.categoryLabel || templateStore.selectedTemplate.category }}
                      </span>
                      <span
                        v-if="templateStore.selectedTemplate.isCustom"
                        class="px-1.5 py-0.2 rounded text-xxs bg-rose-500/15 text-rose-300 border border-rose-500/30 font-semibold"
                      >
                        外部自訂檔案
                      </span>
                    </div>
                    <h3 class="text-sm font-semibold text-dark-100 truncate">
                      {{ templateStore.selectedTemplate.title }}
                    </h3>
                  </div>

                  <!-- Action Buttons -->
                  <div class="flex items-center space-x-1.5 flex-shrink-0">
                    <!-- Copy Button -->
                    <button
                      type="button"
                      @click="copyCode(templateStore.selectedTemplate.code)"
                      class="px-2.5 py-1.5 bg-dark-800 hover:bg-dark-750 text-dark-200 rounded border border-dark-700 transition-colors flex items-center space-x-1 cursor-pointer"
                      title="複製語法至剪貼簿"
                    >
                      <Check v-if="hasCopied" class="w-3.5 h-3.5 text-emerald-400" />
                      <Copy v-else class="w-3.5 h-3.5 text-dark-400" />
                      <span>{{ hasCopied ? '已複製' : '複製' }}</span>
                    </button>

                    <!-- Open in New Tab Button -->
                    <button
                      type="button"
                      @click="openInNewTab(templateStore.selectedTemplate)"
                      class="px-2.5 py-1.5 bg-dark-800 hover:bg-dark-750 text-dark-200 rounded border border-dark-700 transition-colors flex items-center space-x-1 cursor-pointer"
                      title="在新查詢分頁載入此範本"
                    >
                      <FilePlus class="w-3.5 h-3.5 text-brand-400" />
                      <span>新分頁開啟</span>
                    </button>

                    <!-- Insert at Cursor (Primary) -->
                    <button
                      type="button"
                      @click="insertIntoEditor(templateStore.selectedTemplate)"
                      class="px-3 py-1.5 bg-brand-600 hover:bg-brand-500 text-white rounded font-medium transition-colors flex items-center space-x-1.5 cursor-pointer shadow-xs"
                      title="將範本直接插入目前查詢編輯器的游標位置 (Enter)"
                    >
                      <CornerDownLeft class="w-3.5 h-3.5" />
                      <span>插入到目前編輯點</span>
                    </button>

                    <!-- If Custom: Edit / Delete -->
                    <template v-if="templateStore.selectedTemplate.isCustom">
                      <button
                        type="button"
                        @click="openEditTemplateModal(templateStore.selectedTemplate)"
                        class="p-1.5 text-dark-400 hover:text-amber-300 hover:bg-dark-800 rounded border border-dark-750 transition-colors"
                        title="編輯此自訂範本"
                      >
                        <Edit3 class="w-3.5 h-3.5" />
                      </button>

                      <button
                        type="button"
                        @click="handleDeleteTemplate(templateStore.selectedTemplate.id)"
                        class="p-1.5 text-dark-400 hover:text-rose-400 hover:bg-dark-800 rounded border border-dark-750 transition-colors"
                        title="刪除此自訂範本"
                      >
                        <Trash2 class="w-3.5 h-3.5" />
                      </button>
                    </template>
                  </div>
                </div>

                <!-- Preview Content Area -->
                <div class="flex-1 overflow-y-auto p-4 space-y-3.5">
                  <!-- Usage Notes / Description Card -->
                  <div class="p-3 bg-dark-800/80 border border-dark-700/80 rounded-lg text-dark-300 text-xs leading-relaxed space-y-1.5">
                    <div class="flex items-center space-x-1.5 font-semibold text-amber-300 text-xxs uppercase tracking-wider">
                      <Info class="w-3.5 h-3.5" />
                      <span>說明與最佳實踐 (Usage Notes & Guidelines)</span>
                    </div>
                    <div class="text-dark-200">
                      {{ templateStore.selectedTemplate.description }}
                    </div>
                    <!-- Tags -->
                    <div v-if="templateStore.selectedTemplate.tags.length > 0" class="flex flex-wrap gap-1 pt-1">
                      <span
                        v-for="t in templateStore.selectedTemplate.tags"
                        :key="t"
                        class="text-xxs px-1.5 py-0.5 bg-dark-750 text-dark-400 rounded border border-dark-700/60 font-mono"
                      >
                        #{{ t }}
                      </span>
                    </div>
                  </div>

                  <!-- SQL Code View Box -->
                  <div class="space-y-1.5">
                    <div class="flex items-center justify-between text-xxs text-dark-400 font-mono">
                      <span>SQL 程式碼預覽 (T-SQL Syntax):</span>
                      <span>按 Enter 立即插入至編輯器游標處</span>
                    </div>

                    <div class="relative bg-dark-950 border border-dark-700 rounded-lg overflow-hidden group">
                      <pre
                        class="p-3.5 text-xs font-mono text-dark-100 overflow-x-auto select-text leading-relaxed whitespace-pre font-light"
                      ><code>{{ templateStore.selectedTemplate.code }}</code></pre>
                    </div>
                  </div>
                </div>
              </template>

              <!-- No Selection Placeholder -->
              <div
                v-else
                class="flex-1 flex flex-col items-center justify-center p-8 text-center text-dark-500 space-y-2"
              >
                <BookOpen class="w-10 h-10 text-dark-700" />
                <span class="text-xs text-dark-400">請從左側選擇要預覽或插入的範本</span>
              </div>
            </div>
          </div>

          <!-- Bottom Footer: File Info & Keyboard Shortcuts Bar -->
          <div class="px-3.5 py-2 border-t border-dark-700 bg-dark-900/90 flex items-center justify-between text-xxs text-dark-400 flex-shrink-0">
            <!-- Left: Co-located File Information -->
            <div class="flex items-center space-x-2 min-w-0 flex-1 mr-4">
              <span class="flex items-center space-x-1 text-dark-400 flex-shrink-0">
                <FileCode class="w-3 h-3 text-brand-400" />
                <span>自訂範本文件:</span>
              </span>
              <span
                class="text-dark-300 font-mono truncate max-w-md bg-dark-800 px-1.5 py-0.5 rounded border border-dark-750 select-text"
                :title="templateStore.customFilePath || 'sql_custom_templates.json'"
              >
                {{ templateStore.customFilePath || 'sql_custom_templates.json (同層目錄)' }}
              </span>

              <button
                type="button"
                @click="handleRevealInExplorer"
                class="px-2 py-0.5 bg-dark-800 hover:bg-dark-750 text-dark-300 hover:text-dark-100 rounded border border-dark-700 transition-colors flex items-center space-x-1 flex-shrink-0 cursor-pointer"
                title="在 Windows 檔案總管中開啟並反白此自訂語法檔案"
              >
                <Folder class="w-3 h-3 text-amber-400" />
                <span>在檔案總管顯示</span>
              </button>
            </div>

            <!-- Right: Keyboard Hints -->
            <div class="flex items-center space-x-2.5 flex-shrink-0 text-dark-400">
              <span><kbd class="px-1 py-0.5 bg-dark-800 border border-dark-700 rounded text-dark-300 font-mono">↑</kbd> <kbd class="px-1 py-0.5 bg-dark-800 border border-dark-700 rounded text-dark-300 font-mono">↓</kbd> 選擇</span>
              <span><kbd class="px-1 py-0.5 bg-dark-800 border border-dark-700 rounded text-dark-300 font-mono">Enter</kbd> 插入游標處</span>
              <span><kbd class="px-1 py-0.5 bg-dark-800 border border-dark-700 rounded text-dark-300 font-mono">Esc</kbd> 關閉</span>
            </div>
          </div>
        </div>

        <!-- Inline Sub-Modal: Add / Edit Custom Template -->
        <div
          v-if="isCustomFormOpen"
          class="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs select-none"
          @click.self="isCustomFormOpen = false"
        >
          <div
            class="w-full max-w-xl bg-dark-850 border border-dark-650 rounded-xl shadow-2xl flex flex-col overflow-hidden text-xs font-sans ring-1 ring-white/10"
            @click.stop
          >
            <div class="px-4 py-3 border-b border-dark-700 bg-dark-900 flex items-center justify-between">
              <span class="font-semibold text-dark-100 flex items-center space-x-2">
                <Plus class="w-4 h-4 text-brand-400" />
                <span>{{ editingTemplateId ? '編輯自訂 SQL 範本' : '新增自訂 SQL 範本' }}</span>
              </span>
              <button
                type="button"
                @click="isCustomFormOpen = false"
                class="p-1 text-dark-400 hover:text-dark-200 rounded"
              >
                <X class="w-4 h-4" />
              </button>
            </div>

            <form @submit.prevent="saveCustomTemplateForm" class="p-4 space-y-3">
              <!-- Title Field -->
              <div class="space-y-1">
                <label class="block text-dark-300 font-medium">範本標題 <span class="text-rose-400">*</span></label>
                <input
                  v-model="formState.title"
                  required
                  type="text"
                  placeholder="例如: ERP 訂單每日彙總批次查詢"
                  class="w-full bg-dark-800 border border-dark-700 focus:border-brand-500 rounded px-2.5 py-1.5 text-xs text-dark-100 focus:outline-none"
                />
              </div>

              <!-- Category & Tags Row -->
              <div class="grid grid-cols-2 gap-3">
                <div class="space-y-1">
                  <label class="block text-dark-300 font-medium">範本分類</label>
                  <select
                    v-model="formState.category"
                    class="w-full bg-dark-800 border border-dark-700 focus:border-brand-500 rounded px-2.5 py-1.5 text-xs text-dark-100 focus:outline-none cursor-pointer"
                  >
                    <option value="custom">自訂範本</option>
                    <option value="basic">常用語法</option>
                    <option value="cte">CTE 語法</option>
                    <option value="advanced">進階用法</option>
                    <option value="maintenance">診斷維護</option>
                  </select>
                </div>

                <div class="space-y-1">
                  <label class="block text-dark-300 font-medium">標籤 (逗號分隔)</label>
                  <input
                    v-model="formState.tagsInput"
                    type="text"
                    placeholder="如: erp, 報表, sync"
                    class="w-full bg-dark-800 border border-dark-700 focus:border-brand-500 rounded px-2.5 py-1.5 text-xs text-dark-100 focus:outline-none font-mono"
                  />
                </div>
              </div>

              <!-- Description Field -->
              <div class="space-y-1">
                <label class="block text-dark-300 font-medium">使用情境與說明</label>
                <textarea
                  v-model="formState.description"
                  rows="2"
                  placeholder="描述此範本的適用情境、注意事項或需替換的欄位與參數"
                  class="w-full bg-dark-800 border border-dark-700 focus:border-brand-500 rounded px-2.5 py-1.5 text-xs text-dark-100 focus:outline-none resize-none leading-relaxed"
                />
              </div>

              <!-- SQL Code Field -->
              <div class="space-y-1">
                <label class="block text-dark-300 font-medium">SQL 語法內容 <span class="text-rose-400">*</span></label>
                <textarea
                  v-model="formState.code"
                  required
                  rows="7"
                  placeholder="SELECT * FROM dbo.YourTable..."
                  class="w-full bg-dark-950 border border-dark-700 focus:border-brand-500 rounded p-2.5 text-xs text-dark-100 font-mono focus:outline-none resize-y leading-relaxed"
                />
              </div>

              <!-- Modal Footer -->
              <div class="pt-2 flex items-center justify-between border-t border-dark-750">
                <span class="text-xxs text-dark-500">
                  將儲存至應用程式同層檔案 (sql_custom_templates.json)
                </span>
                <div class="flex items-center space-x-2">
                  <button
                    type="button"
                    @click="isCustomFormOpen = false"
                    class="px-3 py-1.5 bg-dark-800 hover:bg-dark-750 text-dark-300 rounded border border-dark-700 transition-colors"
                  >
                    取消
                  </button>
                  <button
                    type="submit"
                    class="px-3.5 py-1.5 bg-brand-600 hover:bg-brand-500 text-white rounded font-medium transition-colors shadow-xs"
                  >
                    儲存範本
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, reactive, computed, watch, nextTick } from 'vue';
import {
  BookOpen,
  Search,
  X,
  Plus,
  RotateCw,
  Copy,
  Check,
  FilePlus,
  CornerDownLeft,
  Info,
  FileCode,
  Folder,
  Edit3,
  Trash2,
} from 'lucide-vue-next';
import { useSqlTemplateStore } from '@/stores/sqlTemplateStore';
import { useWorkspaceStore } from '@/stores/workspaceStore';
import type { SqlTemplate, SqlTemplateCategory } from '@/types/sqlTemplate';

const props = defineProps<{
  isOpen: boolean;
}>();

const emit = defineEmits<{
  (e: 'close'): void;
  (e: 'insert', template: SqlTemplate): void;
  (e: 'open-in-new-tab', template: SqlTemplate): void;
}>();

const templateStore = useSqlTemplateStore();
const workspaceStore = useWorkspaceStore();

const searchInputRef = ref<HTMLInputElement | null>(null);
const listContainerRef = ref<HTMLDivElement | null>(null);
const itemRefs = ref<HTMLElement[]>([]);

const hoverIndex = ref<number>(0);
const hasCopied = ref<boolean>(false);
let copyTimer: ReturnType<typeof setTimeout> | null = null;

// Sub-Modal State for Custom Template Form
const isCustomFormOpen = ref(false);
const editingTemplateId = ref<string | null>(null);
const formState = reactive({
  title: '',
  category: 'custom' as SqlTemplateCategory,
  tagsInput: '',
  description: '',
  code: '',
});

function setItemRef(el: unknown, idx: number) {
  if (el) {
    itemRefs.value[idx] = el as HTMLElement;
  }
}

const categoryChips = computed<{ category: SqlTemplateCategory; label: string; count: number }[]>(() => {
  const counts = templateStore.categoryCounts;
  return [
    { category: 'all', label: '全部', count: counts.all },
    { category: 'basic', label: '常用語法', count: counts.basic },
    { category: 'cte', label: 'CTE 語法', count: counts.cte },
    { category: 'advanced', label: '進階用法', count: counts.advanced },
    { category: 'maintenance', label: '診斷維護', count: counts.maintenance },
    { category: 'custom', label: '自訂文件', count: counts.custom },
  ];
});

function getCategoryBadgeClass(category: SqlTemplateCategory, isCustom?: boolean): string {
  if (isCustom || category === 'custom') {
    return 'bg-rose-500/15 text-rose-300 border-rose-500/30';
  }
  switch (category) {
    case 'basic':
      return 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30';
    case 'cte':
      return 'bg-purple-500/15 text-purple-300 border-purple-500/30';
    case 'advanced':
      return 'bg-amber-500/15 text-amber-300 border-amber-500/30';
    case 'maintenance':
      return 'bg-sky-500/15 text-sky-300 border-sky-500/30';
    default:
      return 'bg-dark-750 text-dark-300 border-dark-700';
  }
}

function closeModal() {
  emit('close');
}

function selectTemplate(tpl: SqlTemplate) {
  templateStore.selectedTemplateId = tpl.id;
}

function navigateDown() {
  const list = templateStore.filteredTemplates;
  if (list.length === 0) return;
  const currIdx = list.findIndex((t) => t.id === templateStore.selectedTemplate?.id);
  const nextIdx = (currIdx + 1) % list.length;
  const target = list[nextIdx];
  if (target) {
    templateStore.selectedTemplateId = target.id;
    scrollToItem(nextIdx);
  }
}

function navigateUp() {
  const list = templateStore.filteredTemplates;
  if (list.length === 0) return;
  const currIdx = list.findIndex((t) => t.id === templateStore.selectedTemplate?.id);
  const prevIdx = (currIdx - 1 + list.length) % list.length;
  const target = list[prevIdx];
  if (target) {
    templateStore.selectedTemplateId = target.id;
    scrollToItem(prevIdx);
  }
}


function scrollToItem(idx: number) {
  nextTick(() => {
    const el = itemRefs.value[idx];
    if (el) {
      el.scrollIntoView({ block: 'nearest' });
    }
  });
}

function handleEnterKey() {
  if (templateStore.selectedTemplate) {
    insertIntoEditor(templateStore.selectedTemplate);
  }
}

function insertIntoEditor(template: SqlTemplate) {
  emit('insert', template);
  closeModal();
}

function openInNewTab(template: SqlTemplate) {
  emit('open-in-new-tab', template);
  closeModal();
}

async function copyCode(code: string) {
  try {
    await navigator.clipboard.writeText(code);
    hasCopied.value = true;
    if (copyTimer) clearTimeout(copyTimer);
    copyTimer = setTimeout(() => {
      hasCopied.value = false;
    }, 2000);
    workspaceStore.showToast('已複製範本語法至剪貼簿', 'success', 2000);
  } catch (e) {
    console.warn('Failed to copy code:', e);
  }
}

async function handleReloadFromDisk() {
  await templateStore.loadTemplates(true);
  workspaceStore.showToast('已從 sql_custom_templates.json 重新載入最新語法', 'success', 2500);
}

async function handleRevealInExplorer() {
  await templateStore.openInExplorer();
  workspaceStore.showToast('已在檔案總管中定位自訂語法檔案', 'info', 2500);
}

function openAddTemplateModal() {
  editingTemplateId.value = null;
  formState.title = '';
  formState.category = 'custom';
  formState.tagsInput = '';
  formState.description = '';
  formState.code = '';
  isCustomFormOpen.value = true;
}

function openEditTemplateModal(tpl: SqlTemplate) {
  editingTemplateId.value = tpl.id;
  formState.title = tpl.title;
  formState.category = tpl.category;
  formState.tagsInput = tpl.tags.join(', ');
  formState.description = tpl.description;
  formState.code = tpl.code;
  isCustomFormOpen.value = true;
}

async function saveCustomTemplateForm() {
  const tags = formState.tagsInput
    .split(',')
    .map((t) => t.trim())
    .filter((t) => Boolean(t));

  const categoryLabels: Record<string, string> = {
    custom: '自訂範本',
    basic: '常用語法',
    cte: 'CTE 語法',
    advanced: '進階用法',
    maintenance: '診斷維護',
  };

  if (editingTemplateId.value) {
    await templateStore.updateCustomTemplate(editingTemplateId.value, {
      title: formState.title.trim(),
      category: formState.category,
      categoryLabel: categoryLabels[formState.category] || '自訂範本',
      tags,
      description: formState.description.trim(),
      code: formState.code.trim(),
    });
    workspaceStore.showToast('已更新自訂範本至 sql_custom_templates.json', 'success', 2200);
  } else {
    await templateStore.addCustomTemplate({
      title: formState.title.trim(),
      category: formState.category,
      categoryLabel: categoryLabels[formState.category] || '自訂範本',
      tags,
      description: formState.description.trim(),
      code: formState.code.trim(),
    });
    workspaceStore.showToast('已新增自訂範本至 sql_custom_templates.json', 'success', 2200);
  }

  isCustomFormOpen.value = false;
}

async function handleDeleteTemplate(id: string) {
  if (confirm('確定要自 sql_custom_templates.json 刪除此自訂範本嗎？')) {
    await templateStore.deleteCustomTemplate(id);
    workspaceStore.showToast('已刪除該自訂範本', 'info', 2200);
  }
}

watch(
  () => props.isOpen,
  (open) => {
    if (open) {
      templateStore.loadTemplates();
      nextTick(() => {
        searchInputRef.value?.focus();
      });
    }
  }
);
</script>
