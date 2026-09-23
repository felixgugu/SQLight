<template>
  <Dialog
    :visible="isOpen"
    modal
    :dismissable-mask="true"
    :closable="true"
    class="w-[860px] h-[660px] max-w-[95vw] max-h-[92vh] font-sans"
    content-class="!p-0 flex flex-col overflow-hidden h-full"
    @update:visible="val => !val && $emit('close')"
  >
    <template #header>
      <div class="flex items-center space-x-2">
        <i class="pi pi-cog text-accent text-base" />
        <span class="text-sm font-semibold text-dark-100">設定 (Settings)</span>
      </div>
    </template>

    <!-- Navigation Tabs -->
    <div class="flex border-b border-dark-750 bg-dark-850 px-5 pt-2 space-x-2 flex-shrink-0 text-xs">
      <Button
        v-for="tab in tabs"
        :key="tab.id"
        :label="tab.label"
        :icon="tab.icon"
        size="small"
        :severity="activeTab === tab.id ? 'primary' : 'secondary'"
        :text="activeTab !== tab.id"
        class="!text-xs !py-1 !px-2.5"
        @click="activeTab = tab.id"
      />
    </div>

    <!-- Modal Body -->
    <div class="p-6 overflow-y-auto flex-1 space-y-6 text-xs text-dark-200">
      <!-- Tab 0: Appearance & Theme Settings -->
      <div v-if="activeTab === 'theme'" class="space-y-6">
        <!-- Global UI Font -->
        <div class="space-y-2.5 pb-4 border-b border-dark-800">
          <div class="flex items-center justify-between gap-4">
            <div>
              <label class="font-medium text-dark-100 block">全域介面字型 (Global UI Font)</label>
              <span class="text-xxs text-dark-400">套用至按鈕、選單、對話框與一般介面文字；SQL 編輯器與既有等寬資料區不受影響。</span>
            </div>
            <FontFamilyPicker
              :model-value="settingsStore.globalFontFamily"
              :options="globalFontSelectOptions"
              :default-value="DEFAULT_GLOBAL_FONT_FAMILY"
              select-class="min-w-[240px] !text-xs !bg-dark-900 !border-dark-700"
              @update:model-value="handleGlobalFontChange"
            />
          </div>
          <div
            class="rounded-md border border-dark-750 bg-dark-900/70 px-3 py-2.5 text-sm text-dark-100"
            :style="{ fontFamily: settingsStore.globalFontFamily }"
          >
            SQLight 資料庫工具 · 查詢結果 · ABC 123
          </div>
          <span v-if="selectedGlobalFont" class="text-xxs text-dark-500 block">
            {{ selectedGlobalFont.description }}
          </span>
        </div>

        <!-- 1. Color Mode (Dark / Light) -->
        <div class="flex items-center justify-between pb-4 border-b border-dark-800">
          <div>
            <label class="font-medium text-dark-100 block">深淺色彩模式 (Color Mode)</label>
            <span class="text-xxs text-dark-400">切換深色系 (Dark) 或淺色系 (Light) 介面外觀</span>
          </div>
          <SelectButton
            :model-value="settingsStore.colorMode"
            :options="[
              { label: '深色 (Dark)', value: 'dark', icon: 'pi pi-moon' },
              { label: '淺色 (Light)', value: 'light', icon: 'pi pi-sun' },
            ]"
            option-label="label"
            option-value="value"
            class="!text-xs"
            @update:model-value="val => val && settingsStore.setColorMode(val as 'dark' | 'light')"
          >
            <template #option="slotProps">
              <div class="flex items-center space-x-1.5 py-0.5 px-1">
                <i :class="slotProps.option.icon" class="text-xs" />
                <span>{{ slotProps.option.label }}</span>
              </div>
            </template>
          </SelectButton>
        </div>

        <!-- 2. Theme Preset (Aura, Lara, Nora, Material) -->
        <div class="space-y-2 pb-4 border-b border-dark-800">
          <div class="flex items-center justify-between">
            <div>
              <label class="font-medium text-dark-100 block">PrimeVue 佈景風格 (Theme Preset)</label>
              <span class="text-xxs text-dark-400">切換 PrimeVue 官方預設主題架構風格</span>
            </div>
            <span class="text-xxs font-mono text-accent font-semibold">{{ settingsStore.themePreset }}</span>
          </div>
          <div class="grid grid-cols-4 gap-2.5">
            <button
              v-for="preset in themePresets"
              :key="preset.id"
              type="button"
              class="flex flex-col items-start p-2.5 rounded border text-left transition-all cursor-pointer"
              :class="settingsStore.themePreset === preset.id
                ? 'border-brand-500 bg-brand-500/10 text-dark-100 ring-1 ring-brand-500'
                : 'border-dark-750 bg-dark-900/60 hover:border-dark-600 text-dark-300 hover:text-dark-200'"
              @click="settingsStore.setThemePreset(preset.id)"
            >
              <div class="flex items-center justify-between w-full mb-1">
                <span class="font-semibold text-xs text-dark-100">{{ preset.label }}</span>
                <i v-if="settingsStore.themePreset === preset.id" class="pi pi-check-circle text-accent text-xs" />
              </div>
              <span class="text-[11px] text-dark-400 leading-snug">{{ preset.desc }}</span>
            </button>
          </div>
        </div>

        <!-- 3. Primary Color Palette -->
        <div class="space-y-2.5 pb-4 border-b border-dark-800">
          <div class="flex items-center justify-between">
            <div>
              <label class="font-medium text-dark-100 block">主要色彩基調 (Primary Palette)</label>
              <span class="text-xxs text-dark-400">按鈕、焦點邊框、啟用指示等核心元件之主色調</span>
            </div>
            <span class="text-xxs font-mono text-dark-300">{{ currentPrimaryLabel }}</span>
          </div>

          <div class="grid grid-cols-4 sm:grid-cols-6 gap-2">
            <button
              v-for="color in PRIMARY_COLOR_OPTIONS"
              :key="color.name"
              type="button"
              class="flex items-center space-x-2 p-1.5 rounded border transition-all cursor-pointer text-left"
              :class="settingsStore.primaryColor === color.name
                ? 'border-brand-500 bg-brand-500/15 ring-1 ring-brand-500 text-dark-100'
                : 'border-dark-750 bg-dark-900/50 hover:border-dark-600 text-dark-300 hover:text-dark-200'"
              @click="settingsStore.setPrimaryColor(color.name)"
            >
              <div
                class="w-4.5 h-4.5 rounded-full flex-shrink-0 flex items-center justify-center text-white text-[9px] shadow-xs"
                :style="{ backgroundColor: color.color }"
              >
                <i
                  v-if="settingsStore.primaryColor === color.name"
                  class="pi pi-check"
                  :style="{ color: pickReadableTextColor(color.color) }"
                />
              </div>
              <span class="text-xxs truncate">{{ color.label.split(' ')[0] }}</span>
            </button>
          </div>
        </div>

        <!-- 4. Surface Palette -->
        <div class="space-y-2.5 pb-4 border-b border-dark-800">
          <div class="flex items-center justify-between">
            <div>
              <label class="font-medium text-dark-100 block">表面底色傾向 (Surface Palette)</label>
              <span class="text-xxs text-dark-400">背景、卡片與對話框表面冷暖色調</span>
            </div>
            <span class="text-xxs font-mono text-dark-300">{{ currentSurfaceLabel }}</span>
          </div>

          <div class="grid grid-cols-5 gap-2">
            <button
              v-for="surface in SURFACE_OPTIONS"
              :key="surface.name"
              type="button"
              class="flex flex-col p-2 rounded border transition-all cursor-pointer text-left space-y-1.5"
              :class="settingsStore.surfaceColor === surface.name
                ? 'border-brand-500 bg-brand-500/15 ring-1 ring-brand-500 text-dark-100'
                : 'border-dark-750 bg-dark-900/50 hover:border-dark-600 text-dark-300 hover:text-dark-200'"
              @click="settingsStore.setSurfaceColor(surface.name)"
            >
              <div class="flex items-center justify-between w-full">
                <span class="text-xxs font-semibold truncate">{{ surface.label.split(' ')[0] }}</span>
                <i v-if="settingsStore.surfaceColor === surface.name" class="pi pi-check-circle text-accent text-xxs" />
              </div>
              <div class="flex items-center space-x-1">
                <div
                  class="w-3.5 h-3.5 rounded border border-dark-600"
                  :style="{ backgroundColor: surface.sampleDark }"
                  title="Dark Surface"
                />
                <div
                  class="w-3.5 h-3.5 rounded border border-dark-300"
                  :style="{ backgroundColor: surface.sampleLight }"
                  title="Light Surface"
                />
                <span class="text-[10px] text-dark-400 truncate">{{ surface.name }}</span>
              </div>
            </button>
          </div>
        </div>

        <!-- 5. Ripple Effect -->
        <div class="flex items-center justify-between pb-4 border-b border-dark-800">
          <div>
            <label class="font-medium text-dark-100 block">水波紋點擊特效 (Ripple Effect)</label>
            <span class="text-xxs text-dark-400">啟用按鈕與可點選元件點擊時擴散的水波紋動畫</span>
          </div>
          <ToggleSwitch
            :model-value="settingsStore.ripple"
            @update:model-value="val => handleRippleToggle(val)"
          />
        </div>

        <!-- 6. Live Component Preview -->
        <div class="space-y-2 p-3.5 rounded-lg border border-dark-750 bg-dark-900/80">
          <div class="flex items-center justify-between">
            <span class="text-xs font-semibold text-dark-200 flex items-center space-x-1.5">
              <i class="pi pi-eye text-accent" />
              <span>主題即時預覽 (Theme Live Preview)</span>
            </span>
            <span class="text-xxs text-dark-400">當前風格即時反映</span>
          </div>
          <div class="flex flex-wrap items-center gap-2.5 pt-1">
            <Button label="主要按鈕" icon="pi pi-check" size="small" />
            <Button label="次要外框" severity="secondary" outlined size="small" />
            <Button label="文字按鈕" text size="small" />
            <Tag value="Tag 標籤" />
            <Badge value="99+" />
            <InputText placeholder="輸入框預覽..." size="small" class="w-32 !h-7 !text-xs" />
            <div class="flex items-center space-x-1.5 pl-2">
              <Checkbox :binary="true" :model-value="true" />
              <span class="text-xxs text-dark-300">核取方塊</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Tab 1: Editor Settings -->
      <div v-else-if="activeTab === 'editor'" class="space-y-5">
        <!-- Font Size -->
        <div class="flex items-center justify-between">
          <div>
            <label class="font-medium text-dark-100 block">編輯器字型大小 (Font Size)</label>
            <span class="text-xxs text-dark-400">控制 SQL 編輯器代碼文字尺寸</span>
          </div>
          <Select
            v-model="settingsStore.editorFontSize"
            :options="fontSizeOptions"
            option-label="label"
            option-value="value"
            class="!h-7 !text-xs !bg-dark-900 !border-dark-700 min-w-[90px]"
          />
        </div>

        <!-- Font Family -->
        <div class="space-y-1.5">
          <div class="flex items-center justify-between">
            <label class="font-medium text-dark-100">字型家族 (Font Family)</label>
            <span class="text-xxs text-dark-400 font-mono">等寬字型 (Monospace)</span>
          </div>
          <FontFamilyPicker
            v-model="settingsStore.editorFontFamily"
            :options="EDITOR_FONT_FAMILY_OPTIONS"
            :default-value="DEFAULT_EDITOR_FONT_FAMILY"
            preview
          />
        </div>

        <!-- Word Wrap -->
        <div class="flex items-center justify-between pt-2 border-t border-dark-800">
          <div>
            <label class="font-medium text-dark-100 block">自動換行 (Word Wrap)</label>
            <span class="text-xxs text-dark-400">長 SQL 語句超出可視範圍時自動折行</span>
          </div>
          <Select
            v-model="settingsStore.editorWordWrap"
            :options="[
              { label: '開啟 (On)', value: 'on' },
              { label: '關閉 (Off)', value: 'off' },
            ]"
            option-label="label"
            option-value="value"
            class="!h-7 !text-xs !bg-dark-900 !border-dark-700 min-w-[110px]"
          />
        </div>

        <!-- Tab Size -->
        <div class="flex items-center justify-between pt-2 border-t border-dark-800">
          <div>
            <label class="font-medium text-dark-100 block">Tab 縮排格數 (Tab Size)</label>
            <span class="text-xxs text-dark-400">按下 Tab 鍵時縮排的空格數</span>
          </div>
          <Select
            v-model="settingsStore.editorTabSize"
            :options="[
              { label: '2 空格', value: 2 },
              { label: '4 空格', value: 4 },
            ]"
            option-label="label"
            option-value="value"
            class="!h-7 !text-xs !bg-dark-900 !border-dark-700 min-w-[90px]"
          />
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
            <InputText
              v-model="settingsStore.editorHighlightColor"
              class="w-20 !h-7 !bg-dark-900 !border-dark-700 !text-xs !font-mono text-center uppercase"
              placeholder="#feffe0"
            />
          </div>
        </div>

        <!-- Active SQL Tab Color -->
        <div class="pt-3 border-t border-dark-800 space-y-3">
          <div>
            <label class="font-medium text-dark-100 block">當前 SQL 查詢分頁顏色 (Active SQL Tab Colors)</label>
            <span class="text-xxs text-dark-400">自訂上方 SQL 查詢分頁在選取啟用時的前景文字與背景顏色</span>
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
                <InputText
                  v-model="settingsStore.activeSqlTabBgColor"
                  class="w-20 !h-7 !bg-dark-850 !border-dark-700 !text-xs !font-mono text-center uppercase"
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
                <InputText
                  v-model="settingsStore.activeSqlTabTextColor"
                  class="w-20 !h-7 !bg-dark-850 !border-dark-700 !text-xs !font-mono text-center uppercase"
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
                <i class="pi pi-file-code text-xs" :style="{ color: settingsStore.activeSqlTabTextColor }" />
                <span>Query 1.sql</span>
                <span
                  class="text-[9px] font-mono px-1 rounded bg-black/20"
                  :style="{ color: settingsStore.activeSqlTabTextColor }"
                  >master</span
                >
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Tab 2: Query & Results Settings -->
      <div v-else-if="activeTab === 'results'" class="space-y-5">
        <!-- Result grid font -->
        <div class="flex items-center justify-between pb-4 border-b border-dark-800">
          <div class="pr-4">
            <label class="font-medium text-dark-100 block">結果表格字型 (Grid Font)</label>
            <span class="text-xxs text-dark-400">
              套用至查詢結果、檢視資料與資料表結構中的所有欄位、列號與表頭。
            </span>
          </div>
          <FontFamilyPicker
            v-model="settingsStore.gridFontFamily"
            :options="GRID_FONT_FAMILY_OPTIONS"
            :default-value="DEFAULT_GRID_FONT_FAMILY"
            select-class="min-w-[240px] !text-xs !bg-dark-900 !border-dark-700 font-mono"
            preview
          />
        </div>

        <!-- Max Result Tabs -->
        <div class="flex items-center justify-between">
          <div class="pr-4">
            <label class="font-medium text-dark-100 block">Results 歷史分頁保留上限 (History Limit)</label>
            <span class="text-xxs text-dark-400">
              每次查詢新增一組結果，保留最近 N 組。超過時自動移除最舊的未釘選分頁。
            </span>
          </div>
          <Select
            v-model="settingsStore.maxResultTabs"
            :options="[
              { label: '5 組', value: 5 },
              { label: '10 組 (預設)', value: 10 },
              { label: '15 組', value: 15 },
              { label: '20 組', value: 20 },
              { label: '30 組', value: 30 },
              { label: '50 組', value: 50 },
            ]"
            option-label="label"
            option-value="value"
            class="!h-7 !text-xs !bg-dark-900 !border-dark-700 min-w-[120px]"
          />
        </div>

        <!-- Default Max Rows -->
        <div class="flex items-center justify-between pt-2 border-t border-dark-800">
          <div class="pr-4">
            <label class="font-medium text-dark-100 block">預設最大查詢筆數 (Default Limit)</label>
            <span class="text-xxs text-dark-400">新建查詢分頁時的預設資料截斷防護上限</span>
          </div>
          <Select
            v-model="settingsStore.defaultMaxRows"
            :options="[
              { label: '1,000 筆', value: 1000 },
              { label: '5,000 筆', value: 5000 },
              { label: '10,000 筆 (預設)', value: 10000 },
              { label: '50,000 筆', value: 50000 },
              { label: '無限制 (No Limit)', value: null },
            ]"
            option-label="label"
            option-value="value"
            class="!h-7 !text-xs !bg-dark-900 !border-dark-700 min-w-[140px]"
          />
        </div>


      </div>

      <!-- Tab 3: Table Filter -->
      <TableFilterTab v-else-if="activeTab === 'table_filter'" />

      <!-- Tab 4: AI Settings -->
      <AiSettingsTab v-else-if="activeTab === 'ai'" />

      <!-- Tab 5: About & Shortcuts -->
      <div v-else-if="activeTab === 'about'" class="space-y-4">
        <div class="bg-dark-900 border border-dark-750 p-3.5 rounded space-y-2">
          <div class="flex items-center space-x-2">
            <div class="w-5 h-5 rounded bg-brand-500/20 text-accent flex items-center justify-center font-mono text-xs font-black">
              SQL
            </div>
            <span class="font-semibold text-dark-100 text-sm">SQLight</span>
            <Tag severity="info" value="v0.1.0" class="!text-xxs !font-mono !px-1.5 !py-0.5" />
          </div>
          <p class="text-xxs text-dark-400 leading-relaxed">
            極致輕量、現代高效的 Microsoft SQL Server 桌面客戶端。<br />
            架構基於 Tauri v2 + Rust + Vue 3 + TypeScript + PrimeVue v4 + Monaco Editor + Tabulator。
          </p>
        </div>

        <!-- Keyboard Shortcuts -->
        <div class="space-y-3">
          <div class="flex items-center justify-between">
            <span class="font-semibold text-dark-100 text-xs">常用快捷鍵 (Keyboard Shortcuts)</span>
            <span class="text-xxs text-dark-500 font-mono">支援 macOS (Cmd ⌘) 與 Windows/Linux (Ctrl)</span>
          </div>

          <div class="grid grid-cols-2 gap-2.5 text-xxs font-mono">
            <!-- Group 1: 查詢執行與中斷 -->
            <div class="bg-dark-900 p-2.5 rounded border border-dark-800 space-y-2">
              <div class="text-[11px] font-semibold text-ok flex items-center space-x-1.5 pb-1 border-b border-dark-800">
                <i class="pi pi-play text-xs"></i>
                <span>查詢執行與中斷</span>
              </div>
              <div class="flex justify-between items-center py-0.5">
                <span class="text-dark-300">執行當前語句 (或選取)</span>
                <kbd class="bg-dark-800 px-1.5 py-0.5 rounded text-ok border border-dark-700">Ctrl + Enter</kbd>
              </div>
              <div class="flex justify-between items-center py-0.5">
                <span class="text-dark-300">執行整頁所有 SQL</span>
                <kbd class="bg-dark-800 px-1.5 py-0.5 rounded text-ok border border-dark-700">Ctrl+Shift+Enter</kbd>
              </div>
              <div class="flex justify-between items-center py-0.5">
                <span class="text-dark-300">中斷並取消執行中查詢</span>
                <kbd class="bg-dark-800 px-1.5 py-0.5 rounded text-danger border border-dark-700">Esc / Alt+Pause</kbd>
              </div>
            </div>

            <!-- Group 2: 分頁與檔案操作 -->
            <div class="bg-dark-900 p-2.5 rounded border border-dark-800 space-y-2">
              <div class="text-[11px] font-semibold text-info flex items-center space-x-1.5 pb-1 border-b border-dark-800">
                <i class="pi pi-folder text-xs"></i>
                <span>分頁與檔案操作</span>
              </div>
              <div class="flex justify-between items-center py-0.5">
                <span class="text-dark-300">新增 SQL 查詢分頁</span>
                <kbd class="bg-dark-800 px-1.5 py-0.5 rounded text-info border border-dark-700">Ctrl + N</kbd>
              </div>
              <div class="flex justify-between items-center py-0.5">
                <span class="text-dark-300">另存 / 儲存 SQL 檔案</span>
                <kbd class="bg-dark-800 px-1.5 py-0.5 rounded text-info border border-dark-700">Ctrl + S</kbd>
              </div>
              <div class="flex justify-between items-center py-0.5">
                <span class="text-dark-300">開啟本機 SQL 檔案</span>
                <kbd class="bg-dark-800 px-1.5 py-0.5 rounded text-info border border-dark-700">Ctrl + O</kbd>
              </div>
            </div>

            <!-- Group 3: 編輯器輔助與格式化 -->
            <div class="bg-dark-900 p-2.5 rounded border border-dark-800 space-y-2">
              <div class="text-[11px] font-semibold text-warn flex items-center space-x-1.5 pb-1 border-b border-dark-800">
                <i class="pi pi-code text-xs"></i>
                <span>編輯器與格式化</span>
              </div>
              <div class="flex justify-between items-center py-0.5">
                <span class="text-dark-300">程式碼智慧自動補全</span>
                <kbd class="bg-dark-800 px-1.5 py-0.5 rounded text-warn border border-dark-700">Ctrl + Space</kbd>
              </div>
              <div class="flex justify-between items-center py-0.5">
                <span class="text-dark-300">格式化 SQL (選取/當前語句)</span>
                <kbd class="bg-dark-800 px-1.5 py-0.5 rounded text-warn border border-dark-700">Shift+Alt+F</kbd>
              </div>
              <div class="flex justify-between items-center py-0.5">
                <span class="text-dark-300">AI SQL 助手 (分析/最佳化)</span>
                <kbd class="bg-dark-800 px-1.5 py-0.5 rounded text-warn border border-dark-700">Ctrl + I</kbd>
              </div>
              <div class="flex justify-between items-center py-0.5">
                <span class="text-dark-300">向下快速複製 (行/選取塊)</span>
                <kbd class="bg-dark-800 px-1.5 py-0.5 rounded text-dark-200 border border-dark-700">Ctrl + D</kbd>
              </div>
              <div class="flex justify-between items-center py-0.5">
                <span class="text-dark-300">尋找 / 替換程式碼</span>
                <kbd class="bg-dark-800 px-1.5 py-0.5 rounded text-dark-200 border border-dark-700">Ctrl+F / Ctrl+H</kbd>
              </div>
            </div>

            <!-- Group 4: 檢索、結果與圖表 -->
            <div class="bg-dark-900 p-2.5 rounded border border-dark-800 space-y-2">
              <div class="text-[11px] font-semibold text-er flex items-center space-x-1.5 pb-1 border-b border-dark-800">
                <i class="pi pi-search text-xs"></i>
                <span>檢索、結果與圖表</span>
              </div>
              <div class="flex justify-between items-center py-0.5">
                <span class="text-dark-300">快速物件檢索器 (Spotlight)</span>
                <kbd class="bg-dark-800 px-1.5 py-0.5 rounded text-er border border-dark-700">Ctrl + P</kbd>
              </div>
              <div class="flex justify-between items-center py-0.5">
                <span class="text-dark-300">查詢結果 - 複製選取儲存格</span>
                <kbd class="bg-dark-800 px-1.5 py-0.5 rounded text-structure border border-dark-700">Ctrl + C</kbd>
              </div>
              <div class="flex justify-between items-center py-0.5">
                <span class="text-dark-300">查詢結果 - 全選所有資料列</span>
                <kbd class="bg-dark-800 px-1.5 py-0.5 rounded text-structure border border-dark-700">Ctrl + A</kbd>
              </div>
              <div class="flex justify-between items-center py-0.5">
                <span class="text-dark-300">ER 關聯圖 - 刪除所選元素</span>
                <kbd class="bg-dark-800 px-1.5 py-0.5 rounded text-dark-200 border border-dark-700">Del / Backspace</kbd>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Modal Footer -->
    <template #footer>
      <div class="px-5 py-2.5 border-t border-dark-750 bg-dark-800/80 flex items-center justify-between w-full">
        <Button
          type="button"
          label="重設為預設值 (Reset Defaults)"
          severity="danger"
          size="small"
          text
          class="!text-xxs"
          @click="handleReset"
        />
        <Button
          type="button"
          label="完成 (Done)"
          severity="primary"
          size="small"
          @click="$emit('close')"
        />
      </div>
    </template>
  </Dialog>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import Dialog from 'primevue/dialog';
