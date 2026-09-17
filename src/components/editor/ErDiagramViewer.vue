<template>
  <div
    class="w-full h-full flex flex-col bg-dark-950 text-dark-100 overflow-hidden select-none relative font-sans"
    @click="closeMenus"
  >
    <!-- ER Diagram Top Toolbar -->
    <div class="h-10 bg-dark-900 border-b border-dark-750 px-3 flex items-center justify-between flex-shrink-0 z-20">
      <!-- Left Controls: Info & Relation Depth & Layout -->
      <div class="flex items-center space-x-2">
        <!-- Root Table Badge -->
        <div v-if="tab.rootTable" class="flex items-center space-x-1.5 px-2 py-1 bg-dark-800 border border-dark-700 rounded text-xs">
          <Database class="w-3.5 h-3.5 text-brand-400" />
          <span class="text-dark-400 text-xxs font-mono">{{ tab.rootSchema }}.</span>
          <span class="text-dark-100 font-semibold font-mono">{{ tab.rootTable }}</span>
        </div>

        <div class="h-4 w-px bg-dark-750 mx-1"></div>


        <!-- Edit Mode Toggle Button -->
        <button
          type="button"
          @click="toggleEditMode"
          :class="[
            'h-7 px-2.5 rounded text-xs flex items-center space-x-1.5 transition-all cursor-pointer font-medium border shadow-xs',
            isEditMode
              ? 'bg-amber-600 hover:bg-amber-500 text-white border-amber-500 shadow-amber-500/20 ring-1 ring-amber-400/50'
              : 'bg-dark-800 hover:bg-dark-750 text-dark-300 hover:text-dark-100 border-dark-700'
          ]"
          :title="isEditMode ? '目前為編輯模式：可自由拖曳連線與勾選隱藏欄位 (點擊切換為檢視模式)' : '目前為檢視模式：僅可移動卡片 (點擊開啟編輯模式)'"
        >
          <component :is="isEditMode ? Edit3 : Eye" class="w-3.5 h-3.5" :class="isEditMode ? 'text-amber-200 animate-pulse' : 'text-dark-400'" />
          <span>{{ isEditMode ? '編輯模式' : '檢視模式' }}</span>
          <span
            :class="[
              'text-[9px] px-1 py-0.2 rounded font-mono font-bold leading-none',
              isEditMode ? 'bg-amber-800 text-amber-100' : 'bg-dark-750 text-dark-400'
            ]"
          >
            {{ isEditMode ? 'ON' : 'OFF' }}
          </span>
        </button>

        <!-- Auto Layout (Dagre) Button -->
        <button
          type="button"
          @click="applyAutoLayout(layoutDirection)"
          class="h-7 px-2.5 bg-dark-800 hover:bg-dark-750 text-dark-200 hover:text-white border border-dark-700 rounded text-xs flex items-center space-x-1.5 transition-colors cursor-pointer shadow-xs"
          title="以階層拓撲演算法自動重新排列所有資料表"
        >
          <LayoutGrid class="w-3.5 h-3.5 text-brand-400" />
          <span>自動排版</span>
        </button>

        <!-- Direction Toggle (LR / TB) -->
        <button
          type="button"
          @click="toggleLayoutDirection"
          class="h-7 px-2 bg-dark-800 hover:bg-dark-750 text-dark-300 hover:text-dark-100 border border-dark-700 rounded text-xs flex items-center space-x-1 transition-colors cursor-pointer"
          :title="`目前方向：${layoutDirection === 'LR' ? '水平左右 (LR)' : '垂直上下 (TB)'}，點擊切換`"
        >
          <component :is="layoutDirection === 'LR' ? ArrowRightLeft : ArrowUpDown" class="w-3.5 h-3.5 text-dark-400" />
          <span class="text-xxs font-mono">{{ layoutDirection }}</span>
        </button>

        <!-- Add Text Note Button -->
        <button
          type="button"
          @click="handleAddTextNode"
          class="h-7 px-2.5 bg-dark-800 hover:bg-dark-750 text-dark-200 hover:text-white border border-dark-700 rounded text-xs flex items-center space-x-1.5 transition-colors cursor-pointer shadow-xs"
          title="在畫布上新增文字說明 / 備註便箋"
        >
          <Type class="w-3.5 h-3.5 text-amber-400" />
          <span>文字</span>
        </button>

        <!-- Refresh Data Button -->
        <button
          v-if="tab.rootTable"
          type="button"
          @click="loadDiagramData"
          :disabled="isLoading"
          class="h-7 px-2 bg-dark-800 hover:bg-dark-750 text-dark-300 hover:text-dark-100 border border-dark-700 rounded text-xs flex items-center transition-colors cursor-pointer"
          title="重新整理資料表與外鍵結構"
        >
          <RefreshCw class="w-3.5 h-3.5 text-dark-400" :class="isLoading ? 'animate-spin text-brand-400' : ''" />
        </button>
      </div>

      <!-- Right Controls: Zoom, Export -->
      <div class="flex items-center space-x-2">
        <!-- Zoom Controls -->
        <div class="flex items-center bg-dark-800 border border-dark-700 rounded overflow-hidden">
          <button
            type="button"
            @click="handleZoomOut"
            class="p-1.5 hover:bg-dark-750 text-dark-300 hover:text-white transition-colors cursor-pointer"
            title="縮小 (Ctrl + 滾輪下滾)"
          >
            <ZoomOut class="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            @click="handleZoomReset"
            class="px-1.5 py-1 hover:bg-dark-750 text-dark-300 hover:text-white text-xxs font-mono transition-colors min-w-[42px] text-center cursor-pointer"
            title="重設縮放 100%"
          >
            {{ Math.round(zoomLevel * 100) }}%
          </button>
          <button
            type="button"
            @click="handleZoomIn"
            class="p-1.5 hover:bg-dark-750 text-dark-300 hover:text-white transition-colors cursor-pointer"
            title="放大 (Ctrl + 滾輪上滾)"
          >
            <ZoomIn class="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            @click="handleZoomFit"
            class="p-1.5 hover:bg-dark-750 text-dark-300 hover:text-white transition-colors border-l border-dark-750 cursor-pointer"
            title="最適大小 (Fit)"
          >
            <Maximize2 class="w-3.5 h-3.5" />
          </button>
        </div>

        <div class="h-4 w-px bg-dark-750 mx-1"></div>

        <!-- Export Dropdown -->
        <div class="relative">
          <button
            type="button"
            @click.stop="isExportMenuOpen = !isExportMenuOpen"
            class="h-7 px-2.5 bg-brand-600 hover:bg-brand-500 text-white rounded text-xs flex items-center space-x-1.5 transition-colors font-medium shadow-sm cursor-pointer"
          >
            <Download class="w-3.5 h-3.5" />
            <span>匯出</span>
            <ChevronDown class="w-3 h-3 ml-0.5" />
          </button>

          <!-- Export Menu Popover -->
          <div
            v-if="isExportMenuOpen"
            class="absolute right-0 top-full mt-1.5 w-48 bg-dark-850 border border-dark-700 rounded-md shadow-2xl py-1 text-xs text-dark-200 z-50 animate-in fade-in zoom-in-95 duration-100"
          >
            <div class="px-2.5 py-1 text-xxs text-dark-400 border-b border-dark-750 font-medium">
              匯出 ER 圖形與定義
            </div>
            <button
              type="button"
              @click="exportAsPng"
              class="w-full text-left px-2.5 py-1.5 hover:bg-dark-750 hover:text-white flex items-center space-x-2 transition-colors cursor-pointer"
            >
              <Image class="w-3.5 h-3.5 text-emerald-400" />
              <span>匯出 PNG 圖檔 (高解析)</span>
            </button>
            <button
              type="button"
              @click="exportAsSvg"
              class="w-full text-left px-2.5 py-1.5 hover:bg-dark-750 hover:text-white flex items-center space-x-2 transition-colors cursor-pointer"
            >
              <FileCode class="w-3.5 h-3.5 text-sky-400" />
              <span>匯出 SVG 向量圖</span>
            </button>
            <button
              type="button"
              @click="exportAsJson"
              class="w-full text-left px-2.5 py-1.5 hover:bg-dark-750 hover:text-white flex items-center space-x-2 transition-colors text-amber-300 cursor-pointer"
            >
              <FileJson class="w-3.5 h-3.5 text-amber-400" />
              <span>匯出原始碼 (.sqlight-er.json)</span>
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Main Canvas Drop Zone & Graph Container -->
    <div
      ref="dropZoneRef"
      @dragover.prevent="handleDragOver"
      @drop="handleDropTable"
      class="flex-1 w-full h-full relative overflow-hidden bg-dark-950 cursor-grab active:cursor-grabbing"
    >
      <!-- AntV X6 Mount Point -->
      <div ref="graphContainerRef" class="w-full h-full"></div>

      <!-- Drag Over Visual Overlay Hint -->
      <div
        v-if="isDragOver"
        class="absolute inset-0 bg-brand-500/10 border-2 border-dashed border-brand-400 z-30 pointer-events-none flex items-center justify-center backdrop-blur-xs"
      >
        <div class="bg-dark-850/90 px-4 py-2 rounded-lg border border-brand-500/50 shadow-2xl flex items-center space-x-2 text-brand-300 text-sm font-medium">
          <PlusCircle class="w-4 h-4 animate-bounce" />
          <span>放開滑鼠以將資料表加入至此 ER 圖</span>
        </div>
      </div>

      <!-- Loading Spinner Indicator -->
      <div
        v-if="isLoading"
        class="absolute inset-0 bg-dark-950/70 z-40 flex flex-col items-center justify-center space-y-2 backdrop-blur-xs"
      >
        <Loader2 class="w-8 h-8 animate-spin text-brand-400" />
        <span class="text-xs text-dark-300">{{ loadingMessage }}</span>
      </div>

      <!-- Empty State Hint (if 0 nodes) -->
      <div
        v-if="!isLoading && nodeCount === 0"
        class="absolute inset-0 flex flex-col items-center justify-center text-dark-500 text-xs space-y-2 pointer-events-none"
      >
        <Layers class="w-10 h-10 text-dark-600" />
        <span>畫布尚無資料表</span>
        <span class="text-dark-600 text-xxs">可從左側資料庫清單拖拉資料表，或由右鍵選單加入</span>
      </div>

      <!-- Floating Stats & Linking Tip (Bottom Left) -->
      <div class="absolute bottom-3 left-3 bg-dark-900/90 backdrop-blur border border-dark-750 px-3 py-1.5 rounded-md text-[11px] text-dark-300 flex items-center space-x-3 pointer-events-none z-10 font-mono shadow-lg">
        <span>資料表：<strong class="text-dark-100">{{ nodeCount }}</strong></span>
        <span class="text-dark-600">•</span>
        <span>關聯線：<strong class="text-dark-100">{{ edgeCount }}</strong></span>
        <span class="text-dark-600">•</span>
        <span v-if="isEditMode" class="text-amber-300 flex items-center space-x-1">
          <Edit3 class="w-3 h-3 text-amber-400" />
          <span>編輯模式：可勾選欄位隱藏/顯示，拖曳圓點自由連線，單擊徽章切換屬性</span>
        </span>
        <span v-else class="text-dark-400 flex items-center space-x-1">
          <Eye class="w-3 h-3 text-dark-400" />
          <span>檢視模式：僅可平移與移動資料表 (未勾選欄位已隱藏)。點擊上方「編輯模式」可開始連線與設定欄位</span>
        </span>
      </div>

      <!-- Edge Property Context Menu Popover -->
      <div
        v-if="edgeMenu.visible"
        :style="{ top: `${edgeMenu.y}px`, left: `${edgeMenu.x}px` }"
        class="fixed z-50 bg-dark-850/95 backdrop-blur border border-dark-700 rounded-lg shadow-2xl py-1.5 w-64 text-xs font-sans text-dark-200 select-none animate-in fade-in zoom-in-95 duration-100 font-mono"
        @click.stop
      >
        <!-- Header Info -->
        <div class="px-3 py-1.5 border-b border-dark-750 text-[11px]">
          <div class="flex items-center space-x-1.5 text-brand-400 font-semibold mb-1 font-sans">
            <Link2 class="w-3.5 h-3.5" />
            <span>關聯設定 (Relation Properties)</span>
          </div>
          <div class="truncate text-dark-400 text-[10px] space-y-0.5">
            <div class="flex items-center space-x-1">
              <span class="text-dark-500 w-10 flex-shrink-0 font-sans">來源：</span>
              <span class="text-dark-100 font-medium truncate">{{ edgeMenu.sourceTable }}.{{ edgeMenu.sourceColumn }}</span>
            </div>
            <div class="flex items-center space-x-1">
              <span class="text-dark-500 w-10 flex-shrink-0 font-sans">目標：</span>
              <span class="text-dark-100 font-medium truncate">{{ edgeMenu.targetTable }}.{{ edgeMenu.targetColumn }}</span>
            </div>
          </div>
        </div>

        <!-- Cardinality Selection -->
        <div class="px-3 py-2 border-b border-dark-750">
          <div class="text-[10px] text-dark-400 mb-1.5 font-sans flex items-center justify-between">
            <span>關聯屬性 (Cardinality)</span>
            <span class="text-brand-300 font-bold font-mono">{{ edgeMenu.cardinality }}</span>
          </div>
          <div class="grid grid-cols-2 gap-1.5 text-xxs">
            <button
              type="button"
              @click="setMenuEdgeCardinality('1:N')"
              :class="[
                'px-2 py-1 rounded text-center border transition-colors flex items-center justify-between cursor-pointer',
                edgeMenu.cardinality === '1:N'
                  ? 'bg-brand-500/25 text-brand-200 border-brand-500/60 font-semibold ring-1 ring-brand-500/40'
                  : 'bg-dark-800 text-dark-300 border-dark-700 hover:bg-dark-750'
              ]"
            >
              <span>1 對多</span>
              <span class="text-dark-400 font-mono">1:N</span>
            </button>
            <button
              type="button"
              @click="setMenuEdgeCardinality('1:1')"
              :class="[
                'px-2 py-1 rounded text-center border transition-colors flex items-center justify-between cursor-pointer',
                edgeMenu.cardinality === '1:1'
                  ? 'bg-brand-500/25 text-brand-200 border-brand-500/60 font-semibold ring-1 ring-brand-500/40'
                  : 'bg-dark-800 text-dark-300 border-dark-700 hover:bg-dark-750'
              ]"
            >
              <span>1 對 1</span>
              <span class="text-dark-400 font-mono">1:1</span>
            </button>
            <button
              type="button"
              @click="setMenuEdgeCardinality('N:1')"
              :class="[
                'px-2 py-1 rounded text-center border transition-colors flex items-center justify-between cursor-pointer',
                edgeMenu.cardinality === 'N:1'
                  ? 'bg-brand-500/25 text-brand-200 border-brand-500/60 font-semibold ring-1 ring-brand-500/40'
                  : 'bg-dark-800 text-dark-300 border-dark-700 hover:bg-dark-750'
              ]"
            >
              <span>多對 1</span>
              <span class="text-dark-400 font-mono">N:1</span>
            </button>
            <button
              type="button"
              @click="setMenuEdgeCardinality('N:M')"
              :class="[
                'px-2 py-1 rounded text-center border transition-colors flex items-center justify-between cursor-pointer',
                edgeMenu.cardinality === 'N:M'
                  ? 'bg-brand-500/25 text-brand-200 border-brand-500/60 font-semibold ring-1 ring-brand-500/40'
                  : 'bg-dark-800 text-dark-300 border-dark-700 hover:bg-dark-750'
              ]"
            >
              <span>多對多</span>
              <span class="text-dark-400 font-mono">N:M</span>
            </button>
          </div>
        </div>

        <!-- Action Items -->
        <div class="py-1 font-sans">
          <button
            type="button"
            @click="reverseMenuEdge"
            class="w-full text-left px-3 py-1.5 hover:bg-dark-750 hover:text-white flex items-center space-x-2 transition-colors cursor-pointer text-sky-300"
          >
            <ArrowRightLeft class="w-3.5 h-3.5 text-sky-400" />
            <span>反轉連線方向</span>
          </button>


          <button
            type="button"
            @click="generateForeignKeySql"
            class="w-full text-left px-3 py-1.5 hover:bg-dark-750 hover:text-white flex items-center space-x-2 transition-colors text-emerald-300 cursor-pointer"
          >
            <FileCode class="w-3.5 h-3.5 text-emerald-400" />
            <span>複製外鍵 SQL 腳本 (ALTER TABLE)</span>
          </button>

          <button
            type="button"
            @click="deleteMenuEdge"
            class="w-full text-left px-3 py-1.5 hover:bg-dark-750 hover:text-white flex items-center space-x-2 transition-colors text-rose-400 cursor-pointer"
          >
            <Trash2 class="w-3.5 h-3.5 text-rose-400" />
            <span>刪除此關聯線 (Delete)</span>
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted, onBeforeUnmount, shallowRef, nextTick } from 'vue';
import {
  Database,
  LayoutGrid,
  RefreshCw,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Download,
  Image,
  FileCode,
  FileJson,
  ChevronDown,
  Loader2,
  PlusCircle,
  Layers,
  ArrowRightLeft,
  ArrowUpDown,
  Link2,
  Trash2,
  Eye,
  Edit3,
  Type,
} from 'lucide-vue-next';
import { Graph, Export } from '@antv/x6';
import { register } from '@antv/x6-vue-shape';
import dagre from 'dagre';
import ErTableNode, { type ErTableNodeData, type ErTableColumn } from './ErTableNode.vue';
import ErTextNode from './ErTextNode.vue';
import { useWorkspaceStore } from '@/stores/workspaceStore';
import { useConnectionStore } from '@/stores/connectionStore';
import { schemaService } from '@/services/schemaService';
import { saveDataUriToFile, saveSvgToFile, saveErDiagramToFile, getAppStylesheets } from '@/utils/fileStorage';
import type { ErDiagramTab } from '@/types/workspace';
import type { ForeignKeyItem } from '@/types/schema';

