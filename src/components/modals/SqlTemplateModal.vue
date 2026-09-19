<template>
  <!-- Main Template Explorer Dialog -->
  <Dialog
    :visible="isOpen"
    @update:visible="(val) => !val && closeModal()"
    modal
    :closable="false"
    :dismissableMask="true"
    :showHeader="false"
    class="w-full max-w-5xl h-[84vh] !bg-dark-850 !border !border-dark-650 !rounded-xl shadow-2xl overflow-hidden ring-1 ring-white/10"
    contentClass="!p-0 !bg-dark-850 h-full flex flex-col"
  >
    <!-- Top Header & Search Area -->
    <div class="p-3.5 border-b border-dark-700 bg-dark-900/80 flex flex-col space-y-2.5 flex-shrink-0">
      <div class="flex items-center space-x-2.5">
        <i class="pi pi-book text-amber-400 text-base flex-shrink-0"></i>
        <span class="text-sm font-semibold text-dark-100 flex items-center space-x-2">
          <span>常用 SQL 範本庫</span>
          <Tag :value="templateStore.allTemplates.length" severity="secondary" class="!font-mono !text-xxs !px-1.5 !py-0.2" />
        </span>

        <div class="h-4 w-px bg-dark-700 mx-1"></div>

        <!-- Search Input with IconField -->
        <IconField class="flex-1">
          <InputIcon class="pi pi-search text-brand-400" />
          <InputText
            ref="searchInputRef"
            v-model="templateStore.searchQuery"
            type="text"
            placeholder="搜尋常用語法、CTE、遞迴、分頁、PIVOT、說明關鍵字... (如 cte, merge, json)"
            class="w-full !bg-dark-800 !border-dark-700 font-mono !text-xs text-dark-100 placeholder-dark-500"
            @keydown.down.prevent="navigateDown"
            @keydown.up.prevent="navigateUp"
            @keydown.enter="handleEnterKey"
            @keydown.esc.prevent="closeModal"
          />
        </IconField>

        <Button
          v-if="templateStore.searchQuery"
          type="button"
          icon="pi pi-times"
          text
          size="small"
          severity="secondary"
          @click="clearSearch"
          v-tooltip.top="'清除搜尋'"
          class="!w-7 !h-7 !p-0 !rounded-md !border-0 hover:!bg-dark-750"
        />

        <!-- Close Button -->
        <Button
          type="button"
          icon="pi pi-times"
          text
          size="small"
          severity="secondary"
          @click="closeModal"
          v-tooltip.top="'關閉 (Esc)'"
          class="!w-7 !h-7 !p-0 !rounded-md !border-0 !shadow-none hover:!bg-rose-500/20 hover:!text-rose-400"
        />
      </div>

      <!-- Category Filter Chips -->
      <div class="flex items-center justify-between text-xxs text-dark-400 pt-0.5">
        <div class="flex items-center space-x-1.5 overflow-x-auto">
          <Button
            v-for="chip in categoryChips"
            :key="chip.category"
            type="button"
            size="small"
            :severity="templateStore.activeCategory === chip.category ? 'primary' : 'secondary'"
            :variant="templateStore.activeCategory === chip.category ? undefined : 'outlined'"
            @click="templateStore.activeCategory = chip.category"
            class="!text-xxs !py-1 !px-2.5"
          >
            <span>{{ chip.label }}</span>
            <span class="ml-1 opacity-70 font-mono">({{ chip.count }})</span>
          </Button>
        </div>

        <!-- Reload & Add New Buttons -->
        <div class="flex items-center space-x-1.5 flex-shrink-0">
          <Button
            type="button"
            :icon="templateStore.isLoading ? 'pi pi-spin pi-spinner' : 'pi pi-refresh'"
            label="重新載入"
            size="small"
            severity="secondary"
            outlined
            @click="handleReloadFromDisk"
            :disabled="templateStore.isLoading"
            v-tooltip.top="'從應用程式同層檔案 (sql_custom_templates.json) 重新載入自訂語法'"
            class="!text-xxs !py-1 !px-2"
          />

          <Button
            type="button"
            icon="pi pi-plus"
            label="新增自訂範本"
            size="small"
            severity="primary"
            @click="openAddTemplateModal"
            v-tooltip.top="'新增自訂 SQL 範本並儲存至應用程式同層檔案'"
            class="!text-xxs !py-1 !px-2.5"
          />
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
                <Tag
                  :severity="getCategorySeverity(tpl.category, tpl.isCustom)"
                  :value="tpl.categoryLabel || tpl.category"
                  class="!text-[10px] !px-1.5 !py-0.2 uppercase tracking-wider"
                />

                <Tag
                  v-if="tpl.isCustom"
                  severity="danger"
                  value="自訂文件"
                  class="!text-[10px] !px-1.5 !py-0.2"
                />
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
          <i class="pi pi-search text-3xl text-dark-600 mb-1"></i>
          <span class="text-xs text-dark-300 font-medium">找不到符合的範本</span>
          <span class="text-xxs text-dark-500 max-w-xs">
            嘗試輸入其他關鍵字，或切換至「全部」分類檢視完整語法清單
          </span>
          <Button
            type="button"
            label="重設搜尋條件"
            size="small"
            severity="secondary"
            outlined
            @click="templateStore.searchQuery = ''; templateStore.activeCategory = 'all'"
            class="mt-2 !text-xxs !py-1 !px-2.5"
          />
        </div>
      </div>

      <!-- Right Pane: Preview & Actions (60%) -->
      <div class="w-[60%] flex flex-col overflow-hidden bg-dark-900/70">
        <template v-if="templateStore.selectedTemplate">
          <!-- Header / Action Bar -->
          <div class="p-3.5 border-b border-dark-750 bg-dark-850/60 flex items-center justify-between flex-shrink-0">
            <div class="min-w-0 flex-1 pr-3">
              <div class="flex items-center space-x-2 mb-1">
                <Tag
                  :severity="getCategorySeverity(templateStore.selectedTemplate.category, templateStore.selectedTemplate.isCustom)"
                  :value="templateStore.selectedTemplate.categoryLabel || templateStore.selectedTemplate.category"
                  class="!text-xxs uppercase tracking-wider"
                />
                <Tag
                  v-if="templateStore.selectedTemplate.isCustom"
                  severity="danger"
                  value="外部自訂檔案"
                  class="!text-xxs"
                />
              </div>
              <h3 class="text-sm font-semibold text-dark-100 truncate">
                {{ templateStore.selectedTemplate.title }}
              </h3>
            </div>

            <!-- Action Buttons -->
            <div class="flex items-center space-x-1.5 flex-shrink-0">
              <!-- Copy Button -->
              <Button
                type="button"
                :icon="hasCopied ? 'pi pi-check' : 'pi pi-copy'"
                :label="hasCopied ? '已複製' : '複製'"
                size="small"
                severity="secondary"
                outlined
                @click="copyCode(templateStore.selectedTemplate.code)"
                v-tooltip.top="'複製語法至剪貼簿'"
                class="!text-xs !py-1.5 !px-2.5"
              />

              <!-- Open in New Tab Button -->
              <Button
                type="button"
                icon="pi pi-external-link"
                label="新分頁開啟"
                size="small"
                severity="secondary"
                outlined
                @click="openInNewTab(templateStore.selectedTemplate)"
                v-tooltip.top="'在新查詢分頁載入此範本'"
                class="!text-xs !py-1.5 !px-2.5"
              />

              <!-- Insert at Cursor (Primary) -->
              <Button
                type="button"
                icon="pi pi-arrow-down-left"
                label="插入到目前編輯點"
                size="small"
                severity="primary"
                @click="insertIntoEditor(templateStore.selectedTemplate)"
                v-tooltip.top="'將範本直接插入目前查詢編輯器的游標位置 (Enter)'"
                class="!text-xs !py-1.5 !px-3 shadow-xs"
              />

              <!-- If Custom: Edit / Delete -->
              <template v-if="templateStore.selectedTemplate.isCustom">
                <Button
                  type="button"
                  icon="pi pi-pencil"
                  text
                  rounded
                  size="small"
                  severity="secondary"
                  @click="openEditTemplateModal(templateStore.selectedTemplate)"
                  v-tooltip.top="'編輯此自訂範本'"
                  class="!p-1 !w-7 !h-7"
                />

                <Button
                  type="button"
                  icon="pi pi-trash"
                  text
                  rounded
                  size="small"
                  severity="danger"
                  @click="handleDeleteTemplate(templateStore.selectedTemplate.id)"
                  v-tooltip.top="'刪除此自訂範本'"
                  class="!p-1 !w-7 !h-7"
                />
              </template>
            </div>
          </div>

          <!-- Preview Content Area -->
          <div class="flex-1 overflow-y-auto p-4 space-y-3.5">
            <!-- Usage Notes / Description Card -->
            <div class="p-3 bg-dark-800/80 border border-dark-700/80 rounded-lg text-dark-300 text-xs leading-relaxed space-y-1.5">
              <div class="flex items-center space-x-1.5 font-semibold text-amber-300 text-xxs uppercase tracking-wider">
                <i class="pi pi-info-circle text-xs"></i>
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
          <i class="pi pi-book text-4xl text-dark-700"></i>
          <span class="text-xs text-dark-400">請從左側選擇要預覽或插入的範本</span>
        </div>
      </div>
    </div>

    <!-- Bottom Footer: File Info & Keyboard Shortcuts Bar -->
    <div class="px-3.5 py-2 border-t border-dark-700 bg-dark-900/90 flex items-center justify-between text-xxs text-dark-400 flex-shrink-0">
      <!-- Left: Co-located File Information -->
      <div class="flex items-center space-x-2 min-w-0 flex-1 mr-4">
        <span class="flex items-center space-x-1 text-dark-400 flex-shrink-0">
          <i class="pi pi-file text-brand-400 text-xs"></i>
          <span>自訂範本文件:</span>
        </span>
        <span
          class="text-dark-300 font-mono truncate max-w-md bg-dark-800 px-1.5 py-0.5 rounded border border-dark-750 select-text"
          :title="templateStore.customFilePath || 'sql_custom_templates.json'"
        >
          {{ templateStore.customFilePath || 'sql_custom_templates.json (同層目錄)' }}
        </span>

        <Button
          type="button"
          icon="pi pi-folder-open"
          label="在檔案總管顯示"
          size="small"
          severity="secondary"
          outlined
          @click="handleRevealInExplorer"
          v-tooltip.top="'在 Windows 檔案總管中開啟並反白此自訂語法檔案'"
          class="!text-xxs !py-0.5 !px-2"
        />
      </div>

      <!-- Right: Keyboard Hints -->
      <div class="flex items-center space-x-2.5 flex-shrink-0 text-dark-400">
        <span><kbd class="px-1 py-0.5 bg-dark-800 border border-dark-700 rounded text-dark-300 font-mono">↑</kbd> <kbd class="px-1 py-0.5 bg-dark-800 border border-dark-700 rounded text-dark-300 font-mono">↓</kbd> 選擇</span>
        <span><kbd class="px-1 py-0.5 bg-dark-800 border border-dark-700 rounded text-dark-300 font-mono">Enter</kbd> 插入游標處</span>
        <span><kbd class="px-1 py-0.5 bg-dark-800 border border-dark-700 rounded text-dark-300 font-mono">Esc</kbd> 關閉</span>
      </div>
    </div>
  </Dialog>

  <!-- Add / Edit Custom Template Dialog -->
  <Dialog
    v-model:visible="isCustomFormOpen"
    modal
    :header="editingTemplateId ? '編輯自訂 SQL 範本' : '新增自訂 SQL 範本'"
    class="w-full max-w-xl !bg-dark-850 !border-dark-650"
  >
    <form @submit.prevent="saveCustomTemplateForm" class="p-2 space-y-3 text-xs font-sans">
      <!-- Title Field -->
      <div class="space-y-1">
        <label class="block text-dark-300 font-medium">範本標題 <span class="text-rose-400">*</span></label>
        <InputText
          v-model="formState.title"
          required
          type="text"
          placeholder="例如: ERP 訂單每日彙總批次查詢"
          size="small"
          class="w-full"
        />
      </div>

      <!-- Category & Tags Row -->
      <div class="grid grid-cols-2 gap-3">
        <div class="space-y-1">
          <label class="block text-dark-300 font-medium">範本分類</label>
          <Select
            v-model="formState.category"
            :options="customCategoryOptions"
            optionLabel="label"
            optionValue="value"
            size="small"
            class="w-full"
          />
        </div>

        <div class="space-y-1">
          <label class="block text-dark-300 font-medium">標籤 (逗號分隔)</label>
          <InputText
            v-model="formState.tagsInput"
            type="text"
            placeholder="如: erp, 報表, sync"
            size="small"
            class="w-full font-mono"
          />
        </div>
      </div>

      <!-- Description Field -->
      <div class="space-y-1">
        <label class="block text-dark-300 font-medium">使用情境與說明</label>
        <Textarea
          v-model="formState.description"
          rows="2"
          placeholder="描述此範本的適用情境、注意事項或需替換的欄位與參數"
          size="small"
          class="w-full resize-none leading-relaxed"
        />
      </div>

      <!-- SQL Code Field -->
      <div class="space-y-1">
        <label class="block text-dark-300 font-medium">SQL 語法內容 <span class="text-rose-400">*</span></label>
        <Textarea
          v-model="formState.code"
          required
          rows="7"
          placeholder="SELECT * FROM dbo.YourTable..."
          size="small"
          class="w-full font-mono resize-y leading-relaxed !bg-dark-950"
        />
      </div>

      <!-- Modal Footer -->
      <div class="pt-3 flex items-center justify-between border-t border-dark-750">
        <span class="text-xxs text-dark-500">
          將儲存至應用程式同層檔案 (sql_custom_templates.json)
        </span>
        <div class="flex items-center space-x-2">
          <Button
            type="button"
            label="取消"
            severity="secondary"
            size="small"
            @click="isCustomFormOpen = false"
          />
          <Button
            type="submit"
            label="儲存範本"
            severity="primary"
            size="small"
          />
        </div>
      </div>
    </form>
  </Dialog>
