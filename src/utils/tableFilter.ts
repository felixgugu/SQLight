export type FilterTarget = 'all' | 'database' | 'table';

export interface FilterRule {
  id: string;
  pattern: string;
  target: FilterTarget;
  enabled: boolean;
  description?: string;
}

export type HiddenTableRule = FilterRule;

export interface FilterPreset {
  label: string;
  pattern: string;
  target: FilterTarget;
  description: string;
}

export const DEFAULT_OBJECT_FILTER_PRESETS: FilterPreset[] = [
  // Database Presets
  {
    label: '系統資料庫',
    pattern: '^(master|model|msdb|tempdb)$',
    target: 'database',
    description: 'SQL Server 內建系統資料庫',
  },
  {
    label: '報表資料庫',
    pattern: '^ReportServer.*',
    target: 'database',
    description: 'SSRS 報表服務系統資料庫',
  },
  {
    label: '備份資料庫',
    pattern: '.*(_backup|_bak)$',
    target: 'database',
    description: '結尾為 backup 或 bak 之備份庫',
  },
  // Table Presets
  {
    label: '備份表',
    pattern: '^bak_|_backup$',
    target: 'table',
    description: '開頭 bak_ 或結尾 _backup 之備份資料表',
  },
  {
    label: '暫存表',
    pattern: '^tmp_|^temp_',
    target: 'table',
    description: '臨時暫存資料表',
  },
  {
    label: '遷移記錄表',
    pattern: '^__EFMigrationsHistory$',
    target: 'table',
    description: 'EF Core 結構遷移歷史記錄',
  },
  {
    label: '舊版棄用表',
    pattern: '.*_old$|.*_deprecated$',
    target: 'table',
    description: '舊版或棄用歸檔資料表',
  },
  // Generic Presets
  {
    label: '臨時測試物件',
    pattern: '^(test_|tmp_|temp_)',
    target: 'all',
    description: '開頭為 test_、tmp_ 或 temp_ 之庫或表',
  },
];

export const DEFAULT_TABLE_FILTER_PRESETS: FilterPreset[] = DEFAULT_OBJECT_FILTER_PRESETS;

export function validateRegexPattern(pattern: string): { isValid: boolean; error?: string } {
  const trimmed = pattern.trim();
  if (!trimmed) {
    return { isValid: false, error: '規則不可為空' };
  }
  try {
    new RegExp(trimmed, 'i');
    return { isValid: true };
  } catch (e: any) {
    return { isValid: false, error: e?.message || '無效的正規表示法' };
  }
}

export function isTableHiddenByRules(
  rules: readonly FilterRule[],
  tableName: string,
  schema?: string
): boolean {
  if (!tableName || !rules || rules.length === 0) return false;
  const fullName = schema ? `${schema}.${tableName}` : tableName;
  for (const rule of rules) {
    if (!rule.enabled || !rule.pattern) continue;
    const target = rule.target || 'all';
    if (target !== 'all' && target !== 'table') continue;

    try {
      const regex = new RegExp(rule.pattern, 'i');
      if (regex.test(tableName) || regex.test(fullName)) {
        return true;
      }
    } catch {
      // Ignore invalid regex patterns safely
    }
  }
  return false;
}

export function isDatabaseHiddenByRules(
  rules: readonly FilterRule[],
  databaseName: string
): boolean {
  if (!databaseName || !rules || rules.length === 0) return false;
  for (const rule of rules) {
    if (!rule.enabled || !rule.pattern) continue;
    const target = rule.target || 'all';
    if (target !== 'all' && target !== 'database') continue;

    try {
      const regex = new RegExp(rule.pattern, 'i');
      if (regex.test(databaseName)) {
        return true;
      }
    } catch {
      // Ignore invalid regex patterns safely
    }
  }
  return false;
}

export function testFilterPatternByRules(
  rules: readonly FilterRule[],
  name: string,
  targetType: 'database' | 'table',
  schema?: string
): { isHidden: boolean; matchedPattern?: string; matchedTarget?: FilterTarget } {
  if (!name || !rules || rules.length === 0) return { isHidden: false };
  const fullName = schema && targetType === 'table' ? `${schema}.${name}` : name;

  for (const rule of rules) {
    if (!rule.enabled || !rule.pattern) continue;
    const ruleTarget = rule.target || 'all';
    if (ruleTarget !== 'all' && ruleTarget !== targetType) continue;

    try {
      const regex = new RegExp(rule.pattern, 'i');
      if (regex.test(name) || (targetType === 'table' && regex.test(fullName))) {
        return { isHidden: true, matchedPattern: rule.pattern, matchedTarget: ruleTarget };
      }
    } catch {
      // Ignore invalid regex patterns safely
    }
  }
  return { isHidden: false };
}

export function testTablePatternByRules(
  rules: readonly FilterRule[],
  tableName: string,
  schema?: string
): { isHidden: boolean; matchedPattern?: string; matchedTarget?: FilterTarget } {
  return testFilterPatternByRules(rules, tableName, 'table', schema);
}
