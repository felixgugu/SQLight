<template>
  <div class="w-full h-full flex flex-col bg-dark-900 overflow-hidden font-mono text-xs select-none">
    <!-- Subheader Toolbar: Result Set Info, Quick Filter, Warnings, Actions -->
    <div class="h-8 bg-dark-850 border-b border-dark-700 flex items-center justify-between px-2 flex-shrink-0 space-x-2">
      <!-- Left: Result Set Label & Quick Filter -->
      <div class="flex items-center space-x-2 min-w-0">
        <!-- Multiple Result Set Index Badge -->
        <Tag
          v-if="totalSets > 1"
          severity="info"
          :value="`Result #${setIndex + 1} (${resultSet.rowCount ?? resultSet.rows.length})`"
          class="!font-mono !text-xxs !px-2 !py-0.5 flex-shrink-0"
        >
          <template #icon>
            <i class="pi pi-table mr-1 text-xs"></i>
          </template>
        </Tag>

        <!-- Quick Filter Input -->
        <IconField class="w-44 sm:w-56">
          <InputIcon class="pi pi-search text-dark-500 text-xs" />
          <InputText
            v-model="quickFilter"
            type="text"
            placeholder="Search grid..."
            size="small"
            class="w-full !bg-dark-900 !border-dark-700 !py-0.5 !pl-7 !pr-6 !text-xs font-mono"
          />
        </IconField>

        <!-- Truncation Warning Badge (when max rows limit reached) -->
        <Tag
          v-if="resultSet.isTruncated"
          severity="warn"
          :value="`已達上限 ${resultSet.rowCount.toLocaleString()} 筆（共 ${(resultSet.totalCount ?? resultSet.rowCount).toLocaleString()} 筆，其餘已截斷）`"
          class="hidden md:flex !text-xxs font-sans truncate"
        >
          <template #icon>
            <i class="pi pi-exclamation-triangle mr-1 text-xs"></i>
          </template>
        </Tag>

        <!-- Estimated Plan Badge -->
        <Tag
          v-if="queryStore.activeResultTab?.isShowplan"
          severity="info"
          value="預估執行計畫 (Estimated Plan)"
          class="hidden md:flex !text-xxs font-sans truncate"
        >
          <template #icon>
            <i class="pi pi-sitemap mr-1 text-xs"></i>
          </template>
        </Tag>

        <div class="h-3.5 w-px bg-dark-750 mx-1 flex-shrink-0"></div>

        <!-- Inline Editing Toolbar: Revert & Commit -->
        <div class="flex items-center space-x-1 flex-shrink-0">
          <template v-if="editability.canEdit">
            <!-- Revert Button -->
            <Button
              type="button"
              icon="pi pi-undo"
              label="退回"
              size="small"
              :severity="modifiedCount > 0 ? 'warn' : 'secondary'"
              outlined
              :disabled="modifiedCount === 0"
              @click="handleRevertChanges"
              v-tooltip.top="'退回所有未提交的修改 (Revert All)'"
              class="!text-xxs !py-0.5 !px-2 select-none"
            />

            <!-- Commit Button -->
            <Button
              type="button"
              icon="pi pi-check"
              :label="`提交 ${modifiedCount > 0 ? '(' + modifiedCount + ')' : ''}`"
              size="small"
              :severity="modifiedCount > 0 ? 'success' : 'secondary'"
              :disabled="modifiedCount === 0"
              @click="openCommitModal"
              v-tooltip.top="'提交所有修改至資料庫 (Commit Changes)'"
              class="!text-xxs !py-0.5 !px-2.5 font-semibold select-none shadow-xs"
            />
          </template>

          <!-- Read-only Indicator when editing is not supported -->
          <template v-else>
            <Tag
              severity="secondary"
              :value="editability.shortReason || '唯讀'"
              v-tooltip.top="editability.reason"
              class="!text-xxs select-none"
            >
              <template #icon>
                <i class="pi pi-lock mr-1 text-xs text-dark-500"></i>
              </template>
            </Tag>
          </template>
        </div>
      </div>

      <!-- Right: Copy Tools, Row Stats & Maximize Toggle -->
      <div class="flex items-center space-x-1.5 flex-shrink-0">
        <!-- Refresh Button -->
        <Button
          type="button"
          :icon="isRefreshing ? 'pi pi-spin pi-spinner' : 'pi pi-refresh'"
          :label="isRefreshing ? 'Refreshing...' : '重新整理'"
          size="small"
          severity="secondary"
          outlined
          :disabled="isRefreshing"
          @click="handleRefresh"
          v-tooltip.top="isRefreshing ? '正在重新整理中...' : '重新整理此查詢結果 (Re-run SQL)'"
          class="!text-xxs !py-0.5 !px-2"
        />

        <!-- Copy to TSV (Excel friendly) -->
        <Button
          type="button"
          :icon="copiedTsv ? 'pi pi-check text-emerald-400' : 'pi pi-file-excel text-emerald-400'"
          :label="copiedTsv ? 'Copied!' : 'Copy TSV'"
          size="small"
          severity="secondary"
          outlined
          @click="copyAsTsv"
          v-tooltip.top="'複製全部為 TSV (相容 Excel 貼上)'"
          class="!text-xxs !py-0.5 !px-2"
        />

        <!-- Copy to CSV -->
        <Button
          type="button"
          :icon="copiedCsv ? 'pi pi-check text-brand-400' : 'pi pi-file text-brand-400'"
          :label="copiedCsv ? 'Copied!' : 'CSV'"
          size="small"
          severity="secondary"
          outlined
          @click="copyAsCsv"
          v-tooltip.top="'複製為 CSV 格式'"
          class="!text-xxs !py-0.5 !px-2"
        />

        <!-- Copy as JSON -->
        <Button
          type="button"
          icon="pi pi-code text-cyan-400"
          label="JSON"
          size="small"
          severity="secondary"
          outlined
          @click="copyAsJson"
          v-tooltip.top="'複製全表為 JSON 物件陣列'"
          class="!text-xxs !py-0.5 !px-2"
        />

        <!-- Copy as Markdown -->
        <Button
          type="button"
          icon="pi pi-table text-pink-400"
          label="MD"
          size="small"
          severity="secondary"
          outlined
          @click="copyAsMarkdown"
          v-tooltip.top="'複製全表為 Markdown 表格 (貼入 GitHub / Notion)'"
          class="!text-xxs !py-0.5 !px-2"
        />

        <div class="h-3.5 w-px bg-dark-750 mx-0.5"></div>

        <!-- Row Count Indicator -->
        <span class="text-xxs text-dark-400 font-mono">
          <strong class="text-dark-200">{{ resultSet.rows.length.toLocaleString() }}</strong> rows
        </span>

        <!-- Maximize / Restore Toggle (when multiple result sets) -->
        <Button
          v-if="totalSets > 1"
          type="button"
          :icon="isMaximized ? 'pi pi-window-minimize' : 'pi pi-window-maximize'"
          text
          rounded
          size="small"
          severity="secondary"
          @click="$emit('toggle-maximize')"
          v-tooltip.top="isMaximized ? '恢復預設多網格檢視' : '最大化檢視此結果集'"
          class="!w-6 !h-6 !p-0 ml-1"
        />
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
      :class="{ 'is-h-scrolling': isHorizontalScrolling }"
      @contextmenu.prevent
      @mousedown="onGridMouseDown"
      @click="onGridClick"
    >
      <AgGridVue
        class="w-full h-full"
        :style="{ '--ag-font-family': settingsStore.gridFontFamily }"
        :theme="activeGridTheme"
        :row-data="gridRowData"
        :column-defs="columnDefs"
        :quick-filter-text="quickFilter"
        :enable-cell-text-selection="false"
        :ensure-dom-order="false"
        :column-buffer="4"
        :animate-rows="false"
        :suppress-move-when-column-dragging="true"
        :suppress-row-hover-highlight="true"
        :suppress-column-virtualisation="true"
        :prevent-default-on-context-menu="true"
        :tooltip-show-mode="'whenTruncated'"
        :tooltip-show-delay="150"
        :tooltip-hide-delay="6000"
        :stop-editing-when-cells-lose-focus="true"
        @grid-ready="onGridReady"
        @first-data-rendered="handleFirstDataRendered"
        @cell-context-menu="onCellContextMenu"
        @body-scroll="handleBodyScroll"
        @column-moved="onColumnMoved"
        @column-pinned="handleColumnLayoutChanged"
      />
    </div>

    <!-- Excel-Grade Live Aggregate Bar -->
    <div class="h-6 bg-dark-850 border-t border-dark-700 flex items-center justify-between px-3 text-xxs font-sans text-dark-300 flex-shrink-0 select-none">
      <!-- Left: Statistics or Default Summary -->
      <div class="flex items-center space-x-2.5 overflow-x-auto min-w-0">
        <template v-if="selectionStats">
          <div class="flex items-center space-x-1 font-semibold text-brand-300 flex-shrink-0">
            <span>選取:</span>
            <span v-if="selectedColumnsCount > 1" class="text-amber-800 dark:text-amber-300 font-mono">
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
              最小值 (Min): <strong class="font-mono text-amber-700 dark:text-amber-400">{{ formatAggregateNumber(selectionStats.min) }}</strong>
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

          <Button
            type="button"
            label="清除"
            text
            size="small"
            severity="secondary"
            @click="clearCellSelection"
            v-tooltip.top="'清除選取 (Esc)'"
            class="!ml-1 !p-0 !text-[10px] !underline"
          />
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
        <Button
          type="button"
          icon="pi pi-copy"
          label="複製選取"
          size="small"
          severity="primary"
          outlined
          @click="copySelectedCells"
          v-tooltip.top="'複製選取內容 (Ctrl+C)'"
          class="!py-0.5 !px-1.5 !text-[10px]"
        />
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
        @click="copyColumnName"
        class="w-full text-left px-2.5 py-1.5 hover:bg-dark-750 hover:text-dark-100 flex items-center space-x-2 transition-colors"
      >
        <Heading class="w-3.5 h-3.5 text-violet-400" />
        <span>複製欄位名稱 (Column Name)</span>
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

      <button
        @click="openDataView"
        class="w-full text-left px-2.5 py-1.5 hover:bg-dark-750 hover:text-dark-100 flex items-center space-x-2 transition-colors"
      >
        <Eye class="w-3.5 h-3.5 text-sky-400" />
        <span>資料檢視 (Data View)</span>
      </button>

      <!-- Cell Editing Quick Actions in Context Menu -->
      <template v-if="isCurrentCellEditable">
        <div class="my-1 border-t border-dark-750"></div>
        <button
          v-if="isCurrentCellNullable && contextMenu.cellValue !== null"
          @click="setCellNull"
          class="w-full text-left px-2.5 py-1.5 hover:bg-dark-750 hover:text-amber-800 dark:hover:text-amber-300 flex items-center space-x-2 transition-colors text-amber-700 dark:text-amber-400"
        >
          <Slash class="w-3.5 h-3.5" />
          <span>設為 NULL (Set NULL)</span>
        </button>
        <button
          v-if="isCurrentCellModified"
          @click="revertSingleCell"
          class="w-full text-left px-2.5 py-1.5 hover:bg-dark-750 hover:text-amber-800 dark:hover:text-amber-300 flex items-center space-x-2 transition-colors text-amber-700 dark:text-amber-400"
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
        <Edit3 class="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
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
        <PinOff v-if="isColPinned" class="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
        <Pin v-else class="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
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
    <Dialog
      :visible="commitModal.visible"
      @update:visible="(val) => !val && closeCommitModal()"
      modal
      :closable="false"
      :dismissableMask="true"
      :showHeader="false"
      class="w-[92vw] max-w-5xl h-[88vh] max-h-[850px] !bg-dark-850 !border !rounded-lg overflow-hidden flex flex-col shadow-2xl"
      :class="requiresModificationPrompt ? (commitModal.confirmStep === 2 ? '!border-rose-600/80 shadow-rose-950/40' : '!border-amber-600/80 shadow-amber-950/30') : '!border-dark-700'"
      contentClass="!p-0 !bg-dark-850 h-full flex flex-col"
    >
      <!-- Modal Header -->
      <div
        class="px-5 py-3.5 border-b flex items-center justify-between flex-shrink-0"
        :class="requiresModificationPrompt && commitModal.confirmStep === 2 ? 'bg-rose-950/30 border-rose-900/50' : 'bg-dark-800 border-dark-750'"
      >
        <div class="flex items-center space-x-2.5">
          <div
            class="w-7 h-7 rounded-md flex items-center justify-center"
            :class="requiresModificationPrompt ? (commitModal.confirmStep === 2 ? 'bg-rose-950/80 border border-rose-700/60' : 'bg-amber-500/20 border border-amber-500/40') : 'bg-emerald-950/80 border border-emerald-700/60'"
          >
            <i v-if="requiresModificationPrompt && commitModal.confirmStep === 2" class="pi pi-exclamation-triangle text-rose-400 animate-pulse text-sm"></i>
            <i v-else-if="requiresModificationPrompt" class="pi pi-exclamation-triangle text-amber-600 dark:text-amber-400 text-sm"></i>
            <i v-else class="pi pi-check text-emerald-400 text-sm"></i>
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
        <Button
          type="button"
          icon="pi pi-times"
          text
          size="small"
          severity="secondary"
          @click="closeCommitModal"
          v-tooltip.top="'關閉 (Esc)'"
          class="!w-7 !h-7 !p-0 !rounded-md !border-0 !shadow-none hover:!bg-rose-500/20 hover:!text-rose-400"
        />
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
            <span>異動格數: <strong class="text-amber-700 dark:text-amber-400 font-semibold text-xs">{{ commitModal.cellCount }}</strong> 格</span>
          </div>
        </div>

        <!-- Error Alert if any -->
        <div v-if="commitModal.error" class="bg-rose-950/50 border border-rose-800 text-rose-300 p-3 rounded-md text-xs flex items-start space-x-2 flex-shrink-0">
          <i class="pi pi-exclamation-triangle text-rose-400 flex-shrink-0 mt-0.5 text-sm"></i>
          <div class="flex-1 font-mono break-all whitespace-pre-wrap">{{ commitModal.error }}</div>
        </div>

        <!-- SQL Preview with Monaco Syntax Highlighting -->
        <div class="flex-1 flex flex-col min-h-0">
          <div class="text-xxs text-dark-400 mb-1.5 flex items-center justify-between flex-shrink-0">
            <span class="flex items-center space-x-1.5">
              <span class="font-medium text-dark-200">即將執行的安全交易 T-SQL 語法</span>
              <span class="text-dark-500">(含 @@ROWCOUNT 防護，任一列失敗自動完整 ROLLBACK)</span>
            </span>
            <Button
              type="button"
              icon="pi pi-copy"
              label="複製語法"
              size="small"
              severity="secondary"
              outlined
              @click="copyCommitSql"
              v-tooltip.top="'複製語法至剪貼簿'"
              class="!text-xxs !py-0.5 !px-2"
            />
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
            class="flex items-center space-x-2 px-3 py-1.5 rounded bg-amber-500/15 border border-amber-500/30 text-amber-800 dark:text-amber-300 text-xxs leading-normal"
          >
            <i class="pi pi-exclamation-triangle text-amber-600 dark:text-amber-400 shrink-0 text-sm"></i>
            <span>
              <strong>高危提醒 (1/2)：</strong>連線「{{ currentConnection?.name }}」已啟用修改提示防護。此操作將直接更動資料庫，需進行 <strong>2 次重複確認</strong> 才可提交！
            </span>
          </div>
          <div
            v-else
            class="flex items-center space-x-2 px-3 py-1.5 rounded bg-rose-950/60 border border-rose-700/80 text-rose-200 text-xxs leading-normal animate-pulse"
          >
            <i class="pi pi-exclamation-circle text-rose-400 shrink-0 text-sm"></i>
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
          <Button
            type="button"
            :label="requiresModificationPrompt && commitModal.confirmStep === 2 ? '放棄提交 (Esc)' : '取消'"
            size="small"
            severity="secondary"
            outlined
            @click="closeCommitModal"
            class="!text-xs !py-1.5 !px-3"
          />

          <!-- Guarded Step 1 Button -->
          <Button
            v-if="requiresModificationPrompt && commitModal.confirmStep === 1"
            type="button"
            icon="pi pi-arrow-right"
            iconPos="right"
            label="初次確認提交 (1/2)"
            size="small"
            severity="warn"
            @click="commitModal.confirmStep = 2"
            class="!text-xs !py-1.5 !px-4 font-semibold shadow-sm"
          />

          <!-- Guarded Step 2 Button -->
          <Button
            v-else-if="requiresModificationPrompt && commitModal.confirmStep === 2"
            type="button"
            :icon="commitModal.isExecuting ? 'pi pi-spin pi-spinner' : 'pi pi-exclamation-triangle'"
            :label="commitModal.isExecuting ? '提交執行中...' : '確定立即提交 (最終確認 2/2)'"
            size="small"
            severity="danger"
            :disabled="commitModal.isExecuting"
            @click="executeCommit"
            class="!text-xs !py-1.5 !px-4 font-bold shadow-md shadow-rose-950/50"
          />

          <!-- Standard Commit Button -->
          <Button
            v-else
            type="button"
            :icon="commitModal.isExecuting ? 'pi pi-spin pi-spinner' : 'pi pi-check'"
            :label="commitModal.isExecuting ? '提交執行中...' : `確認提交 (${commitModal.rowCount} 列 / ${commitModal.cellCount} 格)`"
            size="small"
            severity="success"
            :disabled="commitModal.isExecuting"
            @click="executeCommit"
            class="!text-xs !py-1.5 !px-4 font-medium shadow-sm"
          />
        </div>
      </div>
    </Dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, reactive, watch, toRaw, onBeforeUnmount } from 'vue';