export type Cardinality = '1:1' | '1:N' | 'N:1' | 'N:M';

// Register Vue Node Component into X6 once
let isNodeRegistered = false;
function registerErTableNode() {
  if (isNodeRegistered) return;

  // Register custom pixel-exact port layouts for left & right sides
  Graph.registerPortLayout(
    'er-left',
    (portsPositionArgs) => {
      return portsPositionArgs.map((args) => {
        const y = typeof args.y === 'number' ? args.y : 0;
        return {
          position: { x: 0, y },
          angle: 0,
        };
      });
    },
    true
  );

  Graph.registerPortLayout(
    'er-right',
    (portsPositionArgs, elemBBox) => {
      return portsPositionArgs.map((args) => {
        const y = typeof args.y === 'number' ? args.y : 0;
        return {
          position: { x: elemBBox.width, y },
          angle: 0,
        };
      });
    },
    true
  );

  register({
    shape: 'er-table-node',
    width: 260,
    height: 180,
    component: ErTableNode,
    ports: {
      groups: {
        left: {
          position: 'er-left',
          attrs: {
            circle: {
              r: 3.5,
              magnet: true,
              stroke: '#818cf8',
              strokeWidth: 1.5,
              fill: '#0f111a',
              cursor: 'crosshair',
            },
          },
        },
        right: {
          position: 'er-right',
          attrs: {
            circle: {
              r: 3.5,
              magnet: true,
              stroke: '#818cf8',
              strokeWidth: 1.5,
              fill: '#0f111a',
              cursor: 'crosshair',
            },
          },
        },
      },
    },
  });

  register({
    shape: 'er-text-node',
    width: 240,
    height: 120,
    component: ErTextNode,
  });

  isNodeRegistered = true;
}

