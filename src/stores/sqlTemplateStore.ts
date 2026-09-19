import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import type { SqlTemplate, SqlTemplateCategory } from '@/types/sqlTemplate';
import { BUILTIN_SQL_TEMPLATES } from '@/data/sqlTemplates';
import { templateService } from '@/services/templateService';

export const useSqlTemplateStore = defineStore('sqlTemplate', () => {
  const customFilePath = ref<string>('');
  const customTemplates = ref<SqlTemplate[]>([]);
  const activeCategory = ref<SqlTemplateCategory>('all');
  const searchQuery = ref<string>('');
  const selectedTemplateId = ref<string | null>(null);
  const isLoading = ref<boolean>(false);
  const hasLoaded = ref<boolean>(false);

  /**
   * Merged list of built-in templates and user custom templates from file.
   */
  const allTemplates = computed<SqlTemplate[]>(() => {
    return [...BUILTIN_SQL_TEMPLATES, ...customTemplates.value];
  });

  /**
   * Counts of templates per category.
   */
  const categoryCounts = computed(() => {
    const counts: Record<SqlTemplateCategory, number> = {
      all: allTemplates.value.length,
      basic: 0,
      cte: 0,
      advanced: 0,
      maintenance: 0,
      inspection: 0,
      custom: 0,
    };

    for (const t of allTemplates.value) {
      if (t.isCustom) {
        counts.custom++;
      }
      if (t.category in counts) {
        counts[t.category]++;
      }
    }
    return counts;
  });

  /**
   * Filtered & scored template list based on activeCategory and searchQuery.
   */
  const filteredTemplates = computed<SqlTemplate[]>(() => {
    const q = searchQuery.value.trim().toLowerCase();
    const cat = activeCategory.value;

    return allTemplates.value
      .filter((t) => {
        // 1. Category Filter
        if (cat === 'custom') {
          if (!t.isCustom && t.category !== 'custom') return false;
        } else if (cat !== 'all') {
          if (t.category !== cat) return false;
        }

        // 2. Search Query Filter
        if (!q) return true;

        const titleLower = t.title.toLowerCase();
        const descLower = t.description.toLowerCase();
        const codeLower = t.code.toLowerCase();
        const tagsLower = t.tags.map((tag) => tag.toLowerCase());

        return (
          titleLower.includes(q) ||
          descLower.includes(q) ||
          codeLower.includes(q) ||
          tagsLower.some((tag) => tag.includes(q))
        );
      })
      .sort((a, b) => {
        if (!q) return 0;
        // Prioritize title match over description/code match
        const aTitle = a.title.toLowerCase().indexOf(q);
        const bTitle = b.title.toLowerCase().indexOf(q);

        if (aTitle !== -1 && bTitle === -1) return -1;
        if (bTitle !== -1 && aTitle === -1) return 1;
        if (aTitle !== -1 && bTitle !== -1) return aTitle - bTitle;

        // Then prioritize tag match
        const aTag = a.tags.some((t) => t.toLowerCase().includes(q));
        const bTag = b.tags.some((t) => t.toLowerCase().includes(q));
        if (aTag && !bTag) return -1;
        if (bTag && !aTag) return 1;

        return 0;
      });
  });

  /**
   * Currently active/previewed template.
   */
  const selectedTemplate = computed<SqlTemplate | null>(() => {
    if (selectedTemplateId.value) {
      const found = allTemplates.value.find((t) => t.id === selectedTemplateId.value);
      if (found) return found;
    }
    return filteredTemplates.value[0] || allTemplates.value[0] || null;
  });

  /**
   * Load custom templates from sql_custom_templates.json.
   */
  async function loadTemplates(force = false) {
    if (hasLoaded.value && !force) return;
    isLoading.value = true;
    try {
      const payload = await templateService.loadCustomTemplates();
      customFilePath.value = payload.filePath;
      customTemplates.value = payload.templates.map((item) => ({
        ...item,
        isCustom: true,
      }));
      hasLoaded.value = true;
      if (!selectedTemplateId.value && allTemplates.value.length > 0) {
        selectedTemplateId.value = allTemplates.value[0]?.id ?? null;
      }
    } catch (err) {
      console.warn('[sqlTemplateStore] Failed to load custom templates from file:', err);
    } finally {
      isLoading.value = false;
    }
  }

  /**
   * Add a new custom template and persist to file.
   */
  async function addCustomTemplate(
    item: Omit<SqlTemplate, 'id' | 'isCustom' | 'createdAt'>
  ): Promise<SqlTemplate> {
    const newTemplate: SqlTemplate = {
      ...item,
      id: `custom-${Date.now()}`,
      isCustom: true,
      createdAt: Date.now(),
      categoryLabel: item.categoryLabel || (item.category === 'custom' ? '自訂範本' : item.category),
    };

    customTemplates.value.push(newTemplate);
    selectedTemplateId.value = newTemplate.id;

    try {
      await templateService.saveCustomTemplates(customTemplates.value);
    } catch (err) {
      console.error('[sqlTemplateStore] Failed to save new custom template to file:', err);
    }

    return newTemplate;
  }

  /**
   * Update an existing custom template and persist to file.
   */
  async function updateCustomTemplate(id: string, updates: Partial<SqlTemplate>) {
    const index = customTemplates.value.findIndex((t) => t.id === id);
    if (index !== -1 && customTemplates.value[index]) {
      const existing = customTemplates.value[index]!;
      customTemplates.value[index] = {
        ...existing,
        ...updates,
        id: existing.id,
      };
      try {
        await templateService.saveCustomTemplates(customTemplates.value);
      } catch (err) {
        console.error('[sqlTemplateStore] Failed to update custom template in file:', err);
      }
    }
  }


  /**
   * Delete a custom template and persist to file.
   */
  async function deleteCustomTemplate(id: string) {
    customTemplates.value = customTemplates.value.filter((t) => t.id !== id);
    if (selectedTemplateId.value === id) {
      selectedTemplateId.value = filteredTemplates.value[0]?.id || null;
    }
    try {
      await templateService.saveCustomTemplates(customTemplates.value);
    } catch (err) {
      console.error('[sqlTemplateStore] Failed to persist template deletion:', err);
    }
  }

  /**
   * Open the custom templates file in Windows File Explorer.
   */
  async function openInExplorer() {
    try {
      const path = await templateService.openCustomTemplatesFile();
      if (path) {
        customFilePath.value = path;
      }
    } catch (err) {
      console.warn('[sqlTemplateStore] Failed to open in explorer:', err);
    }
  }

  return {
    customFilePath,
    customTemplates,
    activeCategory,
    searchQuery,
    selectedTemplateId,
    isLoading,
    allTemplates,
    categoryCounts,
    filteredTemplates,
    selectedTemplate,
    loadTemplates,
    addCustomTemplate,
    updateCustomTemplate,
    deleteCustomTemplate,
    openInExplorer,
  };
});