import Button from 'primevue/button';
import InputText from 'primevue/inputtext';
import IconField from 'primevue/iconfield';
import InputIcon from 'primevue/inputicon';
import Tag from 'primevue/tag';
import Dialog from 'primevue/dialog';
import {
  Inbox,
  Copy,
  Pin,
  PinOff,
  FileSpreadsheet,
  FileText,
  PlusCircle,
  Edit3,
  Trash2,
  Braces,
  Table as TableIcon,
  Slash,
  Undo2,
  Eye,
  Heading,
} from 'lucide-vue-next';
import { AgGridVue } from 'ag-grid-vue3';
import {
  AllCommunityModule,
  ModuleRegistry,
  type GridApi,
  type GridReadyEvent,
  type ColDef,
  type CellContextMenuEvent,
  type BodyScrollEvent,
} from 'ag-grid-community';
import { sqlightDarkGridTheme, sqlightLightGridTheme } from '@/styles/gridTheme';
import { useSettingsStore } from '@/stores/settingsStore';
import { useQueryStore } from '@/stores/queryStore';
import { useWorkspaceStore } from '@/stores/workspaceStore';
import { useConnectionStore } from '@/stores/connectionStore';
import { useSchemaStore } from '@/stores/schemaStore';
import { useDataViewStore } from '@/stores/dataViewStore';
import { queryService } from '@/services/queryService';
import { checkTableEditability } from '@/utils/tableEditability';
import { generateBatchUpdateScript, type RowModification } from '@/utils/batchUpdateGenerator';
import SqlCodeViewer from '@/components/common/SqlCodeViewer.vue';
import {
  calculateColumnWidth,
} from '@/composables/useColumnAutoWidth';
import { useGridSelection } from '@/composables/useGridSelection';
import { useGridExport } from '@/composables/useGridExport';
import { startGridPerfDiag } from '@/composables/useGridPerfDiag';
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