const props = defineProps<{
  tab: ErDiagramTab;
}>();

const workspaceStore = useWorkspaceStore();
const connectionStore = useConnectionStore();

const graphContainerRef = ref<HTMLDivElement | null>(null);
const dropZoneRef = ref<HTMLDivElement | null>(null);
const graphInstance = shallowRef<Graph | null>(null);

const isLoading = ref(false);
const loadingMessage = ref('正在載入 ER 圖表...');
const isDragOver = ref(false);
const isExportMenuOpen = ref(false);
const zoomLevel = ref(1);
const nodeCount = ref(0);
const edgeCount = ref(0);
const currentDepth = ref<1 | 2>(props.tab.depth || 2);
const layoutDirection = ref<'LR' | 'TB'>('LR');
const isEditMode = ref(false);

// Edge Context Menu State
const edgeMenu = reactive({
  visible: false,
  x: 0,
  y: 0,
  edge: null as any,
  sourceTable: '',
  sourceColumn: '',
  targetTable: '',
  targetColumn: '',
  cardinality: '1:N' as Cardinality,
});

// Cached all foreign keys of current database
let cachedForeignKeys: ForeignKeyItem[] = [];

// ========================
// Graph Initialization
// ========================
onMounted(async () => {
  registerErTableNode();
  await nextTick();
  initGraph();

  if (props.tab.initialData) {
    // Restore from opened file
    restoreFromInitialData(props.tab.initialData);
  } else if (props.tab.rootTable) {
    // Load fresh ER model from DB
    await loadDiagramData();
  }

  // Register global listener for "加入至當前 ER 圖"
  window.addEventListener('sqlight:add-table-to-er', handleAddTableEvent as EventListener);
  window.addEventListener('keydown', handleCanvasKeydown);
});

onBeforeUnmount(() => {
  window.removeEventListener('sqlight:add-table-to-er', handleAddTableEvent as EventListener);
  window.removeEventListener('keydown', handleCanvasKeydown);

  if (graphInstance.value) {
    // Snapshot the current canvas state back to the tab so that switching
    // tabs and returning restores exactly what the user had (including any
    // manually added tables, connections, and layout adjustments).
    try {
      const snapshot = {
        exportedAt: new Date().toISOString(),
        graph: graphInstance.value.toJSON(),
      };
      workspaceStore.updateTabData(props.tab.id, { initialData: snapshot } as any);
    } catch (e) {
      console.warn('Failed to snapshot ER diagram state before unmount:', e);
    }

    graphInstance.value.dispose();
    graphInstance.value = null;
  }
});

function closeMenus() {
  isExportMenuOpen.value = false;
  edgeMenu.visible = false;
}

