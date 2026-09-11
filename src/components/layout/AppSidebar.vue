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
          placeholder="Filter tables, views & procs..."
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
          @click="selectConnection(conn.id)"
          @contextmenu.prevent="openConnContextMenu($event, conn)"
          :class="[
            'flex items-center space-x-1 px-1.5 py-1 rounded cursor-pointer group transition-colors relative',
            connectionStore.activeConnectionId === conn.id ? 'bg-dark-800 text-dark-100' : 'hover:bg-dark-750 text-dark-300'
          ]"
        >
          <!-- Direction chevron: ONLY clicking this expands/collapses! -->
          <button
            type="button"
            @click.stop="toggleConnectionExpand(conn.id)"
            class="p-0.5 hover:bg-dark-700 text-dark-500 hover:text-dark-200 rounded transition-colors flex-shrink-0 flex items-center justify-center"
            title="展開/收合 (Expand/Collapse)"
          >
            <component
              :is="expandedConns[conn.id] ? ChevronDown : ChevronRight"
              class="w-3 h-3"
            />
          </button>
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
            v-for="db in connectionStore.getDatabases(conn.id)"
            :key="db"
            class="space-y-0.5"
          >
            <!-- Database Item -->
            <div
              @click="selectDatabase(conn.id, db)"
              :class="[
                'flex items-center space-x-1 px-1.5 py-0.5 rounded cursor-pointer transition-colors group',
                connectionStore.activeConnectionId === conn.id && connectionStore.activeDatabase === db
                  ? 'bg-brand-500/20 text-brand-300 font-semibold'
                  : 'text-dark-300 hover:bg-dark-750 hover:text-dark-100'
              ]"
            >
              <!-- Direction Chevron Button -->
              <button
                type="button"
                @click.stop="toggleDatabaseExpand(conn.id, db)"
                class="p-0.5 hover:bg-dark-700 text-dark-500 hover:text-dark-200 rounded transition-colors flex-shrink-0 flex items-center justify-center"
                title="展開/收合資料表 (Expand/Collapse Objects)"
              >
                <component
                  :is="expandedDbs[`${conn.id}:${db}`] ? ChevronDown : ChevronRight"
                  class="w-2.5 h-2.5"
                />
              </button>
              <Database class="w-3 h-3 text-amber-400/80 flex-shrink-0" />
              <span class="truncate flex-1">{{ db }}</span>
            </div>

            <!-- Database Categories & Object Tree -->
            <div v-if="expandedDbs[`${conn.id}:${db}`]" class="pl-3.5 border-l border-dark-750 ml-2 space-y-1">
              <!-- Loading state -->
              <div
                v-if="loadingTablesByDb[`${conn.id}:${db}`] || schemaStore.loadingRoutinesByDb[`${conn.id}:${db}`]"
                class="py-1 px-1.5 text-xxs text-dark-400 flex items-center space-x-1.5"
              >
                <RotateCw class="w-3 h-3 animate-spin text-brand-400" />
                <span>載入物件中...</span>
              </div>

              <div v-else class="space-y-1">
                <!-- 1. 資料表 (Tables) -->
                <div class="space-y-0.5">
                  <div
                    @click="toggleFolder(conn.id, db, 'tables')"
                    class="flex items-center space-x-1 px-1.5 py-0.5 rounded cursor-pointer text-dark-400 hover:text-dark-200 hover:bg-dark-750 transition-colors"
                  >
                    <component
                      :is="isFolderExpanded(conn.id, db, 'tables') ? ChevronDown : ChevronRight"
                      class="w-2.5 h-2.5 text-dark-500"
                    />
                    <component
                      :is="isFolderExpanded(conn.id, db, 'tables') ? FolderOpen : Folder"
                      class="w-3 h-3 text-brand-400"
                    />
                    <span class="font-sans font-medium text-dark-200">資料表</span>
                    <span class="text-xxs text-dark-500 font-mono">({{ getFilteredTables(conn.id, db).length }})</span>
                  </div>

                  <!-- Tables List -->
                  <div
                    v-if="isFolderExpanded(conn.id, db, 'tables')"
                    class="pl-3.5 border-l border-dark-750 ml-2 space-y-0.5"
                  >
                    <div
                      v-if="getFilteredTables(conn.id, db).length === 0"
                      class="py-0.5 px-1.5 text-xxs text-dark-500 italic"
                    >
                      無資料表 (No tables)
                    </div>

                    <div
                      v-else
                      v-for="table in getFilteredTables(conn.id, db)"
                      :key="`${conn.id}:${db}:${table.schema}.${table.name}`"
                      class="space-y-0.5"
                    >
                      <!-- Table Item -->
                      <div
                        @click="toggleTable(conn.id, db, table.schema, table.name)"
                        @contextmenu.prevent="openContextMenu($event, conn.id, db, table.schema, table.name, 'TABLE')"
                        class="flex items-center space-x-1 px-1.5 py-0.5 rounded hover:bg-dark-750 cursor-pointer text-dark-300 hover:text-dark-100 group"
                        :title="`${table.schema}.${table.name} (Table) - 右鍵開啟選單 (Open Data / DDL)`"
                      >
                        <component
                          :is="isTableExpanded(conn.id, db, table.schema, table.name) ? ChevronDown : ChevronRight"
                          class="w-2.5 h-2.5 text-dark-500 group-hover:text-dark-300 flex-shrink-0"
                        />
                        <Table2 class="w-3 h-3 text-brand-400 flex-shrink-0" />
                        <span class="text-dark-400 text-xxs flex-shrink-0">{{ table.schema }}.</span>
                        <span class="truncate flex-1 font-medium">{{ table.name }}</span>
                      </div>

                      <!-- Columns List -->
                      <div
                        v-if="isTableExpanded(conn.id, db, table.schema, table.name)"
                        class="pl-3.5 border-l border-dark-750 ml-2 space-y-0.5"
                      >
                        <div
                          v-if="loadingColumns[tableKey(conn.id, db, table.schema, table.name)]"
                          class="py-0.5 px-1 text-xxs text-dark-400 flex items-center space-x-1.5"
                        >
                          <RotateCw class="w-2.5 h-2.5 animate-spin text-brand-400" />
                          <span>載入欄位中...</span>
                        </div>

                        <div
                          v-else-if="getTableColumns(conn.id, db, table.schema, table.name).length === 0"
                          class="py-0.5 px-1 text-xxs text-dark-500 italic"
                        >
                          無欄位資訊
                        </div>

                        <div
                          v-else
                          v-for="col in getTableColumns(conn.id, db, table.schema, table.name)"
                          :key="col.name"
                          @dblclick.stop="handleColumnDoubleClick(col)"
                          class="flex items-center space-x-1.5 px-1.5 py-0.5 text-xxs rounded cursor-pointer select-none transition-colors group"
                          :class="[
                            isPendingColumn(col.name)
                              ? 'bg-brand-500/25 text-brand-200 border border-brand-500/40 shadow-xs'
                              : 'text-dark-400 hover:text-dark-100 hover:bg-dark-750/70'
                          ]"
                          :title="`雙擊記住此欄位 (${col.name})，點擊編輯區游標處即可貼上`"
                        >
                          <Key v-if="col.isPrimaryKey" class="w-2.5 h-2.5 text-amber-400 flex-shrink-0" />
                          <Columns v-else class="w-2.5 h-2.5 text-dark-500 group-hover:text-dark-300 flex-shrink-0" />
                          <span :class="[col.isPrimaryKey ? 'text-amber-300 font-semibold' : 'text-dark-300 group-hover:text-dark-100']" class="truncate flex-1">
                            {{ col.name }}
                          </span>
                          <span class="text-dark-500 lowercase font-sans text-xxs flex-shrink-0">
                            {{ col.dataType }}
                          </span>
                          <span
                            v-if="isPendingColumn(col.name)"
                            class="text-xxs px-1 py-0.2 bg-brand-500/30 text-brand-300 font-medium rounded text-[9px] border border-brand-400/40 flex-shrink-0 animate-pulse"
                          >
                            待貼上
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <!-- 2. 檢視表 (Views) -->
                <div class="space-y-0.5">
                  <div
                    @click="toggleFolder(conn.id, db, 'views')"
                    class="flex items-center space-x-1 px-1.5 py-0.5 rounded cursor-pointer text-dark-400 hover:text-dark-200 hover:bg-dark-750 transition-colors"
                  >
                    <component
                      :is="isFolderExpanded(conn.id, db, 'views') ? ChevronDown : ChevronRight"
                      class="w-2.5 h-2.5 text-dark-500"
                    />
                    <component
                      :is="isFolderExpanded(conn.id, db, 'views') ? FolderOpen : Folder"
                      class="w-3 h-3 text-purple-400"
                    />
                    <span class="font-sans font-medium text-dark-200">檢視表</span>
                    <span class="text-xxs text-dark-500 font-mono">({{ getFilteredViews(conn.id, db).length }})</span>
                  </div>

                  <!-- Views List -->
                  <div
                    v-if="isFolderExpanded(conn.id, db, 'views')"
                    class="pl-3.5 border-l border-dark-750 ml-2 space-y-0.5"
                  >
                    <div
                      v-if="getFilteredViews(conn.id, db).length === 0"
                      class="py-0.5 px-1.5 text-xxs text-dark-500 italic"
                    >
                      無檢視表 (No views)
                    </div>

                    <div
                      v-else
                      v-for="view in getFilteredViews(conn.id, db)"
                      :key="`${conn.id}:${db}:${view.schema}.${view.name}`"
                      class="space-y-0.5"
                    >
                      <!-- View Item -->
                      <div
                        @click="toggleTable(conn.id, db, view.schema, view.name)"
                        @contextmenu.prevent="openContextMenu($event, conn.id, db, view.schema, view.name, 'VIEW')"
                        class="flex items-center space-x-1 px-1.5 py-0.5 rounded hover:bg-dark-750 cursor-pointer text-dark-300 hover:text-dark-100 group"
                        :title="`${view.schema}.${view.name} (View) - 右鍵檢視定義或查詢`"
                      >
                        <component
                          :is="isTableExpanded(conn.id, db, view.schema, view.name) ? ChevronDown : ChevronRight"
                          class="w-2.5 h-2.5 text-dark-500 group-hover:text-dark-300 flex-shrink-0"
                        />
                        <FileText class="w-3 h-3 text-purple-400 flex-shrink-0" />
                        <span class="text-dark-400 text-xxs flex-shrink-0">{{ view.schema }}.</span>
                        <span class="truncate flex-1 font-medium">{{ view.name }}</span>
                      </div>

                      <!-- View Columns -->
                      <div
                        v-if="isTableExpanded(conn.id, db, view.schema, view.name)"
                        class="pl-3.5 border-l border-dark-750 ml-2 space-y-0.5"
                      >
                        <div
                          v-if="loadingColumns[tableKey(conn.id, db, view.schema, view.name)]"
                          class="py-0.5 px-1 text-xxs text-dark-400 flex items-center space-x-1.5"
                        >
                          <RotateCw class="w-2.5 h-2.5 animate-spin text-brand-400" />
                          <span>載入欄位中...</span>
                        </div>

                        <div
                          v-else-if="getTableColumns(conn.id, db, view.schema, view.name).length === 0"
                          class="py-0.5 px-1 text-xxs text-dark-500 italic"
                        >
                          無欄位資訊
                        </div>

                        <div
                          v-else
                          v-for="col in getTableColumns(conn.id, db, view.schema, view.name)"
                          :key="col.name"
                          @dblclick.stop="handleColumnDoubleClick(col)"
                          class="flex items-center space-x-1.5 px-1.5 py-0.5 text-xxs rounded cursor-pointer select-none transition-colors group"
                          :class="[
                            isPendingColumn(col.name)
                              ? 'bg-brand-500/25 text-brand-200 border border-brand-500/40 shadow-xs'
                              : 'text-dark-400 hover:text-dark-100 hover:bg-dark-750/70'
                          ]"
                          :title="`雙擊記住此欄位 (${col.name})，點擊編輯區游標處即可貼上`"
                        >
                          <Columns class="w-2.5 h-2.5 text-dark-500 group-hover:text-dark-300 flex-shrink-0" />
                          <span class="text-dark-300 group-hover:text-dark-100 truncate flex-1">
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

                <!-- 3. 預存程序 (Stored Procedures) -->
                <div class="space-y-0.5">
                  <div
                    @click="toggleFolder(conn.id, db, 'procs')"
                    class="flex items-center space-x-1 px-1.5 py-0.5 rounded cursor-pointer text-dark-400 hover:text-dark-200 hover:bg-dark-750 transition-colors"
                  >
                    <component
                      :is="isFolderExpanded(conn.id, db, 'procs') ? ChevronDown : ChevronRight"
                      class="w-2.5 h-2.5 text-dark-500"
                    />
                    <component
                      :is="isFolderExpanded(conn.id, db, 'procs') ? FolderOpen : Folder"
                      class="w-3 h-3 text-amber-400"
                    />
                    <span class="font-sans font-medium text-dark-200">預存程序</span>
                    <span class="text-xxs text-dark-500 font-mono">({{ getFilteredProcedures(conn.id, db).length }})</span>
                  </div>

                  <!-- Procedures List -->
                  <div
                    v-if="isFolderExpanded(conn.id, db, 'procs')"
                    class="pl-3.5 border-l border-dark-750 ml-2 space-y-0.5"
                  >
                    <div
                      v-if="getFilteredProcedures(conn.id, db).length === 0"
                      class="py-0.5 px-1.5 text-xxs text-dark-500 italic"
                    >
                      無預存程序 (No stored procedures)
                    </div>

                    <div
                      v-else
                      v-for="proc in getFilteredProcedures(conn.id, db)"
                      :key="`${conn.id}:${db}:${proc.schema}.${proc.name}`"
                      @click="selectDatabase(conn.id, db)"
                      @contextmenu.prevent="openContextMenu($event, conn.id, db, proc.schema, proc.name, 'PROCEDURE')"
                      @dblclick="handleViewDefinition(conn.id, db, proc.schema, proc.name)"
                      class="flex items-center space-x-1 px-1.5 py-0.5 rounded hover:bg-dark-750 cursor-pointer text-dark-300 hover:text-dark-100 group"
                      :title="`${proc.schema}.${proc.name} (Stored Procedure) - 雙擊檢視定義，右鍵開啟選單`"
                    >
                      <Cog class="w-3 h-3 text-amber-400 flex-shrink-0" />
                      <span class="text-dark-400 text-xxs flex-shrink-0">{{ proc.schema }}.</span>
                      <span class="truncate flex-1 font-medium">{{ proc.name }}</span>
                    </div>
                  </div>
                </div>

                <!-- 4. 函數 (Functions) -->
                <div class="space-y-0.5">
                  <div
                    @click="toggleFolder(conn.id, db, 'funcs')"
                    class="flex items-center space-x-1 px-1.5 py-0.5 rounded cursor-pointer text-dark-400 hover:text-dark-200 hover:bg-dark-750 transition-colors"
                  >
                    <component
                      :is="isFolderExpanded(conn.id, db, 'funcs') ? ChevronDown : ChevronRight"
                      class="w-2.5 h-2.5 text-dark-500"
                    />
                    <component
                      :is="isFolderExpanded(conn.id, db, 'funcs') ? FolderOpen : Folder"
                      class="w-3 h-3 text-sky-400"
                    />
                    <span class="font-sans font-medium text-dark-200">函數</span>
                    <span class="text-xxs text-dark-500 font-mono">({{ getFilteredFunctions(conn.id, db).length }})</span>
                  </div>

                  <!-- Functions List -->
                  <div
                    v-if="isFolderExpanded(conn.id, db, 'funcs')"
                    class="pl-3.5 border-l border-dark-750 ml-2 space-y-0.5"
                  >
                    <div
                      v-if="getFilteredFunctions(conn.id, db).length === 0"
                      class="py-0.5 px-1.5 text-xxs text-dark-500 italic"
                    >
                      無函數 (No functions)
                    </div>

                    <div
                      v-else
                      v-for="func in getFilteredFunctions(conn.id, db)"
                      :key="`${conn.id}:${db}:${func.schema}.${func.name}`"
                      @click="selectDatabase(conn.id, db)"
                      @contextmenu.prevent="openContextMenu($event, conn.id, db, func.schema, func.name, 'FUNCTION')"
                      @dblclick="handleViewDefinition(conn.id, db, func.schema, func.name)"
                      class="flex items-center space-x-1 px-1.5 py-0.5 rounded hover:bg-dark-750 cursor-pointer text-dark-300 hover:text-dark-100 group"
                      :title="`${func.schema}.${func.name} (Function) - 雙擊檢視定義，右鍵開啟選單`"
                    >
                      <Code2 class="w-3 h-3 text-sky-400 flex-shrink-0" />
                      <span class="text-dark-400 text-xxs flex-shrink-0">{{ func.schema }}.</span>
                      <span class="truncate flex-1 font-medium">{{ func.name }}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Object Context Menu Popover (Tables, Views, Procedures, Functions) -->
    <div
      v-if="contextMenu.visible"
      :style="{ top: `${contextMenu.y}px`, left: `${contextMenu.x}px` }"
      class="fixed z-50 bg-dark-800 border border-dark-700 rounded shadow-xl py-1 w-52 text-xs font-sans text-dark-200 select-none"
      @click="contextMenu.visible = false"
    >
      <div class="px-2.5 py-1 text-xxs text-dark-400 border-b border-dark-750 font-mono truncate">
        {{ contextMenu.schema }}.{{ contextMenu.tableName }} ({{ contextMenu.objectType }})
      </div>

      <!-- Tables & Views: Open Data -->
      <button
        v-if="contextMenu.objectType === 'TABLE' || contextMenu.objectType === 'VIEW'"
        @click="handleOpenData"
        class="w-full text-left px-2.5 py-1.5 hover:bg-dark-750 hover:text-dark-100 flex items-center space-x-2 transition-colors"
      >
        <Table2 class="w-3.5 h-3.5 text-emerald-400" />
        <span>{{ contextMenu.objectType === 'TABLE' ? '開啟資料表 (Open Data)' : '開啟檢視表資料' }}</span>
      </button>

      <!-- Tables & Views: Generate SELECT -->
      <button
        v-if="contextMenu.objectType === 'TABLE' || contextMenu.objectType === 'VIEW'"
        @click="handleGenerateSelect"
        class="w-full text-left px-2.5 py-1.5 hover:bg-dark-750 hover:text-dark-100 flex items-center space-x-2 transition-colors"
      >
        <FileCode class="w-3.5 h-3.5 text-brand-400" />
        <span>產生 SELECT 語法</span>
      </button>

      <!-- Table Only: Generate CREATE TABLE DDL -->
      <button
        v-if="contextMenu.objectType === 'TABLE'"
        @click="handleGenerateCreateTableDdl"
        class="w-full text-left px-2.5 py-1.5 hover:bg-dark-750 hover:text-dark-100 flex items-center space-x-2 transition-colors text-amber-300"
      >
        <FileText class="w-3.5 h-3.5 text-amber-400" />
        <span>產生 CREATE TABLE 腳本</span>
      </button>

      <!-- Views, Procedures, Functions: View Definition -->
      <button
        v-if="contextMenu.objectType === 'VIEW' || contextMenu.objectType === 'PROCEDURE' || contextMenu.objectType === 'FUNCTION'"
        @click="handleViewDefinition(contextMenu.connId, contextMenu.database, contextMenu.schema, contextMenu.tableName)"
        class="w-full text-left px-2.5 py-1.5 hover:bg-dark-750 hover:text-dark-100 flex items-center space-x-2 transition-colors text-cyan-300"
      >
        <Code2 class="w-3.5 h-3.5 text-cyan-400" />
        <span>檢視定義 (View Definition)</span>
      </button>

      <!-- Procedures: Generate EXEC Template -->
      <button
        v-if="contextMenu.objectType === 'PROCEDURE'"
        @click="handleGenerateExec"
        class="w-full text-left px-2.5 py-1.5 hover:bg-dark-750 hover:text-dark-100 flex items-center space-x-2 transition-colors"
      >
        <Play class="w-3.5 h-3.5 text-emerald-400" />
        <span>產生 EXEC 呼叫樣板</span>
      </button>

      <!-- Functions: Generate SELECT Template -->
      <button
        v-if="contextMenu.objectType === 'FUNCTION'"
        @click="handleGenerateFuncSelect"
        class="w-full text-left px-2.5 py-1.5 hover:bg-dark-750 hover:text-dark-100 flex items-center space-x-2 transition-colors"
      >
        <FileCode class="w-3.5 h-3.5 text-sky-400" />
        <span>產生 SELECT 呼叫樣板</span>
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
  Folder,
  FolderOpen,
  Cog,
  Code2,
  Play,
} from 'lucide-vue-next';
import ConfirmModal from '@/components/common/ConfirmModal.vue';
import { useConnectionStore } from '@/stores/connectionStore';
import { useWorkspaceStore } from '@/stores/workspaceStore';
import { useSchemaStore } from '@/stores/schemaStore';
import { schemaService } from '@/services/schemaService';
import { wrapIdentifierIfNeeded } from '@/utils/sqlParser';
import { generateCreateTableDdl } from '@/utils/ddlGenerator';
import type { TableItem, ColumnItem, RoutineItem } from '@/types/schema';
import type { ConnectionProfile } from '@/types/connection';