const settingsStore = useSettingsStore();
const queryStore = useQueryStore();
const workspaceStore = useWorkspaceStore();
const connectionStore = useConnectionStore();
const schemaStore = useSchemaStore();
const dataViewStore = useDataViewStore();

const activeGridTheme = computed(() => {
  return settingsStore.colorMode === 'light' ? sqlightLightGridTheme : sqlightDarkGridTheme;
});

const quickFilter = ref('');
const gridApi = ref<GridApi | null>(null);
const gridContainerRef = ref<HTMLDivElement | null>(null);

// AG Grid must not hold a Vue reactive proxy for the row data: with wide result sets the
// proxy cost is paid on every cell read, and ag-grid-vue3 also deep-watches the rowData
// prop (which registers a dependency per nested value). Raw arrays keep rendering on plain
// objects while all modification tracking stays in `modifiedCells`.
const gridRowData = computed<CellValue[][]>(() => {
  const rows = props.resultSet?.rows;
  return rows ? (toRaw(rows) as CellValue[][]) : [];
});

// Horizontal-scroll mode: while the user drags the horizontal scrollbar, decorative
// transitions inside the grid are switched off so each frame stays paint-cheap.
const isHorizontalScrolling = ref(false);
let horizontalScrollTimer: ReturnType<typeof setTimeout> | null = null;