function initGraph() {
  if (!graphContainerRef.value) return;

  const graph: Graph = new Graph({
    container: graphContainerRef.value,
    autoResize: true,
    panning: {
      enabled: true,
      eventTypes: ['leftMouseDown'],
    },
    mousewheel: {
      enabled: true,
      zoomAtMousePosition: true,
      modifiers: ['ctrl', 'meta'],
      minScale: 0.15,
      maxScale: 3,
    },
    grid: {
      size: 10,
      visible: true,
      type: 'dot',
      args: {
        color: '#26283b',
        thickness: 1,
      },
    },
    interacting: (cellView: any) => {
      if (cellView.cell?.isEdge?.() || cellView.isEdge?.()) {
        return {
          arrowheadMovable: isEditMode.value,
          vertexMovable: false,
          vertexAddable: false,
          vertexDeletable: false,
          edgeLabelMovable: false,
        };
      }
      return {
        nodeMovable: true,
      };
    },
    connecting: {
      snap: true,
      allowBlank: false,
      allowLoop: false,
      highlight: true,
      connectionPoint: 'anchor',
      anchor: 'center',
      validateConnection({ sourceCell, targetCell, sourceMagnet, targetMagnet }) {
        // Disallow connecting if not in edit mode
        if (!isEditMode.value) return false;
        // Disallow connecting to same node
        if (!sourceCell || !targetCell || sourceCell === targetCell) return false;
        // Require valid ports
        if (!sourceMagnet || !targetMagnet) return false;

        // Disallow connecting if either port belongs to an unchecked column
        const sourcePortId = sourceMagnet.getAttribute('port') || '';
        const targetPortId = targetMagnet.getAttribute('port') || '';
        const sourceCol = sourcePortId.replace(/-(in|out)$/, '');
        const targetCol = targetPortId.replace(/-(in|out)$/, '');

        const sourceData = (sourceCell as any).getData?.() as ErTableNodeData | undefined;
        const targetData = (targetCell as any).getData?.() as ErTableNodeData | undefined;

        if (sourceData?.checkedColumns && !sourceData.checkedColumns.includes(sourceCol)) return false;
        if (targetData?.checkedColumns && !targetData.checkedColumns.includes(targetCol)) return false;

        return true;
      },
      createEdge(this: Graph) {
        return this.createEdge({
          shape: 'edge',
          connector: {
            name: 'rounded',
            args: {
              radius: 6,
            },
          },
          attrs: {
            line: {
              stroke: '#818cf8',
              strokeWidth: 1.5,
            },
          },
          data: {
            cardinality: '1:N',
            isCustom: true,
          },
        });
      },
      router: {
        name: 'manhattan',
        args: {
          padding: 20,
          excludeShapes: ['er-text-node'],
        },
      },
      connector: {
        name: 'rounded',
        args: {
          radius: 6,
        },
      },
    },
  });

  // Enable Export plugin
  graph.use(new Export());

  // Track Zoom Level
  graph.on('scale', (args: { sx: number }) => {
    zoomLevel.value = args.sx;
  });

  // Track Counts
  graph.on('cell:added', updateStats);
  graph.on('cell:removed', updateStats);

  // Edge hover highlight & tools
  graph.on('edge:mouseenter', (args: { edge: any }) => {
    const edge = args.edge;
    if (edge) {
      edge.attr('line/stroke', '#38bdf8');
      edge.attr('line/strokeWidth', 2.5);
      edge.toFront();

      // In edit mode, show arrowhead handles to allow reconnecting endpoints
      const tools: any[] = [];
      if (isEditMode.value) {
        tools.push(
          {
            name: 'source-arrowhead',
            args: {
              attrs: { fill: '#818cf8', stroke: '#0f172a' },
            },
          },
          {
            name: 'target-arrowhead',
            args: {
              attrs: { fill: '#818cf8', stroke: '#0f172a' },
            },
          }
        );
      }

      if (tools.length > 0) {
        edge.addTools(tools);
      }
    }
  });

  graph.on('edge:mouseleave', (args: { edge: any }) => {
    const edge = args.edge;
    if (edge) {
      edge.attr('line/stroke', '#818cf8');
      edge.attr('line/strokeWidth', 1.5);
      edge.removeTools();
    }
  });

  // Interactive connection completed (dragged from column to column, or reconnected)
  graph.on('edge:connected', ({ isNew, edge }: { isNew: boolean; edge: any }) => {
    const sourcePortId = edge.getSourcePortId() || '';
    const targetPortId = edge.getTargetPortId() || '';
    const sourceCell = edge.getSourceCell();
    const targetCell = edge.getTargetCell();
    const sourceData = sourceCell?.getData() as ErTableNodeData | undefined;
    const targetData = targetCell?.getData() as ErTableNodeData | undefined;

    const srcCol = sourcePortId.replace(/-(in|out)$/, '');
    const tgtCol = targetPortId.replace(/-(in|out)$/, '');
    const srcTable = sourceData ? sourceData.table : 'TableA';
    const tgtTable = targetData ? targetData.table : 'TableB';

    if (isNew) {
      applyEdgeCardinality(edge, '1:N');
      updateStats();
      workspaceStore.showToast(`已建立關聯：${srcTable}.${srcCol} ➔ ${tgtTable}.${tgtCol} (1:N)`, 'success', 2500);
    } else {
      updateStats();
      workspaceStore.showToast(`已更新連線端點：${srcTable}.${srcCol} ➔ ${tgtTable}.${tgtCol}`, 'info', 2000);
    }
  });

  // Right-click on edge: open popover
  graph.on('edge:contextmenu', ({ e, edge }: { e: MouseEvent; edge: any }) => {
    e.preventDefault();
    e.stopPropagation();

    const sourcePortId = edge.getSourcePortId() || '';
    const targetPortId = edge.getTargetPortId() || '';
    const sourceCell = edge.getSourceCell();
    const targetCell = edge.getTargetCell();
    const sourceData = sourceCell?.getData() as ErTableNodeData | undefined;
    const targetData = targetCell?.getData() as ErTableNodeData | undefined;

    edgeMenu.visible = true;
    edgeMenu.x = Math.min(e.clientX, window.innerWidth - 270);
    edgeMenu.y = Math.min(e.clientY, window.innerHeight - 300);
    edgeMenu.edge = edge;
    edgeMenu.sourceTable = sourceData ? sourceData.table : 'Source';
    edgeMenu.sourceColumn = sourcePortId.replace(/-(in|out)$/, '');
    edgeMenu.targetTable = targetData ? targetData.table : 'Target';
    edgeMenu.targetColumn = targetPortId.replace(/-(in|out)$/, '');
    edgeMenu.cardinality = (edge.getData()?.cardinality || '1:N') as Cardinality;
  });

  // Blank click: close menus & clear selection
  graph.on('blank:click', () => {
    graph.cleanSelection();
    closeMenus();
  });

  // Node click: select node
  graph.on('node:click', ({ node }) => {
    graph.cleanSelection();
    graph.select(node);
  });

  // Synchronize layout & ports on table node data change (checkbox toggled, edit mode, etc.)
  graph.on('node:change:data', ({ node }) => {
    if (node.shape === 'er-table-node') {
      updateNodeLayoutAndPorts(node, isEditMode.value);
    }
  });

  // Re-evaluate ports when an edge is removed so protected columns can be refreshed
  graph.on('edge:removed', () => {
    for (const n of graph.getNodes()) {
      if (n.shape === 'er-table-node') {
        updateNodeLayoutAndPorts(n, isEditMode.value);
      }
    }
  });

  graphInstance.value = graph;
}

function updateStats() {
  if (!graphInstance.value) return;
  nodeCount.value = graphInstance.value.getNodes().filter((n) => n.shape === 'er-table-node').length;
  edgeCount.value = graphInstance.value.getEdges().length;
}

// ========================
// Cardinality Styling Helper
// ========================
function applyEdgeCardinality(
  edge: any,
  cardinality: Cardinality = '1:N',
  constraintName?: string
) {
  const [srcCard, tgtCard] = cardinality.split(':');

  edge.setData({ ...edge.getData(), cardinality, constraintName });

  // Update labels: source-end badge and target-end badge only
  edge.setLabels([
    // Source side badge (distance: 24)
    {
      attrs: {
        text: {
          text: srcCard,
          fill: '#cbd5e1',
          fontSize: 10,
          fontWeight: 'bold',
          fontFamily: 'monospace',
        },
        rect: {
          fill: '#181825',
          rx: 3,
          ry: 3,
          stroke: '#475569',
          strokeWidth: 1,
        },
      },
      position: { distance: 24 },
    },
    // Target side badge (distance: -24)
    {
      attrs: {
        text: {
          text: tgtCard,
          fill: '#cbd5e1',
          fontSize: 10,
          fontWeight: 'bold',
          fontFamily: 'monospace',
        },
        rect: {
          fill: '#181825',
          rx: 3,
          ry: 3,
          stroke: '#475569',
          strokeWidth: 1,
        },
      },
      position: { distance: -24 },
    },
  ]);

  // Update end markers (Crow's foot / block / bar)
  if (tgtCard === 'N') {
    edge.attr('line/targetMarker', {
      name: 'block',
      width: 7,
      height: 7,
      fill: '#818cf8',
      stroke: '#818cf8',
    });
  } else {
    edge.attr('line/targetMarker', {
      name: 'path',
      d: 'M 0 -6 L 0 6',
      stroke: '#818cf8',
      strokeWidth: 2,
    });
  }

  if (srcCard === 'N') {
    edge.attr('line/sourceMarker', {
      name: 'block',
      width: 7,
      height: 7,
      fill: '#818cf8',
      stroke: '#818cf8',
    });
  } else {
    edge.attr('line/sourceMarker', {
      name: 'path',
      d: 'M 0 -6 L 0 6',
      stroke: '#818cf8',
      strokeWidth: 2,
    });
  }
}

