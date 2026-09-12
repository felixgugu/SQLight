export interface TableIoStats {
  tableName: string;
  scanCount: number;
  logicalReads: number;
  physicalReads: number;
  readAheadReads: number;
  lobLogicalReads: number;
  lobPhysicalReads: number;
  lobReadAheadReads: number;
  totalReads: number;
  bytesFormatted: string;
  isHighIo: boolean;
}

export interface WaitStatItem {
  waitType: string;
  waitingTasksCount: number;
  waitTimeMs: number;
  maxWaitTimeMs: number;
}

export interface PerfTelemetrySummary {
  elapsedTimeMs: number;
  cpuTimeMs: number;
  logicalReads: number;
  physicalReads: number;
  physicalWrites: number;
}

export interface ExecutionStatsData {
  id: string;
  querySql: string;
  executedAt: string;
  
  // Timing
  cpuTimeMs: number;
  elapsedTimeMs: number;
  compileCpuTimeMs?: number;
  compileElapsedTimeMs?: number;
  
  // Overall IO
  totalLogicalReads: number;
  totalPhysicalReads: number;
  totalPhysicalWrites: number;
  totalReadAheadReads: number;
  totalLobReads: number;
  
  // Formatted representations
  logicalReadsFormatted: string;
  physicalReadsFormatted: string;
  
  // Cache Hit Ratio estimate (0 - 100%)
  cacheHitRatio: number;
  
  // Per-Table Breakdown
  tableStats: TableIoStats[];
  
  // Session Wait Stats
  waitStats: WaitStatItem[];
}

/**
 * Formats raw bytes to human readable format (e.g. 10.5 MB)
 */
export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  const val = bytes / Math.pow(k, i);
  const decimals = Number.isInteger(val) || val >= 100 || i === 0 ? 0 : 1;
  return `${val.toFixed(decimals)} ${sizes[i]}`;
}

/**
 * In SQL Server, 1 database page = 8 KB (8192 bytes).
 * Converts page count to human readable formatted string: e.g. "1,200 頁 (9.38 MB)"
 */
export function formatPageSize(pages: number): string {
  const bytes = pages * 8192;
  const formattedBytes = formatBytes(bytes);
  return `${pages.toLocaleString()} 頁 (${formattedBytes})`;
}

/**
 * Regex for SQL Server STATISTICS IO line:
 * e.g.: Table 'Customers'. Scan count 1, logical reads 35, physical reads 2, read-ahead reads 0, lob logical reads 0, lob physical reads 0, lob read-ahead reads 0.
 */
const TABLE_IO_REGEX = /Table\s+'([^']+)'\.\s+Scan\s+count\s+(\d+),\s+logical\s+reads\s+(\d+),\s+physical\s+reads\s+(\d+)(?:,\s+page\s+server\s+reads\s+\d+)?[^,]*(?:,\s+read-ahead\s+reads\s+(\d+))?[^,]*(?:,\s+lob\s+logical\s+reads\s+(\d+))?[^,]*(?:,\s+lob\s+physical\s+reads\s+(\d+))?[^,]*(?:,\s+lob\s+read-ahead\s+reads\s+(\d+))?/i;

/**
 * Regex for SQL Server STATISTICS TIME lines:
 * e.g.: SQL Server Execution Times:   CPU time = 16 ms,  elapsed time = 35 ms.
 * e.g.: SQL Server parse and compile time:   CPU time = 0 ms, elapsed time = 2 ms.
 */
const EXECUTION_TIMES_GLOBAL_REGEX = /SQL\s+Server\s+Execution\s+Times:?\s*(?:\r?\n\s*)?CPU\s+time\s+=\s+(\d+)\s+ms,\s+elapsed\s+time\s+=\s+(\d+)\s+ms/gi;
const COMPILE_TIMES_GLOBAL_REGEX = /SQL\s+Server\s+parse\s+and\s+compile\s+time:?\s*(?:\r?\n\s*)?CPU\s+time\s+=\s+(\d+)\s+ms,\s+elapsed\s+time\s+=\s+(\d+)\s+ms/gi;

/**
 * Parses raw text messages returned by SQL Server for STATISTICS IO and STATISTICS TIME
 */
