import { invoke as tauriInvoke } from '@tauri-apps/api/core';

export const isTauri = (): boolean => {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
};

export async function invokeCommand<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
  if (isTauri()) {
    try {
      return await tauriInvoke<T>(cmd, args);
    } catch (err: unknown) {
      if (typeof err === 'string') {
        throw new Error(err);
      } else if (err instanceof Error) {
        throw err;
      } else {
        throw new Error(JSON.stringify(err));
      }
    }
  }

  // Graceful browser fallback for UI development/testing
  console.info(`[Dev/Browser] Invoking command '${cmd}' with args:`, args);
  return mockInvoke<T>(cmd, args);
}

function mockInvoke<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
  switch (cmd) {
    case 'get_connections':
      return Promise.resolve([
        {
          id: 'conn-demo-1',
          name: 'Production SQL Server (Demo)',
          engine: 'mssql',
          host: 'sql.sqlight.internal',
          port: 1433,
          database: 'AdventureWorks',
          username: 'sa',
          encrypt: true,
          trustServerCertificate: true,
          createdAt: new Date(Date.now() - 86400000).toISOString(),
          updatedAt: new Date().toISOString(),
        },
        {
          id: 'conn-demo-2',
          name: 'Localhost SQL Server 2022',
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
      ] as unknown as T);

    case 'save_connection': {
      const req = (args?.req ?? {}) as Record<string, unknown>;
      return Promise.resolve({
        id: (req.id as string) || `conn-${Date.now()}`,
        name: req.name as string,
        engine: 'mssql',
        host: req.host as string,
        port: (req.port as number) || 1433,
        database: (req.database as string) || 'master',
        username: req.username as string,
        encrypt: !!req.encrypt,
        trustServerCertificate: !!req.trustServerCertificate,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      } as unknown as T);
    }

    case 'delete_connection':
    case 'test_connection':
    case 'connect':
    case 'disconnect':
    case 'switch_database':
      return Promise.resolve(undefined as unknown as T);

    case 'execute_query': {
      const sql = ((args?.sql as string) || '').trim();
      const isSelect = sql.toUpperCase().startsWith('SELECT');

      if (!isSelect) {
        return Promise.resolve({
          resultSets: [],
          messages: [
            {
              level: 'info',
              message: 'Statement executed successfully. (1 row affected)',
              timestamp: new Date().toISOString(),
            },
          ],
          affectedRows: 1,
          executionTimeMs: 16,
        } as unknown as T);
      }

      return Promise.resolve({
        resultSets: [
          {
            columns: [
              { name: 'UserID', dataType: 'int', nullable: false, ordinal: 0 },
              { name: 'Username', dataType: 'nvarchar(50)', nullable: false, ordinal: 1 },
              { name: 'Email', dataType: 'nvarchar(100)', nullable: true, ordinal: 2 },
              { name: 'Department', dataType: 'nvarchar(50)', nullable: true, ordinal: 3 },
              { name: 'Avatar', dataType: 'varbinary(max)', nullable: true, ordinal: 4 },
              { name: 'IsActive', dataType: 'bit', nullable: false, ordinal: 5 },
              { name: 'CreatedAt', dataType: 'datetime2', nullable: false, ordinal: 6 },
            ],
            rows: [
              [1, 'alex.mercer', 'alex@sqlight.dev', 'Engineering', { type: 'binary', length: 1024 }, true, '2026-01-15 08:30:00'],
              [2, 'sarah.connor', 'sarah@sqlight.dev', 'Security', { type: 'binary', length: 2048 }, true, '2026-02-01 11:05:42'],
              [3, 'john.doe', null, 'Marketing', null, false, '2026-03-12 19:40:11'],
              [4, 'elena.rostova', 'elena@sqlight.dev', 'Research', { type: 'binary', length: 512 }, true, '2026-04-18 16:22:09'],
              [5, 'david.kim', 'david@sqlight.dev', 'Product', null, true, '2026-05-09 10:14:33'],
              [6, 'lucas.vance', null, 'Design', null, false, '2026-06-20 14:05:19'],
              [7, 'maya.lin', 'maya@sqlight.dev', 'Engineering', { type: 'binary', length: 4096 }, true, '2026-07-04 09:50:00'],
              [8, 'arthur.dent', 'arthur@sqlight.dev', 'Operations', null, true, '2026-08-11 12:12:12'],
            ],
            rowCount: 8,
          },
        ],
        messages: [
          {
            level: 'info',
            message: 'Query executed successfully. 1 result set, 8 rows returned.',
            timestamp: new Date().toISOString(),
          },
        ],
        affectedRows: 8,
        executionTimeMs: 14,
      } as unknown as T);
    }

    case 'get_databases':
      return Promise.resolve([
        { name: 'master' },
        { name: 'tempdb' },
        { name: 'model' },
        { name: 'msdb' },
        { name: 'AdventureWorks' },
        { name: 'SQLightDB' },
      ] as unknown as T);

    case 'get_tables':
      return Promise.resolve([
        { schema: 'dbo', name: 'Users', kind: 'BASE TABLE' },
        { schema: 'dbo', name: 'Orders', kind: 'BASE TABLE' },
        { schema: 'dbo', name: 'OrderItems', kind: 'BASE TABLE' },
        { schema: 'dbo', name: 'Products', kind: 'BASE TABLE' },
        { schema: 'dbo', name: 'Categories', kind: 'BASE TABLE' },
        { schema: 'dbo', name: 'v_ActiveUsers', kind: 'VIEW' },
        { schema: 'dbo', name: 'v_DailySales', kind: 'VIEW' },
      ] as unknown as T);

    case 'get_columns':
      return Promise.resolve([
        { name: 'UserID', dataType: 'int', maxLength: null, precision: 10, scale: 0, isNullable: false, isPrimaryKey: true, isIdentity: true },
        { name: 'Username', dataType: 'nvarchar', maxLength: 50, precision: null, scale: null, isNullable: false, isPrimaryKey: false, isIdentity: false },
        { name: 'Email', dataType: 'nvarchar', maxLength: 100, precision: null, scale: null, isNullable: true, isPrimaryKey: false, isIdentity: false },
        { name: 'Department', dataType: 'nvarchar', maxLength: 50, precision: null, scale: null, isNullable: true, isPrimaryKey: false, isIdentity: false },
        { name: 'IsActive', dataType: 'bit', maxLength: null, precision: 1, scale: 0, isNullable: false, isPrimaryKey: false, isIdentity: false },
        { name: 'CreatedAt', dataType: 'datetime2', maxLength: null, precision: 27, scale: 7, isNullable: false, isPrimaryKey: false, isIdentity: false },
      ] as unknown as T);

    default:
      return Promise.reject(new Error(`Unknown command '${cmd}'`));
  }
}