// ========================
// Edge Menu Actions
// ========================
function setMenuEdgeCardinality(cardinality: Cardinality) {
  if (!edgeMenu.edge) return;
  edgeMenu.cardinality = cardinality;
  const constraintName = edgeMenu.edge.getData()?.constraintName;
  applyEdgeCardinality(edgeMenu.edge, cardinality, constraintName);
  edgeMenu.visible = false;
  workspaceStore.showToast(`已設定關聯為 ${cardinality}`, 'success', 1500);
}

function reverseMenuEdge() {
  if (!edgeMenu.edge) return;
  const edge = edgeMenu.edge;
  const src = edge.getSource();
  const tgt = edge.getTarget();

  edge.setSource(tgt);
  edge.setTarget(src);

  let nextCard = edgeMenu.cardinality;
  if (edgeMenu.cardinality === '1:N') nextCard = 'N:1';
  else if (edgeMenu.cardinality === 'N:1') nextCard = '1:N';

  const constraintName = edge.getData()?.constraintName;
  applyEdgeCardinality(edge, nextCard, constraintName);

  edgeMenu.visible = false;
  workspaceStore.showToast('已反轉關聯方向', 'info', 1500);
}


function generateForeignKeySql() {
  if (!edgeMenu.edge) return;
  const sourceCell = edgeMenu.edge.getSourceCell();
  const targetCell = edgeMenu.edge.getTargetCell();
  const sourceData = sourceCell?.getData() as ErTableNodeData | undefined;
  const targetData = targetCell?.getData() as ErTableNodeData | undefined;

  const sourceSchema = sourceData?.schema || 'dbo';
  const sourceTable = sourceData?.table || edgeMenu.sourceTable;
  const sourceCol = edgeMenu.sourceColumn;

  const targetSchema = targetData?.schema || 'dbo';
  const targetTable = targetData?.table || edgeMenu.targetTable;
  const targetCol = edgeMenu.targetColumn;

  const constraintName = `FK_${targetTable}_${sourceTable}_${targetCol}`;

  const sql = `-- 建立外鍵條件約束 (Foreign Key Constraint)
ALTER TABLE [${targetSchema}].[${targetTable}]
ADD CONSTRAINT [${constraintName}]
FOREIGN KEY ([${targetCol}])
REFERENCES [${sourceSchema}].[${sourceTable}] ([${sourceCol}]);
`;

  navigator.clipboard.writeText(sql).then(() => {
    workspaceStore.showToast(`已複製外鍵 SQL 至剪貼簿 (${constraintName})`, 'success', 3000);
  }).catch(() => {
    workspaceStore.showToast('複製外鍵 SQL 失敗', 'error');
  });

  edgeMenu.visible = false;
}

function deleteMenuEdge() {
  if (!edgeMenu.edge) return;
  edgeMenu.edge.remove();
  edgeMenu.visible = false;
  updateStats();
  workspaceStore.showToast('已刪除關聯線', 'info', 1500);
}

function handleCanvasKeydown(e: KeyboardEvent) {
  if (e.key === 'Delete' || e.key === 'Backspace') {
    const target = e.target as HTMLElement | null;
    if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) {
      return;
    }
    const graph = graphInstance.value;
    if (!graph) return;
    const selectedCells = graph.getSelectedCells();
    if (selectedCells.length > 0) {
      selectedCells.forEach((cell) => cell.remove());
      updateStats();
      workspaceStore.showToast(`已刪除所選元素`, 'info', 1500);
    }
  }
}

// ========================
// Node Layout & Ports Helper
// ========================
function updateNodeLayoutAndPorts(node: any, isEdit: boolean) {
  const data = node.getData() as ErTableNodeData | undefined;
  if (!data || !data.columns) return;

  const BORDER_OFFSET = 1;
  const HEADER_HEIGHT = 32;
  const ROW_HEIGHT = 24;

  const checkedSet = new Set(data.checkedColumns ?? data.columns.map((c) => c.name));

  // Determine connected columns for this node so they are NEVER hidden
  const graph = node.model?.graph || graphInstance.value;
  const connectedPortIds = new Set<string>();
  if (graph) {
    try {
      const edges = graph.getConnectedEdges(node) || [];
      for (const edge of edges) {
        if (edge.getSourceCell() === node) {
          const p = edge.getSourcePortId();
          if (p) connectedPortIds.add(p.replace(/-(in|out)$/, ''));
        }
        if (edge.getTargetCell() === node) {
          const p = edge.getTargetPortId();
          if (p) connectedPortIds.add(p.replace(/-(in|out)$/, ''));
        }
      }
    } catch (e) {
      console.warn('Failed to inspect connected edges for node:', e);
    }
  }

  let visibleCols: ErTableColumn[];
  if (isEdit) {
    // In edit mode: show all columns in DOM
    visibleCols = data.columns;
  } else {
    // In view mode: show only checked columns (connected columns always preserved)
    visibleCols = data.columns.filter((c) => checkedSet.has(c.name) || connectedPortIds.has(c.name));
    if (data.isKeysOnly) {
      visibleCols = visibleCols.filter((c) => c.isPrimaryKey || c.isForeignKey || connectedPortIds.has(c.name));
    }
  }

  const FOOTER_HEIGHT = isEdit ? 24 : 0;
  const newHeight = Math.max(BORDER_OFFSET * 2 + HEADER_HEIGHT + visibleCols.length * ROW_HEIGHT + FOOTER_HEIGHT, 60);

  const currentSize = node.size();
  if (!currentSize || currentSize.height !== newHeight) {
    node.setSize({
      width: currentSize?.width || 260,
      height: newHeight,
    });
  }

  // Calculate ports: preserve all column port IDs to prevent X6 processRemovedPort from deleting edges!
  const newPorts: any[] = [];
  const visibleColsMap = new Map(visibleCols.map((c, idx) => [c.name, idx]));

  data.columns.forEach((col, originalIdx) => {
    const isVisible = visibleColsMap.has(col.name);
    const visibleIdx = visibleColsMap.get(col.name) ?? -1;
    const isChecked = checkedSet.has(col.name) || connectedPortIds.has(col.name);

    // Calculate Y coordinate:
    // If in edit mode: row index is originalIdx
    // If in view mode: row index is visibleIdx if visible, else -9999 off-screen
    let y: number;
    if (isEdit) {
      y = BORDER_OFFSET + HEADER_HEIGHT + originalIdx * ROW_HEIGHT + ROW_HEIGHT / 2;
    } else if (isVisible) {
      y = BORDER_OFFSET + HEADER_HEIGHT + visibleIdx * ROW_HEIGHT + ROW_HEIGHT / 2;
    } else {
      y = -9999;
    }

    const isMagnetActive = isEdit && isChecked;
    const isPortDisplayed = isEdit || isVisible;

    // Left Port
    newPorts.push({
      id: `${col.name}-in`,
      group: 'left',
      args: { y },
      attrs: {
        circle: {
          r: isEdit ? 3.5 : 3,
          magnet: isMagnetActive,
          stroke: isChecked ? '#818cf8' : '#475569',
          strokeWidth: isChecked ? 1.5 : 1,
          fill: isChecked ? '#0f111a' : '#1e293b',
          opacity: isPortDisplayed ? (isEdit ? (isChecked ? 1 : 0.25) : 0) : 0,
          display: isPortDisplayed ? 'block' : 'none',
          cursor: isMagnetActive ? 'crosshair' : 'default',
        },
      },
    });

    // Right Port
    newPorts.push({
      id: `${col.name}-out`,
      group: 'right',
      args: { y },
      attrs: {
        circle: {
          r: isEdit ? 3.5 : 3,
          magnet: isMagnetActive,
          stroke: isChecked ? '#818cf8' : '#475569',
          strokeWidth: isChecked ? 1.5 : 1,
          fill: isChecked ? '#0f111a' : '#1e293b',
          opacity: isPortDisplayed ? (isEdit ? (isChecked ? 1 : 0.25) : 0) : 0,
          display: isPortDisplayed ? 'block' : 'none',
          cursor: isMagnetActive ? 'crosshair' : 'default',
        },
      },
    });
  });

  // Use standard X6 prop method to update ports/items
  if (typeof node.prop === 'function') {
    node.prop('ports/items', newPorts, { rewrite: true });
  }
}

