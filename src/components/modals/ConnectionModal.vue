<template>
  <div
    v-if="isOpen"
    class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 select-none"
  >
    <div
      class="bg-dark-850 border border-dark-700 rounded-lg shadow-2xl w-full max-w-lg overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-150"
    >
      <!-- Modal Header -->
      <div class="px-5 py-3 border-b border-dark-700 flex items-center justify-between bg-dark-800">
        <div class="flex items-center space-x-2">
          <Database class="w-4 h-4 text-brand-400" />
          <h3 class="font-semibold text-sm text-dark-100">
            {{ editProfile ? 'Edit SQL Server Connection' : (initialProfile ? 'Duplicate SQL Server Connection' : 'New SQL Server Connection') }}
          </h3>
        </div>
        <button
          @click="close"
          class="text-dark-400 hover:text-dark-200 p-1 rounded hover:bg-dark-700 transition-colors"
        >
          <X class="w-4 h-4" />
        </button>
      </div>

      <!-- Modal Body -->
      <form @submit.prevent="handleSave" class="p-5 space-y-4 text-xs">
        <!-- Connection Name & Alias Row -->
        <div class="grid grid-cols-3 gap-3">
          <div class="col-span-2">
            <div class="flex items-center justify-between mb-1">
              <label class="block text-dark-300 font-medium">連線名稱 (Connection Name)</label>
              <span v-if="isDuplicateName" class="text-rose-400 text-xxs font-medium">
                * 此名稱已被使用，請更換名稱
              </span>
            </div>
            <input
              v-model="form.name"
              type="text"
              required
              placeholder="e.g. Local Development MSSQL"
              :class="[
                'w-full bg-dark-900 border rounded px-3 py-1.5 text-dark-100 focus:outline-none transition-colors',
                isDuplicateName
                  ? 'border-rose-500 focus:border-rose-400'
                  : 'border-dark-700 focus:border-brand-500'
              ]"
            />
          </div>
          <div>
            <div class="flex items-center justify-between mb-1">
              <label class="block text-dark-300 font-medium">別名 (Alias)</label>
            </div>
            <input
              v-model="form.alias"
              type="text"
              placeholder="e.g. PROD, DEV"
              class="w-full bg-dark-900 border border-dark-700 rounded px-3 py-1.5 text-dark-100 focus:outline-none focus:border-brand-500 font-mono transition-colors"
            />
          </div>
        </div>

        <!-- Tab Color Picker -->
        <div>
          <div class="flex items-center justify-between mb-1.5">
            <label class="block text-dark-300 font-medium">分頁標籤自訂顏色 (Tab Color)</label>
            <span v-if="form.color" class="text-xxs text-dark-400 font-mono">{{ form.color }}</span>
          </div>
          <div class="flex items-center space-x-2 bg-dark-900/60 p-2 rounded border border-dark-750">
            <!-- Preset Color Palette -->
            <div class="flex items-center space-x-1.5">
              <button
                v-for="preset in PRESET_COLORS"
                :key="preset"
                type="button"
                @click="form.color = preset"
                :style="{ backgroundColor: preset }"
                :class="[
                  'w-5 h-5 rounded-full border transition-all cursor-pointer',
                  form.color.toLowerCase() === preset.toLowerCase()
                    ? 'border-white scale-125 ring-2 ring-white/30 shadow-xs'
                    : 'border-dark-600 hover:scale-115 opacity-80 hover:opacity-100'
                ]"
                :title="preset"
              />
            </div>

            <!-- Custom Color Picker -->
            <label class="relative cursor-pointer flex items-center justify-center w-6 h-6 rounded border border-dark-600 bg-dark-900 hover:border-dark-400 transition-colors" title="自訂顏色 (Custom Color)">
              <input
                type="color"
                v-model="form.color"
                class="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
              />
              <span
                class="w-3.5 h-3.5 rounded-sm border border-white/20"
                :style="{ backgroundColor: form.color || '#64748b' }"
              />
            </label>

            <!-- Clear button -->
            <button
              v-if="form.color"
              type="button"
              @click="form.color = ''"
              class="text-xxs text-dark-400 hover:text-dark-200 px-1.5 py-0.5 rounded border border-dark-700 hover:bg-dark-750 transition-colors cursor-pointer"
            >
              清除
            </button>

            <!-- Tab Preview Badge -->
            <div class="ml-auto flex items-center space-x-1.5 px-2.5 py-1 rounded bg-dark-850 border border-dark-700 text-xxs select-none">
              <span class="text-dark-500">頁籤預覽:</span>
              <span
                class="w-2 h-2 rounded-full shrink-0"
                :style="{ backgroundColor: form.color || '#64748b' }"
              />
              <span
                class="font-medium truncate max-w-[110px]"
                :style="{ color: form.color || undefined }"
                :class="!form.color ? 'text-dark-200' : ''"
              >
                {{ form.name.trim() || 'Query 1' }}
              </span>
              <span
                v-if="form.alias.trim()"
                class="text-[10px] font-mono px-1 py-0.2 rounded border flex-shrink-0 text-slate-300 border-white/10"
                :style="{ backgroundColor: 'rgba(255,255,255,0.08)' }"
              >
                {{ form.alias.trim() }}
              </span>
            </div>
          </div>
        </div>

        <!-- Host & Port Row -->
        <div class="grid grid-cols-3 gap-3">
          <div class="col-span-2">
            <label class="block text-dark-300 font-medium mb-1">Host / Server</label>
            <input
              v-model="form.host"
              type="text"
              required
              placeholder="localhost or 127.0.0.1"
              class="w-full bg-dark-900 border border-dark-700 rounded px-3 py-1.5 text-dark-100 focus:outline-none focus:border-brand-500 font-mono transition-colors"
            />
          </div>
          <div>
            <label class="block text-dark-300 font-medium mb-1">Port</label>
            <input
              v-model.number="form.port"
              type="number"
              required
              class="w-full bg-dark-900 border border-dark-700 rounded px-3 py-1.5 text-dark-100 focus:outline-none focus:border-brand-500 font-mono transition-colors"
            />
          </div>
        </div>

        <!-- Database Name -->
        <div>
          <label class="block text-dark-300 font-medium mb-1">Default Database</label>
          <input
            v-model="form.database"
            type="text"
            required
            placeholder="master"
            class="w-full bg-dark-900 border border-dark-700 rounded px-3 py-1.5 text-dark-100 focus:outline-none focus:border-brand-500 font-mono transition-colors"
          />
        </div>

        <!-- Username & Password Row -->
        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="block text-dark-300 font-medium mb-1">Username (SQL Auth)</label>
            <input
              v-model="form.username"
              type="text"
              required
              placeholder="sa"
              class="w-full bg-dark-900 border border-dark-700 rounded px-3 py-1.5 text-dark-100 focus:outline-none focus:border-brand-500 font-mono transition-colors"
            />
          </div>
          <div>
            <label class="block text-dark-300 font-medium mb-1">Password</label>
            <input
              v-model="form.password"
              type="password"
              :placeholder="editProfile ? '•••••••• (Leave blank to keep existing)' : (initialProfile ? '•••••••• (Leave blank to reuse copied password)' : 'Enter password')"
              class="w-full bg-dark-900 border border-dark-700 rounded px-3 py-1.5 text-dark-100 focus:outline-none focus:border-brand-500 font-mono transition-colors"
            />
          </div>
        </div>

        <!-- Security & Protection Flags -->
        <div class="pt-2 border-t border-dark-750 space-y-2.5">
          <!-- Modification Prompt Safe Guard -->
          <label class="flex items-start space-x-2.5 p-2 rounded bg-amber-950/20 border border-amber-900/40 cursor-pointer hover:bg-amber-950/30 transition-colors">
            <input
              v-model="form.modificationPrompt"
              type="checkbox"
              class="mt-0.5 rounded bg-dark-900 border-dark-700 text-amber-500 focus:ring-0 focus:outline-none"
            />
            <div class="flex-1 min-w-0">
              <div class="flex items-center space-x-1.5">
                <span class="font-semibold text-amber-300">修改提示 (危險指令二次確認保護)</span>
                <span class="px-1.5 py-0.2 bg-amber-500/20 text-amber-300 border border-amber-500/40 rounded text-xxs font-mono">SAFE GUARD</span>
              </div>
              <p class="text-xxs text-dark-400 mt-0.5 leading-relaxed">
                勾選後，在此連線執行 <code class="text-amber-300 font-mono">UPDATE</code>、<code class="text-amber-300 font-mono">INSERT</code>、<code class="text-amber-300 font-mono">DELETE</code>、<code class="text-amber-300 font-mono">ALTER</code>、<code class="text-amber-300 font-mono">CREATE</code>、<code class="text-amber-300 font-mono">DROP</code>、<code class="text-amber-300 font-mono">TRUNCATE</code> 等危險指令時，必須連續確認 2 次才可執行，避免改錯資料。
              </p>
            </div>
          </label>

          <label class="flex items-center space-x-2 cursor-pointer text-dark-300 hover:text-dark-100">
            <input
              v-model="form.encrypt"
              type="checkbox"
              class="rounded bg-dark-900 border-dark-700 text-brand-500 focus:ring-0 focus:outline-none"
            />
            <span>Encrypt connection (TLS)</span>
          </label>
          <label class="flex items-center space-x-2 cursor-pointer text-dark-300 hover:text-dark-100">
            <input
              v-model="form.trustServerCertificate"
              type="checkbox"
              class="rounded bg-dark-900 border-dark-700 text-brand-500 focus:ring-0 focus:outline-none"
            />
            <span>Trust Server Certificate (Allow self-signed certificates)</span>
          </label>
        </div>

        <!-- Feedback Messages (Test status / errors) -->
        <div v-if="testResult" :class="['p-2.5 rounded text-xs border font-mono', testResult.success ? 'bg-emerald-950/40 text-emerald-300 border-emerald-800/60' : 'bg-rose-950/40 text-rose-300 border-rose-800/60']">
          <div class="flex items-center space-x-1.5 font-semibold">
            <CheckCircle2 v-if="testResult.success" class="w-4 h-4 text-emerald-400" />
            <AlertCircle v-else class="w-4 h-4 text-rose-400" />
            <span>{{ testResult.success ? 'Connection Successful' : 'Connection Failed' }}</span>
          </div>
          <div v-if="testResult.message" class="mt-1 text-xxs leading-relaxed">{{ testResult.message }}</div>
        </div>

        <!-- Modal Footer Actions -->
        <div class="pt-3 border-t border-dark-700 flex items-center justify-between">
          <button
            type="button"
            @click="handleTest"
            :disabled="isTesting"
            class="flex items-center space-x-1.5 px-3 py-1.5 bg-dark-800 hover:bg-dark-750 text-dark-200 rounded border border-dark-700 transition-colors disabled:opacity-50"
          >
            <RotateCw :class="['w-3.5 h-3.5', isTesting ? 'animate-spin text-brand-400' : '']" />
            <span>{{ isTesting ? 'Testing...' : 'Test Connection' }}</span>
          </button>

          <div class="flex items-center space-x-2">
            <button
              type="button"
              @click="close"
              class="px-3 py-1.5 bg-dark-800 hover:bg-dark-750 text-dark-400 hover:text-dark-200 rounded border border-dark-700 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              :disabled="isSaving || isDuplicateName || !form.name.trim()"
              class="flex items-center space-x-1 px-4 py-1.5 bg-brand-600 hover:bg-brand-500 text-white font-medium rounded shadow-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <span>{{ isSaving ? 'Saving...' : 'Save & Connect' }}</span>
            </button>
          </div>
        </div>
      </form>
    </div>
  </div>