const emit = defineEmits<{
  (e: 'open-connection-modal'): void;
  (e: 'edit-connection', profile: ConnectionProfile): void;
}>();

const connectionStore = useConnectionStore();
const workspaceStore = useWorkspaceStore();
const schemaStore = useSchemaStore();

function isPendingColumn(colName: string): boolean {
  if (!workspaceStore.pendingColumnToInsert) return false;
  const wrapped = wrapIdentifierIfNeeded(colName);
  return (
    workspaceStore.pendingColumnToInsert === wrapped ||
    workspaceStore.pendingColumnToInsert === colName
  );
}

function handleColumnDoubleClick(col: ColumnItem) {
  const colText = wrapIdentifierIfNeeded(col.name);
  workspaceStore.setPendingColumnToInsert(colText);
  try {
    navigator.clipboard?.writeText(colText);
  } catch (err) {
    // Ignore clipboard access errors
  }
  workspaceStore.showToast(`已記住欄位 ${colText}，點擊編輯區游標處即可貼上`, 'info', 2500);
}

const filterQuery = ref('');
const isRefreshing = ref(false);
const refreshingConnId = ref<string | null>(null);
const expandedConns = reactive<Record<string, boolean>>({});
const expandedDbs = reactive<Record<string, boolean>>({});
const expandedFolders = reactive<Record<string, boolean>>({});
const expandedTables = reactive<Record<string, boolean>>({});
const loadedColumns = reactive<Record<string, ColumnItem[]>>({});
const tablesByDb = reactive<Record<string, TableItem[]>>({});
const loadingTablesByDb = reactive<Record<string, boolean>>({});
const loadingColumns = reactive<Record<string, boolean>>({});

