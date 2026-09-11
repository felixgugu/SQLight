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
            {{ editProfile ? 'Edit SQL Server Connection' : 'New SQL Server Connection' }}
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
        <!-- Connection Name -->
        <div>
          <label class="block text-dark-300 font-medium mb-1">Connection Name</label>
          <input
            v-model="form.name"
            type="text"
            required
            placeholder="e.g. Local Development MSSQL"
            class="w-full bg-dark-900 border border-dark-700 rounded px-3 py-1.5 text-dark-100 focus:outline-none focus:border-brand-500 transition-colors"
          />
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
              :placeholder="editProfile ? '•••••••• (Leave blank to keep existing)' : 'Enter password'"
              class="w-full bg-dark-900 border border-dark-700 rounded px-3 py-1.5 text-dark-100 focus:outline-none focus:border-brand-500 font-mono transition-colors"
            />
          </div>
        </div>

        <!-- Security Flags -->
        <div class="pt-2 border-t border-dark-750 space-y-2">
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
              :disabled="isSaving"
              class="flex items-center space-x-1 px-4 py-1.5 bg-brand-600 hover:bg-brand-500 text-white font-medium rounded shadow-sm transition-colors disabled:opacity-50"
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
import { reactive, ref, watch } from 'vue';
import { Database, X, RotateCw, CheckCircle2, AlertCircle } from 'lucide-vue-next';
import type { ConnectionProfile } from '@/types/connection';
import { useConnectionStore } from '@/stores/connectionStore';

const props = defineProps<{
  isOpen: boolean;
  editProfile?: ConnectionProfile | null;
}>();

const emit = defineEmits<{
  (e: 'close'): void;
  (e: 'saved', profile: ConnectionProfile): void;
}>();

const connectionStore = useConnectionStore();

const form = reactive({
  name: '',
  host: 'localhost',
  port: 1433,
  database: 'master',
  username: 'sa',
  password: '',
  encrypt: false,
  trustServerCertificate: true,
});

const isTesting = ref(false);
const isSaving = ref(false);
const testResult = ref<{ success: boolean; message?: string } | null>(null);

watch(
  () => props.editProfile,
  (profile) => {
    if (profile) {
      form.name = profile.name;
      form.host = profile.host;
      form.port = profile.port;
      form.database = profile.database;
      form.username = profile.username;
      form.password = '';
      form.encrypt = profile.encrypt;
      form.trustServerCertificate = profile.trustServerCertificate;
    } else {
      form.name = 'New SQL Server';
      form.host = 'localhost';
      form.port = 1433;
      form.database = 'master';
      form.username = 'sa';
      form.password = '';
      form.encrypt = false;
      form.trustServerCertificate = true;
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
    await connectionStore.testConnection({
      id: props.editProfile?.id,
      name: form.name,
      engine: 'mssql',
      host: form.host,
      port: form.port,
      database: form.database,
      username: form.username,
      password: form.password,
      encrypt: form.encrypt,
      trustServerCertificate: form.trustServerCertificate,
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
    const saved = await connectionStore.saveConnection({
      id: props.editProfile?.id,
      name: form.name,
      engine: 'mssql',
      host: form.host,
      port: form.port,
      database: form.database,
      username: form.username,
      password: form.password,
      encrypt: form.encrypt,
      trustServerCertificate: form.trustServerCertificate,
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
