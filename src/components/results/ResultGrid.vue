<template>
  <div ref="containerRef" class="w-full h-full flex flex-col bg-dark-900 overflow-hidden font-sans text-xs select-none relative">
    <!-- Empty State (only when no query tab is active and no result sets) -->
    <div
      v-if="!tabId && (!resultSets || resultSets.length === 0)"
      class="flex-1 flex flex-col items-center justify-center text-dark-500 space-y-1"
    >
      <Inbox class="w-6 h-6 stroke-1" />
      <span>No rows returned</span>
    </div>

    <!-- Single Result Set (100% Height, No Splitters) -->
    <ResultGridItem
      v-else-if="effectiveResultSets.length === 1 && effectiveResultSets[0]"
      :key="itemKey(0)"
      :tab-id="tabId"
      :result-set="effectiveResultSets[0]"
      :set-index="0"
      :total-sets="1"
      :hide-toolbar="toolbarHidden"
      class="flex-1 w-full"
    />

    <!-- Multiple Result Sets (> 1) -->
    <template v-else>
      <!-- View Mode Header Bar (Stacked SSMS vs Tabbed) -->
      <div class="h-7 bg-dark-850 border-b border-dark-750 flex items-center justify-between px-2 flex-shrink-0">
        <!-- Left: Result Sets Overview / Tabbed Buttons -->
        <div class="flex items-center space-x-1.5 min-w-0">
          <div class="flex items-center space-x-1 text-xxs font-sans text-primary font-medium px-1.5 py-0.5 rounded bg-dark-800 border border-dark-700">
            <Layers class="w-3 h-3 text-primary" />
            <span>{{ effectiveResultSets.length }} Result Sets (共 {{ totalRowsSum.toLocaleString() }} 筆)</span>
          </div>

          <!-- If in Tabbed Mode, render tab buttons -->
          <div v-if="viewMode === 'tabbed'" class="flex items-center space-x-1 ml-1 overflow-x-auto">
            <button
              v-for="(set, idx) in effectiveResultSets"
              :key="idx"
              @click="activeTabIndex = idx"
              :class="[
                'h-5.5 px-2 rounded text-xxs transition-colors flex items-center space-x-1 cursor-pointer flex-shrink-0',
                activeTabIndex === idx
                  ? 'bg-primary/15 text-primary border border-primary/40 font-semibold shadow-xs'
                  : 'text-dark-400 hover:text-dark-100 hover:bg-dark-800 border border-transparent'
              ]"
            >
              <span>Result #{{ idx + 1 }}</span>
              <span :class="activeTabIndex === idx ? 'text-primary/70 font-semibold' : 'text-dark-400'">({{ set.rowCount ?? set.rows.length }})</span>
            </button>
          </div>

          <!-- Notice when a grid is maximized in Stacked mode -->
          <div
            v-else-if="maximizedIndex !== null"
            class="flex items-center space-x-1.5 text-xxs text-warn bg-amber-500/15 border border-amber-500/30 px-2 py-0.5 rounded"
          >
            <span>已最大化 Result #{{ maximizedIndex + 1 }}</span>
            <button
              @click="maximizedIndex = null"
              class="text-warn hover:text-warn underline cursor-pointer font-medium"
            >
              還原多網格
            </button>
          </div>
        </div>

        <!-- Right: Layout Switcher & Actions -->
        <div class="flex items-center space-x-1 flex-shrink-0">
          <!-- Hide Grid Toolbars / Info Bars (applies to every grid of this result tab) -->
          <button
            v-if="resultSets.length > 1"
            type="button"
            @click="toggleToolbarVisibility"
            :class="[
              'px-2 py-0.5 rounded text-xxs bg-dark-800 hover:bg-dark-750 border transition-colors flex items-center space-x-1 cursor-pointer',
              toolbarHidden
                ? 'border-primary/50 text-primary'
                : 'border-dark-700 text-dark-300 hover:text-dark-100'
            ]"
            :title="toolbarHidden ? '顯示所有 DataGrid 的工具列與資訊列' : '隱藏所有 DataGrid 的工具列與資訊列 (純資料檢視)'"
          >
            <component :is="toolbarHidden ? Eye : EyeOff" class="w-2.5 h-2.5" />
            <span>{{ toolbarHidden ? '顯示工具列' : '隱藏工具列' }}</span>
          </button>

          <!-- Reset Heights Button in Stacked Mode -->
          <button
            v-if="viewMode === 'stacked' && maximizedIndex === null"
            type="button"
            @click="resetEqualHeights"
            class="px-2 py-0.5 rounded text-xxs bg-dark-800 hover:bg-dark-750 text-dark-300 hover:text-dark-100 border border-dark-700 transition-colors flex items-center space-x-1 cursor-pointer"
            title="等分重設所有網格高度 (亦可雙擊分割線)"
          >
            <Split class="w-2.5 h-2.5" />
            <span>等分高度</span>
          </button>

          <!-- Toggle View Mode Button -->
          <button
            type="button"
            @click="toggleViewMode"
            class="px-2 py-0.5 rounded text-xxs bg-dark-800 hover:bg-dark-750 text-dark-300 hover:text-dark-100 border border-dark-700 transition-colors flex items-center space-x-1 cursor-pointer"
            :title="viewMode === 'stacked' ? '切換為分頁標籤檢視 (Tabs)' : '切換為 SSMS 垂直多網格檢視 (Stacked)'"
          >
            <component :is="viewMode === 'stacked' ? Rows : LayoutGrid" class="w-2.5 h-2.5 text-primary" />
            <span>{{ viewMode === 'stacked' ? 'SSMS 堆疊' : '分頁檢視' }}</span>
          </button>
        </div>
      </div>

      <!-- Mode 1: Stacked Multi-Grid View (SSMS Style) -->
      <div
        v-if="viewMode === 'stacked'"
        class="flex-1 w-full flex flex-col overflow-hidden min-h-0"
      >
        <!-- If one grid is maximized -->
        <div
          v-if="maximizedIndex !== null && effectiveResultSets[maximizedIndex]"
          class="flex-1 w-full overflow-hidden"
        >
          <ResultGridItem
            :key="itemKey(maximizedIndex)"
            :tab-id="tabId"
            :result-set="effectiveResultSets[maximizedIndex]!"
            :set-index="maximizedIndex"
            :total-sets="effectiveResultSets.length"
            :is-maximized="true"
            :hide-toolbar="toolbarHidden"
            @toggle-maximize="toggleMaximize(maximizedIndex)"
          />
        </div>

        <!-- Normal Stacked Layout with Splitters -->
        <template v-else>
          <template v-for="(set, idx) in effectiveResultSets" :key="idx">
            <div
              :style="paneHeights[idx] ? { height: `${paneHeights[idx]}px` } : { flex: '1 1 0%' }"
              class="w-full min-h-[60px] flex-shrink-0 overflow-hidden"
            >
              <ResultGridItem
                :key="itemKey(idx)"
                :tab-id="tabId"
                :result-set="set"
                :set-index="idx"
                :total-sets="effectiveResultSets.length"
                :is-maximized="false"
                :hide-toolbar="toolbarHidden"
                @toggle-maximize="toggleMaximize(idx)"
              />
            </div>

            <!-- Draggable Horizontal Splitter between panes -->
            <ResizableSplitter
              v-if="idx < effectiveResultSets.length - 1"
              direction="vertical"
              :is-dragging="draggingSplitterIndex === idx"
              @pointerdown="onSplitterPointerDown(idx, $event)"
              @dblclick="resetEqualHeights"
            />
          </template>
        </template>
      </div>

      <!-- Mode 2: Tabbed Multi-Grid View -->
      <div
        v-else-if="viewMode === 'tabbed' && effectiveResultSets[activeTabIndex]"
        class="flex-1 w-full overflow-hidden"
      >
        <ResultGridItem
          :key="itemKey(activeTabIndex)"
          :tab-id="tabId"
          :result-set="effectiveResultSets[activeTabIndex]!"
          :set-index="activeTabIndex"
          :total-sets="effectiveResultSets.length"
          :is-maximized="false"
          :hide-toolbar="toolbarHidden"
          @toggle-maximize="toggleMaximize(activeTabIndex)"
        />
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onBeforeUnmount, nextTick } from 'vue';
import {
  Inbox,
  Layers,
  Split,
  Rows,
  LayoutGrid,
  Eye,
  EyeOff,
} from 'lucide-vue-next';
import ResizableSplitter from '@/components/common/ResizableSplitter.vue';
import ResultGridItem from '@/components/results/ResultGridItem.vue';
import { useGridLayoutStore } from '@/stores/gridLayoutStore';
import type { ResultSet } from '@/types/query';

