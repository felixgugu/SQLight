/**
 * Built-in SQL Server DBA Diagnostic and Maintenance Cheat-sheet queries
 */

export interface DbaQueryItem {
  id: string;
  title: string;
  badge: string;
  badgeColor: string;
  description: string;
  sql: string;
}

export const DBA_QUERIES: DbaQueryItem[] = [
  {
    id: 'locks_blocking',
    title: '即時鎖定與阻塞鏈 (Locks & Blocking)',
    badge: '鎖定/併發',
    badgeColor: 'text-danger bg-rose-100 dark:bg-rose-950/60 border-rose-200 dark:border-rose-800/60',
    description: '快速查出誰卡住了誰（Lead Blocker、SPID、等待類型與秒數）',
    sql: `-- ============================================================
-- 診斷：即時鎖定與阻塞鏈 (Locks & Blocking Processes)
-- 說明：快速查出誰卡住了誰（Lead Blocker、SPID、等待類型與執行時間）
-- ============================================================
SELECT 
    tl.resource_type AS [資源類型],
    DB_NAME(tl.resource_database_id) AS [資料庫],
    tl.resource_associated_entity_id AS [實體ID],
    tl.request_mode AS [鎖定模式],
    tl.request_status AS [狀態],
    wt.blocking_session_id AS [阻塞者SPID (Blocker)],
    r.session_id AS [被阻塞者SPID (Blocked)],
    wt.wait_duration_ms / 1000.0 AS [等待秒數 (s)],
    wt.wait_type AS [等待類型],
    SUBSTRING(st.text, (r.statement_start_offset/2) + 1,
        ((CASE r.statement_end_offset
            WHEN -1 THEN DATALENGTH(st.text)
            ELSE r.statement_end_offset
        END - r.statement_start_offset)/2) + 1) AS [目前執行的語法],
    s.login_name AS [登入者],
    s.host_name AS [來源主機],
    s.program_name AS [應用程式]
FROM sys.dm_tran_locks tl
INNER JOIN sys.dm_os_waiting_tasks wt ON tl.lock_owner_address = wt.resource_address
LEFT JOIN sys.dm_exec_requests r ON wt.session_id = r.session_id
LEFT JOIN sys.dm_exec_sessions s ON wt.session_id = s.session_id
CROSS APPLY sys.dm_exec_sql_text(r.sql_handle) st
WHERE wt.blocking_session_id IS NOT NULL
ORDER BY wt.wait_duration_ms DESC;
`,
  },
  {
    id: 'slow_queries',
    title: 'Top 20 慢查詢 (Top Slow Queries by CPU)',
    badge: '效能分析',
    badgeColor: 'text-warn bg-amber-100 dark:bg-amber-950/60 border-amber-200 dark:border-amber-800/60',
    description: '依累計 CPU 與耗時排名分析伺服器最耗效能的查詢語句',
    sql: `-- ============================================================
-- 診斷：Top 20 慢查詢 (Top 20 Slow Queries by CPU & Duration)
-- 說明：分析伺服器執行累計耗費最多 CPU 與執行時間的 SQL
-- ============================================================
SELECT TOP 20
    qs.execution_count AS [執行次數],
    CAST(qs.total_worker_time / 1000.0 / qs.execution_count AS DECIMAL(18, 2)) AS [平均CPU耗時 (ms)],
    CAST(qs.total_elapsed_time / 1000.0 / qs.execution_count AS DECIMAL(18, 2)) AS [平均執行時間 (ms)],
    qs.total_logical_reads / qs.execution_count AS [平均邏輯讀取],
    SUBSTRING(st.text, (qs.statement_start_offset/2) + 1,
        ((CASE qs.statement_end_offset
            WHEN -1 THEN DATALENGTH(st.text)
            ELSE qs.statement_end_offset
        END - qs.statement_start_offset)/2) + 1) AS [查詢語法],
    qs.last_execution_time AS [最後執行時間],
    DB_NAME(st.dbid) AS [資料庫名稱]
FROM sys.dm_exec_query_stats qs
CROSS APPLY sys.dm_exec_sql_text(qs.sql_handle) st
ORDER BY [平均CPU耗時 (ms)] DESC;
`,
  },
  {
    id: 'table_sizes',
    title: '資料表空間與筆數排行 (Table Sizes & Rows)',
    badge: '容量規劃',
    badgeColor: 'text-structure bg-indigo-100 dark:bg-indigo-950/60 border-indigo-200 dark:border-indigo-800/60',
    description: '秒級列出資料庫所有資料表的實際列數與 MB 佔用排名',
    sql: `-- ============================================================
-- 診斷：資料表空間佔用與筆數排行 (Table Sizes & Row Counts)
-- 說明：秒級列出資料庫中所有使用者資料表的實際總列數與空間佔用 (MB)
-- ============================================================
SELECT 
    s.name AS [結構描述 (Schema)],
    t.name AS [資料表名稱 (Table)],
    p.rows AS [資料筆數 (Rows)],
    CAST(ROUND(((SUM(a.total_pages) * 8) / 1024.00), 2) AS NUMERIC(36, 2)) AS [總空間 (MB)],
    CAST(ROUND(((SUM(a.used_pages) * 8) / 1024.00), 2) AS NUMERIC(36, 2)) AS [資料空間 (MB)], 
    CAST(ROUND(((SUM(a.total_pages) - SUM(a.used_pages)) * 8) / 1024.00, 2) AS NUMERIC(36, 2)) AS [未配置空間 (MB)]
FROM sys.tables t
INNER JOIN sys.indexes i ON t.object_id = i.object_id
INNER JOIN sys.partitions p ON i.object_id = p.object_id AND i.index_id = p.index_id
INNER JOIN sys.allocation_units a ON p.partition_id = a.container_id
LEFT OUTER JOIN sys.schemas s ON t.schema_id = s.schema_id
WHERE t.is_ms_shipped = 0 AND i.object_id > 255 
GROUP BY t.name, s.name, p.rows
ORDER BY [總空間 (MB)] DESC;
`,
  },
  {
    id: 'index_fragmentation',
    title: '索引破碎度分析 (Index Fragmentation > 20%)',
    badge: '索引維護',
    badgeColor: 'text-info bg-sky-100 dark:bg-sky-950/60 border-sky-200 dark:border-sky-800/60',
    description: '找出破碎度過高的索引，並自動生成 REBUILD / REORGANIZE 語法',
    sql: `-- ============================================================
-- 診斷：索引破碎度分析 (Index Fragmentation > 15%)
-- 說明：列出需要重組 (REORGANIZE) 或重建 (REBUILD) 的索引清單
-- ============================================================
SELECT 
    DB_NAME() AS [資料庫名稱],
    OBJECT_SCHEMA_NAME(ps.object_id) AS [結構描述],
    OBJECT_NAME(ps.object_id) AS [資料表名稱],
    i.name AS [索引名稱],
    i.type_desc AS [索引型別],
    CAST(ps.avg_fragmentation_in_percent AS DECIMAL(5, 2)) AS [破碎度百分比 (%)],
    ps.page_count AS [頁面總數 (Pages)],
    CASE 
        WHEN ps.avg_fragmentation_in_percent > 30 THEN 'ALTER INDEX [' + i.name + '] ON [' + OBJECT_SCHEMA_NAME(ps.object_id) + '].[' + OBJECT_NAME(ps.object_id) + '] REBUILD;'
        WHEN ps.avg_fragmentation_in_percent >= 10 THEN 'ALTER INDEX [' + i.name + '] ON [' + OBJECT_SCHEMA_NAME(ps.object_id) + '].[' + OBJECT_NAME(ps.object_id) + '] REORGANIZE;'
        ELSE '良好 (無需維護)'
    END AS [建議維護語法]
FROM sys.dm_db_index_physical_stats(DB_ID(), NULL, NULL, NULL, 'LIMITED') ps
INNER JOIN sys.indexes i ON ps.object_id = i.object_id AND ps.index_id = i.index_id
WHERE ps.avg_fragmentation_in_percent >= 15.0 AND ps.page_count > 50 AND i.name IS NOT NULL
ORDER BY ps.avg_fragmentation_in_percent DESC;
`,
  },
  {
    id: 'unused_indexes',
    title: '未使用的冗餘索引 (Unused Indexes)',
    badge: '磁碟清理',
    badgeColor: 'text-plan bg-purple-100 dark:bg-purple-950/60 border-purple-200 dark:border-purple-800/60',
    description: '找出從未被查詢使用卻佔用寫入開銷的非必要索引',
    sql: `-- ============================================================
-- 診斷：未使用的冗餘索引 (Unused Indexes)
-- 說明：找出只有寫入開銷，卻從未被查詢搜尋 (0 Seeks / 0 Scans) 的索引
-- ============================================================
SELECT 
    OBJECT_SCHEMA_NAME(i.object_id) AS [結構描述],
    OBJECT_NAME(i.object_id) AS [資料表名稱],
    i.name AS [索引名稱],
    i.type_desc AS [索引型別],
    ISNULL(s.user_seeks, 0) AS [使用者搜尋次數 (Seeks)],
    ISNULL(s.user_scans, 0) AS [使用者掃描次數 (Scans)],
    ISNULL(s.user_lookups, 0) AS [查閱次數 (Lookups)],
    ISNULL(s.user_updates, 0) AS [維護更新開銷 (Updates - 寫入次數)],
    'DROP INDEX [' + i.name + '] ON [' + OBJECT_SCHEMA_NAME(i.object_id) + '].[' + OBJECT_NAME(i.object_id) + '];' AS [建議清理語法]
FROM sys.indexes i
LEFT JOIN sys.dm_db_index_usage_stats s 
    ON s.object_id = i.object_id 
    AND s.index_id = i.index_id 
    AND s.database_id = DB_ID()
WHERE OBJECTPROPERTY(i.object_id, 'IsUserTable') = 1
    AND i.index_id > 1 -- 排除 Clustered Primary Key
    AND i.is_primary_key = 0
    AND i.is_unique = 0
    AND (s.user_seeks = 0 AND s.user_scans = 0 AND s.user_lookups = 0 OR s.database_id IS NULL)
ORDER BY s.user_updates DESC, OBJECT_NAME(i.object_id);
`,
  },
  {
    id: 'active_sessions',
    title: '目前活動連線與客戶端統計 (Active Sessions)',
    badge: '連線監控',
    badgeColor: 'text-ok bg-emerald-100 dark:bg-emerald-950/60 border-emerald-200 dark:border-emerald-800/60',
    description: '即時檢視所有連線的主機、程式名稱、IP 與累積資源佔用',
    sql: `-- ============================================================
-- 診斷：目前活動連線與客戶端統計 (Active Sessions & Client Summary)
-- 說明：檢視所有連線的主機、程式名稱、連線狀態與累積資源佔用
-- ============================================================
SELECT 
    s.session_id AS [SPID],
    s.status AS [連線狀態],
    s.login_name AS [登入帳號],
    s.host_name AS [客戶端主機],
    s.program_name AS [客戶端應用程式],
    c.client_net_address AS [客戶端IP],
    DB_NAME(r.database_id) AS [當前資料庫],
    r.command AS [目前指令],
    r.cpu_time AS [CPU時間 (ms)],
    r.total_elapsed_time AS [執行時間 (ms)],
    r.wait_type AS [等待類型],
    s.login_time AS [登入時間],
    s.last_request_start_time AS [最後請求發起時間]
FROM sys.dm_exec_sessions s
LEFT JOIN sys.dm_exec_connections c ON s.session_id = c.session_id
LEFT JOIN sys.dm_exec_requests r ON s.session_id = r.session_id
WHERE s.is_user_process = 1
ORDER BY s.status, r.cpu_time DESC;
`,
  },
];
