<template>
  <div class="space-y-4">
    <!-- Header & Notice -->
    <div class="bg-dark-900 border border-dark-750 p-3.5 rounded space-y-1">
      <div class="flex items-center space-x-2">
        <EyeOff class="w-4 h-4 text-brand-400" />
        <span class="font-semibold text-dark-100 text-xs">物件過濾規則 (Database & Table Filter Rules)</span>
      </div>
      <p class="text-xxs text-dark-400 leading-relaxed">
        設定符合條件的正規表示法（不區分大小寫），符合的資料庫或資料表將自側邊欄「物件總管」與「物件快搜」中隱藏。
        可指定套用目標為「全部」、「僅資料庫」或「僅資料表」，支援匹配資料庫名（如 <code class="text-dark-300">tempdb</code>）、表名（如 <code class="text-dark-300">bak_Users</code>）與全名（如 <code class="text-dark-300">dbo.bak_Users</code>）。
      </p>
    </div>

    <!-- Add Custom Rule Form -->
    <div class="bg-dark-900/90 border border-dark-800 rounded p-3 space-y-2">
      <div class="text-xxs font-medium text-dark-300">新增自訂規則 (Add Custom Rule)</div>
      <div class="grid grid-cols-12 gap-2">
        <!-- Target Scope Selector -->
        <div class="col-span-3">
          <select
            v-model="newTarget"
            class="w-full bg-dark-850 border border-dark-700 rounded px-2 py-1.5 text-xs text-dark-100 focus:border-brand-500 focus:outline-none cursor-pointer"
          >
            <option value="all">全部 (All: 庫與表)</option>
            <option value="database">僅資料庫 (Database)</option>
            <option value="table">僅資料表 (Table)</option>
          </select>
        </div>

        <!-- Pattern Input -->
        <div class="col-span-4">
          <input
            v-model="newPattern"
            type="text"
            placeholder="正規表示式 (例如: ^(master|tempdb)$)"
            @keydown.enter="handleAddRule"
            :class="[
              'w-full bg-dark-850 border rounded px-2.5 py-1.5 text-xs text-dark-100 font-mono focus:outline-none',
              patternError
                ? 'border-rose-500 focus:border-rose-500'
                : 'border-dark-700 focus:border-brand-500'
            ]"
          />
        </div>

        <!-- Description Input -->
        <div class="col-span-3">
          <input
            v-model="newDescription"
            type="text"
            placeholder="說明備註 (選填，例如: 系統庫)"
            @keydown.enter="handleAddRule"
            class="w-full bg-dark-850 border border-dark-700 rounded px-2.5 py-1.5 text-xs text-dark-100 focus:border-brand-500 focus:outline-none"
          />
        </div>

        <!-- Add Button -->
        <div class="col-span-2">
          <button
            type="button"
            @click="handleAddRule"
            :disabled="!newPattern.trim() || !!patternError"
            class="w-full h-full py-1.5 bg-brand-600 hover:bg-brand-500 disabled:bg-dark-750 disabled:text-dark-500 disabled:cursor-not-allowed text-white rounded text-xs font-medium flex items-center justify-center space-x-1 transition-colors cursor-pointer"
          >
            <Plus class="w-3.5 h-3.5" />
            <span>新增規則</span>
          </button>
        </div>
      </div>
      <div v-if="patternError" class="text-rose-400 text-xxs flex items-center space-x-1">
        <AlertTriangle class="w-3 h-3 flex-shrink-0" />
        <span>{{ patternError }}</span>
      </div>
    </div>

    <!-- Active Rules List -->
    <div class="space-y-1.5">
      <div class="flex items-center justify-between text-xxs font-medium text-dark-300">
        <span>已設定的過濾規則 ({{ settingsStore.hiddenTableRules.length }})</span>
        <span v-if="settingsStore.hiddenTableRules.length > 0" class="text-dark-500 text-xxs">勾選以啟用 / 取消勾選停用</span>
      </div>

      <div class="max-h-80 overflow-y-auto space-y-1.5 pr-1">
        <div
          v-if="settingsStore.hiddenTableRules.length === 0"
          class="py-6 text-center text-dark-500 text-xxs border border-dashed border-dark-800 rounded bg-dark-900/40"
        >
          目前尚未設定任何隱藏規則，所有資料庫與資料表皆正常顯示。
        </div>

        <div
          v-for="rule in settingsStore.hiddenTableRules"
          :key="rule.id"
        >
          <!-- Editing Mode -->
          <div
            v-if="editingRuleId === rule.id"
            class="px-3 py-2 bg-dark-850 border border-brand-500/60 rounded space-y-2 shadow-sm"
          >
            <div class="grid grid-cols-12 gap-2 items-center">
              <!-- Target Scope Selector -->
              <div class="col-span-3">
                <select
                  v-model="editTarget"
                  class="w-full bg-dark-900 border border-dark-700 rounded px-2 py-1 text-xs text-dark-100 focus:border-brand-500 focus:outline-none cursor-pointer"
                >
                  <option value="all">全部 (All)</option>
                  <option value="database">僅資料庫 (Database)</option>
                  <option value="table">僅資料表 (Table)</option>
                </select>
              </div>

              <!-- Pattern Input -->
              <div class="col-span-4">
                <input
                  v-model="editPattern"
                  type="text"
                  placeholder="正規表示式"
                  @keydown.enter="saveEditing"
                  @keydown.esc="cancelEditing"
                  :class="[
                    'w-full bg-dark-900 border rounded px-2.5 py-1 text-xs text-dark-100 font-mono focus:outline-none',
                    editPatternError
                      ? 'border-rose-500 focus:border-rose-500'
                      : 'border-dark-700 focus:border-brand-500'
                  ]"
                />
              </div>

              <!-- Description Input -->
              <div class="col-span-3">
                <input
                  v-model="editDescription"
                  type="text"
                  placeholder="說明備註 (選填)"
                  @keydown.enter="saveEditing"
                  @keydown.esc="cancelEditing"
                  class="w-full bg-dark-900 border border-dark-700 rounded px-2.5 py-1 text-xs text-dark-100 focus:border-brand-500 focus:outline-none"
                />
              </div>

              <!-- Action Buttons: Save & Cancel -->
              <div class="col-span-2 flex items-center justify-end space-x-1.5">
                <button
                  type="button"
                  @click="saveEditing"
                  :disabled="!!editPatternError"
                  class="px-2 py-1 rounded bg-brand-600 hover:bg-brand-500 disabled:bg-dark-750 disabled:text-dark-500 disabled:cursor-not-allowed text-white text-xs font-medium flex items-center space-x-1 cursor-pointer transition-colors"
                  title="儲存修改 (Enter)"
                >
                  <Check class="w-3.5 h-3.5" />
                  <span>儲存</span>
                </button>
                <button
                  type="button"
                  @click="cancelEditing"
                  class="px-1.5 py-1 rounded bg-dark-750 hover:bg-dark-700 text-dark-300 hover:text-dark-100 text-xs flex items-center cursor-pointer transition-colors"
                  title="取消 (Esc)"
                >
                  <X class="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
            <div v-if="editPatternError" class="text-rose-400 text-xxs flex items-center space-x-1">
              <AlertTriangle class="w-3 h-3 flex-shrink-0" />
              <span>{{ editPatternError }}</span>
            </div>
          </div>

          <!-- Normal Display Mode -->
          <div
            v-else
            @dblclick="startEditing(rule)"
            class="flex items-center justify-between px-3 py-2 bg-dark-900 border border-dark-800 rounded hover:border-dark-700 transition-colors group cursor-default"
            title="雙擊即可快速編輯"
          >
            <div class="flex items-center space-x-2.5 min-w-0">
              <input
                type="checkbox"
                :checked="rule.enabled"
                @change="settingsStore.toggleFilterRule(rule.id)"
                class="w-3.5 h-3.5 rounded border-dark-650 bg-dark-800 text-brand-500 focus:ring-0 cursor-pointer"
                title="切換啟用/停用"
              />
              <!-- Target Scope Badge -->
              <span
                :class="[
                  'text-[10px] px-1.5 py-0.5 rounded font-medium border flex-shrink-0',
                  rule.target === 'database'
                    ? 'bg-amber-500/15 text-amber-300 border-amber-500/30'
                    : rule.target === 'table'
                    ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                    : 'bg-brand-500/15 text-brand-300 border-brand-500/30'
                ]"
              >
                {{ rule.target === 'database' ? '資料庫' : rule.target === 'table' ? '資料表' : '全部' }}
              </span>
              <!-- Pattern -->
              <span
                :class="[
                  'font-mono text-xs px-1.5 py-0.5 rounded border transition-colors',
                  rule.enabled
                    ? 'bg-brand-500/10 text-brand-300 border-brand-500/20'
                    : 'bg-dark-800 text-dark-500 border-dark-750 line-through'
                ]"
              >
                {{ rule.pattern }}
              </span>
              <!-- Description -->
              <span
                v-if="rule.description"
                :class="['text-xxs truncate', rule.enabled ? 'text-dark-400' : 'text-dark-500']"
              >
                {{ rule.description }}
              </span>
            </div>

            <!-- Actions: Edit & Delete -->
            <div class="flex items-center space-x-1 flex-shrink-0 opacity-80 group-hover:opacity-100 transition-opacity">
              <button
                type="button"
                @click="startEditing(rule)"
                class="text-dark-400 hover:text-brand-300 p-1 rounded hover:bg-dark-800 transition-colors cursor-pointer"
                title="編輯此規則 (雙擊亦可)"
              >
                <Pencil class="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                @click="settingsStore.removeFilterRule(rule.id)"
                class="text-dark-500 hover:text-rose-400 p-1 rounded hover:bg-dark-800 transition-colors cursor-pointer"
                title="刪除此規則"
              >
                <Trash2 class="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Live Regex Tester -->
    <div class="bg-dark-900 border border-dark-800 rounded p-3 space-y-2">
      <div class="flex items-center justify-between">
        <span class="text-xxs font-medium text-dark-300 flex items-center space-x-1.5">
          <FlaskConical class="w-3.5 h-3.5 text-amber-400" />
          <span>即時比對測試器 (Live Tester)</span>
        </span>
        <span class="text-xxs text-dark-500">測試特定資料庫或資料表是否會被隱藏</span>
      </div>
      <div class="flex items-center space-x-2">
        <!-- Target Type for Tester -->
        <div class="flex items-center bg-dark-850 rounded border border-dark-700 p-0.5 text-xxs">
          <button
            type="button"
            @click="testTargetType = 'database'"
            :class="[
              'px-2 py-0.5 rounded font-medium transition-colors cursor-pointer',
              testTargetType === 'database' ? 'bg-amber-500/20 text-amber-300' : 'text-dark-400 hover:text-dark-200'
            ]"
          >
            測試資料庫
          </button>
          <button
            type="button"
            @click="testTargetType = 'table'"
            :class="[
              'px-2 py-0.5 rounded font-medium transition-colors cursor-pointer',
              testTargetType === 'table' ? 'bg-emerald-500/20 text-emerald-300' : 'text-dark-400 hover:text-dark-200'
            ]"
          >
            測試資料表
          </button>
        </div>

        <input
          v-model="testName"
          type="text"
          :placeholder="testTargetType === 'database' ? '輸入資料庫名稱 (例如: tempdb 或 DB_2026_bak)' : '輸入資料表名稱 (例如: bak_Orders 或 dbo.tmp_logs)'"
          class="flex-1 bg-dark-850 border border-dark-700 rounded px-2.5 py-1 text-xs text-dark-100 font-mono focus:border-brand-500 focus:outline-none"
        />
        <div v-if="testName.trim()" class="flex-shrink-0">
          <span
            v-if="testResult.isHidden"
            class="px-2.5 py-1 rounded text-xxs font-medium bg-rose-500/20 text-rose-300 border border-rose-500/30 flex items-center space-x-1"
          >
            <EyeOff class="w-3 h-3" />
            <span>🚫 將被隱藏 (符合: {{ testResult.matchedPattern }})</span>
          </span>
          <span
            v-else
            class="px-2.5 py-1 rounded text-xxs font-medium bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center space-x-1"
          >
            <Check class="w-3 h-3" />
            <span>✅ 正常顯示 (Visible)</span>
          </span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import { EyeOff, Plus, Trash2, Check, AlertTriangle, FlaskConical, Pencil, X } from 'lucide-vue-next';
