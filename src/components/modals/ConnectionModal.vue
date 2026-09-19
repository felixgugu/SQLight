<template>
  <Dialog
    :visible="isOpen"
    modal
    :dismissable-mask="true"
    :closable="true"
    class="w-full max-w-xl font-sans"
    @update:visible="val => !val && close()"
  >
    <template #header>
      <div class="flex items-center space-x-2">
        <i class="pi pi-database text-brand-400 text-base" />
        <span class="font-semibold text-sm text-dark-100">
          {{ editProfile ? 'Edit SQL Server Connection' : (initialProfile ? 'Duplicate SQL Server Connection' : 'New SQL Server Connection') }}
        </span>
      </div>
    </template>

    <form @submit.prevent="handleSave" class="space-y-3.5 text-xs py-1">
      <!-- Fieldset 1: Server & Database -->
      <Fieldset legend="連線主機與資料庫 (Server & Database)" class="!text-xs">
        <div class="space-y-3 pt-1">
          <!-- Connection Name & Alias Row -->
          <div class="grid grid-cols-3 gap-3">
            <div class="col-span-2">
              <div class="flex items-center justify-between mb-1">
                <label class="block text-dark-300 font-medium">連線名稱 (Name) *</label>
                <span v-if="isDuplicateName" class="text-rose-400 text-xxs font-medium">
                  * 名稱已存在
                </span>
              </div>
              <InputText
                v-model="form.name"
                required
                placeholder="e.g. Local Development MSSQL"
                :invalid="isDuplicateName"
                class="w-full !text-xs !bg-dark-900 !border-dark-700 font-sans"
              />
            </div>
            <div>
              <div class="flex items-center justify-between mb-1">
                <label class="block text-dark-300 font-medium">別名 (Alias)</label>
              </div>
              <InputText
                v-model="form.alias"
                placeholder="PROD, DEV"
                class="w-full !text-xs !bg-dark-900 !border-dark-700 font-mono uppercase"
              />
            </div>
          </div>

          <!-- Host, Port, Database Row -->
          <div class="grid grid-cols-5 gap-3">
            <div class="col-span-3">
              <label class="block text-dark-300 font-medium mb-1">主機位置 (Host) *</label>
              <InputText
                v-model="form.host"
                required
                placeholder="localhost or 127.0.0.1"
                class="w-full !text-xs !bg-dark-900 !border-dark-700 font-mono"
              />
            </div>
            <div class="col-span-2">
              <label class="block text-dark-300 font-medium mb-1">連接埠 (Port) *</label>
              <InputNumber
                v-model="form.port"
                :use-grouping="false"
                required
                class="w-full !text-xs font-mono"
                input-class="!text-xs !bg-dark-900 !border-dark-700 font-mono w-full"
              />
            </div>
          </div>

          <div>
            <label class="block text-dark-300 font-medium mb-1">預設資料庫 (Default Database) *</label>
            <InputText
              v-model="form.database"
              required
              placeholder="master"
              class="w-full !text-xs !bg-dark-900 !border-dark-700 font-mono"
            />
          </div>
        </div>
      </Fieldset>

      <!-- Fieldset 2: Authentication -->
      <Fieldset legend="身分驗證 (Authentication)" class="!text-xs">
        <div class="grid grid-cols-2 gap-3 pt-1">
          <div>
            <label class="block text-dark-300 font-medium mb-1">使用者帳號 (Username) *</label>
            <InputText
              v-model="form.username"
              required
              placeholder="sa"
              class="w-full !text-xs !bg-dark-900 !border-dark-700 font-mono"
            />
          </div>
          <div>
            <label class="block text-dark-300 font-medium mb-1">密碼 (Password)</label>
            <Password
              v-model="form.password"
              :toggle-mask="true"
              :feedback="false"
              fluid
              class="w-full !text-xs"
              input-class="!text-xs !bg-dark-900 !border-dark-700 font-mono w-full"
              :placeholder="editProfile ? '•••••••• (保留原密碼)' : (initialProfile ? '•••••••• (沿用複製密碼)' : '輸入密碼')"
            />
          </div>
        </div>
      </Fieldset>

      <!-- Fieldset 3: Security & Safe Guard -->
      <Fieldset legend="安全性與標籤色彩 (Security & Appearance)" class="!text-xs">
        <div class="space-y-3 pt-1">
          <!-- Modification Prompt Safe Guard -->
          <div class="flex items-start space-x-2.5 p-2 rounded bg-amber-950/20 border border-amber-900/40">
            <ToggleSwitch v-model="form.modificationPrompt" class="mt-0.5 flex-shrink-0" />
            <div class="flex-1 min-w-0">
              <div class="flex items-center space-x-1.5">
                <span class="font-semibold text-amber-300 text-xs">修改提示 (危險指令二次確認保護)</span>
                <Tag severity="warn" value="SAFE GUARD" class="!text-[9px] !px-1 !py-0 font-mono" />
              </div>
              <p class="text-xxs text-dark-400 mt-0.5 leading-relaxed">
                勾選後，在此連線執行 <code class="text-amber-300 font-mono">UPDATE</code>、<code class="text-amber-300 font-mono">DELETE</code>、<code class="text-amber-300 font-mono">DROP</code> 等修改指令時，強制要求連續確認 2 次，防範意外誤更動。
              </p>
            </div>
          </div>

          <!-- TLS & Cert -->
          <div class="flex items-center space-x-4 text-dark-300">
            <div class="flex items-center space-x-2">
              <Checkbox v-model="form.encrypt" :binary="true" input-id="encrypt-cb" />
              <label for="encrypt-cb" class="cursor-pointer">強制 TLS 加密</label>
            </div>
            <div class="flex items-center space-x-2">
              <Checkbox v-model="form.trustServerCertificate" :binary="true" input-id="trust-cert-cb" />
              <label for="trust-cert-cb" class="cursor-pointer">信任自我簽署憑證 (Trust Cert)</label>
            </div>
          </div>

          <!-- Color Picker Row -->
          <div class="flex items-center space-x-2 pt-1">
            <label class="text-dark-300 font-medium">標籤色彩:</label>
            <div class="flex items-center space-x-1.5">
              <button
                v-for="preset in PRESET_COLORS"
                :key="preset"
                type="button"
                @click="form.color = preset"
                :style="{ backgroundColor: preset }"
                :class="[
                  'w-4 h-4 rounded-full border transition-all cursor-pointer',
                  form.color.toLowerCase() === preset.toLowerCase()
                    ? 'border-white scale-125 ring-2 ring-white/30'
                    : 'border-dark-600 hover:scale-115 opacity-80 hover:opacity-100'
                ]"
                :title="preset"
              />
            </div>
            <label class="relative cursor-pointer flex items-center justify-center w-5 h-5 rounded border border-dark-600 bg-dark-900 hover:border-dark-400 ml-1" title="自訂色彩">
              <input
                type="color"
                v-model="form.color"
                class="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
              />
              <span
                class="w-3 h-3 rounded-sm border border-white/20"
                :style="{ backgroundColor: form.color || '#64748b' }"
              />
            </label>
            <Button
              v-if="form.color"
              label="清除"
              size="small"
              text
              severity="secondary"
              class="!text-xxs !py-0 !px-1"
              @click="form.color = ''"
            />

            <!-- Preview -->
            <div class="ml-auto flex items-center space-x-1.5 px-2 py-0.5 rounded bg-dark-900 border border-dark-750 text-xxs">
              <span class="text-dark-500">預覽:</span>
              <span
                class="w-2 h-2 rounded-full shrink-0"
                :style="{ backgroundColor: form.color || '#64748b' }"
              />
              <span class="font-medium truncate max-w-[90px]" :style="{ color: form.color || undefined }">
                {{ form.name.trim() || 'Query' }}
              </span>
              <Tag
                v-if="form.alias.trim()"
                severity="secondary"
                :value="form.alias.trim()"
                class="!text-[9px] !px-1 !py-0 font-mono"
              />
            </div>
          </div>
        </div>
      </Fieldset>

      <!-- Feedback Messages -->
      <Message
        v-if="testResult"
        :severity="testResult.success ? 'success' : 'error'"
        :closable="false"
        class="!text-xs"
      >
        <span class="font-medium">{{ testResult.success ? '連線測試成功！' : '連線測試失敗' }}</span>
        <span v-if="testResult.message" class="block text-xxs mt-0.5 font-mono">{{ testResult.message }}</span>
      </Message>
    </form>

    <!-- Modal Footer Actions -->
    <template #footer>
      <div class="flex items-center justify-between w-full pt-2">
        <Button
          type="button"
          label="測試連線 (Test)"
          icon="pi pi-bolt"
          severity="secondary"
          size="small"
          :loading="isTesting"
          @click="handleTest"
        />

        <div class="flex items-center space-x-2">
          <Button
            type="button"
            label="取消 (Cancel)"
            severity="secondary"
            size="small"
            text
            @click="close"
          />
          <Button
            type="button"
            label="儲存並連線 (Save & Connect)"
            icon="pi pi-check"
            severity="primary"
            size="small"
            :loading="isSaving"
            :disabled="isDuplicateName || !form.name.trim()"
            @click="handleSave"
          />
        </div>
      </div>
    </template>
  </Dialog>
</template>

<script setup lang="ts">
import { reactive, ref, watch, computed } from 'vue';
import Dialog from 'primevue/dialog';
import Fieldset from 'primevue/fieldset';
import InputText from 'primevue/inputtext';
import InputNumber from 'primevue/inputnumber';
import Password from 'primevue/password';
import ToggleSwitch from 'primevue/toggleswitch';
import Checkbox from 'primevue/checkbox';
import Button from 'primevue/button';
import Tag from 'primevue/tag';
import Message from 'primevue/message';
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
    testResult.value = { success: true, message: '已成功連線至 Microsoft SQL Server。' };
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
