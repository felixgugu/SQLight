import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import type { ConnectionProfile, ConnectionStatus } from '@/types/connection';
import { connectionService, type SaveConnectionPayload } from '@/services/connectionService';
import { schemaService } from '@/services/schemaService';

export const useConnectionStore = defineStore('connection', () => {
  const connections = ref<ConnectionProfile[]>([]);
  const activeConnectionId = ref<string | null>(null);
  const status = ref<ConnectionStatus>('disconnected');
  const activeDatabase = ref<string>('master');
  const availableDatabases = ref<string[]>(['master', 'tempdb', 'model', 'msdb']);
  const isLoading = ref<boolean>(false);
  const errorMessage = ref<string | null>(null);

  const activeConnection = computed(() => {
    return connections.value.find((c) => c.id === activeConnectionId.value) ?? null;
  });

  async function loadConnections() {
    isLoading.value = true;
    try {
      connections.value = await connectionService.getConnections();
      if (connections.value.length > 0 && !activeConnectionId.value) {
        const first = connections.value[0];
        if (first) {
          activeConnectionId.value = first.id;
          activeDatabase.value = first.database || 'master';
          status.value = 'connected';
          await refreshDatabases();
        }
      }
    } catch (err) {
      console.error('Failed to load connections:', err);
    } finally {
      isLoading.value = false;
    }
  }

  async function saveConnection(payload: SaveConnectionPayload): Promise<ConnectionProfile> {
    const saved = await connectionService.saveConnection(payload);
    await loadConnections();
    return saved;
  }

  async function deleteConnection(id: string): Promise<void> {
    await connectionService.deleteConnection(id);
    if (activeConnectionId.value === id) {
      activeConnectionId.value = null;
      status.value = 'disconnected';
    }
    await loadConnections();
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
      await refreshDatabases();
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

  async function refreshDatabases(): Promise<void> {
    if (!activeConnectionId.value) return;
    try {
      const dbs = await schemaService.getDatabases(activeConnectionId.value);
      if (dbs && dbs.length > 0) {
        availableDatabases.value = dbs.map((d) => d.name);
      }
    } catch (err) {
      console.warn('Failed to fetch databases:', err);
    }
  }

  async function switchDatabase(dbName: string): Promise<void> {
    if (activeConnectionId.value) {
      try {
        await schemaService.switchDatabase(activeConnectionId.value, dbName);
      } catch (err) {
        console.warn('Switch database error:', err);
      }
    }
    activeDatabase.value = dbName;
  }

  return {
    connections,
    activeConnectionId,
    activeConnection,
    status,
    activeDatabase,
    availableDatabases,
    isLoading,
    errorMessage,
    loadConnections,
    saveConnection,
    deleteConnection,
    testConnection,
    connect,
    disconnect,
    refreshDatabases,
    switchDatabase,
  };
});
