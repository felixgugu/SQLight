import { defineStore } from 'pinia';
import { ref, computed, reactive } from 'vue';
import type { ConnectionProfile, ConnectionStatus } from '@/types/connection';
import { connectionService, type SaveConnectionPayload } from '@/services/connectionService';
import { schemaService } from '@/services/schemaService';
import { useSchemaStore } from './schemaStore';

const STORAGE_DATABASES_KEY = 'sqlight_cached_databases';

function loadDatabasesCache(): Record<string, string[]> {
  try {
    const raw = localStorage.getItem(STORAGE_DATABASES_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') {
        return parsed;
      }
    }
  } catch (e) {
    console.warn('Failed to parse cached databases:', e);
  }
  return {};
}

export const useConnectionStore = defineStore('connection', () => {
  const connections = ref<ConnectionProfile[]>([]);
  const activeConnectionId = ref<string | null>(null);
  const status = ref<ConnectionStatus>('disconnected');
  const activeDatabase = ref<string>('master');
  const availableDatabases = ref<string[]>(['master', 'tempdb', 'model', 'msdb']);
  const databasesByConn = reactive<Record<string, string[]>>(loadDatabasesCache());
  const isLoading = ref<boolean>(false);
  const errorMessage = ref<string | null>(null);

  function saveDatabasesCache() {
    try {
      localStorage.setItem(STORAGE_DATABASES_KEY, JSON.stringify(databasesByConn));
    } catch (e) {
      console.warn('Failed to save cached databases:', e);
    }
  }

  function getDatabases(connectionId: string): string[] {
    const list = databasesByConn[connectionId];
    if (list && list.length > 0) {
      return list;
    }
    const profile = connections.value.find((c) => c.id === connectionId);
    if (profile?.database) {
      const defaults = [profile.database, 'master', 'tempdb', 'model', 'msdb'];
      return Array.from(new Set(defaults));
    }
    return ['master', 'tempdb', 'model', 'msdb'];
  }

  const activeConnection = computed(() => {
    return connections.value.find((c) => c.id === activeConnectionId.value) ?? null;
  });

  function isNameDuplicate(name: string, excludeId?: string): boolean {
    const trimmed = name.trim().toLowerCase();
    if (!trimmed) return false;
    return connections.value.some(
      (c) => c.id !== excludeId && c.name.trim().toLowerCase() === trimmed
    );
  }

  async function loadConnections() {
    isLoading.value = true;
    try {
      connections.value = await connectionService.getConnections();
      if (connections.value.length > 0 && !activeConnectionId.value) {
        const first = connections.value[0];
        if (first) {
          activeConnectionId.value = first.id;
          activeDatabase.value = first.database || 'master';
          const cachedDbs = databasesByConn[first.id];
          if (cachedDbs && cachedDbs.length > 0) {
            availableDatabases.value = cachedDbs;
          }
          try {
            await connect(first.id);
          } catch (e) {
            console.warn('Auto-connect on startup deferred:', e);
            status.value = 'disconnected';
          }
        }
      }
    } catch (err) {
      console.error('Failed to load connections:', err);
    } finally {
      isLoading.value = false;
    }
  }

  async function saveConnection(payload: SaveConnectionPayload): Promise<ConnectionProfile> {
    const trimmed = payload.name.trim();
    if (!trimmed) {
      throw new Error('連線名稱不可為空');
    }
    if (isNameDuplicate(trimmed, payload.id)) {
      throw new Error(`連線名稱 '${trimmed}' 已存在，請使用不同名稱`);
    }

    const saved = await connectionService.saveConnection({
      ...payload,
      name: trimmed,
    });
    await loadConnections();
    return saved;
  }

  async function renameConnection(id: string, newName: string): Promise<ConnectionProfile> {
    const trimmed = newName.trim();
    if (!trimmed) {
      throw new Error('連線名稱不可為空');
    }
    if (isNameDuplicate(trimmed, id)) {
      throw new Error(`連線名稱 '${trimmed}' 已存在，請使用不同名稱`);
    }
    const existing = connections.value.find((c) => c.id === id);
    if (!existing) {
      throw new Error('找不到該連線設定');
    }

    const updated = await connectionService.saveConnection({
      id: existing.id,
      name: trimmed,
      engine: existing.engine,
      host: existing.host,
      port: existing.port,
      database: existing.database,
      username: existing.username,
      encrypt: existing.encrypt,
      trustServerCertificate: existing.trustServerCertificate,
    });
    await loadConnections();
    return updated;
  }

  async function deleteConnection(id: string): Promise<void> {
    const wasActive = activeConnectionId.value === id;
    if (wasActive) {
      await disconnect();
    }

    delete databasesByConn[id];
    saveDatabasesCache();

    await connectionService.deleteConnection(id);
    await loadConnections();

    if (wasActive) {
      if (connections.value.length > 0) {
        const next = connections.value[0];
        if (next) {
          await connect(next.id);
        }
      } else {
        activeConnectionId.value = null;
        status.value = 'disconnected';
        availableDatabases.value = [];
      }
    }
  }

  async function testConnection(payload: SaveConnectionPayload): Promise<void> {
    return connectionService.testConnection(payload);
  }

  async function connect(id: string): Promise<void> {
    status.value = 'connecting';
    errorMessage.value = null;
    try {
      await connectionService.connect(id);
      activeConnectionId.value = id;
      const profile = connections.value.find((c) => c.id === id);
      if (profile) {
        activeDatabase.value = profile.database || 'master';
      }
      status.value = 'connected';
      await refreshDatabases(id);
      // Preload schema in background for instant auto-completion
      useSchemaStore().loadDatabaseSchema(id, activeDatabase.value).catch(() => {});
    } catch (err: unknown) {
      status.value = 'error';
      errorMessage.value = err instanceof Error ? err.message : String(err);
      throw err;
    }
  }

  async function disconnect(): Promise<void> {
    if (activeConnectionId.value) {
      try {
        await connectionService.disconnect(activeConnectionId.value);
      } catch (err) {
        console.warn('Disconnect error:', err);
      }
      status.value = 'disconnected';
      activeConnectionId.value = null;
    }
  }

  async function refreshDatabases(connectionId?: string): Promise<void> {
    const targetId = connectionId || activeConnectionId.value;
    if (!targetId) return;

    try {
      let dbs;
      try {
        dbs = await schemaService.getDatabases(targetId);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        if (
          msg.includes('Not connected') ||
          msg.includes('Connection profile') ||
          msg.includes('Connection not found')
        ) {
          await connectionService.connect(targetId);
          dbs = await schemaService.getDatabases(targetId);
        } else {
          throw err;
        }
      }

      if (dbs && dbs.length > 0) {
        const names = dbs.map((d) => d.name);
        databasesByConn[targetId] = names;
        saveDatabasesCache();

        if (activeConnectionId.value === targetId) {
          availableDatabases.value = names;
          if (!names.includes(activeDatabase.value)) {
            activeDatabase.value = names.includes('master') ? 'master' : names[0] || 'master';
          }
        }
      }
    } catch (err: unknown) {
      console.error('Failed to fetch databases:', err);
      const errMsg = err instanceof Error ? err.message : String(err);
      errorMessage.value = errMsg;
      throw err;
    }
  }

  async function switchDatabase(dbName: string): Promise<void> {
    if (activeConnectionId.value) {
      try {
        await schemaService.switchDatabase(activeConnectionId.value, dbName);
      } catch (err) {
        console.warn('Switch database error:', err);
      }
      activeDatabase.value = dbName;
      // Preload schema in background for instant auto-completion
      useSchemaStore().loadDatabaseSchema(activeConnectionId.value, dbName).catch(() => {});
    } else {
      activeDatabase.value = dbName;
    }
  }

  return {
    connections,
    activeConnectionId,
    activeConnection,
    status,
    activeDatabase,
    availableDatabases,
    databasesByConn,
    isLoading,
    errorMessage,
    isNameDuplicate,
    getDatabases,
    loadConnections,
    saveConnection,
    renameConnection,
    deleteConnection,
    testConnection,
    connect,
    disconnect,
    refreshDatabases,
    switchDatabase,
  };
});
