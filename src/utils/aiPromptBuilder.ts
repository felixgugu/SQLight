/**
 * AI Prompt Builder Utility
 * 
 * Provides pure utility functions for:
 * 1. Diagnosing SQL execution errors (Error Diagnosis)
 * 2. Extracting insights from ShowPlanXML (Missing Indexes, Warnings, Top Operators)
 * 3. Building Execution Plan Tuning prompts
 * 4. Building Execution Stats (IO / TIME) Advice prompts
 */

export interface ErrorDiagnosisContext {
  message: string;
  code?: number;
  lineNumber?: number;
  sql?: string;
  database?: string;
}

export interface MissingIndexInfo {
  impact?: string;
  database?: string;
  schema?: string;
  table?: string;
  equalityColumns: string[];
  inequalityColumns: string[];
  includeColumns: string[];
}

export interface PlanOperatorInfo {
  physicalOp: string;
  logicalOp?: string;
  cost: number;
  nodeId?: string;
  estimatedRows?: number;
  targetObject?: string;
}

export interface PlanInsights {
  missingIndexes: MissingIndexInfo[];
  warnings: string[];
  topOperators: PlanOperatorInfo[];
}

export interface PlanAdviceContext {
  sql: string;
  planXml?: string;
  durationMs?: number;
  database?: string;
}

export interface TableStatItem {
  tableName: string;
  scanCount: number;
  logicalReads: number;
  physicalReads: number;
  readAheadReads: number;
  bytesFormatted: string;
  isHighIo?: boolean;
}

export interface WaitStatContext {
  waitType: string;
  waitingTasksCount: number;
  waitTimeMs: number;
  maxWaitTimeMs: number;
}

export interface StatsAdviceContext {
  sql: string;
  cpuTimeMs: number;
  elapsedTimeMs: number;
  compileCpuTimeMs?: number;
  compileElapsedTimeMs?: number;
  totalLogicalReads: number;
  logicalReadsFormatted: string;
  totalPhysicalReads: number;
  cacheHitRatio: number;
  tableStats: TableStatItem[];
  waitStats?: WaitStatContext[];
  database?: string;
}

/**
 * Builds a structured diagnostic prompt for SQL errors.
 */
export function buildErrorDiagnosisPrompt(ctx: ErrorDiagnosisContext): string {
  const parts: string[] = [
    '請針對以下 Microsoft SQL Server (T-SQL) 執行錯誤進行深入診斷並提供修正方案：',
    '',
    '【錯誤資訊】：',
  ];

  if (ctx.code !== undefined && ctx.code !== null) {
    parts.push(`- 錯誤代碼：Msg ${ctx.code}`);
  }
  if (ctx.lineNumber !== undefined && ctx.lineNumber !== null) {
    parts.push(`- 錯誤行號：Line ${ctx.lineNumber}`);
  }
  if (ctx.database) {
    parts.push(`- 目標資料庫：${ctx.database}`);
  }
  parts.push(`- 錯誤訊息：\n${ctx.message.trim()}`);
  parts.push('');

  parts.push('【執行的 SQL 語法】：');
  if (ctx.sql && ctx.sql.trim()) {
    parts.push('```sql');
    parts.push(ctx.sql.trim());
    parts.push('```');
  } else {
    parts.push('(未提供具體 SQL 語法，請根據上述錯誤訊息進行通用分析)');
  }
  parts.push('');

  parts.push('【請提供】：');
  parts.push('1. 💡 **錯誤根本原因分析**：說明為何 SQL Server 會拋出此錯誤（如語法順序、欄位缺失、GROUP BY 聚合條件、外鍵約束或資料型別不合等）。');
  parts.push('2. 🛠️ **修復後的完整 T-SQL 語法**：給出修訂完成且可直接執行的正確 SQL 程式碼。若有多種修正方案，請分別列出並說明優缺點。');
  parts.push('3. 📌 **防範建議與最佳實踐**：如何避免未來再次發生類似問題。');

  return parts.join('\n');
}

/**
 * Extracts high-value insights (missing indexes, warnings, top cost operators) from a ShowPlanXML string.
 * Uses regex scanning for broad compatibility across browser and Node.js environments.
 */
