<template>
  <div
    v-if="isOpen"
    class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 select-none font-sans"
    @click.self="$emit('close')"
  >
    <div
      class="bg-dark-850 border border-dark-700 rounded-lg shadow-2xl w-[620px] h-[520px] max-w-[95vw] max-h-[90vh] overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-150"
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
        </div>

        <!-- Tab 3: About & Shortcuts -->
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

          <div>
            <div class="font-semibold text-dark-200 mb-2">常用快捷鍵 (Keyboard Shortcuts)</div>
            <div class="grid grid-cols-2 gap-2 text-xxs font-mono">
              <div class="bg-dark-900 p-2 rounded border border-dark-800 flex justify-between items-center">
                <span class="text-dark-300">執行當前游標 SQL</span>
                <kbd class="bg-dark-800 px-1.5 py-0.5 rounded text-emerald-400 border border-dark-700">Ctrl + Enter</kbd>
              </div>
              <div class="bg-dark-900 p-2 rounded border border-dark-800 flex justify-between items-center">
                <span class="text-dark-300">執行全部頁面 SQL</span>
                <kbd class="bg-dark-800 px-1.5 py-0.5 rounded text-emerald-400 border border-dark-700">Ctrl+Shift+Enter</kbd>
              </div>
              <div class="bg-dark-900 p-2 rounded border border-dark-800 flex justify-between items-center">
                <span class="text-dark-300">格式化 SQL (Format)</span>
                <kbd class="bg-dark-800 px-1.5 py-0.5 rounded text-dark-200 border border-dark-700">Shift+Alt+F</kbd>
              </div>
              <div class="bg-dark-900 p-2 rounded border border-dark-800 flex justify-between items-center">
                <span class="text-dark-300">程式碼智慧補全</span>
                <kbd class="bg-dark-800 px-1.5 py-0.5 rounded text-dark-200 border border-dark-700">Ctrl + Space</kbd>
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
import { Settings, X, Code2, TableProperties, Info } from 'lucide-vue-next';
import { useSettingsStore } from '@/stores/settingsStore';

defineProps<{
  isOpen: boolean;
}>();

defineEmits<{
  (e: 'close'): void;
}>();

const settingsStore = useSettingsStore();
const activeTab = ref<'editor' | 'results' | 'about'>('editor');

const tabs = [
  { id: 'editor' as const, label: '編輯器 (Editor)', icon: Code2 },
  { id: 'results' as const, label: '查詢與結果 (Results)', icon: TableProperties },
  { id: 'about' as const, label: '關於 (About)', icon: Info },
];

function handleReset() {
  if (confirm('確定要將所有設定重設回預設值嗎？')) {
    settingsStore.resetToDefaults();
  }
}
</script>