import Button from 'primevue/button';
import Select from 'primevue/select';
import SelectButton from 'primevue/selectbutton';
import ToggleSwitch from 'primevue/toggleswitch';
import Badge from 'primevue/badge';
import Checkbox from 'primevue/checkbox';
import InputText from 'primevue/inputtext';
import Tag from 'primevue/tag';
import { usePrimeVue } from 'primevue/config';
import { useSettingsStore } from '@/stores/settingsStore';
import {
  GLOBAL_FONT_OPTIONS,
  DEFAULT_GLOBAL_FONT_FAMILY,
  PRIMARY_COLOR_OPTIONS,
  SURFACE_OPTIONS,
  type ThemePresetName,
} from '@/services/themeManager';
import {
  DEFAULT_EDITOR_FONT_FAMILY,
  DEFAULT_GRID_FONT_FAMILY,
  EDITOR_FONT_FAMILY_OPTIONS,
  GRID_FONT_FAMILY_OPTIONS,
} from '@/data/fontOptions';
import FontFamilyPicker from '@/components/common/FontFamilyPicker.vue';
import TableFilterTab from './TableFilterTab.vue';
import AiSettingsTab from './settings/AiSettingsTab.vue';
import { pickReadableTextColor } from '@/utils/connectionColor';

defineProps<{
  isOpen: boolean;
}>();

