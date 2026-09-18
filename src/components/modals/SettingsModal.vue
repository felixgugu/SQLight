<template>
  <div
    v-if="isOpen"
    class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 select-none font-sans"
    @click.self="$emit('close')"
  >
    <div
      class="bg-dark-850 border border-dark-700 rounded-lg shadow-2xl w-[860px] h-[660px] max-w-[95vw] max-h-[92vh] overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-150"
    >
      <!-- Modal Header -->
      <div class="px-5 py-3.5 border-b border-dark-750 flex items-center justify-between flex-shrink-0 bg-dark-800">
        <div class="flex items-center space-x-2.5">
          <Settings class="w-4 h-4 text-brand-400" />
          <h2 class="text-sm font-semibold text-dark-100">設定 (Settings)</h2>
        </div>
        <button
          type="button"
          @click="$emit('close')"
          class="text-dark-400 hover:text-dark-200 p-1 rounded hover:bg-dark-700 transition-colors"
          title="關閉 (Esc)"
        >
          <X class="w-4 h-4" />
        </button>
      </div>

      <!-- Navigation Tabs -->
      <div class="flex border-b border-dark-750 bg-dark-850 px-5 pt-2 space-x-4 flex-shrink-0 text-xs">
        <button
          v-for="tab in tabs"
          :key="tab.id"
          type="button"
          @click="activeTab = tab.id"
          :class="[
            'pb-2 font-medium flex items-center space-x-1.5 transition-colors border-b-2',
            activeTab === tab.id
              ? 'border-brand-500 text-brand-400'
              : 'border-transparent text-dark-400 hover:text-dark-200'
          ]"
        >
          <component :is="tab.icon" class="w-3.5 h-3.5" />
          <span>{{ tab.label }}</span>
        </button>
      </div>

      <!-- Modal Body -->
      <div class="p-6 overflow-y-auto flex-1 space-y-6 text-xs text-dark-200">
        <!-- Tab 1: Editor Settings -->
        <div v-if="activeTab === 'editor'" class="space-y-5">
          <!-- Font Size -->
          <div class="flex items-center justify-between">
            <div>
              <label class="font-medium text-dark-100 block">編輯器字型大小 (Font Size)</label>
              <span class="text-xxs text-dark-400">控制 SQL 編輯器代碼文字尺寸</span>
            </div>
            <div class="flex items-center space-x-2">
              <select
                v-model.number="settingsStore.editorFontSize"
                class="bg-dark-900 border border-dark-700 rounded px-2.5 py-1 text-xs text-dark-100 font-mono focus:border-brand-500 focus:outline-none cursor-pointer"
              >
                <option v-for="size in [12, 13, 14, 15, 16, 18, 20]" :key="size" :value="size">
                  {{ size }} px
                </option>
              </select>
            </div>
          </div>

          <!-- Font Family -->
          <div class="space-y-1.5">
            <div class="flex items-center justify-between">
              <label class="font-medium text-dark-100">字型家族 (Font Family)</label>
              <span class="text-xxs text-dark-400 font-mono">等寬字型 (Monospace)</span>
            </div>
            <select
              v-model="settingsStore.editorFontFamily"
              class="w-full bg-dark-900 border border-dark-700 rounded px-2.5 py-1.5 text-xs text-dark-100 font-mono focus:border-brand-500 focus:outline-none cursor-pointer"
            >
              <option value='"Fira Code", Consolas, Monaco, monospace'>Fira Code (預設推薦，支援程式碼連字)</option>
              <option value='"JetBrains Mono", Consolas, Monaco, monospace'>JetBrains Mono</option>
              <option value='"Cascadia Code", Consolas, monospace'>Cascadia Code</option>
              <option value='Consolas, Monaco, monospace'>Consolas</option>
              <option value='Monaco, "Courier New", monospace'>Monaco</option>
              <option value='monospace'>System Monospace</option>
            </select>
          </div>

          <!-- Word Wrap -->
          <div class="flex items-center justify-between pt-2 border-t border-dark-800">
            <div>
              <label class="font-medium text-dark-100 block">自動換行 (Word Wrap)</label>
              <span class="text-xxs text-dark-400">長 SQL 語句超出可視範圍時自動折行</span>
            </div>
            <select
              v-model="settingsStore.editorWordWrap"
              class="bg-dark-900 border border-dark-700 rounded px-2.5 py-1 text-xs text-dark-100 focus:border-brand-500 focus:outline-none cursor-pointer"
            >
              <option value="on">開啟 (On)</option>
              <option value="off">關閉 (Off)</option>
            </select>
          </div>

          <!-- Tab Size -->
          <div class="flex items-center justify-between pt-2 border-t border-dark-800">
            <div>
              <label class="font-medium text-dark-100 block">Tab 縮排格數 (Tab Size)</label>
              <span class="text-xxs text-dark-400">按下 Tab 鍵時縮排的空格數</span>
            </div>
            <select
              v-model.number="settingsStore.editorTabSize"
              class="bg-dark-900 border border-dark-700 rounded px-2.5 py-1 text-xs text-dark-100 font-mono focus:border-brand-500 focus:outline-none cursor-pointer"
            >
              <option :value="2">2 空格</option>
              <option :value="4">4 空格</option>
            </select>
          </div>

          <!-- Highlight Color -->
          <div class="flex items-center justify-between pt-2 border-t border-dark-800">
            <div>
              <label class="font-medium text-dark-100 block">執行暫態高亮顏色 (Highlight Color)</label>
              <span class="text-xxs text-dark-400">Ctrl + Enter 執行或格式化語句時的閃爍高亮顏色</span>
            </div>
            <div class="flex items-center space-x-2">
              <input
                type="color"
                v-model="settingsStore.editorHighlightColor"
                class="w-7 h-7 rounded border border-dark-700 bg-dark-900 cursor-pointer p-0.5"
                title="選擇高亮顏色"
              />
              <input
                type="text"
                v-model="settingsStore.editorHighlightColor"
                class="w-20 bg-dark-900 border border-dark-700 rounded px-2 py-1 text-xs text-dark-100 font-mono focus:border-brand-500 focus:outline-none text-center uppercase"
                placeholder="#feffe0"
              />
            </div>
          </div>

          <!-- Active SQL Tab Color -->
          <div class="pt-3 border-t border-dark-800 space-y-3">
            <div>
              <label class="font-medium text-dark-100 block">當前 SQL 查詢分頁顏色 (Active SQL Tab Colors)</label>
              <span class="text-xxs text-dark-400">自訂上方 SQL 查詢分頁在選取啟用時的前景文字與背景顏色（各類別分頁均搭配專屬色彩體系）</span>
            </div>

            <!-- Color controls: Background & Foreground -->
            <div class="grid grid-cols-2 gap-3 bg-dark-900 p-2.5 rounded border border-dark-800">
              <!-- Background Color -->
              <div class="space-y-1.5">
                <span class="text-xxs text-dark-300 block font-medium">背景顏色 (Background)</span>
                <div class="flex items-center space-x-2">
                  <input
                    type="color"
                    v-model="settingsStore.activeSqlTabBgColor"
                    class="w-7 h-7 rounded border border-dark-700 bg-dark-900 cursor-pointer p-0.5"
                    title="選擇背景顏色"
                  />
                  <input
                    type="text"
                    v-model="settingsStore.activeSqlTabBgColor"
                    class="w-20 bg-dark-850 border border-dark-700 rounded px-2 py-1 text-xs text-dark-100 font-mono focus:border-brand-500 focus:outline-none text-center uppercase"
                  />
                </div>
              </div>

              <!-- Text Color -->
              <div class="space-y-1.5">
                <span class="text-xxs text-dark-300 block font-medium">前景文字顏色 (Text Color)</span>
                <div class="flex items-center space-x-2">
                  <input
                    type="color"
                    v-model="settingsStore.activeSqlTabTextColor"
                    class="w-7 h-7 rounded border border-dark-700 bg-dark-900 cursor-pointer p-0.5"
                    title="選擇文字顏色"
                  />
                  <input
                    type="text"
                    v-model="settingsStore.activeSqlTabTextColor"
                    class="w-20 bg-dark-850 border border-dark-700 rounded px-2 py-1 text-xs text-dark-100 font-mono focus:border-brand-500 focus:outline-none text-center uppercase"
                  />
                </div>
              </div>
            </div>

            <!-- Presets & Live Preview -->
            <div class="flex items-center justify-between pt-1">
              <!-- Presets -->
              <div class="flex items-center space-x-1.5">
                <span class="text-xxs text-dark-400">快速預設:</span>
                <button
                  v-for="preset in [
                    { name: 'Royal Blue', bg: '#1e40af', text: '#ffffff' },
                    { name: 'Ocean Sky', bg: '#0369a1', text: '#ffffff' },
                    { name: 'Emerald', bg: '#065f46', text: '#ffffff' },
                    { name: 'Purple', bg: '#6b21a8', text: '#ffffff' },
                    { name: 'Amber', bg: '#92400e', text: '#ffffff' },
                    { name: 'Rose', bg: '#9f1239', text: '#ffffff' },
                    { name: 'Dark Slate', bg: '#374151', text: '#ffffff' },
                  ]"
                  :key="preset.bg"
                  type="button"
                  @click="settingsStore.activeSqlTabBgColor = preset.bg; settingsStore.activeSqlTabTextColor = preset.text"
                  class="w-4 h-4 rounded-full border border-dark-600 hover:scale-110 transition-transform cursor-pointer"
                  :style="{ backgroundColor: preset.bg }"
                  :title="preset.name"
                />
              </div>

              <!-- Live Preview Badge -->
              <div class="flex items-center space-x-1.5 text-xxs">
                <span class="text-dark-400">預覽:</span>
                <div
                  class="h-6 px-2.5 flex items-center space-x-1.5 rounded text-xs font-medium shadow-xs"
                  :style="{
                    backgroundColor: settingsStore.activeSqlTabBgColor,
                    color: settingsStore.activeSqlTabTextColor,
                  }"
                >
                  <FileCode class="w-3 h-3 text-white" />
                  <span>Query 1.sql</span>
                  <span class="text-[9px] font-mono px-1 rounded bg-black/25 text-white/90">master</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Tab 2: Query & Results Settings -->
        <div v-else-if="activeTab === 'results'" class="space-y-5">
          <!-- Max Result Tabs -->
          <div class="flex items-center justify-between">
            <div class="pr-4">
              <label class="font-medium text-dark-100 block">Results 歷史分頁保留上限 (History Limit)</label>
              <span class="text-xxs text-dark-400">
                每次查詢新增一組結果，保留最近 N 組。超過時自動移除最舊的未釘選分頁。
              </span>
            </div>
            <div class="flex items-center space-x-2 flex-shrink-0">
              <select
                v-model.number="settingsStore.maxResultTabs"
                class="bg-dark-900 border border-dark-700 rounded px-2.5 py-1 text-xs text-dark-100 font-mono focus:border-brand-500 focus:outline-none cursor-pointer"
              >
                <option :value="5">5 組</option>
                <option :value="10">10 組 (預設)</option>
                <option :value="15">15 組</option>
                <option :value="20">20 組</option>
                <option :value="30">30 組</option>
                <option :value="50">50 組</option>
              </select>
            </div>
          </div>

          <!-- Default Max Rows -->
          <div class="flex items-center justify-between pt-2 border-t border-dark-800">
            <div class="pr-4">
              <label class="font-medium text-dark-100 block">預設最大查詢筆數 (Default Limit)</label>
              <span class="text-xxs text-dark-400">新建查詢分頁時的預設資料截斷防護上限</span>
            </div>
            <select
              v-model="settingsStore.defaultMaxRows"
              class="bg-dark-900 border border-dark-700 rounded px-2.5 py-1 text-xs text-dark-100 font-mono focus:border-brand-500 focus:outline-none cursor-pointer flex-shrink-0"
            >
              <option :value="1000">1,000 筆</option>
              <option :value="5000">5,000 筆</option>
              <option :value="10000">10,000 筆 (預設)</option>
              <option :value="50000">50,000 筆</option>
              <option :value="null">無限制 (No Limit)</option>
            </select>
          </div>

          <!-- Active Result Tab Color -->
          <div class="pt-3 border-t border-dark-800 space-y-3">
            <div>
              <label class="font-medium text-dark-100 block">當前查詢結果分頁顏色 (Active Result Tab Colors)</label>
              <span class="text-xxs text-dark-400">自訂下方查詢結果分頁在選取啟用時的前景文字與背景顏色</span>
            </div>

            <!-- Color controls: Background & Foreground -->
            <div class="grid grid-cols-2 gap-3 bg-dark-900 p-2.5 rounded border border-dark-800">
              <!-- Background Color -->
              <div class="space-y-1.5">
                <span class="text-xxs text-dark-300 block font-medium">背景顏色 (Background)</span>
                <div class="flex items-center space-x-2">
                  <input
                    type="color"
                    v-model="settingsStore.activeResultTabBgColor"
                    class="w-7 h-7 rounded border border-dark-700 bg-dark-900 cursor-pointer p-0.5"
                    title="選擇背景顏色"
                  />
                  <input
                    type="text"
                    v-model="settingsStore.activeResultTabBgColor"
                    class="w-20 bg-dark-850 border border-dark-700 rounded px-2 py-1 text-xs text-dark-100 font-mono focus:border-brand-500 focus:outline-none text-center uppercase"
                  />
                </div>
              </div>

              <!-- Text Color -->
              <div class="space-y-1.5">
                <span class="text-xxs text-dark-300 block font-medium">前景文字顏色 (Text Color)</span>
                <div class="flex items-center space-x-2">
                  <input
                    type="color"
                    v-model="settingsStore.activeResultTabTextColor"
                    class="w-7 h-7 rounded border border-dark-700 bg-dark-900 cursor-pointer p-0.5"
                    title="選擇文字顏色"
                  />
                  <input
                    type="text"
                    v-model="settingsStore.activeResultTabTextColor"
                    class="w-20 bg-dark-850 border border-dark-700 rounded px-2 py-1 text-xs text-dark-100 font-mono focus:border-brand-500 focus:outline-none text-center uppercase"
                  />
                </div>
              </div>
            </div>

            <!-- Presets & Live Preview -->
            <div class="flex items-center justify-between pt-1">
              <!-- Presets -->
              <div class="flex items-center space-x-1.5">
                <span class="text-xxs text-dark-400">快速預設:</span>
                <button
                  v-for="preset in [
                    { name: 'Forest Emerald', bg: '#065f46', text: '#ffffff' },
                    { name: 'Deep Teal', bg: '#0f766e', text: '#ffffff' },
                    { name: 'Royal Blue', bg: '#1e40af', text: '#ffffff' },
                    { name: 'Indigo Purple', bg: '#4338ca', text: '#ffffff' },
                    { name: 'Warm Amber', bg: '#92400e', text: '#ffffff' },
                    { name: 'Rose', bg: '#9f1239', text: '#ffffff' },
                    { name: 'Dark Slate', bg: '#374151', text: '#ffffff' },
                  ]"
                  :key="preset.bg"
                  type="button"
                  @click="settingsStore.activeResultTabBgColor = preset.bg; settingsStore.activeResultTabTextColor = preset.text"
                  class="w-4 h-4 rounded-full border border-dark-600 hover:scale-110 transition-transform cursor-pointer"
                  :style="{ backgroundColor: preset.bg }"
                  :title="preset.name"
                />
              </div>

              <!-- Live Preview Badge -->
              <div class="flex items-center space-x-1.5 text-xxs">
                <span class="text-dark-400">預覽:</span>
                <div
                  class="h-5.5 px-2 flex items-center space-x-1.5 rounded text-xxs font-medium shadow-xs"
                  :style="{
                    backgroundColor: settingsStore.activeResultTabBgColor,
                    color: settingsStore.activeResultTabTextColor,
                  }"
                >
                  <Pin class="w-2.5 h-2.5 text-amber-300 fill-current" />
                  <span>1.Users 50r</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Tab 3: Table Filter -->
        <TableFilterTab v-else-if="activeTab === 'table_filter'" />

        <!-- Tab 4: About & Shortcuts -->
        <div v-else-if="activeTab === 'about'" class="space-y-4">
          <div class="bg-dark-900 border border-dark-750 p-3.5 rounded space-y-2">
            <div class="flex items-center space-x-2">
              <div class="w-5 h-5 rounded bg-brand-500/20 text-brand-400 flex items-center justify-center font-mono text-xs font-black">
                SQL
              </div>
              <span class="font-semibold text-dark-100 text-sm">SQLight</span>
              <span class="text-xxs text-brand-400 bg-brand-500/10 px-1.5 py-0.5 rounded font-mono">v0.1.0</span>
            </div>
            <p class="text-xxs text-dark-400 leading-relaxed">
              極致輕量、現代高效的 Microsoft SQL Server 桌面客戶端。<br />
              架構基於 Tauri v2 + Rust + Vue 3 + TypeScript + Monaco Editor + AG Grid Community。
            </p>
          </div>

          <!-- Keyboard Shortcuts -->
          <div>
            <div class="font-semibold text-dark-200 mb-2">常用快捷鍵 (Keyboard Shortcuts)</div>
            <div class="grid grid-cols-2 gap-2 text-xxs font-mono">
              <div class="bg-dark-900 p-2 rounded border border-dark-800 flex justify-between items-center">
                <span class="text-dark-300">執行當前游標 SQL (或選取)</span>
                <kbd class="bg-dark-800 px-1.5 py-0.5 rounded text-emerald-400 border border-dark-700">Ctrl + Enter</kbd>
              </div>
              <div class="bg-dark-900 p-2 rounded border border-dark-800 flex justify-between items-center">
                <span class="text-dark-300">執行全部頁面 SQL</span>
                <kbd class="bg-dark-800 px-1.5 py-0.5 rounded text-emerald-400 border border-dark-700">Ctrl+Shift+Enter</kbd>
              </div>
              <div class="bg-dark-900 p-2 rounded border border-dark-800 flex justify-between items-center">
                <span class="text-dark-300">向下快速複製 (行/選取塊)</span>
                <kbd class="bg-dark-800 px-1.5 py-0.5 rounded text-dark-200 border border-dark-700">Ctrl + D</kbd>
              </div>
              <div class="bg-dark-900 p-2 rounded border border-dark-800 flex justify-between items-center">
                <span class="text-dark-300">格式化 SQL (選取/當前語句)</span>
                <kbd class="bg-dark-800 px-1.5 py-0.5 rounded text-dark-200 border border-dark-700">Shift+Alt+F</kbd>
              </div>
              <div class="bg-dark-900 p-2 rounded border border-dark-800 flex justify-between items-center">
                <span class="text-dark-300">程式碼智慧自動補全</span>
                <kbd class="bg-dark-800 px-1.5 py-0.5 rounded text-dark-200 border border-dark-700">Ctrl + Space</kbd>
              </div>
            </div>
          </div>

          <!-- Code Snippets / Templates -->
          <div>
            <div class="font-semibold text-dark-200 mb-1.5 flex items-center justify-between">
              <span>快速代碼範本 (SQL Code Snippets)</span>
              <span class="text-xxs text-dark-400 font-normal">輸入前綴後按 <kbd class="bg-dark-800 px-1 py-0.2 rounded border border-dark-700 font-mono text-dark-300">Tab</kbd> 或 <kbd class="bg-dark-800 px-1 py-0.2 rounded border border-dark-700 font-mono text-dark-300">Enter</kbd> 展開</span>
            </div>
            <div class="grid grid-cols-2 gap-2 text-xxs font-mono">
              <div class="bg-dark-900 p-2 rounded border border-dark-800 flex items-center justify-between">
                <div class="flex items-center space-x-1.5">
                  <span class="text-brand-400 font-bold bg-brand-500/10 px-1.5 py-0.5 rounded border border-brand-500/20">sel</span>
                  <span class="text-dark-300">SELECT 基礎查詢</span>
                </div>
                <span class="text-dark-500 text-xxs truncate max-w-[120px]">SELECT * FROM...</span>
              </div>
              <div class="bg-dark-900 p-2 rounded border border-dark-800 flex items-center justify-between">
                <div class="flex items-center space-x-1.5">
                  <span class="text-brand-400 font-bold bg-brand-500/10 px-1.5 py-0.5 rounded border border-brand-500/20">seltop</span>
                  <span class="text-dark-300">TOP N 查詢</span>
                </div>
                <span class="text-dark-500 text-xxs truncate max-w-[120px]">SELECT TOP 100...</span>
              </div>
              <div class="bg-dark-900 p-2 rounded border border-dark-800 flex items-center justify-between">
                <div class="flex items-center space-x-1.5">
                  <span class="text-brand-400 font-bold bg-brand-500/10 px-1.5 py-0.5 rounded border border-brand-500/20">ins</span>
                  <span class="text-dark-300">INSERT 新增資料</span>
                </div>
                <span class="text-dark-500 text-xxs truncate max-w-[120px]">INSERT INTO...</span>
              </div>
              <div class="bg-dark-900 p-2 rounded border border-dark-800 flex items-center justify-between">
                <div class="flex items-center space-x-1.5">
                  <span class="text-brand-400 font-bold bg-brand-500/10 px-1.5 py-0.5 rounded border border-brand-500/20">upd</span>
                  <span class="text-dark-300">UPDATE 更新資料</span>
                </div>
                <span class="text-dark-500 text-xxs truncate max-w-[120px]">UPDATE SET...</span>
              </div>
              <div class="bg-dark-900 p-2 rounded border border-dark-800 flex items-center justify-between">
                <div class="flex items-center space-x-1.5">
                  <span class="text-brand-400 font-bold bg-brand-500/10 px-1.5 py-0.5 rounded border border-brand-500/20">del</span>
                  <span class="text-dark-300">DELETE 刪除資料</span>
                </div>
                <span class="text-dark-500 text-xxs truncate max-w-[120px]">DELETE FROM...</span>
              </div>
              <div class="bg-dark-900 p-2 rounded border border-dark-800 flex items-center justify-between">
                <div class="flex items-center space-x-1.5">
                  <span class="text-brand-400 font-bold bg-brand-500/10 px-1.5 py-0.5 rounded border border-brand-500/20">join</span>
                  <span class="text-dark-300">INNER JOIN 關聯</span>
                </div>
                <span class="text-dark-500 text-xxs truncate max-w-[120px]">JOIN ON...</span>
              </div>
              <div class="bg-dark-900 p-2 rounded border border-dark-800 flex items-center justify-between">
                <div class="flex items-center space-x-1.5">
                  <span class="text-brand-400 font-bold bg-brand-500/10 px-1.5 py-0.5 rounded border border-brand-500/20">leftjoin</span>
                  <span class="text-dark-300">LEFT JOIN 關聯</span>
                </div>
                <span class="text-dark-500 text-xxs truncate max-w-[120px]">LEFT JOIN ON...</span>
              </div>
              <div class="bg-dark-900 p-2 rounded border border-dark-800 flex items-center justify-between">
                <div class="flex items-center space-x-1.5">
                  <span class="text-brand-400 font-bold bg-brand-500/10 px-1.5 py-0.5 rounded border border-brand-500/20">cte</span>
                  <span class="text-dark-300">WITH CTE 運算式</span>
                </div>
                <span class="text-dark-500 text-xxs truncate max-w-[120px]">WITH CTE AS...</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Modal Footer -->
      <div class="px-5 py-3 border-t border-dark-750 bg-dark-800/80 flex items-center justify-between flex-shrink-0">
        <button
          type="button"
          @click="handleReset"
          class="px-2.5 py-1 text-dark-400 hover:text-rose-400 text-xxs transition-colors"
        >
          重設為預設值 (Reset Defaults)
        </button>
        <button
          type="button"
          @click="$emit('close')"
          class="px-4 py-1.5 rounded bg-brand-600 hover:bg-brand-500 active:bg-brand-700 text-white text-xs font-medium transition-colors cursor-pointer"
        >
          完成 (Done)
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { Settings, X, Code2, TableProperties, Info, FileCode, Pin, EyeOff } from 'lucide-vue-next';
import { useSettingsStore } from '@/stores/settingsStore';
import TableFilterTab from './TableFilterTab.vue';

defineProps<{
  isOpen: boolean;
}>();

defineEmits<{
  (e: 'close'): void;
}>();

const settingsStore = useSettingsStore();
const activeTab = ref<'editor' | 'results' | 'table_filter' | 'about'>('editor');

const tabs = [
  { id: 'editor' as const, label: '編輯器 (Editor)', icon: Code2 },
  { id: 'results' as const, label: '查詢與結果 (Results)', icon: TableProperties },
  { id: 'table_filter' as const, label: '名稱過濾 (Object Filter)', icon: EyeOff },
  { id: 'about' as const, label: '關於 (About)', icon: Info },
];

function handleReset() {
  if (confirm('確定要將所有設定重設回預設值嗎？')) {
    settingsStore.resetToDefaults();
  }
}
</script>
