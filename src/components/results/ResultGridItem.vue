<template>
  <div class="w-full h-full flex flex-col bg-dark-900 overflow-hidden font-mono text-xs select-none">
    <!-- Subheader Toolbar: Result Set Info, Quick Filter, Warnings, Actions -->
    <div class="h-8 bg-dark-850 border-b border-dark-700 flex items-center justify-between px-2 flex-shrink-0 space-x-2">
      <!-- Left: Result Set Label & Quick Filter -->
      <div class="flex items-center space-x-2 min-w-0">
        <!-- Multiple Result Set Index Badge -->
        <div
          v-if="totalSets > 1"
          class="flex items-center space-x-1 px-2 py-0.5 rounded bg-dark-800 border border-dark-700 text-xxs font-medium text-brand-300 flex-shrink-0 shadow-xs"
        >
          <Table class="w-3 h-3 text-brand-400" />
          <span class="font-semibold">Result #{{ setIndex + 1 }}</span>
          <span class="text-dark-400">({{ resultSet.rowCount ?? resultSet.rows.length }})</span>
        </div>

        <!-- Quick Filter Input -->
        <div class="relative flex items-center w-44 sm:w-56">
          <Search class="w-3 h-3 text-dark-500 absolute left-2 pointer-events-none" />
          <input
            v-model="quickFilter"
            type="text"
            placeholder="Search grid..."
            class="w-full bg-dark-900 border border-dark-700 rounded px-2 py-0.5 pl-7 pr-6 text-xs text-dark-100 placeholder-dark-500 focus:outline-none focus:border-brand-500 font-mono transition-colors"
          />
          <button
            v-if="quickFilter"
            @click="quickFilter = ''"
            class="absolute right-1.5 text-dark-400 hover:text-dark-200 p-0.5"
            title="Clear filter"
          >
            <X class="w-2.5 h-2.5" />
          </button>
        </div>

        <!-- Truncation Warning Badge (when max rows limit reached) -->
        <div
          v-if="resultSet.isTruncated"
          class="hidden md:flex items-center space-x-1 bg-amber-950/60 text-amber-300 border border-amber-800/60 px-2 py-0.5 rounded text-xxs font-sans truncate"
          :title="`查詢結果筆數超過上限，已自動截斷至 ${resultSet.rowCount.toLocaleString()} 筆以保護記憶體效能`"
        >
          <AlertTriangle class="w-3 h-3 text-amber-400 flex-shrink-0" />
          <span>已達上限 {{ resultSet.rowCount.toLocaleString() }} 筆（共 {{ (resultSet.totalCount ?? resultSet.rowCount).toLocaleString() }} 筆，其餘已截斷）</span>
        </div>

        <!-- Estimated Plan Badge -->
        <div
          v-if="queryStore.activeResultTab?.isShowplan"
          class="hidden md:flex items-center space-x-1 bg-cyan-950/60 text-cyan-300 border border-cyan-800/60 px-2 py-0.5 rounded text-xxs font-sans truncate shadow-xs"
          title="此結果分頁為 SET SHOWPLAN_ALL ON 預估執行計畫，未實際執行語句"
        >
          <Workflow class="w-3 h-3 text-cyan-400 flex-shrink-0" />
          <span>預估執行計畫 (Estimated Plan)</span>
        </div>

        <div class="h-3.5 w-px bg-dark-750 mx-1 flex-shrink-0"></div>

        <!-- Inline Editing Toolbar: Revert & Commit -->
        <div class="flex items-center space-x-1 flex-shrink-0">
          <template v-if="editability.canEdit">
            <!-- Revert Button -->
            <button
              @click="handleRevertChanges"
              :disabled="modifiedCount === 0"
              class="flex items-center space-x-1 px-2 py-0.5 rounded border text-xxs transition-colors select-none"
              :class="modifiedCount > 0
                ? 'bg-dark-800 hover:bg-dark-750 text-amber-300 border-amber-600/50 hover:border-amber-500 cursor-pointer shadow-xs'
                : 'bg-dark-850 text-dark-500 border-dark-750 cursor-not-allowed opacity-50'"
              title="退回所有未提交的修改 (Revert All)"
            >
              <RotateCcw class="w-2.5 h-2.5" />
              <span>退回</span>
            </button>

            <!-- Commit Button -->
            <button
              @click="openCommitModal"
              :disabled="modifiedCount === 0"
              class="flex items-center space-x-1 px-2.5 py-0.5 rounded border text-xxs transition-colors select-none"
              :class="modifiedCount > 0
                ? 'bg-emerald-950/80 hover:bg-emerald-900 text-emerald-300 border-emerald-600/70 hover:border-emerald-500 font-semibold cursor-pointer shadow-xs'
                : 'bg-dark-850 text-dark-500 border-dark-750 cursor-not-allowed opacity-50'"
              title="提交所有修改至資料庫 (Commit Changes)"
            >
              <Check class="w-2.5 h-2.5" />
              <span>提交</span>
              <span
                v-if="modifiedCount > 0"
                class="ml-1 px-1 py-0 bg-emerald-500/30 text-emerald-200 rounded text-[10px] font-mono"
              >
                {{ modifiedCount }}
              </span>
            </button>
          </template>

          <!-- Read-only Indicator when editing is not supported -->
          <template v-else>
            <div
              class="flex items-center space-x-1 px-2 py-0.5 bg-dark-850 text-dark-400 border border-dark-750 rounded text-xxs select-none"
              :title="editability.reason"
            >
              <Lock class="w-2.5 h-2.5 text-dark-500 flex-shrink-0" />
              <span>{{ editability.shortReason || '唯讀' }}</span>
            </div>
          </template>
        </div>
      </div>

      <!-- Right: Copy Tools, Row Stats & Maximize Toggle -->
      <div class="flex items-center space-x-1.5 flex-shrink-0">
        <!-- Refresh Button -->
        <button
          @click="handleRefresh"
          :disabled="isRefreshing"
          class="flex items-center space-x-1 px-2 py-0.5 bg-dark-800 hover:bg-dark-750 text-dark-300 hover:text-dark-100 rounded border border-dark-700 text-xxs transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          :title="isRefreshing ? '正在重新整理中...' : '重新整理此查詢結果 (Re-run SQL)'"
        >
          <RotateCw class="w-2.5 h-2.5 text-brand-400" :class="isRefreshing ? 'animate-spin' : ''" />
          <span>{{ isRefreshing ? 'Refreshing...' : '重新整理' }}</span>
        </button>

        <!-- Copy to TSV (Excel friendly) -->
        <button
          @click="copyAsTsv"
          class="flex items-center space-x-1 px-2 py-0.5 bg-dark-800 hover:bg-dark-750 text-dark-300 hover:text-dark-100 rounded border border-dark-700 text-xxs transition-colors cursor-pointer"
          title="複製全部為 TSV (相容 Excel 貼上)"
        >
          <Check v-if="copiedTsv" class="w-2.5 h-2.5 text-emerald-400" />
          <FileSpreadsheet v-else class="w-2.5 h-2.5 text-emerald-400" />
          <span>{{ copiedTsv ? 'Copied!' : 'Copy TSV' }}</span>
        </button>

        <!-- Copy to CSV -->
        <button
          @click="copyAsCsv"
          class="flex items-center space-x-1 px-2 py-0.5 bg-dark-800 hover:bg-dark-750 text-dark-300 hover:text-dark-100 rounded border border-dark-700 text-xxs transition-colors cursor-pointer"
          title="複製為 CSV 格式"
        >
          <Check v-if="copiedCsv" class="w-2.5 h-2.5 text-brand-400" />
          <FileText v-else class="w-2.5 h-2.5 text-brand-400" />
          <span>{{ copiedCsv ? 'Copied!' : 'CSV' }}</span>
        </button>

        <!-- Copy as JSON -->
        <button
          @click="copyAsJson"
          class="flex items-center space-x-1 px-2 py-0.5 bg-dark-800 hover:bg-dark-750 text-dark-300 hover:text-dark-100 rounded border border-dark-700 text-xxs transition-colors cursor-pointer"
          title="複製全表為 JSON 物件陣列"
        >
          <Braces class="w-2.5 h-2.5 text-cyan-400" />
          <span>JSON</span>
        </button>

        <!-- Copy as Markdown -->
        <button
          @click="copyAsMarkdown"
          class="flex items-center space-x-1 px-2 py-0.5 bg-dark-800 hover:bg-dark-750 text-dark-300 hover:text-dark-100 rounded border border-dark-700 text-xxs transition-colors cursor-pointer"
          title="複製全表為 Markdown 表格 (貼入 GitHub / Notion)"
        >
          <TableIcon class="w-2.5 h-2.5 text-pink-400" />
          <span>MD</span>
        </button>

        <div class="h-3.5 w-px bg-dark-750 mx-0.5"></div>

        <!-- Row Count Indicator -->
        <span class="text-xxs text-dark-400 font-mono">
          <strong class="text-dark-200">{{ resultSet.rows.length.toLocaleString() }}</strong> rows
        </span>

        <!-- Maximize / Restore Toggle (when multiple result sets) -->
        <button
          v-if="totalSets > 1"
          type="button"
          @click="$emit('toggle-maximize')"
          class="p-1 text-dark-400 hover:text-dark-200 hover:bg-dark-750 rounded transition-colors ml-1 cursor-pointer"
          :title="isMaximized ? '恢復預設多網格檢視' : '最大化檢視此結果集'"
        >
          <Minimize2 v-if="isMaximized" class="w-3 h-3 text-brand-400" />
          <Maximize2 v-else class="w-3 h-3" />
        </button>
      </div>
    </div>

    <!-- Empty State -->
    <div
      v-if="!resultSet || resultSet.rows.length === 0"
      class="flex-1 flex flex-col items-center justify-center text-dark-500 space-y-1"
    >
      <Inbox class="w-6 h-6 stroke-1" />
      <span>No rows returned</span>
    </div>

    <!-- AG Grid Area -->
    <div
      v-else
      ref="gridContainerRef"
      class="flex-1 w-full overflow-hidden relative"
      @contextmenu.prevent
      @mousedown="onGridMouseDown"
      @click="onGridClick"
    >
      <AgGridVue
        class="w-full h-full"
        :theme="sqlightGridTheme"
        :row-data="resultSet.rows"
        :column-defs="columnDefs"
        :quick-filter-text="quickFilter"
        :enable-cell-text-selection="false"
        :ensure-dom-order="true"
        :prevent-default-on-context-menu="true"
        :tooltip-show-mode="'whenTruncated'"
        :tooltip-show-delay="150"
        :tooltip-hide-delay="6000"
        :suppress-row-hover-highlight="false"
        :stop-editing-when-cells-lose-focus="true"
        @grid-ready="onGridReady"
        @cell-context-menu="onCellContextMenu"
        @body-scroll="onBodyScroll"
        @column-moved="onColumnMoved"
      />
    </div>

    <!-- Excel-Grade Live Aggregate Bar -->
    <div class="h-6 bg-dark-850 border-t border-dark-700 flex items-center justify-between px-3 text-xxs font-sans text-dark-300 flex-shrink-0 select-none">
      <!-- Left: Statistics or Default Summary -->
      <div class="flex items-center space-x-2.5 overflow-x-auto min-w-0">
        <template v-if="selectionStats">
          <div class="flex items-center space-x-1 font-semibold text-brand-300 flex-shrink-0">
            <span>選取:</span>
            <span v-if="selectedColumnsCount > 1" class="text-amber-300 font-mono">
              {{ selectedColumnsCount }} 欄
            </span>
            <span class="font-mono text-dark-100">
              {{ selectedColumnsCount > 1 ? `(${selectionStats.totalCells.toLocaleString()} 格)` : `${selectionStats.totalCells.toLocaleString()} 格` }}
            </span>
            <span v-if="selectionStats.numericCount > 0" class="text-dark-400 font-mono text-[10px]">
              [{{ selectionStats.numericCount.toLocaleString() }} 數值]
            </span>
          </div>

          <template v-if="selectionStats.numericCount > 0">
            <span class="text-dark-600 flex-shrink-0">|</span>
            <div class="flex-shrink-0">
              總和 (Sum): <strong class="font-mono text-emerald-400">{{ formatAggregateNumber(selectionStats.sum) }}</strong>
            </div>
            <span class="text-dark-600 flex-shrink-0">|</span>
            <div class="flex-shrink-0">
              平均 (Avg): <strong class="font-mono text-sky-400">{{ formatAggregateNumber(selectionStats.avg) }}</strong>
            </div>
            <span class="text-dark-600 flex-shrink-0">|</span>
            <div class="flex-shrink-0">
              最小值 (Min): <strong class="font-mono text-amber-400">{{ formatAggregateNumber(selectionStats.min) }}</strong>
            </div>
            <span class="text-dark-600 flex-shrink-0">|</span>
            <div class="flex-shrink-0">
              最大值 (Max): <strong class="font-mono text-purple-400">{{ formatAggregateNumber(selectionStats.max) }}</strong>
            </div>
          </template>

          <span class="text-dark-600 flex-shrink-0">|</span>
          <div class="flex-shrink-0">
            非重複計數: <strong class="font-mono text-dark-100">{{ selectionStats.distinctCount.toLocaleString() }}</strong>
          </div>

          <button
            type="button"
            @click="clearCellSelection"
            class="ml-1 text-dark-400 hover:text-dark-200 underline text-[10px] cursor-pointer flex-shrink-0"
            title="清除選取 (Esc)"
          >
            清除
          </button>
        </template>

        <template v-else>
          <div class="flex items-center space-x-2 text-dark-400">
            <span>共 <strong class="font-mono text-dark-200">{{ resultSet.rows.length.toLocaleString() }}</strong> 列</span>
            <span class="text-dark-600">|</span>
            <span><strong class="font-mono text-dark-200">{{ resultSet.columns.length }}</strong> 個欄位</span>
            <span class="text-dark-600">|</span>
            <span class="text-dark-500 italic text-[10px]">提示：支援標題列拖曳多欄選取、Shift 連續多欄、Ctrl 多選、儲存格框選與 Ctrl+A 全選</span>
          </div>
        </template>
      </div>

      <!-- Right: Copy Selection Button -->
      <div v-if="selectionStats" class="flex items-center space-x-1 flex-shrink-0 ml-2">
        <button
          type="button"
          @click="copySelectedCells"
          class="flex items-center space-x-1 px-1.5 py-0.5 bg-brand-500/20 hover:bg-brand-500/30 text-brand-300 rounded border border-brand-500/40 text-[10px] transition-colors cursor-pointer"
          title="複製選取內容 (Ctrl+C)"
        >
          <Copy class="w-2.5 h-2.5" />
          <span>複製選取</span>
        </button>
      </div>
    </div>

    <!-- Custom Context Menu for Cells & Column Pinning -->
    <div
      v-if="contextMenu.visible"
      :style="{ top: `${contextMenu.y}px`, left: `${contextMenu.x}px` }"
      class="fixed z-50 bg-dark-800 border border-dark-700 rounded shadow-xl py-1 w-52 text-xs font-sans text-dark-200 select-none"
      @click="contextMenu.visible = false"
    >
      <div class="px-2.5 py-1 text-xxs text-dark-400 border-b border-dark-750 font-mono truncate">
        {{ contextMenu.colName }}: {{ String(contextMenu.cellValue ?? 'NULL') }}
      </div>

      <button
        @click="copyCellValue"
        class="w-full text-left px-2.5 py-1.5 hover:bg-dark-750 hover:text-dark-100 flex items-center space-x-2 transition-colors"
      >
        <Copy class="w-3.5 h-3.5 text-brand-400" />
        <span>複製儲存格值 (Copy Cell)</span>
      </button>

      <button
        @click="copyCurrentRow"
        class="w-full text-left px-2.5 py-1.5 hover:bg-dark-750 hover:text-dark-100 flex items-center space-x-2 transition-colors"
      >
        <FileText class="w-3.5 h-3.5 text-emerald-400" />
        <span>複製整列資料 (Copy Row)</span>
      </button>

      <button
        @click="copyCurrentRowAsJson"
        class="w-full text-left px-2.5 py-1.5 hover:bg-dark-750 hover:text-dark-100 flex items-center space-x-2 transition-colors"
      >
        <Braces class="w-3.5 h-3.5 text-teal-400" />
        <span>複製整列為 JSON (Row JSON)</span>
      </button>

      <!-- Cell Editing Quick Actions in Context Menu -->
      <template v-if="isCurrentCellEditable">
        <div class="my-1 border-t border-dark-750"></div>
        <button
          v-if="isCurrentCellNullable && contextMenu.cellValue !== null"
          @click="setCellNull"
          class="w-full text-left px-2.5 py-1.5 hover:bg-dark-750 hover:text-amber-300 flex items-center space-x-2 transition-colors text-amber-400"
        >
          <Slash class="w-3.5 h-3.5" />
          <span>設為 NULL (Set NULL)</span>
        </button>
        <button
          v-if="isCurrentCellModified"
          @click="revertSingleCell"
          class="w-full text-left px-2.5 py-1.5 hover:bg-dark-750 hover:text-amber-300 flex items-center space-x-2 transition-colors text-amber-400"
        >
          <Undo2 class="w-3.5 h-3.5" />
          <span>退回此儲存格修改 (Revert Cell)</span>
        </button>
      </template>

      <div class="my-1 border-t border-dark-750"></div>

      <!-- Selection Copy (if selection active) -->
      <button
        v-if="hasSelection"
        @click="copySelectedCells"
        class="w-full text-left px-2.5 py-1.5 hover:bg-dark-750 hover:text-dark-100 flex items-center space-x-2 transition-colors"
      >
        <Copy class="w-3.5 h-3.5 text-brand-300" />
        <span>複製選取內容 ({{ selectionStats?.totalCells }} 格)</span>
      </button>

      <button
        v-if="hasSelection"
        @click="copySelectedAsJson"
        class="w-full text-left px-2.5 py-1.5 hover:bg-dark-750 hover:text-dark-100 flex items-center space-x-2 transition-colors"
      >
        <Braces class="w-3.5 h-3.5 text-cyan-400" />
        <span>複製選取為 JSON 物件陣列</span>
      </button>

      <!-- DML SQL Generation Options -->
      <button
        @click="handleGenerateDml('INSERT')"
        class="w-full text-left px-2.5 py-1.5 hover:bg-dark-750 hover:text-dark-100 flex items-center space-x-2 transition-colors"
      >
        <PlusCircle class="w-3.5 h-3.5 text-sky-400" />
        <span>建立 INSERT 語法</span>
      </button>

      <button
        @click="handleGenerateDml('UPDATE')"
        class="w-full text-left px-2.5 py-1.5 hover:bg-dark-750 hover:text-dark-100 flex items-center space-x-2 transition-colors"
      >
        <Edit3 class="w-3.5 h-3.5 text-amber-400" />
        <span>建立 UPDATE 語法</span>
      </button>

      <button
        @click="handleGenerateDml('DELETE')"
        class="w-full text-left px-2.5 py-1.5 hover:bg-dark-750 hover:text-dark-100 flex items-center space-x-2 transition-colors"
      >
        <Trash2 class="w-3.5 h-3.5 text-rose-400" />
        <span>建立 DELETE 語法</span>
      </button>

      <div class="my-1 border-t border-dark-750"></div>

      <button
        @click="togglePinColumn"
        class="w-full text-left px-2.5 py-1.5 hover:bg-dark-750 hover:text-dark-100 flex items-center space-x-2 transition-colors"
      >
        <PinOff v-if="isColPinned" class="w-3.5 h-3.5 text-amber-400" />
        <Pin v-else class="w-3.5 h-3.5 text-amber-400" />
        <span>{{ isColPinned ? '取消凍結此欄 (Unpin)' : '凍結此欄於左側 (Pin Left)' }}</span>
      </button>

      <div class="my-1 border-t border-dark-750"></div>

      <button
        @click="copyAsTsv"
        class="w-full text-left px-2.5 py-1.5 hover:bg-dark-750 hover:text-dark-100 flex items-center space-x-2 transition-colors"
      >
        <FileSpreadsheet class="w-3.5 h-3.5 text-indigo-400" />
        <span>複製全表為 TSV (Excel)</span>
      </button>

      <button
        @click="copyAsJson"
        class="w-full text-left px-2.5 py-1.5 hover:bg-dark-750 hover:text-dark-100 flex items-center space-x-2 transition-colors"
      >
        <Braces class="w-3.5 h-3.5 text-cyan-400" />
        <span>複製全表為 JSON</span>
      </button>

      <button
        @click="copyAsMarkdown"
        class="w-full text-left px-2.5 py-1.5 hover:bg-dark-750 hover:text-dark-100 flex items-center space-x-2 transition-colors"
      >
        <TableIcon class="w-3.5 h-3.5 text-pink-400" />
        <span>複製全表為 Markdown 表格</span>
      </button>
    </div>

    <!-- Commit Confirmation Modal -->
    <div
      v-if="commitModal.visible"
      class="fixed inset-0 z-50 bg-black/65 flex items-center justify-center p-4 sm:p-6 backdrop-blur-xs select-none"
      @click.self="closeCommitModal"
    >
      <div
        class="bg-dark-850 border rounded-lg shadow-2xl w-[92vw] max-w-5xl h-[88vh] max-h-[850px] flex flex-col overflow-hidden text-sans transition-colors"
        :class="requiresModificationPrompt ? (commitModal.confirmStep === 2 ? 'border-rose-600/80 shadow-rose-950/40' : 'border-amber-600/80 shadow-amber-950/30') : 'border-dark-700'"
      >
        <!-- Modal Header -->
        <div
          class="px-5 py-3.5 border-b border-dark-750 flex items-center justify-between flex-shrink-0"
          :class="requiresModificationPrompt && commitModal.confirmStep === 2 ? 'bg-rose-950/30 border-rose-900/50' : 'bg-dark-800'"
        >
          <div class="flex items-center space-x-2.5">
            <div
              class="w-7 h-7 rounded-md flex items-center justify-center"
              :class="requiresModificationPrompt ? (commitModal.confirmStep === 2 ? 'bg-rose-950/80 border border-rose-700/60' : 'bg-amber-950/80 border border-amber-700/60') : 'bg-emerald-950/80 border border-emerald-700/60'"
            >
              <ShieldAlert v-if="requiresModificationPrompt && commitModal.confirmStep === 2" class="w-4 h-4 text-rose-400 animate-pulse" />
              <AlertTriangle v-else-if="requiresModificationPrompt" class="w-4 h-4 text-amber-400" />
              <CheckCircle2 v-else class="w-4 h-4 text-emerald-400" />
            </div>
            <div>
              <h3 class="font-semibold text-sm text-dark-100 leading-tight">
                {{ requiresModificationPrompt ? (commitModal.confirmStep === 2 ? '確認提交資料變更 (高危最終確認 2/2)' : '確認提交資料變更 (修改提示 1/2)') : '確認提交資料變更 (Commit Changes)' }}
              </h3>
              <p class="text-xxs text-dark-400 mt-0.5">
                {{ requiresModificationPrompt ? (commitModal.confirmStep === 2 ? '注意：此操作將直接更動目標資料庫！資料修改後可能無法復原' : '連線已啟用修改提示保護，請核實即將寫入資料庫的交易語法與異動範圍') : '請確認以下即將寫入資料庫的交易 T-SQL 語法與異動範圍' }}
              </p>
            </div>
          </div>
          <button
            @click="closeCommitModal"
            class="text-dark-400 hover:text-dark-200 p-1.5 rounded hover:bg-dark-700 transition-colors cursor-pointer"
            title="關閉 (Esc)"
          >
            <X class="w-4 h-4" />
          </button>
        </div>

        <!-- Modal Body -->
        <div class="p-5 flex-1 flex flex-col min-h-0 space-y-3.5 text-xs bg-dark-900">
          <!-- Summary Info Strip -->
          <div class="bg-dark-850 border border-dark-750 rounded-md px-4 py-2.5 flex items-center justify-between font-mono flex-shrink-0">
            <div class="flex items-center space-x-2">
              <span class="text-dark-400 text-xxs">目標資料表: </span>
              <strong class="text-brand-300 font-semibold text-xs">[{{ editability.targetTable?.schema }}].[{{ editability.targetTable?.tableName }}]</strong>
            </div>
            <div class="flex items-center space-x-3 text-dark-300 text-xxs">
              <span>異動列數: <strong class="text-emerald-400 font-semibold text-xs">{{ commitModal.rowCount }}</strong> 列</span>
              <span class="text-dark-600">|</span>
              <span>異動格數: <strong class="text-amber-400 font-semibold text-xs">{{ commitModal.cellCount }}</strong> 格</span>
            </div>
          </div>

          <!-- Error Alert if any -->
          <div v-if="commitModal.error" class="bg-rose-950/50 border border-rose-800 text-rose-300 p-3 rounded-md text-xs flex items-start space-x-2 flex-shrink-0">
            <AlertTriangle class="w-4 h-4 text-rose-400 flex-shrink-0 mt-0.5" />
            <div class="flex-1 font-mono break-all whitespace-pre-wrap">{{ commitModal.error }}</div>
          </div>

          <!-- SQL Preview with Monaco Syntax Highlighting -->
          <div class="flex-1 flex flex-col min-h-0">
            <div class="text-xxs text-dark-400 mb-1.5 flex items-center justify-between flex-shrink-0">
              <span class="flex items-center space-x-1.5">
                <span class="font-medium text-dark-200">即將執行的安全交易 T-SQL 語法</span>
                <span class="text-dark-500">(含 @@ROWCOUNT 防護，任一列失敗自動完整 ROLLBACK)</span>
              </span>
              <button
                type="button"
                @click="copyCommitSql"
                class="px-2 py-0.5 rounded border border-dark-700 bg-dark-800 hover:bg-dark-750 text-dark-300 hover:text-dark-100 flex items-center space-x-1 text-xxs transition-colors cursor-pointer"
                title="複製語法至剪貼簿"
              >
                <Copy class="w-2.5 h-2.5 text-brand-400" />
                <span>複製語法</span>
              </button>
            </div>

            <!-- Monaco SQL Code Viewer Container -->
            <div class="flex-1 min-h-[350px] border border-dark-750 rounded-md overflow-hidden relative shadow-inner">
              <SqlCodeViewer :code="commitModal.sql" language="sql" class="w-full h-full" />
            </div>
          </div>
        </div>

        <!-- Modal Footer -->
        <div class="px-5 py-3 border-t border-dark-750 flex items-center justify-between bg-dark-800 flex-shrink-0">
          <!-- Left: High Risk Warning / Standard Note -->
          <div v-if="requiresModificationPrompt" class="flex-1 min-w-0 mr-4">
            <div
              v-if="commitModal.confirmStep === 1"
              class="flex items-center space-x-2 px-3 py-1.5 rounded bg-amber-950/40 border border-amber-800/60 text-amber-300 text-xxs leading-normal"
            >
              <AlertTriangle class="w-4 h-4 text-amber-400 shrink-0" />
              <span>
                <strong>高危提醒 (1/2)：</strong>連線「{{ currentConnection?.name }}」已啟用修改提示防護。此操作將直接更動資料庫，需進行 <strong>2 次重複確認</strong> 才可提交！
              </span>
            </div>
            <div
              v-else
              class="flex items-center space-x-2 px-3 py-1.5 rounded bg-rose-950/60 border border-rose-700/80 text-rose-200 text-xxs leading-normal animate-pulse"
            >
              <AlertOctagon class="w-4 h-4 text-rose-400 shrink-0" />
              <span>
                <strong class="text-white">高危提醒 (2/2 最終確認)：</strong>即將對目標資料表實施實體資料更動！資料修改後可能無法復原，請再次核實無誤後點擊執行。
              </span>
            </div>
          </div>
          <div v-else class="text-xxs text-dark-400">
            提示：所有異動包含在同一交易 (BEGIN TRAN) 中，任何錯誤均完整復原
          </div>

          <!-- Right: Buttons -->
          <div class="flex items-center space-x-2 shrink-0">
            <button
              type="button"
              @click="closeCommitModal"
              class="px-3 py-1.5 rounded border border-dark-700 hover:bg-dark-750 text-dark-300 hover:text-dark-100 text-xs transition-colors cursor-pointer"
            >
              {{ requiresModificationPrompt && commitModal.confirmStep === 2 ? '放棄提交 (Esc)' : '取消' }}
            </button>

            <!-- Guarded Step 1 Button -->
            <button
              v-if="requiresModificationPrompt && commitModal.confirmStep === 1"
              type="button"
              @click="commitModal.confirmStep = 2"
              class="px-4 py-1.5 rounded bg-amber-600 hover:bg-amber-500 text-white font-semibold text-xs flex items-center space-x-1.5 transition-colors cursor-pointer shadow-sm"
            >
              <span>初次確認提交 (1/2)</span>
              <ArrowRight class="w-3.5 h-3.5" />
            </button>

            <!-- Guarded Step 2 Button -->
            <button
              v-else-if="requiresModificationPrompt && commitModal.confirmStep === 2"
              type="button"
              @click="executeCommit"
              :disabled="commitModal.isExecuting"
              class="px-4 py-1.5 rounded bg-rose-600 hover:bg-rose-500 active:bg-rose-700 disabled:opacity-50 text-white font-bold text-xs flex items-center space-x-1.5 transition-colors cursor-pointer shadow-md shadow-rose-950/50"
            >
              <Loader2 v-if="commitModal.isExecuting" class="w-3.5 h-3.5 animate-spin" />
              <AlertTriangle v-else class="w-3.5 h-3.5" />
              <span>{{ commitModal.isExecuting ? '提交執行中...' : '確定立即提交 (最終確認 2/2)' }}</span>
            </button>

            <!-- Standard Commit Button -->
            <button
              v-else
              type="button"
              @click="executeCommit"
              :disabled="commitModal.isExecuting"
              class="px-4 py-1.5 rounded bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-medium text-xs flex items-center space-x-1.5 transition-colors cursor-pointer shadow-sm"
            >
              <Loader2 v-if="commitModal.isExecuting" class="w-3.5 h-3.5 animate-spin" />
              <Check v-else class="w-3.5 h-3.5" />
              <span>{{ commitModal.isExecuting ? '提交執行中...' : `確認提交 (${commitModal.rowCount} 列 / ${commitModal.cellCount} 格)` }}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, reactive, watch } from 'vue';