defineEmits<{
  (e: 'close'): void;
}>();

const primevue = usePrimeVue();
const settingsStore = useSettingsStore();
const activeTab = ref<'theme' | 'editor' | 'results' | 'table_filter' | 'ai' | 'about'>('theme');

const tabs = [
  { id: 'theme' as const, label: '外觀與主題 (Appearance & Theme)', icon: 'pi pi-palette' },
  { id: 'editor' as const, label: '編輯器 (Editor)', icon: 'pi pi-code' },
  { id: 'results' as const, label: '查詢與結果 (Results)', icon: 'pi pi-table' },
  { id: 'table_filter' as const, label: '名稱過濾 (Object Filter)', icon: 'pi pi-filter' },
  { id: 'ai' as const, label: 'AI 設定 (AI Assistant)', icon: 'pi pi-sparkles' },
  { id: 'about' as const, label: '關於 (About)', icon: 'pi pi-info-circle' },
];

const themePresets: { id: ThemePresetName; label: string; desc: string }[] = [
  { id: 'Aura', label: 'Aura (現代)', desc: '精緻圓角與柔和光澤，SQLight 預設推薦' },
  { id: 'Lara', label: 'Lara (經典)', desc: '經典俐落 Prime 風格，清晰穩健' },
  { id: 'Nora', label: 'Nora (極簡)', desc: '高對比扁平線條，簡約素雅' },
  { id: 'Material', label: 'Material (質樸)', desc: 'Google Material 3 規範，流暢現代' },
];