function isFolderExpanded(connId: string, db: string, folder: 'tables' | 'views' | 'procs' | 'funcs'): boolean {
  if (filterQuery.value.trim()) {
    return true;
  }
  const key = `${connId}:${db}:${folder}`;
  if (expandedFolders[key] === undefined) {
    return folder === 'tables';
  }
  return !!expandedFolders[key];
}

function toggleFolder(connId: string, db: string, folder: 'tables' | 'views' | 'procs' | 'funcs') {
  const key = `${connId}:${db}:${folder}`;
  expandedFolders[key] = !isFolderExpanded(connId, db, folder);
}

function getFilteredTables(connId: string, db: string): TableItem[] {
  const key = `${connId}:${db}`;
  const list = (tablesByDb[key] || []).filter((t) => t.kind === 'BASE TABLE');
  const q = filterQuery.value.trim().toLowerCase();
  if (!q) return list;
  return list.filter(
    (t) => t.name.toLowerCase().includes(q) || t.schema.toLowerCase().includes(q)
  );
}

function getFilteredViews(connId: string, db: string): TableItem[] {
  const key = `${connId}:${db}`;
  const list = (tablesByDb[key] || []).filter((t) => t.kind === 'VIEW');
  const q = filterQuery.value.trim().toLowerCase();
  if (!q) return list;
  return list.filter(
    (t) => t.name.toLowerCase().includes(q) || t.schema.toLowerCase().includes(q)
  );
}