import {
  Inbox,
  Search,
  X,
  Copy,
  Check,
  AlertTriangle,
  Pin,
  PinOff,
  FileSpreadsheet,
  FileText,
  PlusCircle,
  Edit3,
  Trash2,
  Braces,
  Table as TableIcon,
  Workflow,
  RotateCcw,
  RotateCw,
  Lock,
  Slash,
  Undo2,
  CheckCircle2,
  Loader2,
  Maximize2,
  Minimize2,
  Table,
  AlertOctagon,
  ShieldAlert,
  ArrowRight,
} from 'lucide-vue-next';
import { AgGridVue } from 'ag-grid-vue3';
import {
  AllCommunityModule,
  ModuleRegistry,
  type GridApi,
  type GridReadyEvent,
  type ColDef,
  type CellContextMenuEvent,
  type ICellRendererParams,
} from 'ag-grid-community';
import { sqlightGridTheme } from '@/styles/gridTheme';
import { useQueryStore } from '@/stores/queryStore';
import { useWorkspaceStore } from '@/stores/workspaceStore';
import { useConnectionStore } from '@/stores/connectionStore';
import { useSchemaStore } from '@/stores/schemaStore';
import { queryService } from '@/services/queryService';
import { checkTableEditability } from '@/utils/tableEditability';
import { generateBatchUpdateScript, type RowModification } from '@/utils/batchUpdateGenerator';
import SqlCodeViewer from '@/components/common/SqlCodeViewer.vue';
import {
  escapeHtml,
  calculateColumnWidth,
} from '@/composables/useColumnAutoWidth';
import { useGridSelection } from '@/composables/useGridSelection';
import { useGridExport } from '@/composables/useGridExport';
import {
  generateInsertStatement,
  generateUpdateStatement,
  generateDeleteStatement,
  parseTargetTableFromSql,
  extractAllTableNamesFromSql,
  type ColumnInfo,
  type GenerateDmlParams,
} from '@/utils/sqlGenerator';
import type { ResultSet, CellValue, QueryResultTab } from '@/types/query';