function markHorizontalScrolling() {
  if (!isHorizontalScrolling.value) {
    isHorizontalScrolling.value = true;
  }
  if (horizontalScrollTimer) {
    clearTimeout(horizontalScrollTimer);
  }
  horizontalScrollTimer = setTimeout(() => {
    horizontalScrollTimer = null;
    isHorizontalScrolling.value = false;
  }, 150);
}

function handleBodyScroll(event?: BodyScrollEvent) {
  if (!event || event.direction === 'horizontal') {
    markHorizontalScrolling();
  }
  onBodyScroll();
}

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

const pkColumnIndices = computed<number[]>(() => {
  if (!props.resultSet || editability.value.pkColumns.length === 0) return [];
  const map = new Map<string, number>();
  props.resultSet.columns.forEach((c, idx) => map.set(c.name.toLowerCase(), idx));
  return editability.value.pkColumns
    .map((pk) => map.get(pk.toLowerCase()))
    .filter((idx): idx is number => idx !== undefined);
});

function getRowPkKey(row: CellValue[] | undefined): string {
  if (!row || pkColumnIndices.value.length === 0) return '';
  const indices = pkColumnIndices.value;
  let key = '';
  for (let i = 0; i < indices.length; i++) {
    if (i > 0) key += ':::';
    key += String(row[indices[i]!] ?? '');
  }
  return key;
}

