import { invokeCommand } from './api';
import type { SqlFileNode } from '@/types/sqlFolder';

export const sqlFolderService = {
  /**
   * Opens the native OS folder picker dialog to select a folder
   */
  async pickFolder(): Promise<string | null> {
    return invokeCommand<string | null>('pick_sql_folder');
  },

  /**
   * Scans a directory and returns its tree of folders and .sql files (empty folders pruned)
   */
  async scanFolder(folderPath: string): Promise<SqlFileNode> {
    return invokeCommand<SqlFileNode>('scan_sql_folder', { folderPath });
  },

  /**
   * Reads a .sql file from disk (handles UTF-8, UTF-8 BOM, and UTF-16 LE/BE)
   */
  async readFile(filePath: string): Promise<string> {
    return invokeCommand<string>('read_sql_file', { filePath });
  },

  /**
   * Writes/overwrites a .sql file in place without prompt
   */
  async writeFile(filePath: string, content: string): Promise<void> {
    return invokeCommand<void>('write_sql_file', { filePath, content });
  },
};