function getFilteredProcedures(connId: string, db: string): RoutineItem[] {
  const key = `${connId}:${db}`;
  const list = (schemaStore.routinesByDb[key] || []).filter((r) => r.kind === 'PROCEDURE');
  const q = filterQuery.value.trim().toLowerCase();
  if (!q) return list;
  return list.filter(
    (r) => r.name.toLowerCase().includes(q) || r.schema.toLowerCase().includes(q)
  );
}

function getFilteredFunctions(connId: string, db: string): RoutineItem[] {
  const key = `${connId}:${db}`;
  const list = (schemaStore.routinesByDb[key] || []).filter((r) => r.kind === 'FUNCTION');
  const q = filterQuery.value.trim().toLowerCase();
  if (!q) return list;
  return list.filter(
    (r) => r.name.toLowerCase().includes(q) || r.schema.toLowerCase().includes(q)
  );
}

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

// Object Context Menu
const contextMenu = reactive<{
  visible: boolean;
  x: number;
  y: number;
  connId: string;
  database: string;
  schema: string;
  tableName: string;
  objectType: 'TABLE' | 'VIEW' | 'PROCEDURE' | 'FUNCTION';
}>({
  visible: false,
  x: 0,
  y: 0,
  connId: '',
  database: '',
  schema: '',
  tableName: '',
  objectType: 'TABLE',
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
    expandedDbs[`${connectionStore.activeConnectionId}:${connectionStore.activeDatabase}`] = true;
    if (connectionStore.status === 'connected') {
      await loadDatabaseTables(connectionStore.activeConnectionId, connectionStore.activeDatabase);
    }
  }
});