function toggleEditMode() {
  isEditMode.value = !isEditMode.value;
  const graph = graphInstance.value;
  if (!graph) return;

  for (const node of graph.getNodes()) {
    if (node.shape === 'er-table-node') {
      const data = node.getData<ErTableNodeData>();
      if (data) {
        node.setData({ ...data, isEditMode: isEditMode.value }, { overwrite: true });
      }
      updateNodeLayoutAndPorts(node, isEditMode.value);
    }
  }

  if (isEditMode.value) {
    workspaceStore.showToast('已開啟編輯模式：可勾選欄位隱藏/顯示、自由拖曳圓點連線', 'info', 2500);
  } else {
    workspaceStore.showToast('已切換為檢視模式：可調整表卡與連線走線以預覽出圖效果', 'info', 2000);
  }
}

// ========================
// Dagre Layout Helper
// ========================
function layoutWithDagre(
  nodes: Array<{ id: string; width: number; height: number; x?: number; y?: number }>,
  edges: Array<{ source: string; target: string }>,
  rankdir: 'LR' | 'TB' = 'LR'
) {
  const g = new dagre.graphlib.Graph();
  g.setGraph({ rankdir, nodesep: 50, ranksep: 90 });
  g.setDefaultEdgeLabel(() => ({}));

  for (const node of nodes) {
    g.setNode(node.id, { width: node.width, height: node.height });
  }

  for (const edge of edges) {
    g.setEdge(edge.source, edge.target);
  }

  dagre.layout(g);

  for (const node of nodes) {
    const pos = g.node(node.id);
    if (pos) {
      node.x = Math.max(0, pos.x - node.width / 2);
      node.y = Math.max(0, pos.y - node.height / 2);
    }
  }
}

// ========================
// Data Loading & Layout
// ========================
async function loadDiagramData() {
  const graph = graphInstance.value;
  if (!graph) return;

  const connId = props.tab.connectionId || connectionStore.activeConnectionId;
  const db = props.tab.database || connectionStore.activeDatabase;
  const rootSchema = props.tab.rootSchema || 'dbo';
  const rootTable = props.tab.rootTable;

  if (!connId || !rootTable) return;

  isLoading.value = true;
  loadingMessage.value = `正在分析 ${rootSchema}.${rootTable} 的外鍵關聯...`;

  try {
    // 1. Fetch all FKs in database
    cachedForeignKeys = await schemaService.getForeignKeys(connId, db);

    // 2. Compute 1st-degree or 2nd-degree related tables
    const targetTables = computeRelatedTables(rootSchema, rootTable, currentDepth.value, cachedForeignKeys);

    loadingMessage.value = `正在載入 ${targetTables.length} 張關聯資料表結構...`;

    // 3. Fetch columns for all target tables
    const tableDataList: Array<{
      schema: string;
      table: string;
      columns: ErTableColumn[];
      isRoot: boolean;
    }> = [];

    await Promise.all(
      targetTables.map(async (t) => {
        try {
          const cols = await schemaService.getColumns(connId, t.schema, t.table, db);
          const enrichedCols: ErTableColumn[] = cols.map((col) => {
            const isFk = cachedForeignKeys.some(
              (fk) =>
                (fk.fromSchema === t.schema && fk.fromTable === t.table && fk.fromColumn === col.name) ||
                (fk.toSchema === t.schema && fk.toTable === t.table && fk.toColumn === col.name)
            );
            return {
              ...col,
              isForeignKey: isFk,
            };
          });

          tableDataList.push({
            schema: t.schema,
            table: t.table,
            columns: enrichedCols,
            isRoot: t.schema === rootSchema && t.table === rootTable,
          });
        } catch (e) {
          console.error(`Failed to load columns for ${t.schema}.${t.table}:`, e);
        }
      })
    );

    // 4. Build Nodes & Edges Models
    renderTablesAndEdges(tableDataList, cachedForeignKeys, true);
  } catch (err: unknown) {
    console.error('Failed to load ER diagram data:', err);
    workspaceStore.showToast(`載入 ER 圖失敗：${err instanceof Error ? err.message : String(err)}`, 'error');
  } finally {
    isLoading.value = false;
  }
}

function computeRelatedTables(
  rootSchema: string,
  rootTable: string,
  depth: 1 | 2,
  fks: ForeignKeyItem[]
): Array<{ schema: string; table: string }> {
  const rootKey = `${rootSchema}.${rootTable}`;
  const d1Set = new Set<string>([rootKey]);

  for (const fk of fks) {
    const fromKey = `${fk.fromSchema}.${fk.fromTable}`;
    const toKey = `${fk.toSchema}.${fk.toTable}`;

    if (fromKey === rootKey) {
      d1Set.add(toKey);
    } else if (toKey === rootKey) {
      d1Set.add(fromKey);
    }
  }

  if (depth === 1) {
    return Array.from(d1Set).map((k) => {
      const parts = k.split('.');
      return { schema: parts[0] || 'dbo', table: parts[1] || '' };
    });
  }

  // 2nd-degree extension
  const d2Set = new Set<string>(d1Set);
  for (const tableKey of d1Set) {
    for (const fk of fks) {
      const fromKey = `${fk.fromSchema}.${fk.fromTable}`;
      const toKey = `${fk.toSchema}.${fk.toTable}`;
      if (fromKey === tableKey) {
        d2Set.add(toKey);
      } else if (toKey === tableKey) {
        d2Set.add(fromKey);
      }
    }
  }

  return Array.from(d2Set).map((k) => {
    const parts = k.split('.');
    return { schema: parts[0] || 'dbo', table: parts[1] || '' };
  });
}

function renderTablesAndEdges(
  tables: Array<{ schema: string; table: string; columns: ErTableColumn[]; isRoot: boolean }>,
  allFks: ForeignKeyItem[],
  runLayout = true
) {
  const graph = graphInstance.value;
  if (!graph) return;

  graph.clearCells();

  const BORDER_OFFSET = 1;
  const HEADER_HEIGHT = 32;
  const FOOTER_HEIGHT = isEditMode.value ? 24 : 0;
  const ROW_HEIGHT = 24;
  const tableKeyToNodeId = new Map<string, string>();

  // Create Nodes
  const nodesToLayout = tables.map((tbl) => {
    const nodeId = `node-${tbl.schema}.${tbl.table}`;
    const fullKey = `${tbl.schema}.${tbl.table}`;
    tableKeyToNodeId.set(fullKey, nodeId);

    const height = BORDER_OFFSET * 2 + HEADER_HEIGHT + tbl.columns.length * ROW_HEIGHT + FOOTER_HEIGHT;
    const width = 260;

    // Build ports for every column
    const portItems = tbl.columns.flatMap((col, idx) => {
      const y = BORDER_OFFSET + HEADER_HEIGHT + idx * ROW_HEIGHT + ROW_HEIGHT / 2;
      return [
        { id: `${col.name}-in`, group: 'left', args: { y } },
        { id: `${col.name}-out`, group: 'right', args: { y } },
      ];
    });

    const checkedColumns = tbl.columns.map((c) => c.name);
    const data: ErTableNodeData = {
      schema: tbl.schema,
      table: tbl.table,
      isRoot: tbl.isRoot,
      isKeysOnly: false,
      columns: tbl.columns,
      checkedColumns,
      isEditMode: isEditMode.value,
    };

    return {
      id: nodeId,
      shape: 'er-table-node',
      width,
      height,
      data,
      x: 0,
      y: 0,
      ports: {
        items: portItems,
      },
    };
  });

  // Filter Foreign Keys that exist between visible tables
  const edgesToLayout: Array<{
    id: string;
    source: { cell: string; port: string };
    target: { cell: string; port: string };
    connector?: any;
    attrs?: any;
    data: { cardinality: Cardinality; constraintName: string };
  }> = [];

  for (const fk of allFks) {
    const fromKey = `${fk.fromSchema}.${fk.fromTable}`;
    const toKey = `${fk.toSchema}.${fk.toTable}`;

    const sourceCell = tableKeyToNodeId.get(fromKey);
    const targetCell = tableKeyToNodeId.get(toKey);

    if (sourceCell && targetCell) {
      edgesToLayout.push({
        id: `edge-${fk.constraintName}-${fromKey}-${toKey}`,
        source: { cell: sourceCell, port: `${fk.fromColumn}-out` },
        target: { cell: targetCell, port: `${fk.toColumn}-in` },
        connector: {
          name: 'rounded',
          args: {
            radius: 6,
          },
        },
        attrs: {
          line: {
            stroke: '#818cf8',
            strokeWidth: 1.5,
          },
        },
        data: {
          cardinality: '1:N',
          constraintName: fk.constraintName,
        },
      });
    }
  }

  // If auto-layout requested, run Dagre
  if (runLayout && nodesToLayout.length > 0) {
    layoutWithDagre(
      nodesToLayout,
      edgesToLayout.map((e) => ({ source: e.source.cell, target: e.target.cell })),
      layoutDirection.value
    );
  }

  // Load into Graph
  graph.fromJSON({
    nodes: nodesToLayout,
    edges: edgesToLayout,
  });

  // Apply Cardinality labels & markers to loaded edges
  for (const edge of graph.getEdges()) {
    const d = edge.getData();
    applyEdgeCardinality(edge, d?.cardinality || '1:N', d?.constraintName);
  }

  // Ensure all nodes have correct initial ports and sizes according to isEditMode
  for (const node of graph.getNodes()) {
    updateNodeLayoutAndPorts(node, isEditMode.value);
  }

  updateStats();

  // Smooth fit to canvas
  setTimeout(() => {
    graph.zoomToFit({ padding: 50, maxScale: 1.1 });
  }, 100);
}