ModuleRegistry.registerModules([AllCommunityModule]);

const props = defineProps<{
  resultSet: ResultSet;
  setIndex: number;
  totalSets: number;
  queryTab?: QueryResultTab | null;
  isMaximized?: boolean;
}>();

defineEmits<{
  (e: 'toggle-maximize'): void;
}>();

const queryStore = useQueryStore();
const workspaceStore = useWorkspaceStore();
const connectionStore = useConnectionStore();
const schemaStore = useSchemaStore();

const quickFilter = ref('');
const gridApi = ref<GridApi | null>(null);
const gridContainerRef = ref<HTMLDivElement | null>(null);

const currentTab = computed(() => props.queryTab ?? queryStore.activeResultTab);

const currentConnection = computed(() => {
  const connId = currentTab.value?.connectionId || connectionStore.activeConnectionId;
  return connectionStore.getConnectionById(connId) || connectionStore.activeConnection;
});

const requiresModificationPrompt = computed(() => {
  return currentConnection.value?.modificationPrompt ?? false;
});

const isRefreshing = ref(false);

async function handleRefresh() {
  if (isRefreshing.value) return;
  const tab = currentTab.value;
  if (!tab) {
    workspaceStore.showToast('無法取得查詢分頁資訊', 'error', 2000);
    return;
  }

  isRefreshing.value = true;
  try {
    const res = await queryStore.refreshTabResultSet(tab.id, props.setIndex);
    if (res.success) {
      modifiedCells.value = {};
      gridApi.value?.refreshCells({ force: true });
      workspaceStore.showToast(`資料已重新整理（共 ${res.rowCount.toLocaleString()} 筆）`, 'success', 2000);
    } else {
      workspaceStore.showToast(`重新整理失敗: ${res.error || '未知錯誤'}`, 'error', 3500);
    }
  } catch (err: any) {
    workspaceStore.showToast(`重新整理失敗: ${err?.message || err}`, 'error', 3500);
  } finally {
    isRefreshing.value = false;
  }
}