const currentPrimaryLabel = computed(() => {
  const match = PRIMARY_COLOR_OPTIONS.find((c) => c.name === settingsStore.primaryColor);
  return match ? match.label : settingsStore.primaryColor;
});

const currentSurfaceLabel = computed(() => {
  const match = SURFACE_OPTIONS.find((s) => s.name === settingsStore.surfaceColor);
  return match ? match.label : settingsStore.surfaceColor;
});

const globalFontSelectOptions = GLOBAL_FONT_OPTIONS.map(({ label, value }) => ({
  label,
  value,
}));

const selectedGlobalFont = computed(() =>
  GLOBAL_FONT_OPTIONS.find((option) => option.value === settingsStore.globalFontFamily)
);

function handleGlobalFontChange(fontFamily: unknown) {
  if (typeof fontFamily === 'string' && fontFamily.trim()) {
    settingsStore.setGlobalFontFamily(fontFamily);
  }
}

function handleRippleToggle(val: boolean) {
  settingsStore.setRipple(val, primevue.config);
}

const fontSizeOptions = [
  { label: '12 px', value: 12 },
  { label: '13 px', value: 13 },
  { label: '14 px', value: 14 },
  { label: '15 px', value: 15 },
  { label: '16 px', value: 16 },
  { label: '18 px', value: 18 },
  { label: '20 px', value: 20 },
];

function handleReset() {
  if (confirm('確定要將所有設定重設回預設值嗎？')) {
    settingsStore.resetToDefaults();
  }
}
</script>