</template>

<script setup lang="ts">
import { reactive, ref, watch, computed } from 'vue';
import { Database, X, RotateCw, CheckCircle2, AlertCircle } from 'lucide-vue-next';
import type { ConnectionProfile } from '@/types/connection';
import { useConnectionStore } from '@/stores/connectionStore';
import { generateDuplicateConnectionName } from '@/utils/connectionNameHelper';

const props = defineProps<{
  isOpen: boolean;
  editProfile?: ConnectionProfile | null;
  initialProfile?: ConnectionProfile | null;
}>();

const emit = defineEmits<{
  (e: 'close'): void;
  (e: 'saved', profile: ConnectionProfile): void;
}>();

const connectionStore = useConnectionStore();

const PRESET_COLORS = [
  '#ef4444', // Red
  '#f97316', // Orange
  '#eab308', // Yellow
  '#10b981', // Emerald
  '#06b6d4', // Cyan
  '#3b82f6', // Blue
  '#8b5cf6', // Violet
  '#ec4899', // Pink
];

const form = reactive({
  name: '',
  alias: '',
  host: 'localhost',
  port: 1433,
  database: 'master',
  username: 'sa',
  password: '',
  encrypt: false,
  trustServerCertificate: true,
  color: '',
  modificationPrompt: false,
});