function isCellModified(rowData: CellValue[] | undefined, colIdx: number): boolean {
  if (modifiedCount.value === 0 || !rowData) return false;
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
  invalidateVisualColIndices,
  updateSelectionHighlight,
  onGridMouseDown,
  onGridClick,
  onColumnMoved,
  onBodyScroll,
} = selection;

function handleColumnLayoutChanged() {
  invalidateVisualColIndices();
  updateSelectionHighlight();
}

// Clear selection when result set changes
watch(
  () => props.resultSet,
  () => {
    invalidateVisualColIndices();
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
  copyColumnName: exportCopyColumnName,
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

function copyColumnName() {
  exportCopyColumnName(contextMenu.colName);
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

function openDataView() {
  const row = contextMenu.rowData || (contextMenu.rowIndex >= 0 && props.resultSet ? props.resultSet.rows[contextMenu.rowIndex] : null);
  if (!row || !props.resultSet) {
    contextMenu.visible = false;
    return;
  }
  dataViewStore.openDataView({
    columns: props.resultSet.columns,
    row,
    rowIndex: contextMenu.rowIndex,
    totalRows: props.resultSet.rows.length,
    allRows: props.resultSet.rows,
    tableName: currentTab.value?.title || currentTab.value?.tableName,
  });
  contextMenu.visible = false;
}

const isColPinned = computed(() => {
  if (!gridApi.value || !contextMenu.colId) return false;
  const col = gridApi.value.getColumn(contextMenu.colId);
  return col ? col.isPinned() : false;
});

function onGridReady(params: GridReadyEvent) {
  gridApi.value = params.api;
  const container = gridContainerRef.value;
  if (container) {
    disposeGridPerfDiag?.();
    disposeGridPerfDiag = startGridPerfDiag({
      api: params.api,
      container,
      label: currentTab.value?.title,
    });
  }
}

let disposeGridPerfDiag: (() => void) | null = null;

// AG Grid suppresses column virtualisation while its viewport width is still unknown
// (viewportRight === 0), which renders every column of a wide result set at once. Nudging
// the viewport once after the first render makes the grid recompute the visible window.
function handleFirstDataRendered() {
  const api = gridApi.value;
  const container = gridContainerRef.value;
  if (!api || !container) return;
  ensureColumnVirtualisation(api, container);
}

function ensureColumnVirtualisation(api: GridApi, container: HTMLElement) {
  if (api.getAllGridColumns().length <= 30) return;
  const viewport = container.querySelector<HTMLElement>('.ag-grid-viewport');
  if (!viewport || viewport.scrollWidth <= viewport.clientWidth) return;

  const renderedColumns = new Set<string>();
  container.querySelectorAll('.ag-cell[col-id]').forEach((cell) => {
    const colId = cell.getAttribute('col-id');
    if (colId) renderedColumns.add(colId);
  });
  if (renderedColumns.size <= 40) return;

  const left = viewport.scrollLeft;
  viewport.scrollLeft = left + 1;
  viewport.scrollLeft = left;
}

onBeforeUnmount(() => {
  disposeGridPerfDiag?.();
  disposeGridPerfDiag = null;
  if (horizontalScrollTimer) {
    clearTimeout(horizontalScrollTimer);
    horizontalScrollTimer = null;
  }
});

// AG Grid Column Definitions
function buildColumnDefs(): ColDef[] {
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
    // Opaque background: a translucent pinned cell would force per-frame blending of the
    // horizontally scrolled content underneath it while the scrollbar is being dragged.
    cellClass: 'text-dark-500 bg-dark-850 text-center font-mono text-xxs select-none !px-1 cursor-pointer',
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
        'sqlight-cell-null': (params) => params.value === null || params.value === undefined,
        'sqlight-cell-bool-true': (params) => params.value === true,
        'sqlight-cell-bool-false': (params) => params.value === false,
        'sqlight-cell-binary': (params) => typeof params.value === 'object' && params.value !== null && 'type' in params.value && (params.value as any).type === 'binary',
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
      valueFormatter: (params) => {
        const val = params.value;
        if (val === null || val === undefined) return 'NULL';
        if (typeof val === 'boolean') return val ? 'TRUE' : 'FALSE';
        if (typeof val === 'object' && val !== null && 'type' in val && (val as any).type === 'binary') {
          return `[Binary ${(val as any).length} B]`;
        }
        return val != null ? String(val) : '';
      },
    };
  });

  return [indexCol, ...dataCols];
}