function applyAutoLayout(direction: 'LR' | 'TB' = 'LR') {
  const graph = graphInstance.value;
  if (!graph) return;

  const nodes = graph.getNodes();
  const edges = graph.getEdges();
  if (nodes.length === 0) return;

  // Only layout table nodes so text notes remain in their original positions
  const tableNodes = nodes.filter((n) => n.shape === 'er-table-node');
  if (tableNodes.length === 0) return;

  const dagreNodes = tableNodes.map((n) => {
    const size = n.size();
    return { id: n.id, width: size.width, height: size.height, x: 0, y: 0 };
  });

  const dagreEdges = edges.map((e) => {
    const source = e.getSource() as { cell: string };
    const target = e.getTarget() as { cell: string };
    return { source: source.cell, target: target.cell };
  });

  layoutWithDagre(dagreNodes, dagreEdges, direction);

  for (const dn of dagreNodes) {
    const cell = graph.getCellById(dn.id);
    if (cell && cell.isNode()) {
      cell.setPosition(dn.x, dn.y);
    }
  }

  graph.zoomToFit({ padding: 50, maxScale: 1.1 });
  workspaceStore.showToast('已完成自動排版', 'success', 1500);
}

function toggleLayoutDirection() {
  layoutDirection.value = layoutDirection.value === 'LR' ? 'TB' : 'LR';
  applyAutoLayout(layoutDirection.value);
}


// ========================
// Drag & Drop / Add Tables
// ========================
function handleDragOver(e: DragEvent) {
  if (e.dataTransfer?.types.includes('application/sqlight-table')) {
    e.dataTransfer.dropEffect = 'copy';
    isDragOver.value = true;
  }
}

async function handleDropTable(e: DragEvent) {
  isDragOver.value = false;
  const raw = e.dataTransfer?.getData('application/sqlight-table');
  if (!raw) return;

  try {
    const tableInfo = JSON.parse(raw) as {
      connId: string;
      db: string;
      schema: string;
      table: string;
    };

    const graph = graphInstance.value;
    if (!graph) return;

    const localPoint = graph.clientToLocal(e.clientX, e.clientY);
    await addTableToGraph(tableInfo.schema, tableInfo.table, localPoint.x, localPoint.y);
  } catch (err) {
    console.error('Failed to parse dropped table:', err);
  }
}

function handleAddTableEvent(e: CustomEvent<{ schema: string; table: string }>) {
  if (!e.detail) return;
  if (workspaceStore.activeTab?.id === props.tab.id) {
    addTableToGraph(e.detail.schema, e.detail.table);
  }
}

async function addTableToGraph(schema: string, table: string, x?: number, y?: number) {
  const graph = graphInstance.value;
  if (!graph) return;

  const nodeId = `node-${schema}.${table}`;
  const existingNode = graph.getCellById(nodeId);

  if (existingNode) {
    graph.cleanSelection();
    graph.select(existingNode);
    graph.centerCell(existingNode);
    workspaceStore.showToast(`資料表 ${schema}.${table} 已在畫布中`, 'info', 2000);
    return;
  }

  const connId = props.tab.connectionId || connectionStore.activeConnectionId;
  const db = props.tab.database || connectionStore.activeDatabase;
  if (!connId) return;

  try {
    const cols = await schemaService.getColumns(connId, schema, table, db);

    if (cachedForeignKeys.length === 0) {
      cachedForeignKeys = await schemaService.getForeignKeys(connId, db);
    }

    const enrichedCols: ErTableColumn[] = cols.map((col) => {
      const isFk = cachedForeignKeys.some(
        (fk) =>
          (fk.fromSchema === schema && fk.fromTable === table && fk.fromColumn === col.name) ||
          (fk.toSchema === schema && fk.toTable === table && fk.toColumn === col.name)
      );
      return { ...col, isForeignKey: isFk };
    });

    const BORDER_OFFSET = 1;
    const HEADER_HEIGHT = 32;
    const FOOTER_HEIGHT = isEditMode.value ? 24 : 0;
    const ROW_HEIGHT = 24;
    const height = BORDER_OFFSET * 2 + HEADER_HEIGHT + enrichedCols.length * ROW_HEIGHT + FOOTER_HEIGHT;
    const width = 260;

    const portItems = enrichedCols.flatMap((col, idx) => {
      const y = BORDER_OFFSET + HEADER_HEIGHT + idx * ROW_HEIGHT + ROW_HEIGHT / 2;
      return [
        { id: `${col.name}-in`, group: 'left', args: { y } },
        { id: `${col.name}-out`, group: 'right', args: { y } },
      ];
    });

    const checkedColumns = enrichedCols.map((c) => c.name);
    const data: ErTableNodeData = {
      schema,
      table,
      isRoot: false,
      isKeysOnly: false,
      columns: enrichedCols,
      checkedColumns,
      isEditMode: isEditMode.value,
    };

    const finalX = x !== undefined ? x : 120 + Math.random() * 80;
    const finalY = y !== undefined ? y : 120 + Math.random() * 80;

    const newNode = graph.addNode({
      id: nodeId,
      shape: 'er-table-node',
      x: finalX,
      y: finalY,
      width,
      height,
      data,
      ports: { items: portItems },
    });

    updateNodeLayoutAndPorts(newNode, isEditMode.value);

    // Check for foreign key edges with all currently existing nodes
    const existingNodes = graph.getNodes();
    const visibleTableKeys = new Set(
      existingNodes.map((n) => {
        const d = n.getData<ErTableNodeData>();
        return d ? `${d.schema}.${d.table}` : '';
      })
    );

    const currentKey = `${schema}.${table}`;
    for (const fk of cachedForeignKeys) {
      const fromKey = `${fk.fromSchema}.${fk.fromTable}`;
      const toKey = `${fk.toSchema}.${fk.toTable}`;

      if ((fromKey === currentKey && visibleTableKeys.has(toKey)) || (toKey === currentKey && visibleTableKeys.has(fromKey))) {
        const edgeId = `edge-${fk.constraintName}-${fromKey}-${toKey}`;
        if (!graph.getCellById(edgeId)) {
          const newEdge = graph.addEdge({
            id: edgeId,
            source: { cell: `node-${fromKey}`, port: `${fk.fromColumn}-out` },
            target: { cell: `node-${toKey}`, port: `${fk.toColumn}-in` },
            data: { cardinality: '1:N', constraintName: fk.constraintName },
          });
          applyEdgeCardinality(newEdge, '1:N', fk.constraintName);
        }
      }
    }

    graph.cleanSelection();
    graph.select(newNode);
    updateStats();
    workspaceStore.showToast(`已新增資料表：${schema}.${table}`, 'success', 2000);
  } catch (err) {
    console.error('Failed to add table to ER diagram:', err);
    workspaceStore.showToast('新增資料表失敗', 'error');
  }
}


