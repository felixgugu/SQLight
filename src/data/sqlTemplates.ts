import type { SqlTemplate } from '@/types/sqlTemplate';
import { TABLE_INSPECTION_TEMPLATES } from './tableInspectionTemplates';

export const BUILTIN_SQL_TEMPLATES: SqlTemplate[] = [
  // ==========================================
  // 1. 常用語法 (Basic & DDL/DML)
  // ==========================================
  {
    id: 'basic-pagination',
    title: '高效分頁查詢 (OFFSET ... FETCH NEXT)',
    category: 'basic',
    categoryLabel: '常用語法',
    tags: ['分頁', 'pagination', 'offset', 'fetch', 'order by'],
    description: 'SQL Server 2012+ 標準高效分頁語法，取代舊式 TOP 巢狀查詢或 ROW_NUMBER() 子查詢。注意：必須搭配 ORDER BY 子句使用。',
    code: `-- 高效分頁查詢 (OFFSET ... FETCH NEXT)
-- 注意: 必須搭配 ORDER BY 欄位，否則會報語法錯誤
DECLARE @PageNumber INT = 1;      -- 當前頁碼 (從 1 開始)
DECLARE @PageSize INT = 50;        -- 每頁筆數

SELECT 
    *
FROM dbo.YourTable
ORDER BY Id ASC
OFFSET (@PageNumber - 1) * @PageSize ROWS
FETCH NEXT @PageSize ROWS ONLY;
`,
  },
  {
    id: 'basic-update-join',
    title: '多表關聯批次更新 (UPDATE with JOIN)',
    category: 'basic',
    categoryLabel: '常用語法',
    tags: ['update', 'join', '關聯更新', 'inner join', 'left join'],
    description: '根據另一張關聯來源表的最新資料批次更新目標表欄位，常見於主檔同步、狀態刷正或關聯計算。建議在 WHERE 加上值不相等過濾，避免無謂的日誌寫入。',
    code: `-- 多表關聯批次更新 (UPDATE ... FROM ... JOIN)
UPDATE target
SET 
    target.Status = source.NewStatus,
    target.UpdatedAt = SYSDATETIME()
FROM dbo.TargetTable AS target
INNER JOIN dbo.SourceTable AS source
    ON target.SourceId = source.Id
WHERE target.Status <> source.NewStatus; -- 僅更新值有變動的資料列，減少日誌鎖定
`,
  },
  {
    id: 'basic-merge-upsert',
    title: '條件式插入或更新 (MERGE / UPSERT 原子操作)',
    category: 'basic',
    categoryLabel: '常用語法',
    tags: ['merge', 'upsert', 'insert', 'update', '原子操作'],
    description: '依據比對鍵 (Key) 判斷：存在則 UPDATE，不存在則 INSERT。特別注意：T-SQL 規定 MERGE 語法結尾必須以分號 (;) 結束！',
    code: `-- MERGE 原子操作 (UPSERT 範本)
-- 注意: MERGE 語法結尾必須強制以分號 (;) 結束！
MERGE INTO dbo.TargetTable AS target
USING (
    SELECT 
        1001 AS Id,
        N'範例名稱' AS Name,
        'example@sqlight.io' AS Email
) AS source
ON (target.Id = source.Id)
WHEN MATCHED THEN
    UPDATE SET 
        target.Name = source.Name,
        target.Email = source.Email,
        target.UpdatedAt = SYSDATETIME()
WHEN NOT MATCHED THEN
    INSERT (Id, Name, Email, CreatedAt)
    VALUES (source.Id, source.Name, source.Email, SYSDATETIME());
`,
  },
  {
    id: 'basic-output-clause',
    title: '異動資料即時輸出 (OUTPUT 子句)',
    category: 'basic',
    categoryLabel: '常用語法',
    tags: ['output', 'inserted', 'deleted', 'audit', '稽核'],
    description: '在 INSERT/UPDATE/DELETE 同步擷取異動前 (deleted) 與異動後 (inserted) 的資料列，免去再次 SELECT 的開銷，適合用來寫入 Audit 稽核歷程或回傳新產生之 ID。',
    code: `-- OUTPUT 子句 (擷取變更前/後的資料列)
-- 適用於 INSERT、UPDATE、DELETE
UPDATE dbo.Orders
SET 
    Status = 'Shipped',
    ShippedAt = SYSDATETIME()
OUTPUT 
    inserted.OrderId,
    deleted.Status AS OldStatus,
    inserted.Status AS NewStatus,
    inserted.ShippedAt
WHERE Status = 'Pending'
  AND ShippedAt IS NULL;
`,
  },
  {
    id: 'basic-create-table-standards',
    title: '標準資料表建立與約束規範 (CREATE TABLE with Constraints)',
    category: 'basic',
    categoryLabel: '常用語法',
    tags: ['create table', 'constraints', 'primary key', 'default', 'check'],
    description: '包含自我增量主鍵 (IDENTITY)、唯一鍵 (UNIQUE)、預設值 (DEFAULT)、檢查約束 (CHECK) 與標準審計欄位 (CreatedAt/UpdatedAt) 的標準企業建表範本。',
    code: `-- 標準資料表建立範本 (含主鍵、唯一鍵、CHECK 約束、預設值)
-- 注意: 若複製此腳本建立新資料表，請記得同步修改 CONSTRAINT 名稱避免衝突
CREATE TABLE dbo.SampleTable (
    Id BIGINT IDENTITY(1,1) NOT NULL,
    Code VARCHAR(50) NOT NULL,
    Title NVARCHAR(200) NOT NULL,
    Amount DECIMAL(18, 4) NOT NULL CONSTRAINT DF_SampleTable_Amount DEFAULT (0),
    IsActive BIT NOT NULL CONSTRAINT DF_SampleTable_IsActive DEFAULT (1),
    CreatedAt DATETIME2(3) NOT NULL CONSTRAINT DF_SampleTable_CreatedAt DEFAULT (SYSDATETIME()),
    UpdatedAt DATETIME2(3) NULL,
    
    CONSTRAINT PK_SampleTable PRIMARY KEY CLUSTERED (Id ASC),
    CONSTRAINT UQ_SampleTable_Code UNIQUE NONCLUSTERED (Code ASC),
    CONSTRAINT CK_SampleTable_Amount CHECK (Amount >= 0)
);
`,
  },
  {
    id: 'basic-insert-not-exists',
    title: '防重複批次插入 (INSERT INTO ... WHERE NOT EXISTS)',
    category: 'basic',
    categoryLabel: '常用語法',
    tags: ['insert', 'where not exists', '防重複', '批次插入'],
    description: '從來源表或暫存表篩選出目標表尚不存在的記錄批次匯入，避免 Primary Key 或 Unique 索引衝突報錯。',
    code: `-- 防重複插入 (INSERT INTO ... SELECT ... WHERE NOT EXISTS)
INSERT INTO dbo.TargetUsers (Username, Email, CreatedAt)
SELECT 
    s.Username,
    s.Email,
    SYSDATETIME()
FROM dbo.SourceStaging AS s
WHERE NOT EXISTS (
    SELECT 1 
    FROM dbo.TargetUsers AS t 
    WHERE t.Username = s.Username
);
`,
  },
  {
    id: 'basic-declare-variables',
    title: '純量變數宣告與賦值 (DECLARE & SET / SELECT)',
    category: 'basic',
    categoryLabel: '常用語法',
    tags: ['declare', 'set', 'select', '變數', 'variable', '純量變數'],
    description: '展示 T-SQL 變數宣告、多變數合併宣告、預設值賦值、SET 與 SELECT 賦值的差異與注意事項（SET 賦值若多列會報錯或僅支援單值，SELECT 可同時賦值多個變數但若查詢回傳多列時僅保留最後一列的值）。',
    code: `-- 1. 純量變數宣告與行內初始化 (SQL Server 2008+)
DECLARE 
    @UserId INT = 1001,
    @UserName NVARCHAR(50) = N'SQLight User',
    @StartDate DATE = '2026-01-01',
    @TotalAmount DECIMAL(18, 2) = 0.00,
    @IsActive BIT = 1;

-- 2. 使用 SET 進行單一變數運算賦值 (標準規範)
SET @StartDate = DATEADD(MONTH, -1, GETDATE());

-- 3. 使用 SELECT 一次從資料表擷取並賦值多個變數
SELECT TOP 1
    @UserName = CustomerName,
    @TotalAmount = TotalSpent
FROM dbo.CustomerSummary
WHERE CustomerId = @UserId;

-- 4. 輸出檢驗結果
SELECT 
    @UserId AS [使用者ID],
    @UserName AS [名稱],
    @StartDate AS [查詢起始日],
    @TotalAmount AS [總消費額],
    @IsActive AS [有效狀態];
`,
  },
  {
    id: 'basic-table-variable',
    title: '資料表變數宣告與操作 (DECLARE @TableVariable)',
    category: 'basic',
    categoryLabel: '常用語法',
    tags: ['table variable', '資料表變數', 'declare table', '暫存', '記憶體變數', '變數'],
    description: '宣告輕量記憶體/tempdb 資料表變數，支援主鍵、預設值與直接 INSERT / UPDATE / JOIN。適用於小量資料集（建議小於 1,000 筆）。特點：不受交易 ROLLBACK 影響（即使交易回滾，@Table 內的資料仍保留）。',
    code: `-- 資料表變數宣告與應用 (適合 < 1,000 筆之小量快取)
-- 注意: 資料表變數不受交易 ROLLBACK 影響 (即使交易回滾，@Table 內的資料仍保留)
DECLARE @SelectedUsers TABLE (
    UserId INT PRIMARY KEY,
    UserName NVARCHAR(50) NOT NULL,
    CreatedAt DATETIME2(3) DEFAULT SYSDATETIME()
);

-- 1. 批次匯入資料至資料表變數
INSERT INTO @SelectedUsers (UserId, UserName)
SELECT CustomerId, CustomerName
FROM dbo.Customers
WHERE IsActive = 1 AND City = 'Taipei';

-- 2. 像實體表一樣與其他資料表關聯查詢
SELECT 
    u.UserId,
    u.UserName,
    COUNT(o.OrderId) AS OrderCount,
    ISNULL(SUM(o.TotalAmount), 0) AS TotalSpent
FROM @SelectedUsers AS u
LEFT JOIN dbo.Orders AS o ON u.UserId = o.CustomerId
GROUP BY u.UserId, u.UserName;
`,
  },
  {
    id: 'basic-temp-table',
    title: '區域暫存表建立與索引最佳化 (CREATE TABLE #TempTable)',
    category: 'basic',
    categoryLabel: '常用語法',
    tags: ['temp table', '暫存表', 'hashtag', '索引', 'tempdb', '效能', '變數'],
    description: '大量中繼資料處理標準做法。說明安全清除舊表 (OBJECT_ID(\'tempdb..#...\'))、顯式宣告欄位型別、並為暫存表建立叢集與非叢集索引以大幅提升大型查詢效能。',
    code: `-- 區域暫存表標準處理範本 (適合中大型資料集與中繼運算)
-- 1. 安全刪除可能已存在的舊暫存表
IF OBJECT_ID('tempdb..#OrderStaging') IS NOT NULL
BEGIN
    DROP TABLE #OrderStaging;
END;

-- 2. 顯式宣告暫存表結構 (強烈建議明確宣告型別，取代 SELECT INTO 避免隱式轉換)
CREATE TABLE #OrderStaging (
    OrderId BIGINT NOT NULL,
    CustomerId INT NOT NULL,
    OrderDate DATETIME2(3) NOT NULL,
    TotalAmount DECIMAL(18, 2) NOT NULL,
    
    CONSTRAINT PK_OrderStaging PRIMARY KEY CLUSTERED (OrderId ASC)
);

-- 3. 建立輔助非叢集索引優化關聯效能
CREATE NONCLUSTERED INDEX IX_OrderStaging_Customer 
ON #OrderStaging (CustomerId ASC) 
INCLUDE (TotalAmount);

-- 4. 載入資料
INSERT INTO #OrderStaging (OrderId, CustomerId, OrderDate, TotalAmount)
SELECT OrderId, CustomerId, OrderDate, TotalAmount
FROM dbo.Orders
WHERE OrderDate >= DATEADD(DAY, -30, GETDATE());

-- 5. 查詢中繼運算結果
SELECT 
    CustomerId,
    COUNT(OrderId) AS RecentOrdersCount,
    SUM(TotalAmount) AS RecentTotalSpent
FROM #OrderStaging
GROUP BY CustomerId;

-- 6. 使用完畢主動釋放 tempdb 空間
DROP TABLE #OrderStaging;
`,
  },
  {
    id: 'basic-system-variables',
    title: '常用系統函數與環境變數 (SCOPE_IDENTITY, @@ROWCOUNT, @@SPID)',
    category: 'basic',
    categoryLabel: '常用語法',
    tags: ['scope_identity', 'rowcount', 'error', 'spid', '系統變數', '環境變數', '變數'],
    description: '展示新增後安全取得新增 ID (SCOPE_IDENTITY() 防 Trigger 干擾)、立即擷取受影響筆數 (@@ROWCOUNT)、連線資訊 (@@SPID) 與資料庫名稱。注意：@@ROWCOUNT 必須立即轉存，否則下一個陳述式會將其覆寫。',
    code: `-- 常用系統變數與環境狀態擷取
-- 1. 取得最新新增的識別值 (推薦使用 SCOPE_IDENTITY() 防止觸發程序 Trigger 干擾)
INSERT INTO dbo.AuditLogs (Action, Note)
VALUES ('LOGIN', N'使用者登入驗證成功');

DECLARE @NewId INT = SCOPE_IDENTITY();

-- 2. 立即擷取前一個陳述式受影響的資料列數 (必須立即轉存至變數)
DECLARE @AffectedRows INT = @@ROWCOUNT;

-- 3. 擷取當前連線工作階段資訊
DECLARE @CurrentSpid INT = @@SPID;
DECLARE @ServerName NVARCHAR(128) = @@SERVERNAME;
DECLARE @DbName NVARCHAR(128) = DB_NAME();

SELECT 
    @NewId AS [最新新增ID],
    @AffectedRows AS [受影響資料列數],
    @CurrentSpid AS [目前連線SPID],
    @ServerName AS [伺服器名稱],
    @DbName AS [當前資料庫];
`,
  },
  {
    id: 'basic-table-type-tvp',
    title: '自訂資料表型別與 TVP 批次傳遞 (User-Defined Table Type / TVP)',
    category: 'basic',
    categoryLabel: '常用語法',
    tags: ['tvp', 'table type', '型別', '批次傳遞', '預存程序參數', '變數'],
    description: '建立可重複使用的結構化資料表型別，宣告為變數並作為批次陣列傳入預存程序 (Stored Procedure)，是微軟官方推薦解決批次多筆傳入的最佳解法。',
    code: `-- 1. 建立可重複使用的資料表型別 (如果尚未建立)
IF NOT EXISTS (SELECT 1 FROM sys.types WHERE name = 'IntIdListType' AND is_table_type = 1)
BEGIN
    CREATE TYPE dbo.IntIdListType AS TABLE (
        Id INT PRIMARY KEY
    );
END;

-- 2. 宣告該型別變數並填入批次待處理清單
DECLARE @TargetIds dbo.IntIdListType;

INSERT INTO @TargetIds (Id)
VALUES (101), (105), (209), (312), (405);

-- 3. 以 INNER JOIN 方式高效批次過濾查詢
SELECT 
    o.OrderId,
    o.CustomerId,
    o.TotalAmount,
    o.Status
FROM dbo.Orders AS o
INNER JOIN @TargetIds AS t ON o.OrderId = t.Id;
`,
  },

  // ==========================================
  // 2. CTE 語法 (Common Table Expressions)
  // ==========================================

  {
    id: 'cte-multiple-chained',
    title: '多重模組化 CTE 串接 (Multiple CTEs Pipeline)',
    category: 'cte',
    categoryLabel: 'CTE 語法',
    tags: ['cte', 'with', '模組化', '多重cte', '子查詢優化'],
    description: '以 WITH 語法宣告多個公用資料表運算式 (CTE)，將複雜的業務分析依序拆解為「資料清洗」、「分組匯總」與「最終聯集」，大幅提升 SQL 的可讀性與維護性。注意：WITH 前一個陳述式必須加分號。',
    code: `-- 多重 CTE 串接範本 (模組化資料管線)
-- 注意: T-SQL 規定 WITH 前方必須有分號 (;) 分隔
;WITH Step1_SalesAggregate AS (
    -- 步驟 1: 匯總各客戶近 1 年訂單金額
    SELECT 
        CustomerId,
        SUM(TotalAmount) AS TotalSpent,
        COUNT(OrderId) AS OrderCount
    FROM dbo.Orders
    WHERE OrderDate >= DATEADD(YEAR, -1, GETDATE())
    GROUP BY CustomerId
),
Step2_HighValueFilter AS (
    -- 步驟 2: 篩選出消費超過門檻之高價值客戶
    SELECT 
        CustomerId,
        TotalSpent,
        OrderCount
    FROM Step1_SalesAggregate
    WHERE TotalSpent >= 50000
)
-- 步驟 3: 與客戶主檔串接呈現最終分析結果
SELECT 
    c.Id AS CustomerId,
    c.CustomerName,
    c.Email,
    h.TotalSpent,
    h.OrderCount
FROM Step2_HighValueFilter AS h
INNER JOIN dbo.Customers AS c ON h.CustomerId = c.Id
ORDER BY h.TotalSpent DESC;
`,
  },
  {
    id: 'cte-recursive-hierarchy',
    title: '遞迴 CTE - 樹狀組織與階層展開 (Recursive CTE Hierarchy)',
    category: 'cte',
    categoryLabel: 'CTE 語法',
    tags: ['cte', 'recursive', '遞迴', '階層樹', 'parent_id', '組織圖'],
    description: '展開員工主管關係、部門樹狀架構或多層分類目錄。包含定位點成員 (Anchor Member) 與遞迴成員 (Recursive Member)，並動態產出階層深度 (Level) 與完整階層路徑 (Path)。建議搭配 OPTION (MAXRECURSION 100) 防止無窮循環。',
    code: `-- 遞迴 CTE: 樹狀階層展開 (如部門結構、主管部屬、分類樹)
;WITH OrgHierarchy AS (
    -- 1. 定位點成員 (Anchor): 最上層節點 (ParentId / ManagerId 為 NULL)
    SELECT 
        EmployeeId,
        EmployeeName,
        ManagerId,
        0 AS HierarchyLevel,
        CAST(EmployeeName AS NVARCHAR(MAX)) AS HierarchyPath
    FROM dbo.Employees
    WHERE ManagerId IS NULL

    UNION ALL

    -- 2. 遞迴成員 (Recursive): 透過 JOIN 往下層層遍歷子節點
    SELECT 
        e.EmployeeId,
        e.EmployeeName,
        e.ManagerId,
        o.HierarchyLevel + 1 AS HierarchyLevel,
        CAST(o.HierarchyPath + N' > ' + e.EmployeeName AS NVARCHAR(MAX)) AS HierarchyPath
    FROM dbo.Employees AS e
    INNER JOIN OrgHierarchy AS o ON e.ManagerId = o.EmployeeId
)
SELECT 
    HierarchyLevel,
    REPLICATE(N'  ', HierarchyLevel) + EmployeeName AS IndentedName,
    HierarchyPath,
    EmployeeId,
    ManagerId
FROM OrgHierarchy
ORDER BY HierarchyPath
OPTION (MAXRECURSION 100); -- 預設上限 100，若超過可調整 (0 代表無限制)
`,
  },
  {
    id: 'cte-deduplication',
    title: 'CTE 搭配 ROW_NUMBER 精準刪除重複資料 (Deduplication)',
    category: 'cte',
    categoryLabel: 'CTE 語法',
    tags: ['cte', 'row_number', '重複資料', 'delete', '去重'],
    description: '利用 CTE 結合視窗函數 ROW_NUMBER()，依據業務鍵值 (PARTITION BY) 分組並依時間 (ORDER BY) 排序，直接對 CTE 執行 DELETE 刪除 RowNum > 1 的重複資料列，乾淨俐落且無須暫存表。',
    code: `-- 利用 CTE + ROW_NUMBER() 精準刪除重複資料 (保留最新一筆)
;WITH RankedDuplicates AS (
    SELECT 
        *,
        ROW_NUMBER() OVER (
            PARTITION BY UserEmail, SystemCode -- 指定依據哪些鍵值判定為「重複」
            ORDER BY CreatedAt DESC           -- 保留最新一筆 (若要保留最早建立改為 ASC)
        ) AS RowSeq
    FROM dbo.UserProfile
)
DELETE FROM RankedDuplicates
WHERE RowSeq > 1; -- 刪除所有第 2 筆以後的重複資料
`,
  },
  {
    id: 'cte-date-series-generator',
    title: '遞迴 CTE - 動態產生連續日期維度 (Date Range Generator)',
    category: 'cte',
    categoryLabel: 'CTE 語法',
    tags: ['cte', 'recursive', '日期維度', '連續日期', '報表補零'],
    description: '無需在資料庫中額外建立日曆實體表，透過遞迴 CTE 動態生成指定區間（如整月份、整年）的每日連續日期列表，方便與業務報表 LEFT JOIN 進行無資料日期的補零計算。',
    code: `-- 遞迴 CTE: 動態產生連續日期維度 (報表補零必備)
DECLARE @StartDate DATE = '2026-01-01';
DECLARE @EndDate DATE = '2026-01-31';

;WITH DateSeries AS (
    SELECT @StartDate AS [CalendarDate]
    UNION ALL
    SELECT DATEADD(DAY, 1, [CalendarDate])
    FROM DateSeries
    WHERE [CalendarDate] < @EndDate
)
SELECT 
    [CalendarDate],
    DATENAME(WEEKDAY, [CalendarDate]) AS [DayOfWeek],
    DATEPART(ISO_WEEK, [CalendarDate]) AS [WeekNumber]
FROM DateSeries
OPTION (MAXRECURSION 366);
`,
  },

  // ==========================================
  // 3. 進階用法與說明 (Advanced Features)
  // ==========================================
  {
    id: 'adv-window-functions',
    title: '視窗函數進階計算 (Window Functions: Running Total & Rank)',
    category: 'advanced',
    categoryLabel: '進階用法',
    tags: ['window functions', 'over', 'partition by', 'running total', 'dense_rank', 'lag'],
    description: '展示 ROW_NUMBER (唯一序號)、DENSE_RANK (不跳號排名)、SUM() OVER (累積加總 Running Total) 與 LAG() (前期數值比較) 的進階組合計算。',
    code: `-- 視窗函數進階計算 (分組排序、累積加總、前期比較)
SELECT 
    OrderId,
    CustomerId,
    OrderDate,
    TotalAmount,
    -- 1. 客戶內部金額排名 (不跳號排名)
    DENSE_RANK() OVER (PARTITION BY CustomerId ORDER BY TotalAmount DESC) AS CustAmountRank,
    
    -- 2. 累積銷售總額 (Running Total，累積至當前列)
    SUM(TotalAmount) OVER (
        PARTITION BY CustomerId 
        ORDER BY OrderDate ASC 
        ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
    ) AS CustomerRunningTotal,
    
    -- 3. 與上一筆訂單金額比較 (前期差額分析)
    TotalAmount - LAG(TotalAmount, 1, TotalAmount) OVER (
        PARTITION BY CustomerId 
        ORDER BY OrderDate ASC
    ) AS AmountDiffFromPrev
FROM dbo.Orders;
`,
  },
  {
    id: 'adv-cross-apply-top-n',
    title: 'CROSS APPLY 取得各組最新 Top N 記錄 (Apply Pattern)',
    category: 'advanced',
    categoryLabel: '進階用法',
    tags: ['cross apply', 'outer apply', 'top n', '分組最新', 'tvf'],
    description: '使用 CROSS APPLY 對每一筆外層資料列即時求值內層關聯查詢。最經典應用為：取得每個客戶、產品分類或部門的「最新前 3 筆明細」，效能遠優於傳統全表 ROW_NUMBER()。',
    code: `-- CROSS APPLY: 取得每個客戶的「最新 3 筆訂單」
SELECT 
    c.Id AS CustomerId,
    c.CustomerName,
    topOrders.OrderId,
    topOrders.OrderDate,
    topOrders.TotalAmount
FROM dbo.Customers AS c
CROSS APPLY (
    SELECT TOP 3 
        o.OrderId,
        o.OrderDate,
        o.TotalAmount
    FROM dbo.Orders AS o
    WHERE o.CustomerId = c.Id
    ORDER BY o.OrderDate DESC -- 排序抓取最新 3 筆
) AS topOrders
ORDER BY c.Id, topOrders.OrderDate DESC;
`,
  },
  {
    id: 'adv-string-split-agg',
    title: '原生字串拆分與聚合 (STRING_SPLIT & STRING_AGG)',
    category: 'advanced',
    categoryLabel: '進階用法',
    tags: ['string_split', 'string_agg', '字串處理', 'group_concat', 'csv'],
    description: 'SQL Server 2016/2017+ 內建的高效原生字串函數。STRING_AGG 實現類似 GROUP_CONCAT 的字串合併；STRING_SPLIT 將逗號隔開的字串清單展開為多筆資料列。',
    code: `-- 1. 字串聚合: 將同一組的多列名稱串接為一行 (SQL Server 2017+)
SELECT 
    DepartmentId,
    STRING_AGG(EmployeeName, ', ') WITHIN GROUP (ORDER BY EmployeeName ASC) AS MemberList
FROM dbo.Employees
GROUP BY DepartmentId;

-- 2. 字串拆分: 將 CSV 字串展開為關聯資料列 (SQL Server 2016+)
DECLARE @IdList NVARCHAR(MAX) = '101, 105, 203, 408';

SELECT 
    CAST(TRIM(value) AS INT) AS TargetId
FROM STRING_SPLIT(@IdList, ',')
WHERE TRIM(value) <> '';
`,
  },
  {
    id: 'adv-dynamic-pivot',
    title: '動態 PIVOT 行列轉置 (Dynamic PIVOT SQL)',
    category: 'advanced',
    categoryLabel: '進階用法',
    tags: ['pivot', '動態sql', '行列轉換', 'sp_executesql'],
    description: '將縱向的多列分類數據動態轉置為橫向欄位（例如將各年份、月份或產品類別動態展開為直欄）。自動透過 STRING_AGG 與 QUOTENAME 組裝欄位清單。',
    code: `-- 動態 PIVOT (動態抓取類別展開為直欄)
DECLARE @Cols AS NVARCHAR(MAX);
DECLARE @Sql AS NVARCHAR(MAX);

-- 步驟 1: 動態抓取不重複的類別名稱並以逗號隔開
SELECT @Cols = STRING_AGG(QUOTENAME(CategoryName), ', ') WITHIN GROUP (ORDER BY CategoryName)
FROM (
    SELECT DISTINCT CategoryName 
    FROM dbo.ProductSales
) AS cats;

-- 步驟 2: 組裝動態 PIVOT 語法
SET @Sql = N'
SELECT 
    SaleYear, ' + @Cols + N'
FROM (
    SELECT 
        SaleYear, 
        CategoryName, 
        TotalAmount
    FROM dbo.ProductSales
) AS SourceTable
PIVOT (
    SUM(TotalAmount)
    FOR CategoryName IN (' + @Cols + N')
) AS PivotTable
ORDER BY SaleYear DESC;';

-- 步驟 3: 執行安全動態 SQL
EXEC sp_executesql @stmt = @Sql;
`,
  },
  {
    id: 'adv-robust-try-catch-transaction',
    title: '生產級安全交易與錯誤捕捉 (TRY...CATCH + XACT_ABORT)',
    category: 'advanced',
    categoryLabel: '進階用法',
    tags: ['try catch', 'transaction', 'xact_abort', 'xact_state', '錯誤處理'],
    description: '企業級與金融級強健交易規範。包含 SET XACT_ABORT ON（遇到執行期錯誤自動終止）、XACT_STATE() 判斷交易是否有效、防範幽靈交易 (Zombie Transaction) 與詳細錯誤訊息回報。',
    code: `-- 生產級安全交易範本 (TRY...CATCH + XACT_ABORT)
SET NOCOUNT ON;
SET XACT_ABORT ON; -- 重要: 任一執行期錯誤發生即強制交易標記為 Uncommittable

BEGIN TRY
    BEGIN TRANSACTION;

    -- 業務操作步驟 A
    UPDATE dbo.BankAccounts
    SET Balance = Balance - 1000
    WHERE AccountId = 101;

    -- 業務操作步驟 B
    UPDATE dbo.BankAccounts
    SET Balance = Balance + 1000
    WHERE AccountId = 202;

    COMMIT TRANSACTION;
    PRINT N'交易順利完成並成功提交 (Commit)。';
END TRY
BEGIN CATCH
    -- 判斷交易狀態，安全進行 ROLLBACK
    IF XACT_STATE() <> 0
    BEGIN
        ROLLBACK TRANSACTION;
        PRINT N'檢測到錯誤，交易已安全回復 (Rollback)。';
    END;

    -- 取得並向上拋出詳細錯誤資訊
    DECLARE @ErrMsg NVARCHAR(4000) = ERROR_MESSAGE();
    DECLARE @ErrSeverity INT = ERROR_SEVERITY();
    DECLARE @ErrState INT = ERROR_STATE();
    DECLARE @ErrLine INT = ERROR_LINE();

    RAISERROR(N'交易執行失敗: 行號 %d, 訊息: %s', @ErrSeverity, @ErrState, @ErrLine, @ErrMsg);
END CATCH;
`,
  },
  {
    id: 'adv-sp-executesql-params',
    title: '安全參數化動態 SQL (sp_executesql with Typed Params)',
    category: 'advanced',
    categoryLabel: '進階用法',
    tags: ['sp_executesql', '參數化', 'sql注入', '執行計畫快取', '動態sql'],
    description: '避免字串拼接引發的 SQL Injection 漏洞，並使 SQL Server 能重複複用編譯好的 Execution Plan 快取。支援輸入與輸出 (OUTPUT) 型別參數。',
    code: `-- 安全參數化動態 SQL (避免 SQL 注入並重複利用執行計畫)
DECLARE @Sql NVARCHAR(MAX);
DECLARE @ParamDef NVARCHAR(500);

-- 定義業務查詢變數
DECLARE @SearchKeyword NVARCHAR(100) = N'SQLight';
DECLARE @MinAmount DECIMAL(18, 2) = 5000.00;
DECLARE @TotalMatchCount INT;

-- 撰寫包含具名參數的 SQL 語法
SET @Sql = N'
SELECT 
    @OutCount = COUNT(*)
FROM dbo.Orders o
INNER JOIN dbo.Customers c ON o.CustomerId = c.Id
WHERE c.CustomerName LIKE @InKeyword + ''%''
  AND o.TotalAmount >= @InMinAmount;';

-- 定義各參數的型別宣告
SET @ParamDef = N'
    @InKeyword NVARCHAR(100),
    @InMinAmount DECIMAL(18, 2),
    @OutCount INT OUTPUT';

-- 透過系統預存程序 sp_executesql 傳遞型別安全參數
EXEC sp_executesql 
    @stmt = @Sql,
    @params = @ParamDef,
    @InKeyword = @SearchKeyword,
    @InMinAmount = @MinAmount,
    @OutCount = @TotalMatchCount OUTPUT;

SELECT @TotalMatchCount AS [符合條件筆數];
`,
  },
  {
    id: 'adv-json-parsing-generating',
    title: '原生 JSON 資料解析與轉換 (OPENJSON & FOR JSON PATH)',
    category: 'advanced',
    categoryLabel: '進階用法',
    tags: ['json', 'openjson', 'for json path', 'json_value'],
    description: 'SQL Server 2016+ 原生處理 JSON 資料。利用 OPENJSON 將傳入的 JSON 陣列直接轉為關聯表格進行 JOIN 或 INSERT，並展示利用 FOR JSON PATH 將查詢輸出成 JSON。',
    code: `-- 1. 解析 JSON 陣列為關聯表格 (OPENJSON)
DECLARE @JsonPayload NVARCHAR(MAX) = N'[
    {"id": 1, "name": "Alice", "role": "Admin", "email": "alice@company.com"},
    {"id": 2, "name": "Bob", "role": "Developer", "email": "bob@company.com"}
]';

SELECT 
    id,
    name,
    role,
    email
FROM OPENJSON(@JsonPayload)
WITH (
    id INT '$.id',
    name NVARCHAR(100) '$.name',
    role VARCHAR(50) '$.role',
    email VARCHAR(200) '$.email'
);

-- 2. 將查詢結果包裝為 JSON 物件陣列輸出
SELECT 
    CustomerId,
    CustomerName,
    (
        SELECT TOP 2 OrderId, TotalAmount 
        FROM dbo.Orders 
        WHERE CustomerId = c.Id 
        ORDER BY OrderDate DESC 
        FOR JSON PATH
    ) AS RecentOrdersJson
FROM dbo.Customers AS c
FOR JSON PATH, ROOT('CustomersData');
`,
  },
  {
    id: 'adv-batch-deletion-lock-escalation',
    title: '分批大量刪除歷史資料 (Batch Deletion to Prevent Lock Escalation)',
    category: 'advanced',
    categoryLabel: '進階用法',
    tags: ['batch delete', '分批刪除', '鎖定升級', 'lock escalation', '大量資料'],
    description: '清理數百萬筆過期日誌時，一次性 DELETE 會導致交易日誌檔 (LDF) 暴增並觸發全表鎖定升級 (Lock Escalation)。使用 WHILE 迴圈分批刪除能維持伺服器穩定與併發度。',
    code: `-- 分批刪除大量資料 (避免一次性鎖定升級與交易日誌檔暴增)
SET NOCOUNT ON;

DECLARE @BatchSize INT = 5000;    -- 每次刪除筆數 (建議 2000~5000)
DECLARE @RowsDeleted INT = @BatchSize;
DECLARE @TotalDeleted INT = 0;

WHILE @RowsDeleted = @BatchSize
BEGIN
    DELETE TOP (@BatchSize)
    FROM dbo.SystemAuditLogs
    WHERE CreatedAt < DATEADD(DAY, -180, SYSDATETIME());

    SET @RowsDeleted = @@ROWCOUNT;
    SET @TotalDeleted = @TotalDeleted + @RowsDeleted;

    -- 短暫暫停 100ms 讓其他連線獲得排程與磁碟 I/O
    WAITFOR DELAY '00:00:00.100';
END;

SELECT @TotalDeleted AS [累積刪除筆數];
`,
  },

  // ==========================================
  // 4. 診斷與維護 (Maintenance & Diagnostics)
  // ==========================================
  {
    id: 'maint-missing-indexes',
    title: '查詢系統建議建立之缺失索引 (Missing Indexes DMV)',
    category: 'maintenance',
    categoryLabel: '診斷維護',
    tags: ['dmv', 'missing index', '效能優化', '缺失索引', '調優'],
    description: '查詢 SQL Server 引擎自帶的 DMV 統計資料，找出能大幅降低查詢成本 (Impact > 50%) 的缺失索引建議與建議建表語法。',
    code: `-- 查詢高回報之缺失索引建議 (Missing Indexes)
SELECT TOP 20
    CONVERT(DECIMAL(18,2), migs.user_seeks * migs.avg_total_user_cost * (migs.avg_user_impact * 0.01)) AS ImprovementScore,
    migs.avg_user_impact AS ImprovementPercent,
    migs.user_seeks,
    db_name(mid.database_id) AS DatabaseName,
    OBJECT_SCHEMA_NAME(mid.object_id, mid.database_id) + '.' + OBJECT_NAME(mid.object_id, mid.database_id) AS TableName,
    'CREATE NONCLUSTERED INDEX IX_' + OBJECT_NAME(mid.object_id, mid.database_id) + '_' + 
        REPLACE(REPLACE(REPLACE(ISNULL(mid.equality_columns, ''), ', ', '_'), '[', ''), ']', '') +
        ' ON ' + mid.statement + ' (' + ISNULL(mid.equality_columns, '') +
        CASE WHEN mid.equality_columns IS NOT NULL AND mid.inequality_columns IS NOT NULL THEN ', ' ELSE '' END +
        ISNULL(mid.inequality_columns, '') + ')' +
        ISNULL(' INCLUDE (' + mid.included_columns + ')', '') AS SuggestedCreateIndexScript
FROM sys.dm_db_missing_index_groups mig
INNER JOIN sys.dm_db_missing_index_group_stats migs ON migs.group_handle = mig.index_group_handle
INNER JOIN sys.dm_db_missing_index_details mid ON mid.index_handle = mig.index_handle
WHERE migs.avg_user_impact > 30.0
ORDER BY ImprovementScore DESC;
`,
  },
  {
    id: 'maint-active-locks-blocking',
    title: '即時資料庫鎖定與阻塞源頭排查 (Locking & Blocking Queries)',
    category: 'maintenance',
    categoryLabel: '診斷維護',
    tags: ['lock', 'blocking', '阻塞', 'spid', '死鎖排查'],
    description: '即時查詢目前哪些連線正在被阻塞 (blocked)，以及造成阻塞的源頭 SPID、等待類型 (LCK_M_X) 與正在執行的 SQL 語法。',
    code: `-- 即時排查資料庫阻塞源頭與等待語法 (Blocking Queries)
SELECT 
    r.session_id AS BlockedSpid,
    r.blocking_session_id AS BlockingSpid,
    r.wait_type AS WaitType,
    r.wait_time / 1000.0 AS WaitTimeSeconds,
    r.status AS SessionStatus,
    r.command AS RunningCommand,
    DB_NAME(r.database_id) AS DatabaseName,
    SUBSTRING(t.text, (r.statement_start_offset/2)+1, 
        ((CASE r.statement_end_offset WHEN -1 THEN DATALENGTH(t.text) ELSE r.statement_end_offset END - r.statement_start_offset)/2) + 1) AS CurrentSqlText
FROM sys.dm_exec_requests r
CROSS APPLY sys.dm_exec_sql_text(r.sql_handle) t
WHERE r.blocking_session_id <> 0;
`,
  },

  // ==========================================
  // 5. 表結構探勘 (Table Inspection & Profile)
  // ==========================================
  ...TABLE_INSPECTION_TEMPLATES,
];

