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
        <i class="pi pi-cog text-brand-400 text-base" />
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
      <!-- Tab 1: Editor Settings -->
      <div v-if="activeTab === 'editor'" class="space-y-5">
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
          <Select
            v-model="settingsStore.editorFontFamily"
            :options="fontFamilyOptions"
            option-label="label"
            option-value="value"
            class="w-full !text-xs !bg-dark-900 !border-dark-700 font-mono"
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
                <i class="pi pi-file-code text-white text-xs" />
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
                <InputText
                  v-model="settingsStore.activeResultTabBgColor"
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
                  v-model="settingsStore.activeResultTabTextColor"
                  class="w-7 h-7 rounded border border-dark-700 bg-dark-900 cursor-pointer p-0.5"
                  title="選擇文字顏色"
                />
                <InputText
                  v-model="settingsStore.activeResultTabTextColor"
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
                <i class="pi pi-bookmark-fill text-amber-300 text-xxs" />
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
            <Tag severity="info" value="v0.1.0" class="!text-xxs !font-mono !px-1.5 !py-0.5" />
          </div>
          <p class="text-xxs text-dark-400 leading-relaxed">
            極致輕量、現代高效的 Microsoft SQL Server 桌面客戶端。<br />
            架構基於 Tauri v2 + Rust + Vue 3 + TypeScript + PrimeVue v4 + Monaco Editor + AG Grid Community。
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
import { ref } from 'vue';
import Dialog from 'primevue/dialog';
import Button from 'primevue/button';
import Select from 'primevue/select';
import InputText from 'primevue/inputtext';
import Tag from 'primevue/tag';
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
  { id: 'editor' as const, label: '編輯器 (Editor)', icon: 'pi pi-code' },
  { id: 'results' as const, label: '查詢與結果 (Results)', icon: 'pi pi-table' },
  { id: 'table_filter' as const, label: '名稱過濾 (Object Filter)', icon: 'pi pi-filter' },
  { id: 'about' as const, label: '關於 (About)', icon: 'pi pi-info-circle' },
];

const fontSizeOptions = [
  { label: '12 px', value: 12 },
  { label: '13 px', value: 13 },
  { label: '14 px', value: 14 },
  { label: '15 px', value: 15 },
  { label: '16 px', value: 16 },
  { label: '18 px', value: 18 },
  { label: '20 px', value: 20 },
];

const fontFamilyOptions = [
  { label: 'Fira Code (預設推薦，支援連字)', value: '"Fira Code", Consolas, Monaco, monospace' },
  { label: 'JetBrains Mono', value: '"JetBrains Mono", Consolas, Monaco, monospace' },
  { label: 'Cascadia Code', value: '"Cascadia Code", Consolas, monospace' },
  { label: 'Consolas', value: 'Consolas, Monaco, monospace' },
  { label: 'Monaco', value: 'Monaco, "Courier New", monospace' },
  { label: 'System Monospace', value: 'monospace' },
];

function handleReset() {
  if (confirm('確定要將所有設定重設回預設值嗎？')) {
    settingsStore.resetToDefaults();
  }
}
</script>