const isTesting = ref(false);
const isSaving = ref(false);
const testResult = ref<{ success: boolean; message?: string } | null>(null);

const isDuplicateName = computed(() => {
  return connectionStore.isNameDuplicate(form.name, props.editProfile?.id);
});

watch(
  () => [props.isOpen, props.editProfile, props.initialProfile],
  () => {
    if (!props.isOpen) return;

    if (props.editProfile) {
      form.name = props.editProfile.name;
      form.alias = props.editProfile.alias || '';
      form.host = props.editProfile.host;
      form.port = props.editProfile.port;
      form.database = props.editProfile.database;
      form.username = props.editProfile.username;
      form.password = '';
      form.encrypt = props.editProfile.encrypt;
      form.trustServerCertificate = props.editProfile.trustServerCertificate;
      form.color = props.editProfile.color || '';
      form.modificationPrompt = props.editProfile.modificationPrompt ?? false;
    } else if (props.initialProfile) {
      form.name = generateDuplicateConnectionName(
        props.initialProfile.name,
        connectionStore.connections.map((c) => c.name)
      );
      form.alias = props.initialProfile.alias || '';
      form.host = props.initialProfile.host;
      form.port = props.initialProfile.port;
      form.database = props.initialProfile.database;
      form.username = props.initialProfile.username;
      form.password = '';
      form.encrypt = props.initialProfile.encrypt;
      form.trustServerCertificate = props.initialProfile.trustServerCertificate;
      form.color = props.initialProfile.color || '';
      form.modificationPrompt = props.initialProfile.modificationPrompt ?? false;
    } else {
      form.name = 'New SQL Server';
      form.alias = '';
      form.host = 'localhost';
      form.port = 1433;
      form.database = 'master';
      form.username = 'sa';
      form.password = '';
      form.encrypt = false;
      form.trustServerCertificate = true;
      form.color = '';
      form.modificationPrompt = false;
    }
    testResult.value = null;
  },
  { immediate: true }
);

