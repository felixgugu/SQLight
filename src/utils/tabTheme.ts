import type { TabType } from '@/types/workspace';

export interface TabCategoryColors {
  bg: string;
  border: string;
  topAccent: string;
  text: string;
  badgeBg: string;
  hoverBg?: string;
  hoverBorder?: string;
  hoverText?: string;
}

export interface TabCategoryTheme {
  type: TabType;
  label: string;
  active: TabCategoryColors;
  inactive: Required<TabCategoryColors>;
  iconColor: string;
}

export const TAB_CATEGORY_THEMES: Record<TabType, TabCategoryTheme> = {
  sql_editor: {
    type: 'sql_editor',
    label: 'SQL 查詢',
    active: {
      bg: '#1e40af', // Royal Blue 800
      border: '#3b82f6', // Blue 500
      topAccent: '#60a5fa', // Blue 400
      text: '#ffffff',
      badgeBg: 'rgba(0, 0, 0, 0.3)',
    },
    inactive: {
      bg: 'rgba(30, 58, 138, 0.22)',
      border: 'rgba(59, 130, 246, 0.28)',
      topAccent: '#3b82f6',
      text: '#94a3b8',
      hoverBg: 'rgba(30, 58, 138, 0.42)',
      hoverBorder: 'rgba(59, 130, 246, 0.55)',
      hoverText: '#f8fafc',
      badgeBg: 'rgba(15, 23, 42, 0.65)',
    },
    iconColor: '#60a5fa',
  },
  table_data: {
    type: 'table_data',
    label: '表格資料',
    active: {
      bg: '#065f46', // Emerald 800
      border: '#10b981', // Emerald 500
      topAccent: '#34d399', // Emerald 400
      text: '#ffffff',
      badgeBg: 'rgba(0, 0, 0, 0.3)',
    },
    inactive: {
      bg: 'rgba(6, 78, 59, 0.22)',
      border: 'rgba(16, 185, 129, 0.28)',
      topAccent: '#10b981',
      text: '#94a3b8',
      hoverBg: 'rgba(6, 78, 59, 0.42)',
      hoverBorder: 'rgba(16, 185, 129, 0.55)',
      hoverText: '#f8fafc',
      badgeBg: 'rgba(15, 23, 42, 0.65)',
    },
    iconColor: '#34d399',
  },
  table_structure: {
    type: 'table_structure',
    label: '表格結構',
    active: {
      bg: '#3730a3', // Indigo 800
      border: '#6366f1', // Indigo 500
      topAccent: '#818cf8', // Indigo 400
      text: '#ffffff',
      badgeBg: 'rgba(0, 0, 0, 0.3)',
    },
    inactive: {
      bg: 'rgba(49, 46, 129, 0.22)',
      border: 'rgba(99, 102, 241, 0.28)',
      topAccent: '#6366f1',
      text: '#94a3b8',
      hoverBg: 'rgba(49, 46, 129, 0.42)',
      hoverBorder: 'rgba(99, 102, 241, 0.55)',
      hoverText: '#f8fafc',
      badgeBg: 'rgba(15, 23, 42, 0.65)',
    },
    iconColor: '#818cf8',
  },
  execution_plan: {
    type: 'execution_plan',
    label: '執行計畫',
    active: {
      bg: '#581c87', // Purple 900
      border: '#a855f7', // Purple 500
      topAccent: '#c084fc', // Purple 400
      text: '#ffffff',
      badgeBg: 'rgba(0, 0, 0, 0.3)',
    },
    inactive: {
      bg: 'rgba(59, 7, 100, 0.22)',
      border: 'rgba(168, 85, 247, 0.28)',
      topAccent: '#a855f7',
      text: '#94a3b8',
      hoverBg: 'rgba(59, 7, 100, 0.42)',
      hoverBorder: 'rgba(168, 85, 247, 0.55)',
      hoverText: '#f8fafc',
      badgeBg: 'rgba(15, 23, 42, 0.65)',
    },
    iconColor: '#c084fc',
  },
  er_diagram: {
    type: 'er_diagram',
    label: 'ER 關聯圖',
    active: {
      bg: '#155e75', // Cyan 800
      border: '#06b6d4', // Cyan 500
      topAccent: '#22d3ee', // Cyan 400
      text: '#ffffff',
      badgeBg: 'rgba(0, 0, 0, 0.3)',
    },
    inactive: {
      bg: 'rgba(22, 78, 99, 0.22)',
      border: 'rgba(6, 182, 212, 0.28)',
      topAccent: '#06b6d4',
      text: '#94a3b8',
      hoverBg: 'rgba(22, 78, 99, 0.42)',
      hoverBorder: 'rgba(6, 182, 212, 0.55)',
      hoverText: '#f8fafc',
      badgeBg: 'rgba(15, 23, 42, 0.65)',
    },
    iconColor: '#22d3ee',
  },
};

/**
 * Computes CSS variable styling for a tab given its type, active state, and optional SQL overrides.
 */
export function getTabThemeStyle(
  type: TabType,
  isActive: boolean,
  customSqlBg?: string,
  customSqlText?: string,
  isLight = false
): Record<string, string> {
  const theme = TAB_CATEGORY_THEMES[type] || TAB_CATEGORY_THEMES.sql_editor;

  if (isActive) {
    const isCustom = Boolean(type === 'sql_editor' && customSqlBg && customSqlBg !== '#1e40af');
    const bg = type === 'sql_editor' && customSqlBg ? customSqlBg : theme.active.bg;
    const text = type === 'sql_editor' && customSqlText ? customSqlText : theme.active.text;
    const border = type === 'sql_editor' && customSqlBg ? customSqlBg : theme.active.border;
    const topAccent = type === 'sql_editor' && customSqlBg ? customSqlBg : theme.active.topAccent;

    return {
      '--tab-bg': bg,
      '--tab-hover-bg': bg,
      '--tab-border': border,
      '--tab-hover-border': border,
      '--tab-top-accent': topAccent,
      '--tab-text': text,
      '--tab-hover-text': text,
      '--tab-badge-bg': theme.active.badgeBg,
      '--tab-icon-color': text,
      '--tab-active-surface': isCustom ? bg : (isLight ? '#ffffff' : 'rgb(var(--color-dark-900))'),
      '--tab-active-text': isCustom && customSqlText ? customSqlText : (isLight ? '#0f172a' : '#f0f0f5'),
    };
  }

  return {
    '--tab-bg': isLight ? 'rgba(226, 232, 240, 0.6)' : theme.inactive.bg,
    '--tab-hover-bg': isLight ? 'rgba(203, 213, 225, 0.7)' : theme.inactive.hoverBg,
    '--tab-border': isLight ? 'rgba(203, 213, 225, 0.8)' : theme.inactive.border,
    '--tab-hover-border': isLight ? 'rgba(148, 163, 184, 0.9)' : theme.inactive.hoverBorder,
    '--tab-top-accent': theme.inactive.topAccent,
    '--tab-text': isLight ? '#475569' : theme.inactive.text,
    '--tab-hover-text': isLight ? '#0f172a' : theme.inactive.hoverText,
    '--tab-badge-bg': isLight ? 'rgba(203, 213, 225, 0.8)' : theme.inactive.badgeBg,
    '--tab-icon-color': theme.iconColor,
  };
}