// Check editability for this result set
const editability = computed(() => {
  return checkTableEditability({
    tab: currentTab.value,
    columns: props.resultSet.columns ?? [],
    getTableSchema: (tbl, cId, db) => {
      const conn = cId || currentTab.value?.connectionId || connectionStore.activeConnectionId || undefined;
      const dbase = db || currentTab.value?.database || connectionStore.activeDatabase || undefined;
      return schemaStore.getTable(tbl, conn, dbase);
    },
  });
});

// Set of lowercased identity column names
const identityColumnNames = computed<Set<string>>(() => {
  const tab = currentTab.value;
  const connId = tab?.connectionId || connectionStore.activeConnectionId || undefined;
  const db = tab?.database || connectionStore.activeDatabase || undefined;
  if (!connId || !db || !editability.value.targetTable) return new Set();

  const target = editability.value.targetTable;
  const tableSchema =
    schemaStore.getTable(target.tableName, connId, db) ||
    schemaStore.getTable(`${target.schema}.${target.tableName}`, connId, db);
  if (!tableSchema) return new Set();

  return new Set(
    tableSchema.columns.filter((c) => c.isIdentity).map((c) => c.name.toLowerCase())
  );
});

// Set of lowercased primary key column names
const primaryKeyColumnNames = computed<Set<string>>(() => {
  if (editability.value.pkColumns.length > 0) {
    return new Set(editability.value.pkColumns.map((c) => c.toLowerCase()));
  }

  const tab = currentTab.value;
  const connId = tab?.connectionId || connectionStore.activeConnectionId || undefined;
  const db = tab?.database || connectionStore.activeDatabase || undefined;
  if (!connId || !db) return new Set();

  const sql = tab?.sql || '';
  const parsedTables = extractAllTableNamesFromSql(sql);

  if (parsedTables.length === 0 && tab?.tableName) {
    parsedTables.push({ schema: tab.schema, tableName: tab.tableName });
  }

  const pkNames = new Set<string>();
  for (const t of parsedTables) {
    const tableSchema =
      schemaStore.getTable(t.tableName, connId, db) ||
      (t.schema ? schemaStore.getTable(`${t.schema}.${t.tableName}`, connId, db) : undefined);
    if (tableSchema) {
      for (const col of tableSchema.columns) {
        if (col.isPrimaryKey) {
          pkNames.add(col.name.toLowerCase());
        }
      }
    }
  }

  return pkNames;
});