function close() {
  testResult.value = null;
  emit('close');
}

async function handleTest() {
  isTesting.value = true;
  testResult.value = null;
  try {
    const copyFrom = props.initialProfile && !form.password.trim() ? props.initialProfile.id : undefined;
    await connectionStore.testConnection({
      id: props.editProfile?.id,
      name: form.name,
      alias: form.alias.trim() || undefined,
      engine: 'mssql',
      host: form.host,
      port: form.port,
      database: form.database,
      username: form.username,
      password: form.password,
      encrypt: form.encrypt,
      trustServerCertificate: form.trustServerCertificate,
      color: form.color.trim() || undefined,
      modificationPrompt: form.modificationPrompt,
      copyPasswordFrom: copyFrom,
    });
    testResult.value = { success: true, message: 'Connected to Microsoft SQL Server successfully.' };
  } catch (err: unknown) {
    testResult.value = {
      success: false,
      message: err instanceof Error ? err.message : String(err),
    };
  } finally {
    isTesting.value = false;
  }
}

async function handleSave() {
  isSaving.value = true;
  try {
    const copyFrom = props.initialProfile && !form.password.trim() ? props.initialProfile.id : undefined;
    const saved = await connectionStore.saveConnection({
      id: props.editProfile?.id,
      name: form.name,
      alias: form.alias.trim() || undefined,
      engine: 'mssql',
      host: form.host,
      port: form.port,
      database: form.database,
      username: form.username,
      password: form.password,
      encrypt: form.encrypt,
      trustServerCertificate: form.trustServerCertificate,
      color: form.color.trim() || undefined,
      modificationPrompt: form.modificationPrompt,
      copyPasswordFrom: copyFrom,
    });
    await connectionStore.connect(saved.id);
    emit('saved', saved);
    close();
  } catch (err: unknown) {
    testResult.value = {
      success: false,
      message: err instanceof Error ? err.message : String(err),
    };
  } finally {
    isSaving.value = false;
  }
}
</script>