export function extractPlanInsights(xml?: string | null): PlanInsights {
  const insights: PlanInsights = {
    missingIndexes: [],
    warnings: [],
    topOperators: [],
  };

  if (!xml || typeof xml !== 'string' || !xml.trim()) {
    return insights;
  }

  // 1. Missing Indexes Extraction
  const missingGroupRegex = /<MissingIndexGroup\s+Impact="([^"]+)"[\s\S]*?<\/MissingIndexGroup>/gi;
  let groupMatch: RegExpExecArray | null;

  while ((groupMatch = missingGroupRegex.exec(xml)) !== null) {
    const groupContent = groupMatch[0];
    const impact = groupMatch[1];

    const indexRegex = /<MissingIndex\s+Database="([^"]*)"\s+Schema="([^"]*)"\s+Table="([^"]*)"/i;
    const indexMatch = groupContent.match(indexRegex);

    const equalityColumns: string[] = [];
    const inequalityColumns: string[] = [];
    const includeColumns: string[] = [];

    const columnGroupRegex = /<ColumnGroup\s+Usage="(EQUALITY|INEQUALITY|INCLUDE)">([\s\S]*?)<\/ColumnGroup>/gi;
    let colGroupMatch: RegExpExecArray | null;

    while ((colGroupMatch = columnGroupRegex.exec(groupContent)) !== null) {
      const usage = (colGroupMatch[1] || '').toUpperCase();
      const colsXml = colGroupMatch[2] || '';
      const colNameRegex = /<Column\s+Name="([^"]+)"/gi;
      let colNameMatch: RegExpExecArray | null;
      while ((colNameMatch = colNameRegex.exec(colsXml)) !== null) {
        const colName = colNameMatch[1];
        if (colName) {
          if (usage === 'EQUALITY') equalityColumns.push(colName);
          else if (usage === 'INEQUALITY') inequalityColumns.push(colName);
          else if (usage === 'INCLUDE') includeColumns.push(colName);
        }
      }
    }

    insights.missingIndexes.push({
      impact,
      database: indexMatch?.[1] || '',
      schema: indexMatch?.[2] || '',
      table: indexMatch?.[3] || '',
      equalityColumns,
      inequalityColumns,
      includeColumns,
    });
  }

  // 2. Warnings Extraction
  if (/SpillToTempDb="true"/i.test(xml)) {
    insights.warnings.push('偵測到記憶體不足溢出至 TempDB 警告 (SpillToTempDb: 記憶體配置不足導致排序或雜湊運算溢出至磁碟)');
  }
  if (/NoJoinPredicate="true"/i.test(xml)) {
    insights.warnings.push('偵測到缺少連接述詞警告 (NoJoinPredicate: 可能發生非預期的笛卡兒乘積 Cartesian Product)');
  }
  if (/UnmatchedIndexes="true"/i.test(xml)) {
    insights.warnings.push('偵測到未匹配索引警告 (UnmatchedIndexes: 查詢最佳化工具因參數化或複雜運算無法使用現有篩選索引)');
  }
  if (/<ColumnsWithNoStatistics/i.test(xml)) {
    insights.warnings.push('偵測到欄位缺少統計資訊 (ColumnsWithNoStatistics: 可能導致估計列數失真，建議更新統計資訊)');
  }
  if (/<MemoryGrantWarning/i.test(xml)) {
    insights.warnings.push('偵測到記憶體授與警告 (MemoryGrantWarning: 記憶體過度配置或配置不足)');
  }
  if (/PlanAffectingConvert/i.test(xml)) {
    insights.warnings.push('偵測到隱式型別轉換警告 (PlanAffectingConvert: 資料型別不一致導致無法有效使用索引搜尋 Seek)');
  }

  // 3. Top Cost Operators Extraction
  const relOpRegex = /<RelOp\s+NodeId="([^"]+)"\s+PhysicalOp="([^"]+)"(?:\s+LogicalOp="([^"]+)")?[\s\S]*?EstimatedTotalSubtreeCost="([^"]+)"(?:\s+EstimateRows="([^"]+)")?([\s\S]*?)<\/RelOp>/gi;
  let relOpMatch: RegExpExecArray | null;
  const rawOps: PlanOperatorInfo[] = [];

  while ((relOpMatch = relOpRegex.exec(xml)) !== null) {
    const nodeId = relOpMatch[1] || '';
    const physicalOp = relOpMatch[2] || '';
    const logicalOp = relOpMatch[3] || physicalOp;
    const cost = parseFloat(relOpMatch[4] || '0');
    const estimatedRows = relOpMatch[5] ? parseFloat(relOpMatch[5]) : undefined;
    const restXml = relOpMatch[6] || '';

    // Try finding target object table name
    const objMatch = restXml.match(/<Object\s+Table="([^"]+)"/i);
    const targetObject = objMatch?.[1];

    if (!isNaN(cost) && cost > 0) {
      rawOps.push({
        nodeId,
        physicalOp,
        logicalOp,
        cost,
        estimatedRows,
        targetObject,
      });
    }
  }

  // Sort descending by cost and take top 5 unique operators
  rawOps.sort((a, b) => b.cost - a.cost);
  const seenOps = new Set<string>();
  for (const op of rawOps) {
    const key = `${op.physicalOp}-${op.targetObject || ''}-${op.cost.toFixed(3)}`;
    if (!seenOps.has(key)) {
      seenOps.add(key);
      insights.topOperators.push(op);
      if (insights.topOperators.length >= 5) break;
    }
  }

  return insights;
}

