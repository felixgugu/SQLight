import { invokeCommand } from './api';
import type { SqlTemplate, CustomTemplatesPayload } from '@/types/sqlTemplate';

export const templateService = {
  /**
   * Loads custom templates from the application-co-located file (sql_custom_templates.json).
   */
  async loadCustomTemplates(): Promise<CustomTemplatesPayload> {
    return await invokeCommand<CustomTemplatesPayload>('load_custom_templates');
  },

  /**
   * Saves custom templates back to the co-located file.
   */
  async saveCustomTemplates(templates: SqlTemplate[]): Promise<string> {
    return await invokeCommand<string>('save_custom_templates', { templates });
  },

  /**
   * Opens the custom templates file in Windows File Explorer or the default editor.
   */
  async openCustomTemplatesFile(): Promise<string> {
    return await invokeCommand<string>('open_custom_templates_file');
  },
};