</template>

<script setup lang="ts">
import { ref, reactive, computed, watch, nextTick } from 'vue';
import Dialog from 'primevue/dialog';
import IconField from 'primevue/iconfield';
import InputIcon from 'primevue/inputicon';
import InputText from 'primevue/inputtext';
import Textarea from 'primevue/textarea';
import Button from 'primevue/button';
import Select from 'primevue/select';
import Tag from 'primevue/tag';
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

const searchInputRef = ref<any>(null);
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

const customCategoryOptions = [
  { label: '自訂範本', value: 'custom' },
  { label: '常用語法', value: 'basic' },
  { label: 'CTE 語法', value: 'cte' },
  { label: '進階用法', value: 'advanced' },
  { label: '表結構探勘', value: 'inspection' },
  { label: '診斷維護', value: 'maintenance' },
];

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
    { category: 'inspection', label: '表結構探勘', count: counts.inspection },
    { category: 'maintenance', label: '診斷維護', count: counts.maintenance },
    { category: 'custom', label: '自訂文件', count: counts.custom },
  ];
});

function getCategorySeverity(category: SqlTemplateCategory, isCustom?: boolean): string {
  if (isCustom || category === 'custom') {
    return 'danger';
  }
  switch (category) {
    case 'basic':
      return 'success';
    case 'cte':
      return 'info';
    case 'advanced':
      return 'warn';
    case 'inspection':
      return 'help';
    case 'maintenance':
      return 'secondary';
    default:
      return 'secondary';
  }
}

function clearSearch() {
  templateStore.searchQuery = '';
  focusSearchInput();
}

function focusSearchInput() {
  const el = searchInputRef.value;
  if (!el) return;
  if (typeof el.focus === 'function') {
    el.focus();
  } else if (el.$el && typeof el.$el.focus === 'function') {
    el.$el.focus();
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
        focusSearchInput();
      });
    }
  }
);
</script>