/**
 * Builds a structured prompt for AI Execution Plan Tuning advice.
 */
export function buildExecutionPlanAdvicePrompt(ctx: PlanAdviceContext): string {
  const parts: string[] = [
    '請針對以下 Microsoft SQL Server (T-SQL) 查詢及其「實際執行計畫 (Execution Plan)」進行效能調校與優化分析：',
    '',
  ];

  if (ctx.durationMs !== undefined) {
    parts.push(`- 執行耗時：${ctx.durationMs} ms`);
  }
  if (ctx.database) {
    parts.push(`- 資料庫：${ctx.database}`);
  }

  const insights = extractPlanInsights(ctx.planXml);

  if (insights.warnings.length > 0) {
    parts.push('');
    parts.push('⚠️ 【執行計畫關鍵警告】：');
    for (const w of insights.warnings) {
      parts.push(`  • ${w}`);
    }
  }

  if (insights.missingIndexes.length > 0) {
    parts.push('');
    parts.push('⚡ 【SQL Server 引擎建議之缺失索引 (Missing Indexes)】：');
    for (const mi of insights.missingIndexes) {
      const impactStr = mi.impact ? ` (預估效益提升: ${parseFloat(mi.impact).toFixed(1)}%)` : '';
      const tableStr = mi.table ? `${mi.schema ? mi.schema + '.' : ''}${mi.table}` : '目標資料表';
      parts.push(`  • 目標表: ${tableStr}${impactStr}`);
      if (mi.equalityColumns.length > 0) {
        parts.push(`    - 等值欄位 (Equality): ${mi.equalityColumns.join(', ')}`);
      }
      if (mi.inequalityColumns.length > 0) {
        parts.push(`    - 不等值欄位 (Inequality): ${mi.inequalityColumns.join(', ')}`);
      }
      if (mi.includeColumns.length > 0) {
        parts.push(`    - 包含欄位 (Include): ${mi.includeColumns.join(', ')}`);
      }

      // Generate suggested index statement
      const cleanTable = tableStr.replace(/[\[\]]/g, '');
      const keyCols = [...mi.equalityColumns, ...mi.inequalityColumns];
      if (keyCols.length > 0 && keyCols[0]) {
        const cleanKey = keyCols[0].replace(/[\[\]]/g, '');
        const indexName = `IX_${cleanTable}_${cleanKey}`;
        let ddl = `CREATE NONCLUSTERED INDEX [${indexName}] ON ${tableStr} (${keyCols.join(', ')})`;
        if (mi.includeColumns.length > 0) {
          ddl += ` INCLUDE (${mi.includeColumns.join(', ')})`;
        }
        parts.push(`    - 參考建立語法: \`${ddl}\``);
      }
    }
  }

  if (insights.topOperators.length > 0) {
    parts.push('');
    parts.push('🔍 【主要耗時運算子 (Top Cost Operators)】：');
    for (let i = 0; i < insights.topOperators.length; i++) {
      const op = insights.topOperators[i];
      if (!op) continue;
      const targetStr = op.targetObject ? ` [${op.targetObject}]` : '';
      const rowsStr = op.estimatedRows ? ` (預估 ${op.estimatedRows.toLocaleString()} 列)` : '';
      parts.push(`  ${i + 1}. **${op.physicalOp}**${targetStr} — 預估子樹成本: ${op.cost.toFixed(4)}${rowsStr}`);
    }
  }

  parts.push('');
  parts.push('【原始 T-SQL 查詢語法】：');
  parts.push('```sql');
  parts.push(ctx.sql.trim());
  parts.push('```');
  parts.push('');

  parts.push('【請提供】：');
  parts.push('1. 🔍 **執行計畫效能瓶頸深入診斷**：針對上述耗時最高之運算子、掃描方式（如 Clustered/Table Scan、Hash Match 等）以及警告事項進行成因分析。');
  parts.push('2. ⚡ **索引最佳化策略**：評估缺失索引或既有索引是否合宜，提供最精確的索引建立指令與覆蓋索引設計。');
  parts.push('3. 🚀 **SQL 語句重構調校建言**：提供改寫後的完整 T-SQL 程式碼（例如消除全表掃描、改寫子查詢/JOIN、避免隱式轉換或暫存表重構等），並評估預期效益。');

  return parts.join('\n');
}