// Rebuilding 100+ column definitions on unrelated reactive changes makes AG Grid re-apply
// the whole column model, so identical inputs reuse the previous array instance.
let cachedColumnDefs: ColDef[] = [];
let cachedColumnDefsSignature = '';

function buildColumnDefsSignature(): string {
  if (!props.resultSet) return 'empty';
  return [
    props.resultSet.columns.map((c) => `${c.name}|${c.dataType}|${c.nullable ? 1 : 0}`).join('\u0001'),
    [...primaryKeyColumnNames.value].sort().join(','),
    [...identityColumnNames.value].sort().join(','),
    editability.value.canEdit ? '1' : '0',
    String(props.resultSet.rows.length),
  ].join('\u0002');
}

const columnDefs = computed<ColDef[]>(() => {
  const signature = buildColumnDefsSignature();
  if (signature === cachedColumnDefsSignature && cachedColumnDefs.length > 0) {
    return cachedColumnDefs;
  }
  cachedColumnDefsSignature = signature;
  cachedColumnDefs = buildColumnDefs();
  return cachedColumnDefs;
});

function onCellContextMenu(event: CellContextMenuEvent) {
  if (event.event) {
    (event.event as Event).preventDefault?.();
    (event.event as Event).stopPropagation?.();
  }
  const mouseEvent = event.event as MouseEvent | undefined;
  if (!mouseEvent) return;

  const menuWidth = 220;
  const menuHeight = 390;
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
  invalidateVisualColIndices();
  updateSelectionHighlight();
  contextMenu.visible = false;
}
</script>

<style scoped>
:deep(.sqlight-cell-selected) {
  background-color: rgba(59, 130, 246, 0.22) !important;
}

/* While the horizontal scrollbar is being dragged the grid repaints every frame, so
   decorative transitions/animations are switched off until the scroll settles. */
.is-h-scrolling :deep(*) {
  transition: none !important;
  animation: none !important;
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

/* Zero-overhead CSS styling for NULL, Booleans, and Binary cells (Native text performance) */
:deep(.sqlight-cell-null) {
  color: rgb(var(--color-dark-500)) !important;
  font-style: italic !important;
  font-family: var(--ag-font-family) !important;
  font-size: 0.6875rem !important;
}

:deep(.sqlight-cell-bool-true) {
  color: #34d399 !important;
  font-weight: 600 !important;
  font-size: 0.6875rem !important;
}

:deep(.sqlight-cell-bool-false) {
  color: #fb7185 !important;
  font-weight: 600 !important;
  font-size: 0.6875rem !important;
}

:deep(.sqlight-cell-binary) {
  color: #93c5fd !important;
  font-weight: 500 !important;
  font-size: 0.6875rem !important;
}
</style>
