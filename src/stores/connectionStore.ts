import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import type { ConnectionProfile, ConnectionStatus } from '@/types/connection';

export const useConnectionStore = defineStore('connection', () => {
  const connections = ref<ConnectionProfile[]>([
    {
      id: 'conn-local-demo',
      name: 'Local SQL Server (Demo)',
      engine: 'mssql',
      host: 'localhost',
      port: 1433,
      database: 'master',
      username: 'sa',
      encrypt: false,
      trustServerCertificate: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  ]);

  const activeConnectionId = ref<string | null>('conn-local-demo');
  const status = ref<ConnectionStatus>('connected');
  const activeDatabase = ref<string>('master');
  const availableDatabases = ref<string[]>(['master', 'tempdb', 'model', 'msdb', 'SQLightDB']);

  const activeConnection = computed(() => {
    return connections.value.find((c) => c.id === activeConnectionId.value) ?? null;
  });

  function setActiveConnection(id: string | null) {
    activeConnectionId.value = id;
    if (id) {
      status.value = 'connected';
    } else {
      status.value = 'disconnected';
    }
  }

  function setActiveDatabase(db: string) {
    activeDatabase.value = db;
  }

  return {
    connections,
    activeConnectionId,
    activeConnection,
    status,
    activeDatabase,
    availableDatabases,
    setActiveConnection,
    setActiveDatabase,
  };
});
