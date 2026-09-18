import { invokeCommand } from './api';
import type { ConnectionProfile } from '@/types/connection';

export interface SaveConnectionPayload {
  id?: string;
  name: string;
  alias?: string;
  engine: 'mssql';
  host: string;
  port: number;
  database: string;
  username: string;
  password?: string;
  encrypt: boolean;
  trustServerCertificate: boolean;
  copyPasswordFrom?: string;
  color?: string;
  modificationPrompt?: boolean;
}

export const connectionService = {
  async getConnections(): Promise<ConnectionProfile[]> {
    return invokeCommand<ConnectionProfile[]>('get_connections');
  },

  async saveConnection(req: SaveConnectionPayload): Promise<ConnectionProfile> {
    return invokeCommand<ConnectionProfile>('save_connection', { req });
  },

  async deleteConnection(id: string): Promise<void> {
    return invokeCommand<void>('delete_connection', { id });
  },

  async testConnection(req: SaveConnectionPayload): Promise<void> {
    return invokeCommand<void>('test_connection', { req });
  },

  async connect(id: string): Promise<void> {
    return invokeCommand<void>('connect', { id });
  },

  async disconnect(id: string): Promise<void> {
    return invokeCommand<void>('disconnect', { id });
  },
};
