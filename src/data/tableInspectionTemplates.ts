import type { SqlTemplate } from '@/types/sqlTemplate';

export const TABLE_INSPECTION_TEMPLATES: SqlTemplate[] = [
  // ==========================================
  // 表結構探勘 (Table Inspection & Profile)
  // ==========================================
  {
    id: 'inspect-table-all-in-one',
    title: '資料表全方位快速盤點彙總 (All-in-One Comprehensive Profile)',
    category: 'inspection',
    categoryLabel: '表結構探勘',
    tags: ['全方位盤點', 'table profile', 'all in one', '一鍵檢查', '結構彙總', '資料表探勘'],
    description: '一鍵完整執行盤點：一次批次輸出「基本規格與估算列數」、「空間配置與容量大小 (MB)」、「外鍵父子關聯」以及「索引與包含欄位清單」，全面掌握資料表全貌。',
    code: `-- ==============================================================================
-- 資料表全方位快速盤點彙總 (All-in-One Profile)
-- 請於下方替換 @TableName，一鍵執行即可產出 4 大核心面向之分析結果
-- ==============================================================================
DECLARE @TableName NVARCHAR(256) = 'dbo.YourTable';
DECLARE @ObjectId INT = OBJECT_ID(@TableName);

IF @ObjectId IS NULL
BEGIN
    RAISERROR(N'找不到指定的資料表：%s，請確認資料庫與結構描述名稱是否正確。', 16, 1, @TableName);
    RETURN;
END;

-- 1. 基本規格、建立時間與系統估算總列數
SELECT 
    OBJECT_SCHEMA_NAME(@ObjectId) AS [結構描述],
    OBJECT_NAME(@ObjectId) AS [資料表名稱],
    o.create_date AS [建立時間],
    o.modify_date AS [最後結構修改時間],
    SUM(p.rows) AS [系統估算資料列數]
FROM sys.objects AS o
LEFT JOIN sys.partitions AS p 
    ON p.object_id = o.object_id 
   AND p.index_id IN (0, 1) -- 0: Heap, 1: Clustered
WHERE o.object_id = @ObjectId
GROUP BY o.object_id, o.create_date, o.modify_date;

-- 2. 磁碟空間與索引佔用大小 (MB)
SELECT
    CAST(SUM(a.total_pages) * 8.0 / 1024 AS DECIMAL(18, 2)) AS [總配置空間_MB],
    CAST(SUM(a.used_pages) * 8.0 / 1024 AS DECIMAL(18, 2)) AS [實際已用空間_MB],
    CAST(SUM(a.data_pages) * 8.0 / 1024 AS DECIMAL(18, 2)) AS [資料本體大小_MB],
    CAST((SUM(a.used_pages) - SUM(a.data_pages)) * 8.0 / 1024 AS DECIMAL(18, 2)) AS [索引佔用大小_MB]
FROM sys.indexes AS i
INNER JOIN sys.partitions AS p 
    ON p.object_id = i.object_id 
   AND p.index_id = i.index_id
INNER JOIN sys.allocation_units AS a 
    ON a.container_id = p.partition_id
WHERE i.object_id = @ObjectId;

-- 3. 索引組成與包含欄位清單
SELECT
    i.name AS [索引名稱],
    i.type_desc AS [類型],
    CASE WHEN i.is_primary_key = 1 THEN 'PK' WHEN i.is_unique = 1 THEN 'UNIQUE' ELSE 'INDEX' END AS [屬性],
    ic.key_ordinal AS [順序],
    c.name AS [欄位名稱],
    CASE WHEN ic.is_included_column = 1 THEN 'INCLUDE' ELSE 'KEY' END AS [欄位類型]
FROM sys.indexes AS i
INNER JOIN sys.index_columns AS ic 
    ON ic.object_id = i.object_id 
   AND ic.index_id = i.index_id
INNER JOIN sys.columns AS c 
    ON c.object_id = ic.object_id 
   AND c.column_id = ic.column_id
WHERE i.object_id = @ObjectId
ORDER BY i.index_id ASC, ic.is_included_column ASC, ic.key_ordinal ASC;

-- 4. 外鍵關係清單
SELECT
    fk.name AS [外鍵名稱],
    OBJECT_SCHEMA_NAME(fk.parent_object_id) + '.' + OBJECT_NAME(fk.parent_object_id) AS [子表 (Child)],
    OBJECT_SCHEMA_NAME(fk.referenced_object_id) + '.' + OBJECT_NAME(fk.referenced_object_id) AS [父表 (Parent)]
FROM sys.foreign_keys AS fk
WHERE fk.parent_object_id = @ObjectId 
   OR fk.referenced_object_id = @ObjectId;
`,
  },
  {
    id: 'inspect-columns-schema',
    title: '資料表欄位規格與預設約束清單 (Column Specifications & Defaults)',
    category: 'inspection',
    categoryLabel: '表結構探勘',
    tags: ['欄位結構', 'columns', 'sp_help', '預設值', 'default constraint', 'data type', 'identity'],
    description: '全面查詢指定資料表的欄位定義、型別、最大位元組長度、數值精度、小數位數、Nullable、Identity 自動增量與預設值條件式 (Default Constraints)。',
    code: `-- 1. 快速概述 (包含欄位、索引與基本約束)
-- EXEC sp_help 'dbo.YourTable';

-- 2. 詳細欄位型別、可空性、自動增量與預設約束清單
DECLARE @TableName NVARCHAR(256) = 'dbo.YourTable'; -- 請替換為您的目標表名

SELECT
    c.column_id AS [欄位序號],
    c.name AS [欄位名稱],
    TYPE_NAME(c.user_type_id) AS [資料型別],
    c.max_length AS [最大長度(Bytes)],
    c.precision AS [數值精度(Precision)],
    c.scale AS [小數位數(Scale)],
    CASE WHEN c.is_nullable = 1 THEN N'YES (可為 NULL)' ELSE N'NO (不可 NULL)' END AS [可否NULL],
    CASE WHEN c.is_identity = 1 THEN N'YES (自動增量)' ELSE N'NO' END AS [是否Identity],
    dc.name AS [預設值約束名稱],
    dc.definition AS [預設值表達式]
FROM sys.columns AS c
LEFT JOIN sys.default_constraints AS dc
    ON dc.object_id = c.default_object_id
WHERE c.object_id = OBJECT_ID(@TableName)
ORDER BY c.column_id ASC;
`,
  },
  {
    id: 'inspect-row-count-estimate',
    title: '資料表筆數統計與分區快速估算 (Row Count & Fast Partition Estimate)',
    category: 'inspection',
    categoryLabel: '表結構探勘',
    tags: ['筆數統計', 'row count', 'count_big', 'sys.partitions', '快速估算', '大表筆數'],
    description: '提供精確計算 (COUNT_BIG) 與系統分區快速估算 (sys.partitions) 兩種方式。針對百萬/千萬筆以上的大型資料表，透過分區元數據可在 0 秒內取得總列數，完全不佔用查詢 I/O 或造成資料庫鎖定。',
    code: `DECLARE @TableName NVARCHAR(256) = 'dbo.YourTable'; -- 請替換為您的目標表名

-- 方法 A: 快速取得系統分區估算筆數 (0 秒秒級回傳，大表極速推薦，不鎖表、不消耗 I/O)
SELECT 
    OBJECT_SCHEMA_NAME(p.object_id) AS [結構描述],
    OBJECT_NAME(p.object_id) AS [資料表名稱],
    SUM(p.rows) AS [快速估算總列數],
    COUNT(p.partition_number) AS [分區數量]
FROM sys.partitions AS p
WHERE p.object_id = OBJECT_ID(@TableName)
  AND p.index_id IN (0, 1) -- 0: Heap, 1: Clustered Index
GROUP BY p.object_id;

-- 方法 B: 絕對精確即時計算 (對大型表可能需全表掃描，請依情境斟酌執行)
-- SELECT COUNT_BIG(1) AS [精確即時資料筆數] FROM dbo.YourTable;
`,
  },
  {
    id: 'inspect-space-used-detail',
    title: '資料表空間使用量與磁碟佔用明細 (Data & Index Space Used in MB)',
    category: 'inspection',
    categoryLabel: '表結構探勘',
    tags: ['容量大小', 'spaceused', '資料表空間', '索引大小', 'allocation_units', 'mb', 'pages'],
    description: '精準計算資料表在儲存空間上的實際配置：總資料列數、總配置空間 (Total MB)、實際已用空間 (Used MB)、資料本體大小 (Data MB) 以及索引佔用空間 (Index MB)。',
    code: `DECLARE @TableName NVARCHAR(256) = 'dbo.YourTable'; -- 請替換為您的目標表名

-- 1. 快速系統預存程序檢查
-- EXEC sp_spaceused 'dbo.YourTable';

-- 2. 磁碟頁面 (Pages) 與 MB 空間精準換算統計
SELECT
    OBJECT_SCHEMA_NAME(i.object_id) AS [結構描述],
    OBJECT_NAME(i.object_id) AS [資料表名稱],
    SUM(p.rows) AS [資料總筆數],
    CAST(SUM(a.total_pages) * 8.0 / 1024 AS DECIMAL(18, 2)) AS [總配置空間_MB],
    CAST(SUM(a.used_pages) * 8.0 / 1024 AS DECIMAL(18, 2)) AS [實際已使用_MB],
    CAST(SUM(a.data_pages) * 8.0 / 1024 AS DECIMAL(18, 2)) AS [資料本體大小_MB],
    CAST((SUM(a.used_pages) - SUM(a.data_pages)) * 8.0 / 1024 AS DECIMAL(18, 2)) AS [索引佔用大小_MB]
FROM sys.indexes AS i
INNER JOIN sys.partitions AS p
    ON p.object_id = i.object_id
   AND p.index_id = i.index_id
INNER JOIN sys.allocation_units AS a
    ON a.container_id = p.partition_id
WHERE i.object_id = OBJECT_ID(@TableName)
GROUP BY i.object_id;
`,
  },
  {
    id: 'inspect-foreign-keys-relations',
    title: '主鍵、外鍵約束與關聯資料表清單 (Primary & Foreign Keys Relations)',
    category: 'inspection',
    categoryLabel: '表結構探勘',
    tags: ['外鍵', 'foreign key', '主鍵', 'primary key', '關聯', '約束', 'constraints'],
    description: '雙向盤點此資料表的所有外鍵關係：包含「此表引用哪些外部父表 (Parent Tables)」以及「有哪些子表引用了此表 (Child Tables)」，附帶約束名稱與對應關聯欄位。',
    code: `DECLARE @TableName NVARCHAR(256) = 'dbo.YourTable'; -- 請替換為您的目標表名

-- 1. 快速檢視所有約束條件
-- EXEC sp_helpconstraint 'dbo.YourTable';

-- 2. 雙向查詢外鍵關聯 (引用的外部表 & 被引用的關聯表)
SELECT
    fk.name AS [外鍵約束名稱],
    CASE 
        WHEN fk.parent_object_id = OBJECT_ID(@TableName) THEN N'⬆️ 外部依賴 (此表引用父表)'
        ELSE N'⬇️ 被子表引用 (子表參照此表)'
    END AS [關聯方向],
    OBJECT_SCHEMA_NAME(fk.parent_object_id) AS [子表結構描述],
    OBJECT_NAME(fk.parent_object_id) AS [子表名稱 (Child Table)],
    pc.name AS [子表外鍵欄位],
    OBJECT_SCHEMA_NAME(fk.referenced_object_id) AS [父表結構描述],
    OBJECT_NAME(fk.referenced_object_id) AS [父表名稱 (Parent Table)],
    rc.name AS [父表被參照欄位 (通常為PK/UK)],
    fk.delete_referential_action_desc AS [刪除連動規則],
    fk.update_referential_action_desc AS [更新連動規則]
FROM sys.foreign_keys AS fk
INNER JOIN sys.foreign_key_columns AS fkc
    ON fkc.constraint_object_id = fk.object_id
INNER JOIN sys.columns AS pc
    ON pc.object_id = fkc.parent_object_id
   AND pc.column_id = fkc.parent_column_id
INNER JOIN sys.columns AS rc
    ON rc.object_id = fkc.referenced_object_id
   AND rc.column_id = fkc.referenced_column_id
WHERE fk.parent_object_id = OBJECT_ID(@TableName)
   OR fk.referenced_object_id = OBJECT_ID(@TableName)
ORDER BY [關聯方向] DESC, fk.name ASC, fkc.constraint_column_id ASC;
`,
  },
  {
    id: 'inspect-indexes-definition',
    title: '索引組成結構、鍵值順序與包含欄位 (Index Definitions & Included Columns)',
    category: 'inspection',
    categoryLabel: '表結構探勘',
    tags: ['索引定義', 'indexes', 'included column', 'key ordinal', '唯一索引', '主鍵索引'],
    description: '詳列資料表上所有叢集 (Clustered) 與非叢集 (Nonclustered) 索引的鍵欄位順序 (Key Ordinal) 及 INCLUDE 包含欄位，並標註 Unique、Primary Key 與停用狀態。',
    code: `DECLARE @TableName NVARCHAR(256) = 'dbo.YourTable'; -- 請替換為您的目標表名

-- 1. 快速預存程序檢查
-- EXEC sp_helpindex 'dbo.YourTable';

-- 2. 完整索引組成與包含欄位明細
SELECT
    i.name AS [索引名稱],
    i.type_desc AS [索引類型],
    CASE WHEN i.is_primary_key = 1 THEN N'YES (PK)' ELSE N'NO' END AS [是否為主鍵],
    CASE WHEN i.is_unique = 1 THEN N'YES (唯一)' ELSE N'NO' END AS [是否唯一],
    CASE WHEN i.is_disabled = 1 THEN N'⚠️ 已停用' ELSE N'啟用中' END AS [狀態],
    ic.key_ordinal AS [索引鍵排序序號],
    c.name AS [欄位名稱],
    CASE WHEN ic.is_included_column = 1 THEN N'YES (INCLUDE 包含欄位)' ELSE N'NO (索引鍵欄位)' END AS [是否為包含欄位],
    CASE WHEN ic.is_descending_key = 1 THEN 'DESC' ELSE 'ASC' END AS [排序方向]
FROM sys.indexes AS i
INNER JOIN sys.index_columns AS ic
    ON ic.object_id = i.object_id
   AND ic.index_id = i.index_id
INNER JOIN sys.columns AS c
    ON c.object_id = ic.object_id
   AND c.column_id = ic.column_id
WHERE i.object_id = OBJECT_ID(@TableName)
ORDER BY i.index_id ASC, ic.is_included_column ASC, ic.key_ordinal ASC;
`,
  },
  {
    id: 'inspect-index-usage-stats',
    title: '索引讀寫使用次數統計 (Index Usage: Seeks, Scans & Updates)',
    category: 'inspection',
    categoryLabel: '表結構探勘',
    tags: ['索引使用率', 'index usage', 'dmv', 'seeks', 'scans', 'updates', '無效索引'],
    description: '透過 sys.dm_db_index_usage_stats 檢視資料庫服務自上次重啟以來的索引讀取 (Seek/Scan/Lookup) 與寫入 (Update) 次數。可快速辨識高寫入、零讀取的無效冗餘索引。',
    code: `DECLARE @TableName NVARCHAR(256) = 'dbo.YourTable'; -- 請替換為您的目標表名

SELECT
    i.name AS [索引名稱],
    i.type_desc AS [索引類型],
    ISNULL(us.user_seeks, 0) AS [Seek 次數 (精準搜尋)],
    ISNULL(us.user_scans, 0) AS [Scan 次數 (全區間掃描)],
    ISNULL(us.user_lookups, 0) AS [Lookup 次數 (書籤查閱)],
    (ISNULL(us.user_seeks, 0) + ISNULL(us.user_scans, 0) + ISNULL(us.user_lookups, 0)) AS [總讀取次數],
    ISNULL(us.user_updates, 0) AS [Update 維護次數 (寫入開銷)],
    us.last_user_seek AS [最後 Seek 時間],
    us.last_user_scan AS [最後 Scan 時間],
    us.last_user_update AS [最後 Update 時間]
FROM sys.indexes AS i
LEFT JOIN sys.dm_db_index_usage_stats AS us
    ON us.database_id = DB_ID()
   AND us.object_id = i.object_id
   AND us.index_id = i.index_id
WHERE i.object_id = OBJECT_ID(@TableName)
ORDER BY [總讀取次數] DESC, [Update 維護次數 (寫入開銷)] DESC;
`,
  },
  {
    id: 'inspect-index-fragmentation',
    title: '索引碎片率與實體頁面分析 (Index Physical Fragmentation & Pages)',
    category: 'inspection',
    categoryLabel: '表結構探勘',
    tags: ['索引碎片', 'fragmentation', 'rebuild', 'reorganize', 'page count', '磁碟頁面'],
    description: '使用 sys.dm_db_index_physical_stats (LIMITED 模式) 檢測索引的內部/外部碎片率與 Page 頁數，作為是否執行 REBUILD 或 REORGANIZE 的判斷依據（頁數極少的小表通常無需處理）。',
    code: `DECLARE @TableName NVARCHAR(256) = 'dbo.YourTable'; -- 請替換為您的目標表名

SELECT
    i.name AS [索引名稱],
    ps.index_type_desc AS [索引實體類型],
    CAST(ps.avg_fragmentation_in_percent AS DECIMAL(5, 2)) AS [碎片百分比 (%)],
    ps.page_count AS [實體頁面數 (Page Count)],
    CAST(ps.page_count * 8.0 / 1024 AS DECIMAL(18, 2)) AS [索引大小_MB],
    CASE 
        WHEN ps.page_count < 1000 THEN N'小於 1000 頁 (無需特別處理)'
        WHEN ps.avg_fragmentation_in_percent >= 30.0 THEN N'建議 REBUILD (重建索引)'
        WHEN ps.avg_fragmentation_in_percent >= 10.0 THEN N'建議 REORGANIZE (重組索引)'
        ELSE N'健康良好 (< 10%)'
    END AS [維護建議]
FROM sys.dm_db_index_physical_stats(
    DB_ID(),
    OBJECT_ID(@TableName),
    NULL,
    NULL,
    'LIMITED' -- LIMITED 模式速度極快，僅讀取葉層頁標頭
) AS ps
INNER JOIN sys.indexes AS i
    ON i.object_id = ps.object_id
   AND i.index_id = ps.index_id
ORDER BY ps.page_count DESC;
`,
  },
  {
    id: 'inspect-statistics-status',
    title: '統計資訊狀態與最後更新時間 (Statistics Status & Last Updated)',
    category: 'inspection',
    categoryLabel: '表結構探勘',
    tags: ['統計資訊', 'statistics', 'stats_date', '更新時間', 'auto_created', '執行計畫'],
    description: '查詢資料表上所有統計物件 (Statistics) 的最後更新時間 (STATS_DATE)、是否為自動建立或已停用重新計算，防止因統計資訊陳舊導致執行計畫走偏。',
    code: `DECLARE @TableName NVARCHAR(256) = 'dbo.YourTable'; -- 請替換為您的目標表名

SELECT
    s.name AS [統計資訊名稱],
    STATS_DATE(s.object_id, s.stats_id) AS [最後更新時間],
    DATEDIFF(DAY, STATS_DATE(s.object_id, s.stats_id), GETDATE()) AS [距今天數],
    CASE WHEN s.auto_created = 1 THEN N'YES (系統自動產生)' ELSE N'NO' END AS [是否自動建立],
    CASE WHEN s.user_created = 1 THEN N'YES (使用者建立)' ELSE N'NO' END AS [是否使用者建立],
    CASE WHEN s.no_recompute = 1 THEN N'⚠️ 是 (已停用自動重新計算)' ELSE N'否 (正常自動計算)' END AS [停用自動重新計算]
FROM sys.stats AS s
WHERE s.object_id = OBJECT_ID(@TableName)
ORDER BY [最後更新時間] ASC;

-- 若要檢視特定統計資訊的長條圖分佈與密度向量，可執行：
-- DBCC SHOW_STATISTICS ('dbo.YourTable', '統計或索引名稱');
`,
  },
  {
    id: 'inspect-data-sampling',
    title: '資料快速抽查與隨機抽樣 (Data Quick Inspection & Random Sampling)',
    category: 'inspection',
    categoryLabel: '表結構探勘',
    tags: ['資料抽樣', 'top 100', 'newid', '隨機抽查', 'sample', 'sample data'],
    description: '快速抽查前 100 筆或隨機抽樣檢驗資料格式。注意：ORDER BY NEWID() 需對全表每列計算 GUID，大型千萬級資料表請避免在正式環境繁忙時使用。',
    code: `-- 1. 快速查看前 100 筆資料 (高效無負擔)
SELECT TOP (100) *
FROM dbo.YourTable;

-- 2. 隨機抽樣 100 筆 (適合中小型資料表檢查資料品質與分佈)
-- 注意: ORDER BY NEWID() 會全表計算雜湊，千萬筆大表請避免在尖峰期執行
SELECT TOP (100) *
FROM dbo.YourTable
ORDER BY NEWID();
`,
  },
  {
    id: 'inspect-data-quality-distribution',
    title: '資料品質分析 (NULL 統計、重複值檢驗與數值分布)',
    category: 'inspection',
    categoryLabel: '表結構探勘',
    tags: ['資料品質', 'null 檢查', '重複值', '資料分佈', 'min max 日期', 'group by'],
    description: '快速盤點資料品質：統計特定欄位為 NULL 的總列數與佔比、檢驗疑似唯一欄位是否有重複值、頻率最高的分組值排行以及時間欄位之最早/最新日期範圍。',
    code: `-- 1. 檢驗特定欄位之 NULL 值數量與佔比 (請替換 ColumnName 與 TableName)
SELECT
    COUNT_BIG(*) AS [總筆數],
    SUM(CASE WHEN ColumnName IS NULL THEN 1 ELSE 0 END) AS [NULL筆數],
    CAST(SUM(CASE WHEN ColumnName IS NULL THEN 1.0 ELSE 0 END) * 100.0 / NULLIF(COUNT_BIG(*), 0) AS DECIMAL(5, 2)) AS [NULL百分比(%)]
FROM dbo.YourTable;

-- 2. 檢驗疑似應該唯一的欄位是否存在重複值 (若有重複則列出前幾大)
SELECT TOP (20)
    ColumnName,
    COUNT_BIG(*) AS [重複筆數]
FROM dbo.YourTable
GROUP BY ColumnName
HAVING COUNT_BIG(*) > 1
ORDER BY [重複筆數] DESC;

-- 3. 查看數值或狀態分佈 (頻率最高的前 100 種值)
SELECT TOP (100)
    ColumnName,
    COUNT_BIG(*) AS [出現次數],
    CAST(COUNT_BIG(*) * 100.0 / SUM(COUNT_BIG(*)) OVER() AS DECIMAL(5, 2)) AS [佔比(%)]
FROM dbo.YourTable
GROUP BY ColumnName
ORDER BY [出現次數] DESC;

-- 4. 查看建立或異動日期之涵蓋範圍
SELECT
    MIN(CreatedDate) AS [最早日期 (Earliest)],
    MAX(CreatedDate) AS [最新日期 (Latest)],
    DATEDIFF(DAY, MIN(CreatedDate), MAX(CreatedDate)) AS [跨越天數]
FROM dbo.YourTable;
`,
  },
  {
    id: 'inspect-object-dependencies',
    title: '物件相依關係查詢 (哪些 View、Procedure、Function 引用此表)',
    category: 'inspection',
    categoryLabel: '表結構探勘',
    tags: ['相依關係', 'dependencies', 'view', 'stored procedure', 'function', '引用查詢'],
    description: '透過 sys.sql_expression_dependencies 盤點引用此資料表的所有 View、預存程序與純量/資料表值函數，方便在修改欄位或結構前進行精準的影響範圍評估。',
    code: `DECLARE @TableName NVARCHAR(256) = 'dbo.YourTable'; -- 請替換為您的目標表名

SELECT
    OBJECT_SCHEMA_NAME(d.referencing_id) AS [引用者結構描述],
    OBJECT_NAME(d.referencing_id) AS [引用物件名稱 (Referencing Object)],
    o.type_desc AS [物件類型 (Type)],
    CASE o.type
        WHEN 'V'  THEN N'檢視表 (View)'
        WHEN 'P'  THEN N'預存程序 (Stored Procedure)'
        WHEN 'FN' THEN N'純量函數 (Scalar Function)'
        WHEN 'TF' THEN N'資料表值函數 (Table-valued Function)'
        WHEN 'IF' THEN N'行內函數 (Inline Function)'
        WHEN 'TR' THEN N'觸發程序 (Trigger)'
        ELSE o.type_desc
    END AS [類型中文說明]
FROM sys.sql_expression_dependencies AS d
INNER JOIN sys.objects AS o
    ON o.object_id = d.referencing_id
WHERE d.referenced_id = OBJECT_ID(@TableName)
ORDER BY o.type ASC, [引用物件名稱 (Referencing Object)] ASC;

-- 傳統預存程序法 (僅供參考，可能漏掉動態 SQL 或跨資料庫相依)：
-- EXEC sp_depends 'dbo.YourTable';
`,
  },
  {
    id: 'inspect-dbcc-checktable',
    title: '資料表實體與邏輯完整性健康檢查 (DBCC CHECKTABLE)',
    category: 'inspection',
    categoryLabel: '表結構探勘',
    tags: ['完整性檢查', 'dbcc checktable', '健康檢查', '損毀排查', 'corruption', '頁面修復'],
    description: '檢查指定資料表所有資料頁與索引頁的配置完整性、結構指標與邏輯一致性，確認有無壞頁 (Bad Pages) 或損毀。注意：會產生較大磁碟 I/O，建議選在離峰維護時間執行。',
    code: `-- 檢查指定資料表之所有資料頁與索引頁的邏輯與實體完整性
-- WITH NO_INFOMSGS: 抑制一般參考資訊，若無錯誤則不產生多餘訊息
DBCC CHECKTABLE ('dbo.YourTable') WITH NO_INFOMSGS;

-- 若需同時檢查資料表及索引的延伸資訊：
-- DBCC CHECKTABLE ('dbo.YourTable') WITH PHYSICAL_ONLY; -- 僅檢查實體結構，大幅減少執行時間與伺服器負擔
`,
  },
];