const props = defineProps<{
  resultSets: ResultSet[];
  tabId?: string | null;
}>();

const fallbackEmptyResultSet: ResultSet = {
  columns: [],
  rows: [],
  rowCount: 0,
};

const effectiveResultSets = computed<ResultSet[]>(() => {
  if (!props.resultSets || props.resultSets.length === 0) {
    return [fallbackEmptyResultSet];
  }
  return props.resultSets;
});

const containerRef = ref<HTMLDivElement | null>(null);
const viewMode = ref<'stacked' | 'tabbed'>('stacked');
const activeTabIndex = ref(0);
const maximizedIndex = ref<number | null>(null);

const gridLayoutStore = useGridLayoutStore();

/**
 * Per result tab view mode: hides the toolbar and info bar of every grid in this tab. The state
 * lives in the layout store so it survives switching between result tabs and bottom panel tabs,
 * and is dropped when the result tab closes. Single result sets keep their toolbar because the
 * header carrying this toggle only renders for multiple result sets.
 */
const toolbarHidden = computed(
  () => props.resultSets.length > 1 && gridLayoutStore.isToolbarHidden(props.tabId ?? null)
);

function toggleToolbarVisibility() {
  gridLayoutStore.toggleToolbarHidden(props.tabId ?? null);
}

/** Component key doubles as the persistent layout key for the result set it renders. */
function itemKey(setIndex: number | null | undefined): string {
  return gridLayoutStore.layoutKey(props.tabId ?? null, setIndex ?? 0);
}