async function loadDatabaseTables(connId: string, db: string, force = false) {
  const dbKey = `${connId}:${db}`;
  if (!force && tablesByDb[dbKey] !== undefined) {
    return;
  }
  loadingTablesByDb[dbKey] = true;
  try {
    if (connectionStore.activeConnectionId !== connId || connectionStore.status !== 'connected') {
      await connectionStore.connect(connId);
    }
    const [tables] = await Promise.all([
      schemaService.getTables(connId, db),
      schemaStore.loadDatabaseRoutines(connId, db, force),
    ]);
    tablesByDb[dbKey] = tables;
  } catch (err: unknown) {
    console.error(`Failed to load tables for ${dbKey}:`, err);
    alert(`載入資料庫 [${db}] 的物件失敗: ${err instanceof Error ? err.message : String(err)}`);
  } finally {
    loadingTablesByDb[dbKey] = false;
  }
}

async function refreshCurrent() {
  isRefreshing.value = true;
  try {
    await connectionStore.refreshDatabases();
    if (connectionStore.activeConnectionId && connectionStore.activeDatabase) {
      schemaStore.loadDatabaseSchema(connectionStore.activeConnectionId, connectionStore.activeDatabase, true).catch(() => {});
      schemaStore.loadDatabaseRoutines(connectionStore.activeConnectionId, connectionStore.activeDatabase, true).catch(() => {});
      await loadDatabaseTables(connectionStore.activeConnectionId, connectionStore.activeDatabase, true);
    }
  } catch (err: unknown) {
    console.error('Refresh current failed:', err);
    alert(`重新整理失敗: ${err instanceof Error ? err.message : String(err)}`);
  } finally {
    isRefreshing.value = false;
  }
}

