export type SqlTemplateCategory = 'all' | 'basic' | 'cte' | 'advanced' | 'maintenance' | 'inspection' | 'custom';

export interface SqlTemplate {
  id: string;
  title: string;
  category: SqlTemplateCategory;
  categoryLabel: string;
  tags: string[];
  description: string;
  code: string;
  isCustom?: boolean;
  createdAt?: number;
}

export interface CustomTemplatesPayload {
  filePath: string;
  templates: SqlTemplate[];
}