// Pixel heights for each stacked pane
const paneHeights = ref<number[]>([]);
const draggingSplitterIndex = ref<number | null>(null);

const totalRowsSum = computed(() => {
  return effectiveResultSets.value.reduce((sum, rs) => sum + (rs.rowCount ?? rs.rows?.length ?? 0), 0);
});

function toggleViewMode() {
  viewMode.value = viewMode.value === 'stacked' ? 'tabbed' : 'stacked';
  maximizedIndex.value = null;
  if (viewMode.value === 'stacked') {
    nextTick(() => {
      recalculateHeights();
    });
  }
}

function toggleMaximize(index: number) {
  if (maximizedIndex.value === index) {
    maximizedIndex.value = null;
  } else {
    maximizedIndex.value = index;
  }
}

function getAvailableHeight(): number {
  if (!containerRef.value) return 0;
  // Exclude view mode toolbar (28px = h-7) and all horizontal splitters (6px each)
  const headerHeight = effectiveResultSets.value.length > 1 ? 28 : 0;
  const splittersTotal = Math.max(0, (effectiveResultSets.value.length - 1) * 6);
  const total = containerRef.value.clientHeight - headerHeight - splittersTotal;
  return Math.max(total, 60 * effectiveResultSets.value.length);
}

function resetEqualHeights() {
  if (effectiveResultSets.value.length <= 1) return;
  const available = getAvailableHeight();
  const count = effectiveResultSets.value.length;
  const equalH = Math.floor(available / count);
  const remainder = available - equalH * count;

  const heights: number[] = [];
  for (let i = 0; i < count; i++) {
    heights.push(equalH + (i === count - 1 ? remainder : 0));
  }
  paneHeights.value = heights;
}