async function handleRefreshConn(conn: ConnectionProfile) {
  connContextMenu.visible = false;
  refreshingConnId.value = conn.id;
  try {
    if (connectionStore.activeConnectionId !== conn.id || connectionStore.status !== 'connected') {
      await connectionStore.connect(conn.id);
      expandedConns[conn.id] = true;
    } else {
      await connectionStore.refreshDatabases(conn.id);
    }

    // Refresh all currently expanded databases for this connection
    const dbs = connectionStore.getDatabases(conn.id);
    for (const db of dbs) {
      const dbKey = `${conn.id}:${db}`;
      if (expandedDbs[dbKey]) {
        schemaStore.loadDatabaseSchema(conn.id, db, true).catch(() => {});
        schemaStore.loadDatabaseRoutines(conn.id, db, true).catch(() => {});
        await loadDatabaseTables(conn.id, db, true);
      }
    }
  } catch (err: unknown) {
    console.error('Failed to refresh connection:', err);
    alert(`連線或更新資料庫失敗: ${err instanceof Error ? err.message : String(err)}`);
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

function toggleConnectionExpand(connId: string) {
  if (inlineEditingId.value === connId) return;
  expandedConns[connId] = !expandedConns[connId];
}

async function selectConnection(connId: string) {
  if (inlineEditingId.value === connId) return;
  if (connectionStore.activeConnectionId === connId && connectionStore.status === 'connected') {
    return;
  }
  try {
    await connectionStore.connect(connId);
  } catch (err) {
    console.warn('Failed to connect on select:', err);
  }
}

async function toggleDatabaseExpand(connId: string, db: string) {
  const dbKey = `${connId}:${db}`;
  expandedDbs[dbKey] = !expandedDbs[dbKey];
  if (expandedDbs[dbKey]) {
    await loadDatabaseTables(connId, db);
  }
}

async function selectDatabase(connId: string, db: string) {
  if (connectionStore.activeConnectionId !== connId || connectionStore.status !== 'connected') {
    try {
      await connectionStore.connect(connId);
    } catch (err) {
      console.warn('Failed to connect on selectDatabase:', err);
      return;
    }
  }
  await connectionStore.switchDatabase(db);
}

function tableKey(connId: string, db: string, schema: string, tableName: string) {
  return `${connId}:${db}:${schema}.${tableName}`;
}

function isTableExpanded(connId: string, db: string, schema: string, tableName: string) {
  return !!expandedTables[tableKey(connId, db, schema, tableName)];
}

async function toggleTable(connId: string, db: string, schema: string, tableName: string) {
  const key = tableKey(connId, db, schema, tableName);
  expandedTables[key] = !expandedTables[key];

  if (expandedTables[key] && !loadedColumns[key]) {
    loadingColumns[key] = true;
    try {
      const cols = await schemaService.getColumns(
        connId,
        schema,
        tableName,
        db
      );
      loadedColumns[key] = cols;
    } catch (err: unknown) {
      console.error('Failed to load columns:', err);
      alert(`載入欄位失敗: ${err instanceof Error ? err.message : String(err)}`);
      expandedTables[key] = false;
    } finally {
      loadingColumns[key] = false;
    }
  }
}

function getTableColumns(connId: string, db: string, schema: string, tableName: string) {
  return loadedColumns[tableKey(connId, db, schema, tableName)] ?? [];
}

function openContextMenu(
  event: MouseEvent,
  connId: string,
  db: string,
  schema: string,
  tableName: string,
  objectType: 'TABLE' | 'VIEW' | 'PROCEDURE' | 'FUNCTION' = 'TABLE'
) {
  connContextMenu.visible = false;
  contextMenu.visible = true;
  contextMenu.x = event.clientX;
  contextMenu.y = event.clientY;
  contextMenu.connId = connId;
  contextMenu.database = db;
  contextMenu.schema = schema;
  contextMenu.tableName = tableName;
  contextMenu.objectType = objectType;

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

async function handleOpenData() {
  if (contextMenu.connId && connectionStore.activeConnectionId !== contextMenu.connId) {
    try {
      await connectionStore.connect(contextMenu.connId);
    } catch (e) {
      console.warn('Connect failed:', e);
    }
  }
  if (contextMenu.database && connectionStore.activeDatabase !== contextMenu.database) {
    try {
      await connectionStore.switchDatabase(contextMenu.database);
    } catch (e) {
      console.warn('Switch DB failed:', e);
    }
  }
  workspaceStore.addTableDataTab(contextMenu.schema, contextMenu.tableName);
  contextMenu.visible = false;
}

async function handleGenerateSelect() {
  if (contextMenu.connId && connectionStore.activeConnectionId !== contextMenu.connId) {
    try {
      await connectionStore.connect(contextMenu.connId);
    } catch (e) {
      console.warn('Connect failed:', e);
    }
  }
  if (contextMenu.database && connectionStore.activeDatabase !== contextMenu.database) {
    try {
      await connectionStore.switchDatabase(contextMenu.database);
    } catch (e) {
      console.warn('Switch DB failed:', e);
    }
  }
  const dbPrefix = contextMenu.database ? `[${contextMenu.database}].` : '';
  const sql = `SELECT TOP 1000\n  *\nFROM ${dbPrefix}[${contextMenu.schema}].[${contextMenu.tableName}];\n`;
  workspaceStore.addSqlTab(sql, `${contextMenu.tableName}.sql`);
  contextMenu.visible = false;
}

async function handleGenerateCreateTableDdl() {
  const { connId, database, schema, tableName } = contextMenu;
  const key = tableKey(connId, database, schema, tableName);
  let cols = loadedColumns[key];
  if (!cols || cols.length === 0) {
    try {
      cols = await schemaService.getColumns(connId, schema, tableName, database);
      loadedColumns[key] = cols;
    } catch (err) {
      console.error('Failed to get columns for DDL:', err);
    }
  }

  const ddl = generateCreateTableDdl({
    tableName,
    schema,
    database,
    columns: cols || [],
  });

  workspaceStore.addSqlTab(ddl, `${tableName}_ddl.sql`);
  workspaceStore.showToast(`已產生 [${schema}].[${tableName}] 之 CREATE TABLE 腳本`, 'success', 2500);
  contextMenu.visible = false;
}

async function handleViewDefinition(connId: string, database: string, schema: string, name: string) {
  try {
    if (connectionStore.activeConnectionId !== connId) {
      await connectionStore.connect(connId);
    }
    const def = await schemaStore.getObjectDefinition(connId, database, schema, name);
    if (def) {
      workspaceStore.addSqlTab(def, `${schema}.${name}.sql`);
      workspaceStore.showToast(`已載入 [${schema}].[${name}] 之 SQL 定義`, 'success', 2500);
    } else {
      const fallback = `-- 提示：未能直接讀取到 OBJECT_DEFINITION（可能為加密物件或缺少 VIEW DEFINITION 權限）
USE [${database}];
GO

SELECT OBJECT_DEFINITION(OBJECT_ID(N'[${schema}].[${name}]')) AS [Definition];
GO
`;
      workspaceStore.addSqlTab(fallback, `${schema}.${name}.sql`);
      workspaceStore.showToast(`未能直接讀取到定義，已開啟查詢語句`, 'info', 2500);
    }
  } catch (err) {
    console.error('Failed to load object definition:', err);
  }
  contextMenu.visible = false;
}

function handleGenerateExec() {
  const { database, schema, tableName } = contextMenu;
  const sql = `-- ============================================================
-- 執行預存程序: [${schema}].[${tableName}]
-- 產生時間: ${new Date().toLocaleString()}
-- ============================================================
USE [${database}];
GO

DECLARE @RC int;
-- TODO: 如有參數請在此宣告與傳入：
-- DECLARE @Param1 int;

EXECUTE @RC = [${schema}].[${tableName}]
  -- @Param1 = @Param1
;

SELECT @RC AS [Return Code];
GO
`;
  workspaceStore.addSqlTab(sql, `EXEC_${tableName}.sql`);
  workspaceStore.showToast(`已產生 [${schema}].[${tableName}] 之 EXEC 呼叫樣板`, 'success', 2500);
  contextMenu.visible = false;
}

function handleGenerateFuncSelect() {
  const { database, schema, tableName } = contextMenu;
  const sql = `-- ============================================================
-- 呼叫函數: [${schema}].[${tableName}]
-- 產生時間: ${new Date().toLocaleString()}
-- ============================================================
USE [${database}];
GO

-- 若為純量函數 (Scalar Function):
SELECT [${schema}].[${tableName}]() AS [Result];

-- 若為資料表值函數 (Table-valued Function):
-- SELECT * FROM [${schema}].[${tableName}]();
GO
`;
  workspaceStore.addSqlTab(sql, `SELECT_${tableName}.sql`);
  workspaceStore.showToast(`已產生 [${schema}].[${tableName}] 之呼叫樣板`, 'success', 2500);
  contextMenu.visible = false;
}
</script>