// Cell modification tracking
interface CellModification {
  rowKey: string;
  originalRowIndex: number;
  colIdx: number;
  colName: string;
  originalValue: CellValue;
  currentValue: CellValue;
  rowRef: CellValue[];
  pkWhere: Record<string, CellValue>;
}

const modifiedCells = ref<Record<string, CellModification>>({});
const modifiedCount = computed(() => Object.keys(modifiedCells.value).length);

function getRowPkKey(row: CellValue[] | undefined): string {
  if (!row || !props.resultSet || editability.value.pkColumns.length === 0) return '';
  return editability.value.pkColumns
    .map((pk) => {
      const idx = props.resultSet.columns.findIndex((c) => c.name.toLowerCase() === pk.toLowerCase());
      return idx !== undefined && idx >= 0 ? String(row[idx]) : '';
    })
    .join(':::');
}

function isCellModified(rowData: CellValue[] | undefined, colIdx: number): boolean {
  if (!rowData) return false;
  const rowKey = getRowPkKey(rowData);
  if (!rowKey) return false;
  return `${rowKey}___col_${colIdx}` in modifiedCells.value;
}

// Clear modified cells when switching result sets or tabs
watch(
  () => [props.resultSet, queryStore.activeResultTabId],
  () => {
    modifiedCells.value = {};
  }
);

// Commit confirmation modal state
const commitModal = reactive({
  visible: false,
  isExecuting: false,
  error: '',
  sql: '',
  rowCount: 0,
  cellCount: 0,
  confirmStep: 1 as 1 | 2,
});

function closeCommitModal() {
  commitModal.visible = false;
  commitModal.confirmStep = 1;
  commitModal.error = '';
}