function recalculateHeights() {
  const count = effectiveResultSets.value.length;
  if (count <= 1) {
    paneHeights.value = [];
    return;
  }

  const available = getAvailableHeight();
  const currentSum = paneHeights.value.reduce((a, b) => a + b, 0);

  if (paneHeights.value.length !== count || currentSum <= 0) {
    resetEqualHeights();
    return;
  }

  // Scale existing heights proportionally to fit new container dimensions
  const scale = available / currentSum;
  let allocated = 0;
  paneHeights.value = paneHeights.value.map((h, idx) => {
    if (idx === count - 1) {
      return Math.max(60, available - allocated);
    }
    const scaled = Math.max(60, Math.round(h * scale));
    allocated += scaled;
    return scaled;
  });
}

// Watch for effectiveResultSets changes to re-init heights; remember which Result #N was selected per tab.
watch(
  () => effectiveResultSets.value,
  (sets) => {
    const remembered = gridLayoutStore.getActiveSetIndex(props.tabId ?? null);
    const maxIndex = Math.max(0, sets.length - 1);
    activeTabIndex.value = remembered == null ? 0 : Math.min(Math.max(remembered, 0), maxIndex);
    maximizedIndex.value = null;
    nextTick(() => {
      resetEqualHeights();
    });
  },
  { deep: false }
);

watch(activeTabIndex, (index) => {
  gridLayoutStore.setActiveSetIndex(props.tabId ?? null, index);
});

// Splitter Dragging Logic
let startDragY = 0;
let startTopH = 0;
let startBottomH = 0;
let activeSplitterIdx = -1;

function onSplitterPointerDown(splitterIndex: number, event: PointerEvent) {
  if (event.button !== 0) return;
  event.preventDefault();

  activeSplitterIdx = splitterIndex;
  draggingSplitterIndex.value = splitterIndex;
  startDragY = event.clientY;

  // Ensure heights are initialized
  if (paneHeights.value.length !== effectiveResultSets.value.length) {
    resetEqualHeights();
  }

  startTopH = paneHeights.value[splitterIndex] || 100;
  startBottomH = paneHeights.value[splitterIndex + 1] || 100;

  if (typeof document !== 'undefined') {
    document.addEventListener('pointermove', onPointerMove);
    document.addEventListener('pointerup', onPointerUp);
    document.addEventListener('pointercancel', onPointerUp);
    document.body.style.userSelect = 'none';
    document.body.style.cursor = 'row-resize';
  }
}

function onPointerMove(event: PointerEvent) {
  if (draggingSplitterIndex.value === null || activeSplitterIdx < 0) return;

  const deltaY = event.clientY - startDragY;
  const minH = 60;
  const totalCombined = startTopH + startBottomH;

  let newTopH = startTopH + deltaY;
  let newBottomH = startBottomH - deltaY;

  if (newTopH < minH) {
    newTopH = minH;
    newBottomH = totalCombined - minH;
  } else if (newBottomH < minH) {
    newBottomH = minH;
    newTopH = totalCombined - minH;
  }

  paneHeights.value[activeSplitterIdx] = Math.round(newTopH);
  paneHeights.value[activeSplitterIdx + 1] = Math.round(newBottomH);
}

function onPointerUp() {
  draggingSplitterIndex.value = null;
  activeSplitterIdx = -1;

  if (typeof document !== 'undefined') {
    document.removeEventListener('pointermove', onPointerMove);
    document.removeEventListener('pointerup', onPointerUp);
    document.removeEventListener('pointercancel', onPointerUp);
    document.body.style.userSelect = '';
    document.body.style.cursor = '';
  }
}

let resizeObserver: ResizeObserver | null = null;

onMounted(() => {
  if (containerRef.value && typeof ResizeObserver !== 'undefined') {
    resizeObserver = new ResizeObserver(() => {
      if (viewMode.value === 'stacked' && draggingSplitterIndex.value === null) {
        recalculateHeights();
      }
    });
    resizeObserver.observe(containerRef.value);
  }
  nextTick(() => {
    resetEqualHeights();
  });
});

onBeforeUnmount(() => {
  if (resizeObserver) {
    resizeObserver.disconnect();
    resizeObserver = null;
  }
  onPointerUp();
});
</script>