/**
 * Builds a structured prompt for AI Execution Stats (STATISTICS IO & TIME) advice.
 */
export function buildExecutionStatsAdvicePrompt(ctx: StatsAdviceContext): string {
  const parts: string[] = [
    '請針對以下 Microsoft SQL Server 之「STATISTICS IO & TIME 執行統計資料」進行效能調校分析與建議：',
    '',
    '【核心效能 KPI 指標】：',
    `- CPU 耗時: ${ctx.cpuTimeMs} ms (編譯 CPU: ${ctx.compileCpuTimeMs ?? 0} ms)`,
    `- 總執行耗時: ${ctx.elapsedTimeMs} ms (編譯耗時: ${ctx.compileElapsedTimeMs ?? 0} ms)`,
    `- 總邏輯讀取: ${ctx.totalLogicalReads.toLocaleString()} 頁 (${ctx.logicalReadsFormatted})`,
    `- 總實體讀取: ${ctx.totalPhysicalReads.toLocaleString()} 頁`,
    `- 快取命中率: ${ctx.cacheHitRatio}%`,
  ];

  if (ctx.database) {
    parts.push(`- 目標資料庫: ${ctx.database}`);
  }

  if (ctx.tableStats.length > 0) {
    parts.push('');
    parts.push('【各資料表 IO 讀取明細】：');
    parts.push('| 資料表名稱 | 掃描次數 | 邏輯讀取 | 實體讀取 | 預讀 | 容量換算 |');
    parts.push('| :--- | :---: | :---: | :---: | :---: | :---: |');
    for (const t of ctx.tableStats) {
      const highIoTag = t.isHighIo ? ' ⚠️ (高讀取)' : '';
      parts.push(`| ${t.tableName}${highIoTag} | ${t.scanCount} | ${t.logicalReads.toLocaleString()} | ${t.physicalReads.toLocaleString()} | ${t.readAheadReads.toLocaleString()} | ${t.bytesFormatted} |`);
    }
  }

  if (ctx.waitStats && ctx.waitStats.length > 0) {
    parts.push('');
    parts.push('【工作階段等候事件 (Wait Stats)】：');
    parts.push('| 等候類型 | 等候次數 | 總等候時間 (ms) | 最大單次 (ms) |');
    parts.push('| :--- | :---: | :---: | :---: |');
    for (const w of ctx.waitStats) {
      parts.push(`| ${w.waitType} | ${w.waitingTasksCount} | ${w.waitTimeMs} | ${w.maxWaitTimeMs} |`);
    }
  }

  parts.push('');
  parts.push('【原始 T-SQL 查詢語法】：');
  parts.push('```sql');
  parts.push(ctx.sql.trim());
  parts.push('```');
  parts.push('');

  parts.push('【請提供】：');
  parts.push('1. 📊 **IO 消耗與效能瓶頸評估**：針對高讀取資料表、多重掃描與等候事件進行成因診斷。');
  parts.push('2. 🎯 **索引與覆蓋索引最佳化建議**：評估現有讀取是否可藉由索引搜尋 (Index Seek) 消除資料表掃描，並提供具體 `CREATE INDEX` 語句。');
  parts.push('3. ⚡ **SQL 查詢重構調優**：提供重寫後的完整 T-SQL 程式碼與調校對策。');

  return parts.join('\n');
}