function handleRevertChanges() {
  if (modifiedCount.value === 0 || !props.resultSet) return;

  for (const mod of Object.values(modifiedCells.value)) {
    mod.rowRef[mod.colIdx] = mod.originalValue;
  }
  const count = modifiedCount.value;
  modifiedCells.value = {};
  gridApi.value?.refreshCells({ force: true });
  workspaceStore.showToast(`已退回 ${count} 格修改，資料已還原`, 'info', 2000);
}

function openCommitModal() {
  if (modifiedCount.value === 0 || !editability.value.canEdit || !editability.value.targetTable) return;

  const rowsMap = new Map<string, RowModification>();
  for (const mod of Object.values(modifiedCells.value)) {
    let rm = rowsMap.get(mod.rowKey);
    if (!rm) {
      rm = {
        rowIndex: mod.originalRowIndex,
        updates: {},
        pkWhere: mod.pkWhere,
      };
      rowsMap.set(mod.rowKey, rm);
    }
    rm.updates[mod.colName] = mod.currentValue;
  }

  const modifications = Array.from(rowsMap.values());
  const tab = currentTab.value;
  const db = tab?.database || connectionStore.activeDatabase || undefined;

  try {
    const sql = generateBatchUpdateScript({
      tableName: editability.value.targetTable.tableName,
      schema: editability.value.targetTable.schema,
      database: db,
      modifications,
    });

    commitModal.sql = sql;
    commitModal.rowCount = modifications.length;
    commitModal.cellCount = modifiedCount.value;
    commitModal.error = '';
    commitModal.isExecuting = false;
    commitModal.confirmStep = 1;
    commitModal.visible = true;
  } catch (err: any) {
    workspaceStore.showToast(`產生更新語法失敗: ${err?.message || err}`, 'error', 3500);
  }
}

async function executeCommit() {
  const tab = currentTab.value;
  const connId = tab?.connectionId || connectionStore.activeConnectionId || undefined;
  const db = tab?.database || connectionStore.activeDatabase || undefined;

  if (!connId || !db) {
    commitModal.error = '無法取得當前連線或資料庫資訊';
    return;
  }

  commitModal.isExecuting = true;
  commitModal.error = '';

  try {
    await queryService.executeQuery(connId, db, commitModal.sql);

    const rowCnt = commitModal.rowCount;
    const cellCnt = commitModal.cellCount;
    modifiedCells.value = {};
    gridApi.value?.refreshCells({ force: true });
    closeCommitModal();
    workspaceStore.showToast(`成功提交！已更新 ${rowCnt} 筆資料 (共 ${cellCnt} 格)`, 'success', 3000);
  } catch (err: any) {
    commitModal.error = err?.message || String(err);
  } finally {
    commitModal.isExecuting = false;
  }
}

function copyCommitSql() {
  if (!commitModal.sql) return;
  try {
    navigator.clipboard?.writeText(commitModal.sql);
    workspaceStore.showToast('已複製批次更新語法至剪貼簿', 'success', 2000);
  } catch (err) {
    // Ignore clipboard error
  }
}

// Cell context menu quick action computed and methods
const isCurrentCellEditable = computed(() => {
  if (!editability.value.canEdit || !contextMenu.visible) return false;
  const colIdx = getColIndex(contextMenu.colId);
  if (colIdx === undefined || !props.resultSet) return false;
  const col = props.resultSet.columns[colIdx];
  if (!col) return false;
  const isPk = primaryKeyColumnNames.value.has(col.name.toLowerCase());
  const isIdentity = identityColumnNames.value.has(col.name.toLowerCase());
  return !isPk && !isIdentity;
});

const isCurrentCellNullable = computed(() => {
  if (!isCurrentCellEditable.value) return false;
  const colIdx = getColIndex(contextMenu.colId);
  if (colIdx === undefined || !props.resultSet) return false;
  return props.resultSet.columns[colIdx]?.nullable ?? true;
});

const isCurrentCellModified = computed(() => {
  if (!contextMenu.visible || !contextMenu.rowData) return false;
  const colIdx = getColIndex(contextMenu.colId);
  if (colIdx === undefined) return false;
  return isCellModified(contextMenu.rowData, colIdx);
});

function setCellNull() {
  if (!isCurrentCellEditable.value || !contextMenu.rowData || !props.resultSet) return;
  const colIdx = getColIndex(contextMenu.colId);
  if (colIdx === undefined) return;
  const oldVal: CellValue = contextMenu.rowData[colIdx] ?? null;
  if (oldVal === null) {
    contextMenu.visible = false;
    return;
  }

  contextMenu.rowData[colIdx] = null;
  const rowKey = getRowPkKey(contextMenu.rowData);
  if (rowKey) {
    const cellKey = `${rowKey}___col_${colIdx}`;
    const existingMod = modifiedCells.value[cellKey];
    const originalValue: CellValue = existingMod ? existingMod.originalValue : oldVal;

    if (null === originalValue) {
      const copy = { ...modifiedCells.value };
      delete copy[cellKey];
      modifiedCells.value = copy;
    } else {
      const pkWhere: Record<string, CellValue> = {};
      for (const pkCol of editability.value.pkColumns) {
        const pColIdx = props.resultSet.columns.findIndex((c) => c.name.toLowerCase() === pkCol.toLowerCase());
        if (pColIdx >= 0) {
          pkWhere[pkCol] = contextMenu.rowData[pColIdx] ?? null;
        }
      }
      const originalRowIndex = props.resultSet.rows.indexOf(contextMenu.rowData);
      modifiedCells.value = {
        ...modifiedCells.value,
        [cellKey]: {
          rowKey,
          originalRowIndex,
          colIdx,
          colName: contextMenu.colName,
          originalValue,
          currentValue: null,
          rowRef: contextMenu.rowData,
          pkWhere,
        },
      };
    }
  }
  gridApi.value?.refreshCells({ force: true });
  contextMenu.visible = false;
}

function revertSingleCell() {
  if (!contextMenu.rowData || !props.resultSet) return;
  const colIdx = getColIndex(contextMenu.colId);
  if (colIdx === undefined) return;
  const rowKey = getRowPkKey(contextMenu.rowData);
  const cellKey = `${rowKey}___col_${colIdx}`;
  const mod = modifiedCells.value[cellKey];
  if (!mod) {
    contextMenu.visible = false;
    return;
  }

  mod.rowRef[colIdx] = mod.originalValue;
  const copy = { ...modifiedCells.value };
  delete copy[cellKey];
  modifiedCells.value = copy;

  gridApi.value?.refreshCells({ force: true });
  contextMenu.visible = false;
  workspaceStore.showToast(`已還原欄位 [${mod.colName}]`, 'info', 1500);
}

// Auto-fetch database schema if not yet loaded
watch(
  () => [currentTab.value?.connectionId, currentTab.value?.database] as const,
  ([cId, db]) => {
    const connId = cId || connectionStore.activeConnectionId;
    const database = db || connectionStore.activeDatabase;
    if (connId && database && !schemaStore.isDatabaseLoaded(connId, database)) {
      schemaStore.loadDatabaseSchema(connId, database).catch(() => {});
    }
  },
  { immediate: true }
);

// Selection composable
const selection = useGridSelection({
  getRows: () => props.resultSet.rows ?? [],
  getColumns: () => props.resultSet.columns ?? [],
  getGridApi: () => gridApi.value,
  getGridContainer: () => gridContainerRef.value,
  onCopySelected: () => gridExport.copySelectedCells(),
});

const {
  selectionStats,
  hasSelection,
  selectedColumnsCount,
  getColIndex,
  formatAggregateNumber,
  clearCellSelection,
  onGridMouseDown,
  onGridClick,
  onColumnMoved,
  onBodyScroll,
} = selection;

// Clear selection when result set changes
watch(
  () => props.resultSet,
  () => {
    clearCellSelection();
  }
);