export function parseStatisticsMessages(messages: string[]): {
  tableStats: TableIoStats[];
  cpuTimeMs?: number;
  elapsedTimeMs?: number;
  compileCpuTimeMs?: number;
  compileElapsedTimeMs?: number;
} {
  const tableStatsMap = new Map<string, TableIoStats>();
  let cpuTimeMs: number | undefined;
  let elapsedTimeMs: number | undefined;
  let compileCpuTimeMs: number | undefined;
  let compileElapsedTimeMs: number | undefined;

  for (const rawMsg of messages) {
    if (!rawMsg) continue;

    // 1. Check Execution Times (may span multiple lines in raw message)
    for (const execMatch of rawMsg.matchAll(EXECUTION_TIMES_GLOBAL_REGEX)) {
      cpuTimeMs = (cpuTimeMs ?? 0) + parseInt(execMatch[1] || '0', 10);
      elapsedTimeMs = (elapsedTimeMs ?? 0) + parseInt(execMatch[2] || '0', 10);
    }

    // 2. Check Parse and Compile Time (may span multiple lines in raw message)
    for (const compileMatch of rawMsg.matchAll(COMPILE_TIMES_GLOBAL_REGEX)) {
      compileCpuTimeMs = (compileCpuTimeMs ?? 0) + parseInt(compileMatch[1] || '0', 10);
      compileElapsedTimeMs = (compileElapsedTimeMs ?? 0) + parseInt(compileMatch[2] || '0', 10);
    }

    // 3. Line by line table IO stats
    const lines = rawMsg.split(/\r?\n/);
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;

      const ioMatch = trimmed.match(TABLE_IO_REGEX);
      if (ioMatch) {
        const tableName = ioMatch[1] || 'Unknown';
        const scanCount = parseInt(ioMatch[2] || '0', 10);
        const logicalReads = parseInt(ioMatch[3] || '0', 10);
        const physicalReads = parseInt(ioMatch[4] || '0', 10);
        const readAheadReads = parseInt(ioMatch[5] || '0', 10);
        const lobLogicalReads = parseInt(ioMatch[6] || '0', 10);
        const lobPhysicalReads = parseInt(ioMatch[7] || '0', 10);
        const lobReadAheadReads = parseInt(ioMatch[8] || '0', 10);

        const totalReads = logicalReads + lobLogicalReads;
        const bytesFormatted = formatBytes(totalReads * 8192);
        const isHighIo = logicalReads > 1000 || (scanCount > 0 && logicalReads > 200);

        const existing = tableStatsMap.get(tableName);
        if (existing) {
          existing.scanCount += scanCount;
          existing.logicalReads += logicalReads;
          existing.physicalReads += physicalReads;
          existing.readAheadReads += readAheadReads;
          existing.lobLogicalReads += lobLogicalReads;
          existing.lobPhysicalReads += lobPhysicalReads;
          existing.lobReadAheadReads += lobReadAheadReads;
          existing.totalReads = existing.logicalReads + existing.lobLogicalReads;
          existing.bytesFormatted = formatBytes(existing.totalReads * 8192);
          existing.isHighIo = existing.isHighIo || isHighIo;
        } else {
          tableStatsMap.set(tableName, {
            tableName,
            scanCount,
            logicalReads,
            physicalReads,
            readAheadReads,
            lobLogicalReads,
            lobPhysicalReads,
            lobReadAheadReads,
            totalReads,
            bytesFormatted,
            isHighIo,
          });
        }
      }
    }
  }

  // Sort table stats by logical reads descending
  const tableStats = Array.from(tableStatsMap.values()).sort(
    (a, b) => b.logicalReads - a.logicalReads
  );

  return {
    tableStats,
    cpuTimeMs,
    elapsedTimeMs,
    compileCpuTimeMs,
    compileElapsedTimeMs,
  };
}

/**
 * Combines parsed messages and session telemetry into a comprehensive ExecutionStatsData object
 */
