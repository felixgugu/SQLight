<template>
  <div
    v-if="isOpen"
    class="fixed inset-0 z-50 flex items-center justify-center bg-black/65 backdrop-blur-xs p-4 select-none font-sans"
    @click.self="$emit('cancel')"
    @keydown.esc="$emit('cancel')"
  >
    <div
      class="bg-dark-850 border rounded-lg shadow-2xl w-full max-w-lg overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-150"
      :class="step === 2 ? 'border-rose-600/70 shadow-rose-950/40' : 'border-amber-600/70 shadow-amber-950/30'"
    >
      <!-- Modal Header -->
      <div
        class="px-5 py-3 border-b flex items-center justify-between"
        :class="step === 2 ? 'bg-rose-950/40 border-rose-900/60' : 'bg-dark-800 border-dark-750'"
      >
        <div class="flex items-center space-x-2">
          <ShieldAlert v-if="step === 2" class="w-4 h-4 text-rose-400 animate-pulse" />
          <AlertTriangle v-else class="w-4 h-4 text-amber-400" />
          <h3 class="font-semibold text-sm text-dark-100">
            {{ step === 2 ? '高危險變更確認 (第二次確認 2/2 — 最終確認)' : '修改提示 — 偵測到變更指令 (第一次確認 1/2)' }}
          </h3>
        </div>
        <button
          type="button"
          @click="$emit('cancel')"
          class="text-dark-400 hover:text-dark-200 p-1 rounded hover:bg-dark-700 transition-colors"
          title="取消 (Esc)"
        >
          <X class="w-4 h-4" />
        </button>
      </div>

      <!-- Modal Body -->
      <div class="p-5 space-y-4 text-xs">
        <!-- Target Environment & Database Info -->
        <div class="flex items-center space-x-2 text-xxs font-mono bg-dark-900 p-2 rounded border border-dark-750">
          <div class="flex items-center space-x-1 text-dark-300">
            <span class="text-dark-500">連線:</span>
            <span class="font-semibold text-dark-100">{{ connectionName }}</span>
          </div>
          <span class="text-dark-600">/</span>
          <div class="flex items-center space-x-1 text-dark-300">
            <span class="text-dark-500">資料庫:</span>
            <span class="font-semibold text-dark-100">{{ databaseName }}</span>
          </div>
        </div>

        <!-- Step 1 Content -->
        <template v-if="step === 1">
          <!-- Detected Keywords List -->
          <div class="space-y-1.5">
            <div class="text-dark-300 flex items-center justify-between">
              <span>偵測到即將執行的修改/變更指令：</span>
              <span class="text-xxs text-dark-500 font-mono">{{ detectedKeywords.length }} 種關鍵字</span>
            </div>
            <div class="flex items-center flex-wrap gap-1.5">
              <span
                v-for="kw in detectedKeywords"
                :key="kw"
                class="px-2 py-0.5 rounded text-xs font-mono font-bold bg-amber-500/15 border border-amber-500/40 text-amber-300"
              >
                {{ kw }}
              </span>
            </div>
          </div>

          <!-- SQL Code Preview -->
          <div class="space-y-1">
            <div class="text-dark-400 text-xxs flex items-center space-x-1">
              <FileCode class="w-3 h-3 text-dark-400" />
              <span>即將執行的 SQL 片段預覽：</span>
            </div>
            <pre class="bg-dark-950 p-2.5 rounded border border-dark-800 font-mono text-xxs text-dark-200 overflow-auto max-h-32 whitespace-pre-wrap select-text leading-relaxed">{{ sql }}</pre>
          </div>

          <!-- Prompt description -->
          <p class="text-dark-300 leading-relaxed bg-amber-950/20 border border-amber-900/40 p-2.5 rounded text-xxs">
            連線「<strong>{{ connectionName }}</strong>」已開啟「修改提示」保護機制。<br />
            為避免改錯或刪除正式資料，系統要求必須<strong>連續確認 2 次</strong>才可執行。請確認是否要進行第二次確認？
          </p>
        </template>

        <!-- Step 2 Content -->
        <template v-else>
          <!-- Dangerous Alert Box -->
          <div class="bg-rose-950/40 border border-rose-600/60 p-3.5 rounded-lg space-y-2 text-rose-200 leading-relaxed">
            <div class="flex items-center space-x-2 text-rose-300 font-bold text-xs">
              <AlertOctagon class="w-4 h-4 text-rose-400 flex-shrink-0" />
              <span>注意：此操作將直接更動目標資料庫！</span>
            </div>
            <p class="text-xxs text-rose-200/90 leading-relaxed">
              即將對目標伺服器 <strong>{{ connectionName }}</strong> 的 <strong>{{ databaseName }}</strong> 資料庫執行包含
              <strong class="text-white">{{ detectedKeywords.join('、') }}</strong> 的變更操作。<br />
              資料修改或結構刪除後<strong>可能無法復原或復原成本極高</strong>。
            </p>
          </div>

          <div class="text-center py-1">
            <span class="text-xs font-semibold text-dark-100">
              請再次審慎確認：是否確定要立即執行此 SQL？
            </span>
          </div>
        </template>
      </div>

      <!-- Modal Footer -->
      <div class="px-5 py-3 bg-dark-850 border-t border-dark-750 flex items-center justify-between">
        <button
          type="button"
          @click="$emit('cancel')"
          class="px-3 py-1.5 bg-dark-800 hover:bg-dark-750 text-dark-300 hover:text-dark-100 rounded border border-dark-700 text-xs transition-colors cursor-pointer"
        >
          {{ step === 2 ? '放棄執行 (Esc)' : '取消 (Esc)' }}
        </button>

        <button
          v-if="step === 1"
          type="button"
          @click="$emit('proceed')"
          class="flex items-center space-x-1.5 px-4 py-1.5 bg-amber-600 hover:bg-amber-500 active:bg-amber-700 text-white font-medium rounded shadow-xs text-xs transition-colors cursor-pointer"
        >
          <span>繼續確認 (1/2)</span>
          <ArrowRight class="w-3.5 h-3.5" />
        </button>

        <button
          v-else
          type="button"
          @click="$emit('proceed')"
          class="flex items-center space-x-1.5 px-4 py-1.5 bg-rose-600 hover:bg-rose-500 active:bg-rose-700 text-white font-bold rounded shadow-md shadow-rose-950/50 text-xs transition-colors cursor-pointer"
        >
          <AlertTriangle class="w-3.5 h-3.5" />
          <span>確定立即執行 (Execute)</span>
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { AlertTriangle, ShieldAlert, AlertOctagon, X, FileCode, ArrowRight } from 'lucide-vue-next';

defineProps<{
  isOpen: boolean;
  step: 1 | 2;
  connectionName: string;
  databaseName: string;
  detectedKeywords: string[];
  sql: string;
}>();

defineEmits<{
  (e: 'proceed'): void;
  (e: 'cancel'): void;
}>();
</script>