// Custom cell context menu state
const contextMenu = reactive<{
  visible: boolean;
  x: number;
  y: number;
  colId: string;
  colName: string;
  cellValue: unknown;
  rowIndex: number;
  rowData: CellValue[] | null;
}>({
  visible: false,
  x: 0,
  y: 0,
  colId: '',
  colName: '',
  cellValue: null,
  rowIndex: -1,
  rowData: null,
});

// Export composable
const gridExport = useGridExport({
  getRows: () => props.resultSet.rows ?? [],
  getColumns: () => props.resultSet.columns ?? [],
  selection,
  showToast: (msg, type, duration) => workspaceStore.showToast(msg, type, duration),
  onMenuClose: () => {
    contextMenu.visible = false;
  },
});

const {
  copiedTsv,
  copiedCsv,
  copyCellValue: exportCopyCellValue,
  copyCurrentRow: exportCopyCurrentRow,
  copyCurrentRowAsJson: exportCopyCurrentRowAsJson,
  copySelectedCells,
  copySelectedAsJson,
  copyAsTsv,
  copyAsCsv,
  copyAsJson,
  copyAsMarkdown,
} = gridExport;

function copyCellValue() {
  exportCopyCellValue(contextMenu.cellValue);
}

function copyCurrentRow() {
  const row = contextMenu.rowData || (contextMenu.rowIndex >= 0 && props.resultSet ? props.resultSet.rows[contextMenu.rowIndex] : null);
  exportCopyCurrentRow(row);
}

function copyCurrentRowAsJson() {
  const row = contextMenu.rowData || (contextMenu.rowIndex >= 0 && props.resultSet ? props.resultSet.rows[contextMenu.rowIndex] : null);
  if (row && props.resultSet) {
    exportCopyCurrentRowAsJson(props.resultSet.columns, row);
  }
}

const isColPinned = computed(() => {
  if (!gridApi.value || !contextMenu.colId) return false;
  const col = gridApi.value.getColumn(contextMenu.colId);
  return col ? col.isPinned() : false;
});

function onGridReady(params: GridReadyEvent) {
  gridApi.value = params.api;
}

// AG Grid Column Definitions
const columnDefs = computed<ColDef[]>(() => {
  if (!props.resultSet) return [];

  // 1. Pinned Row Index Column (#)
  const rowCount = props.resultSet.rows.length;
  const digits = Math.max(2, String(rowCount).length);
  const indexWidth = Math.max(60, digits * 10 + 36);

  const indexCol: ColDef = {
    colId: 'row_index',
    headerName: '#',
    pinned: 'left',
    width: indexWidth,
    minWidth: 48,
    suppressMovable: true,
    lockPosition: 'left',
    sortable: false,
    filter: false,
    resizable: true,
    valueGetter: (params) => (params.node?.rowIndex != null ? params.node.rowIndex + 1 : ''),
    cellClass: 'text-dark-500 bg-dark-850/40 text-center font-mono text-xxs select-none !px-1 cursor-pointer',
    headerClass: 'text-center !px-1 cursor-pointer select-none',
    headerTooltip: '點選此處全選表格 (Select All)',
  };

  const firstRow = props.resultSet.rows[0];

  // 2. Dynamic Data Columns with standardized colId: `col_${colIdx}`
  const dataCols: ColDef[] = props.resultSet.columns.map((col, colIdx) => {
    const isPk = primaryKeyColumnNames.value.has(col.name.toLowerCase());
    const isIdentity = identityColumnNames.value.has(col.name.toLowerCase());
    const isStmtText = col.name === 'StmtText';
    const firstVal = firstRow ? firstRow[colIdx] : undefined;
    const baseWidth = calculateColumnWidth(col.name, firstVal, isPk);
    const colWidth = isStmtText ? Math.max(baseWidth, 360) : baseWidth;

    return {
      colId: `col_${colIdx}`,
      field: `col_${colIdx}`,
      headerName: col.name,
      headerClass: isPk ? 'pk-column-header' : '',
      cellClass: isStmtText ? '!whitespace-pre font-mono text-dark-100' : '',
      cellClassRules: {
        'sqlight-cell-modified': (params) => isCellModified(params.data, colIdx),
      },
      editable: () => {
        return editability.value.canEdit && !isPk && !isIdentity;
      },
      valueSetter: (params) => {
        if (!editability.value.canEdit || isPk || isIdentity || !params.data) return false;
        const oldVal = params.data[colIdx];
        let newVal: CellValue = params.newValue;

        if (typeof newVal === 'string') {
          const trimmed = newVal.trim();
          if (trimmed.toUpperCase() === 'NULL') {
            newVal = null;
          } else if (
            trimmed === '' &&
            col.nullable &&
            !['varchar', 'nvarchar', 'char', 'nchar', 'text', 'ntext'].includes(col.dataType.toLowerCase())
          ) {
            newVal = null;
          } else if (
            trimmed !== '' &&
            !Number.isNaN(Number(trimmed)) &&
            ['int', 'bigint', 'smallint', 'tinyint', 'numeric', 'decimal', 'float', 'real'].includes(col.dataType.toLowerCase())
          ) {
            newVal = Number(trimmed);
          } else if (['bit', 'boolean'].includes(col.dataType.toLowerCase())) {
            if (trimmed === '1' || trimmed.toLowerCase() === 'true') newVal = true;
            else if (trimmed === '0' || trimmed.toLowerCase() === 'false') newVal = false;
          }
        }

        if (newVal === oldVal) return false;

        params.data[colIdx] = newVal;

        const rowKey = getRowPkKey(params.data);
        if (!rowKey) return true;

        const cellKey = `${rowKey}___col_${colIdx}`;
        const existingMod = modifiedCells.value[cellKey];
        const originalValue = existingMod ? existingMod.originalValue : oldVal;

        if (newVal === originalValue) {
          const copy = { ...modifiedCells.value };
          delete copy[cellKey];
          modifiedCells.value = copy;
        } else {
          const pkWhere: Record<string, CellValue> = {};
          for (const pkCol of editability.value.pkColumns) {
            const pColIdx = props.resultSet.columns.findIndex((c) => c.name.toLowerCase() === pkCol.toLowerCase());
            if (pColIdx !== undefined && pColIdx >= 0) {
              pkWhere[pkCol] = params.data[pColIdx];
            }
          }

          const originalRowIndex = props.resultSet.rows.indexOf(params.data) ?? -1;

          modifiedCells.value = {
            ...modifiedCells.value,
            [cellKey]: {
              rowKey,
              originalRowIndex,
              colIdx,
              colName: col.name,
              originalValue,
              currentValue: newVal,
              rowRef: params.data,
              pkWhere,
            },
          };
        }

        return true;
      },
      width: colWidth,
      minWidth: isStmtText ? 200 : 70,
      suppressMovable: false,
      tooltipShowMode: 'whenTruncated',
      headerTooltip: isPk
        ? `🔑 [主鍵 / Primary Key (唯讀)] 型別 (Type): ${col.dataType}${col.nullable ? ' | 可為 NULL' : ' | NOT NULL'} (拖曳表頭調整順序，點擊或 Shift 點選)`
        : isIdentity
          ? `🔒 [識別欄位 / Identity (唯讀)] 型別 (Type): ${col.dataType} (拖曳表頭調整順序)`
          : `型別 (Type): ${col.dataType}${col.nullable ? ' | 可為 NULL' : ' | NOT NULL'}${editability.value.canEdit ? ' (雙擊可編輯)' : ''} (拖曳表頭調整順序)`,
      tooltipValueGetter: (params) => {
        const val = params.value;
        if (val === null || val === undefined) return 'NULL';
        if (typeof val === 'object' && val !== null && 'type' in val && (val as any).type === 'binary') {
          return `[Binary ${(val as any).length} Bytes]`;
        }
        if (typeof val === 'boolean') {
          return val ? 'TRUE' : 'FALSE';
        }
        return String(val);
      },
      sortable: true,
      filter: true,
      resizable: true,
      valueGetter: (params) => params.data?.[colIdx],
      cellRenderer: (params: ICellRendererParams) => {
        const val = params.value;
        if (val === null || val === undefined) {
          return '<span class="italic text-dark-500 font-mono text-xxs">NULL</span>';
        }
        if (typeof val === 'object' && val !== null && 'type' in val && (val as any).type === 'binary') {
          return `<span class="bg-indigo-950/60 text-indigo-300 px-1.5 py-0.5 rounded text-xxs font-sans font-medium border border-indigo-800/50">[Binary ${(val as any).length} B]</span>`;
        }
        if (typeof val === 'boolean') {
          const color = val ? 'text-emerald-400' : 'text-rose-400';
          return `<span class="${color} font-semibold text-xxs">${val ? 'TRUE' : 'FALSE'}</span>`;
        }
        if (isStmtText) {
          return `<span class="whitespace-pre font-mono text-dark-100">${escapeHtml(String(val))}</span>`;
        }
        return escapeHtml(String(val));
      },
    };
  });

  return [indexCol, ...dataCols];
});

