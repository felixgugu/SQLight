export type DatabaseEngine = 'mssql';

export interface ConnectionConfig {
  name: string;
  host: string;
  port: number;
  database: string;
  username: string;
  encrypt: boolean;
  trustServerCertificate: boolean;
}

export interface ConnectionProfile extends ConnectionConfig {
  id: string;
  engine: DatabaseEngine;
  createdAt: string;
  updatedAt: string;
}

export type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error';