import { useSettingsStore } from '@/stores/settingsStore';
import {
  validateRegexPattern,
  type FilterRule,
  type FilterTarget,
} from '@/utils/tableFilter';

const settingsStore = useSettingsStore();

const newTarget = ref<FilterTarget>('all');
const newPattern = ref('');
const newDescription = ref('');

// Inline editing state
const editingRuleId = ref<string | null>(null);
const editTarget = ref<FilterTarget>('all');
const editPattern = ref('');
const editDescription = ref('');

const editPatternError = computed(() => {
  const trimmed = editPattern.value.trim();
  if (!trimmed) return '規則不可為空';
  const val = validateRegexPattern(trimmed);
  return val.isValid ? '' : '正規表示法語法錯誤: ' + val.error;
});

function startEditing(rule: FilterRule) {
  editingRuleId.value = rule.id;
  editTarget.value = rule.target || 'all';
  editPattern.value = rule.pattern;
  editDescription.value = rule.description || '';
}

function cancelEditing() {
  editingRuleId.value = null;
}

function saveEditing() {
  if (editPatternError.value || !editingRuleId.value) return;
  settingsStore.updateFilterRule(editingRuleId.value, {
    pattern: editPattern.value.trim(),
    target: editTarget.value,
    description: editDescription.value.trim() || undefined,
  });
  editingRuleId.value = null;
}

const testTargetType = ref<'database' | 'table'>('database');
const testName = ref('');

const patternError = computed(() => {
  if (!newPattern.value.trim()) return '';
  const val = validateRegexPattern(newPattern.value);
  return val.isValid ? '' : '正規表示法語法錯誤: ' + val.error;
});

const testResult = computed(() => {
  const trimmed = testName.value.trim();
  if (!trimmed) return { isHidden: false };

  if (testTargetType.value === 'table') {
    const parts = trimmed.split('.');
    if (parts.length > 1) {
      const schema = parts[0];
      const table = parts.slice(1).join('.');
      return settingsStore.testFilterPattern(table, 'table', schema);
    }
    return settingsStore.testFilterPattern(trimmed, 'table');
  }

  return settingsStore.testFilterPattern(trimmed, 'database');
});

function handleAddRule() {
  if (patternError.value || !newPattern.value.trim()) return;
  settingsStore.addFilterRule(newPattern.value, newTarget.value, newDescription.value);
  newPattern.value = '';
  newDescription.value = '';
}
</script>