function onCellContextMenu(event: CellContextMenuEvent) {
  if (event.event) {
    (event.event as Event).preventDefault?.();
    (event.event as Event).stopPropagation?.();
  }
  const mouseEvent = event.event as MouseEvent | undefined;
  if (!mouseEvent) return;

  const menuWidth = 220;
  const menuHeight = 360;
  const x = Math.min(mouseEvent.clientX, Math.max(0, window.innerWidth - menuWidth - 8));
  const y = Math.min(mouseEvent.clientY, Math.max(0, window.innerHeight - menuHeight - 8));

  const cId = event.column?.getColId() || '';
  const colIdx = getColIndex(cId);
  const realColName = colIdx !== undefined && props.resultSet ? props.resultSet.columns[colIdx]?.name : cId;

  contextMenu.visible = true;
  contextMenu.x = x;
  contextMenu.y = y;
  contextMenu.colId = cId;
  contextMenu.colName = realColName || '';
  contextMenu.cellValue = event.value;
  contextMenu.rowIndex = event.node?.rowIndex ?? -1;
  contextMenu.rowData = (event.data as CellValue[]) || (event.node?.data as CellValue[]) || null;

  function closeMenu() {
    contextMenu.visible = false;
    document.removeEventListener('click', closeMenu);
  }
  setTimeout(() => {
    document.addEventListener('click', closeMenu);
  }, 0);
}

function handleGenerateDml(type: 'INSERT' | 'UPDATE' | 'DELETE') {
  const row = contextMenu.rowData || (contextMenu.rowIndex >= 0 && props.resultSet ? props.resultSet.rows[contextMenu.rowIndex] : null);
  if (!row || !props.resultSet) {
    contextMenu.visible = false;
    return;
  }

  const tab = currentTab.value;
  const sql = tab?.sql || '';
  const parsedTarget = parseTargetTableFromSql(sql);

  const tableName = parsedTarget?.tableName || tab?.tableName || tab?.title || 'TargetTable';
  let schema = parsedTarget?.schema || tab?.schema;

  const connId = tab?.connectionId || connectionStore.activeConnectionId || undefined;
  const db = tab?.database || connectionStore.activeDatabase || undefined;

  const tableSchema = connId && db
    ? (schemaStore.getTable(tableName, connId, db) || (schema ? schemaStore.getTable(`${schema}.${tableName}`, connId, db) : undefined))
    : undefined;

  if (!schema && tableSchema?.schema) {
    schema = tableSchema.schema;
  }
  if (!schema) {
    schema = 'dbo';
  }

  const primaryKeyColumns = tableSchema?.columns
    .filter((c) => c.isPrimaryKey)
    .map((c) => c.name);

  const pkColNames = new Set(
    primaryKeyColumns?.map((c) => c.toLowerCase()) ?? []
  );

  const identityColNames = new Set(
    tableSchema?.columns
      .filter((c) => c.isIdentity)
      .map((c) => c.name.toLowerCase()) ?? []
  );

  const columns: ColumnInfo[] = props.resultSet.columns.map((col) => ({
    name: col.name,
    dataType: col.dataType,
    isPrimaryKey: pkColNames.has(col.name.toLowerCase()),
    isIdentity: identityColNames.has(col.name.toLowerCase()),
  }));

  const dmlParams: GenerateDmlParams = {
    tableName,
    schema,
    database: db,
    columns,
    row,
    primaryKeyColumns,
  };

  let generated = '';
  try {
    if (type === 'INSERT') {
      generated = generateInsertStatement(dmlParams);
    } else if (type === 'UPDATE') {
      generated = generateUpdateStatement(dmlParams);
    } else if (type === 'DELETE') {
      generated = generateDeleteStatement(dmlParams);
    }

    try {
      navigator.clipboard?.writeText(generated);
    } catch (err) {
      // Ignore clipboard error
    }

    workspaceStore.addSqlTab(generated, `${type}: [${schema}].[${tableName}]`, connId, db);
    workspaceStore.showToast(`已建立 ${type} 語法並開啟新分頁（已複製至剪貼簿）`, 'success', 2500);
  } catch (err: any) {
    workspaceStore.showToast(`產生 ${type} 語法失敗: ${err?.message || err}`, 'error', 3500);
  }

  contextMenu.visible = false;
}

function togglePinColumn() {
  if (!gridApi.value || !contextMenu.colId) return;
  const col = gridApi.value.getColumn(contextMenu.colId);
  if (!col) return;

  const newPinState = col.isPinned() ? null : 'left';
  gridApi.value.setColumnsPinned([contextMenu.colId], newPinState);
  contextMenu.visible = false;
}
</script>

<style scoped>
:deep(.sqlight-cell-selected) {
  background-color: rgba(59, 130, 246, 0.22) !important;
  box-shadow: inset 0 0 0 1px #3b82f6 !important;
}

:deep(.sqlight-header-selected) {
  background-color: rgba(59, 130, 246, 0.28) !important;
  color: #93c5fd !important;
  font-weight: 700 !important;
}

/* Primary Key Column Header Styling with Lucide Key vector icon */
:deep(.pk-column-header .ag-header-cell-text) {
  color: #fbbf24 !important;
  font-weight: 600 !important;
  display: inline-flex !important;
  align-items: center !important;
  gap: 4px !important;
}

:deep(.pk-column-header .ag-header-cell-text::before) {
  content: '' !important;
  display: inline-block !important;
  width: 12px !important;
  height: 12px !important;
  flex-shrink: 0 !important;
  background-color: #fbbf24 !important;
  -webkit-mask: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2.5' stroke-linecap='round' stroke-linejoin='round'%3E%3Ccircle cx='7.5' cy='15.5' r='5.5'/%3E%3Cpath d='m21 2-9.6 9.6'/%3E%3Cpath d='m15.5 7.5 3 3L22 7l-3-3'/%3E%3C/svg%3E") no-repeat center / contain !important;
  mask: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2.5' stroke-linecap='round' stroke-linejoin='round'%3E%3Ccircle cx='7.5' cy='15.5' r='5.5'/%3E%3Cpath d='m21 2-9.6 9.6'/%3E%3Cpath d='m15.5 7.5 3 3L22 7l-3-3'/%3E%3C/svg%3E") no-repeat center / contain !important;
}

:deep(.sqlight-header-selected.pk-column-header .ag-header-cell-text) {
  color: #fef08a !important;
}

:deep(.sqlight-header-selected.pk-column-header .ag-header-cell-text::before) {
  background-color: #fef08a !important;
}

/* Modified Cell Visual Feedback */
:deep(.sqlight-cell-modified) {
  background-color: rgba(245, 158, 11, 0.15) !important;
  box-shadow: inset 3px 0 0 0 #f59e0b !important;
  color: #fef08a !important;
}
</style>