export function buildExecutionStats(params: {
  messages: string[];
  telemetrySummary?: PerfTelemetrySummary | null;
  waitStats?: WaitStatItem[];
  executionTimeMsFallback: number;
  querySql: string;
}): ExecutionStatsData {
  const parsed = parseStatisticsMessages(params.messages);
  const tableStats = parsed.tableStats;

  let totalLogicalReads = 0;
  let totalPhysicalReads = 0;
  let totalReadAheadReads = 0;
  let totalLobReads = 0;

  for (const t of tableStats) {
    totalLogicalReads += t.logicalReads;
    totalPhysicalReads += t.physicalReads;
    totalReadAheadReads += t.readAheadReads;
    totalLobReads += t.lobLogicalReads;
  }

  // If per-table didn't report logical reads but telemetry did, use telemetry
  if (totalLogicalReads === 0 && params.telemetrySummary?.logicalReads) {
    totalLogicalReads = params.telemetrySummary.logicalReads;
  }
  if (totalPhysicalReads === 0 && params.telemetrySummary?.physicalReads) {
    totalPhysicalReads = params.telemetrySummary.physicalReads;
  }

  const totalPhysicalWrites = params.telemetrySummary?.physicalWrites ?? 0;

  // CPU and Elapsed time
  const cpuTimeMs = parsed.cpuTimeMs ?? params.telemetrySummary?.cpuTimeMs ?? 0;
  const elapsedTimeMs =
    parsed.elapsedTimeMs ??
    params.telemetrySummary?.elapsedTimeMs ??
    params.executionTimeMsFallback;

  // Cache Hit Ratio: (Logical Reads - Physical Reads) / Logical Reads * 100
  let cacheHitRatio = 100;
  if (totalLogicalReads > 0) {
    const hits = Math.max(0, totalLogicalReads - totalPhysicalReads);
    cacheHitRatio = Math.round((hits / totalLogicalReads) * 100);
  }

  return {
    id: `stats-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    querySql: params.querySql,
    executedAt: new Date().toLocaleTimeString(),
    cpuTimeMs,
    elapsedTimeMs,
    compileCpuTimeMs: parsed.compileCpuTimeMs,
    compileElapsedTimeMs: parsed.compileElapsedTimeMs,
    totalLogicalReads,
    totalPhysicalReads,
    totalPhysicalWrites,
    totalReadAheadReads,
    totalLobReads,
    logicalReadsFormatted: formatPageSize(totalLogicalReads),
    physicalReadsFormatted: formatPageSize(totalPhysicalReads),
    cacheHitRatio,
    tableStats,
    waitStats: params.waitStats || [],
  };
}

/**
 * Wraps query with performance analysis telemetry script for SQL Server
 */
export function wrapQueryWithPerfTelemetry(userSql: string): string {
  return `
SET NOCOUNT ON;
DECLARE @sqlight_p_start_cpu INT, @sqlight_p_start_reads BIGINT, @sqlight_p_start_writes BIGINT, @sqlight_p_start_log_reads BIGINT, @sqlight_p_start_time DATETIME2 = SYSDATETIME();
SELECT 
  @sqlight_p_start_cpu = cpu_time, 
  @sqlight_p_start_reads = reads, 
  @sqlight_p_start_writes = writes, 
  @sqlight_p_start_log_reads = logical_reads
FROM sys.dm_exec_sessions 
WHERE session_id = @@SPID;

SET STATISTICS IO ON;
SET STATISTICS TIME ON;

${userSql}

SET STATISTICS IO OFF;
SET STATISTICS TIME OFF;

-- Telemetry Payload
SELECT 
  '__SQLIGHT_PERF_SUMMARY__' AS [__sqlight_tag__],
  DATEDIFF(MILLISECOND, @sqlight_p_start_time, SYSDATETIME()) AS [elapsedTimeMs],
  CAST(CASE WHEN s.cpu_time >= @sqlight_p_start_cpu THEN s.cpu_time - @sqlight_p_start_cpu ELSE 0 END AS INT) AS [cpuTimeMs],
  CAST(CASE WHEN s.logical_reads >= @sqlight_p_start_log_reads THEN s.logical_reads - @sqlight_p_start_log_reads ELSE 0 END AS BIGINT) AS [logicalReads],
  CAST(CASE WHEN s.reads >= @sqlight_p_start_reads THEN s.reads - @sqlight_p_start_reads ELSE 0 END AS BIGINT) AS [physicalReads],
  CAST(CASE WHEN s.writes >= @sqlight_p_start_writes THEN s.writes - @sqlight_p_start_writes ELSE 0 END AS BIGINT) AS [physicalWrites]
FROM sys.dm_exec_sessions s
WHERE s.session_id = @@SPID;

SELECT 
  '__SQLIGHT_WAIT_STATS__' AS [__sqlight_tag__],
  wait_type,
  waiting_tasks_count,
  wait_time_ms,
  max_wait_time_ms
FROM sys.dm_exec_session_wait_stats
WHERE session_id = @@SPID AND wait_time_ms > 0
ORDER BY wait_time_ms DESC;
`;
}