function handleAddTextNode() {
  const graph = graphInstance.value;
  if (!graph) return;

  let x = 120;
  let y = 120;
  if (graphContainerRef.value) {
    const rect = graphContainerRef.value.getBoundingClientRect();
    const center = graph.clientToLocal(rect.left + rect.width / 2, rect.top + rect.height / 2);
    const jitterX = (Math.random() - 0.5) * 40;
    const jitterY = (Math.random() - 0.5) * 40;
    x = Math.round(center.x - 120 + jitterX);
    y = Math.round(center.y - 60 + jitterY);
  }

  const id = `text-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  const textNode = graph.addNode({
    id,
    shape: 'er-text-node',
    x,
    y,
    width: 240,
    height: 120,
    data: {
      text: '',
      color: 'amber',
    },
  });

  graph.cleanSelection();
  graph.select(textNode);
  updateStats();
  workspaceStore.showToast('已新增文字備註，可點擊直接輸入說明', 'info', 2000);
}

// ========================
// Zoom Controls
// ========================
function handleZoomIn() {
  graphInstance.value?.zoom(0.15);
}

function handleZoomOut() {
  graphInstance.value?.zoom(-0.15);
}

function handleZoomReset() {
  graphInstance.value?.zoomTo(1);
  graphInstance.value?.centerContent();
}

function handleZoomFit() {
  graphInstance.value?.zoomToFit({ padding: 40, maxScale: 1.2 });
}

// ========================
// Export Options
// ========================
function exportAsPng() {
  isExportMenuOpen.value = false;
  const graph = graphInstance.value;
  if (!graph) return;

  const title = props.tab.title.replace(/[^a-zA-Z0-9_\u4e00-\u9fa5-]/g, '_');
  try {
    const stylesheet = getAppStylesheets();
    graph.toPNG(
      async (dataUri: string) => {
        try {
          const res = await saveDataUriToFile(dataUri, `${title}.png`);
          if (res.saved) {
            workspaceStore.showToast(`已成功儲存 PNG 圖檔: ${res.fileName}`, 'success');
          }
        } catch (err) {
          console.error('Save PNG failed:', err);
          workspaceStore.showToast('儲存 PNG 失敗', 'error');
        }
      },
      {
        padding: 40,
        backgroundColor: '#0f111a',
        quality: 1.0,
        ratio: 2, // 2x high resolution (Retina quality)
        copyStyles: true,
        stylesheet,
        beforeSerialize(clonedSVG: SVGSVGElement) {
          // Ensure all foreignObject children have explicit XHTML namespace for clean rasterization
          const foreignObjects = clonedSVG.querySelectorAll('foreignObject');
          foreignObjects.forEach((fo) => {
            Array.from(fo.children).forEach((child) => {
              if (!child.getAttribute('xmlns')) {
                child.setAttribute('xmlns', 'http://www.w3.org/1999/xhtml');
              }
            });
          });
        },
      }
    );
  } catch (e) {
    console.error('Export PNG failed:', e);
    workspaceStore.showToast('匯出 PNG 失敗', 'error');
  }
}

function exportAsSvg() {
  isExportMenuOpen.value = false;
  const graph = graphInstance.value;
  if (!graph) return;

  const title = props.tab.title.replace(/[^a-zA-Z0-9_\u4e00-\u9fa5-]/g, '_');
  try {
    const stylesheet = getAppStylesheets();
    const bbox = graph.getContentBBox();
    const padding = 40;
    const viewBox = {
      x: Math.round(bbox.x - padding),
      y: Math.round(bbox.y - padding),
      width: Math.max(Math.round(bbox.width + padding * 2), 100),
      height: Math.max(Math.round(bbox.height + padding * 2), 100),
    };

    graph.toSVG(
      async (svgString: string) => {
        try {
          const res = await saveSvgToFile(svgString, `${title}.svg`);
          if (res.saved) {
            workspaceStore.showToast(`已成功儲存 SVG 向量圖: ${res.fileName}`, 'success');
          }
        } catch (err) {
          console.error('Save SVG failed:', err);
          workspaceStore.showToast('儲存 SVG 失敗', 'error');
        }
      },
      {
        viewBox,
        preserveDimensions: {
          width: viewBox.width,
          height: viewBox.height,
        },
        copyStyles: true,
        stylesheet,
        beforeSerialize(clonedSVG: SVGSVGElement) {
          // 1. Ensure all foreignObject children have explicit XHTML namespace
          const foreignObjects = clonedSVG.querySelectorAll('foreignObject');
          foreignObjects.forEach((fo) => {
            Array.from(fo.children).forEach((child) => {
              if (!child.getAttribute('xmlns')) {
                child.setAttribute('xmlns', 'http://www.w3.org/1999/xhtml');
              }
            });
          });

          // 2. Insert solid dark background rect behind all content
          const bgRect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
          bgRect.setAttribute('x', `${viewBox.x}`);
          bgRect.setAttribute('y', `${viewBox.y}`);
          bgRect.setAttribute('width', `${viewBox.width}`);
          bgRect.setAttribute('height', `${viewBox.height}`);
          bgRect.setAttribute('fill', '#0f111a');
          clonedSVG.insertBefore(bgRect, clonedSVG.firstChild);

          // 3. Ensure essential SVG namespaces on root element
          clonedSVG.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
          clonedSVG.setAttribute('xmlns:xlink', 'http://www.w3.org/1999/xlink');
          clonedSVG.setAttribute('xmlns:xhtml', 'http://www.w3.org/1999/xhtml');
        },
      }
    );
  } catch (e) {
    console.error('Export SVG failed:', e);
    workspaceStore.showToast('匯出 SVG 失敗', 'error');
  }
}

async function exportAsJson() {
  isExportMenuOpen.value = false;
  const graph = graphInstance.value;
  if (!graph) return;

  const title = props.tab.title.replace(/[^a-zA-Z0-9_\u4e00-\u9fa5-]/g, '_');
  const payload = {
    $schema: 'https://sqlight.dev/schemas/er-model-v1.json',
    type: 'sqlight_er_model',
    version: '1.0',
    title: props.tab.title,
    rootSchema: props.tab.rootSchema,
    rootTable: props.tab.rootTable,
    depth: currentDepth.value,
    exportedAt: new Date().toISOString(),
    graph: graph.toJSON(),
  };

  const jsonStr = JSON.stringify(payload, null, 2);
  try {
    const res = await saveErDiagramToFile(jsonStr, `${title}.sqlight-er.json`);
    if (res.saved) {
      workspaceStore.showToast(`已成功儲存 X6 格式原始碼: ${res.fileName}`, 'success');
    }
  } catch (err) {
    console.error('Save JSON failed:', err);
    workspaceStore.showToast('儲存原始碼失敗', 'error');
  }
}

function restoreFromInitialData(data: any) {
  const graph = graphInstance.value;
  if (!graph) return;

  try {
    const graphData = data.graph || data;
    graph.fromJSON(graphData);

    // Apply proper cardinality styling to all restored edges
    for (const edge of graph.getEdges()) {
      const d = edge.getData();
      applyEdgeCardinality(edge, d?.cardinality || '1:N', d?.constraintName);
    }

    // Ensure restored nodes have synchronized edit mode, ports, and sizes
    for (const node of graph.getNodes()) {
      if (node.shape === 'er-table-node') {
        const d = node.getData<ErTableNodeData>();
        if (d) {
          node.setData({ ...d, isEditMode: isEditMode.value }, { overwrite: true });
        }
        updateNodeLayoutAndPorts(node, isEditMode.value);
      }
    }

    updateStats();
    setTimeout(() => {
      graph.zoomToFit({ padding: 50, maxScale: 1.1 });
    }, 100);
    workspaceStore.showToast('已還原 ER 模型圖', 'success');
  } catch (err) {
    console.error('Failed to restore ER diagram from file:', err);
    workspaceStore.showToast('載入圖檔結構失敗', 'error');
  }
}
</script>
