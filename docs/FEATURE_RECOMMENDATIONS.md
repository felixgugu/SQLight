# SQLight 未來功能擴充與優化建議藍圖 (Feature Recommendations Blueprint)

> **版本**：v0.2.0-draft  
> **更新時間**：2026-09-16  
> **適用架構**：Tauri v2 + Rust (Tiberius TDS) + Vue 3 + Monaco Editor + AG Grid Community  

---

## 📖 目錄 (Table of Contents)

1. [執行摘要與現況評估 (Executive Summary & Status Review)](#1-執行摘要與現況評估-executive-summary--status-review)
2. [🎉 已落地交付之里程碑功能 (Completed Milestones)](#2--已落地交付之里程碑功能-completed-milestones)
3. [🥇 第一梯隊：安全守護與核心外銷 (P0 - Security & Core Data Export)](#3--第一梯隊安全守護與核心外銷-p0---security--core-data-export)
   - [3.1 🔴 生產環境防呆警示與危險操作攔截 (Production Safe Guard & Environment Badge)](#31--生產環境防呆警示與危險操作攔截-production-safe-guard--environment-badge)
   - [3.2 💾 實體檔案串流匯出精靈 (Native File Stream Exporter: Excel / CSV / JSON / SQL)](#32--實體檔案串流匯出精靈-native-file-stream-exporter-excel--csv--json--sql)
   - [3.3 🔐 連線設定檔安全加密匯入/匯出 (AES-256 Portable Encrypted Profiles)](#33--連線設定檔安全加密匯入匯出-aes-256-portable-encrypted-profiles)
4. [🥈 第二梯隊：專業 DBA 與結構深度洞察 (P1 - Pro DBA & Schema Deep Dive)](#4--第二梯隊專業-dba-與結構深度洞察-p1---pro-dba--schema-deep-dive)
   - [4.1 🧱 資料表結構進階檢視（索引管理、外鍵、檢查約束、觸發程序）](#41--資料表結構進階檢視索引管理外鍵檢查約束觸發程序)
   - [4.2 🔍 雙結果集資料比對工具 (Result Diff & Data Comparator)](#42--雙結果集資料比對工具-result-diff--data-comparator)
   - [4.3 🔗 外鍵關聯快速跳轉與資料穿透 (FK Quick Peek & Navigation)](#43--外鍵關聯快速跳轉與資料穿透-fk-quick-peek--navigation)
   - [4.4 ✏️ 資料瀏覽器 (`TableDataViewer`) 補齊行內編輯與「新增資料列」](#44--資料瀏覽器-tabledataviewer-補齊行內編輯與新增資料列)
5. [🥉 第三梯隊：巨量效能調校與現代 AI 體驗 (P2 - Scale, Performance & AI)](#5--第三梯隊巨量效能調校與現代-ai-體驗-p2---scale-performance--ai)
   - [5.1 ⚡ 伺服器端分頁與鍵值串流 (Server-side Pagination & Keyset Fetching)](#51--伺服器端分頁與鍵值串流-server-side-pagination--keyset-fetching)
   - [5.2 🤖 現代 AI SQL 助手 (BYOK LLM: 自然語言轉換、語法診斷與優化建議)](#52--現代-ai-sql-助手-byok-llm-自然語言轉換語法診斷與優化建議)
   - [5.3 📊 資料庫即時活動與鎖定監控儀表板 (Live Activity & Locks Monitor Dashboard)](#53--資料庫即時活動與鎖定監控儀表板-live-activity--locks-monitor-dashboard)
6. [建議實作路線圖 (Implementation Roadmap)](#6-建議實作路線圖-implementation-roadmap)

---

## 1. 執行摘要與現況評估 (Executive Summary & Status Review)

**SQLight** 經過快速迭代，已建構起極佳的桌面端架構優勢：
- 🚀 **極致啟動與記憶體表現**：採用 Tauri v2 + Rust 原生非同步核心，擺脫 Electron/JVM 動輒 500MB~1GB 的記憶體開銷。
- 💻 **流暢的編程與資料互動**：Monaco Editor 與 AG Grid Community 整合順暢，支援多結果集歷史、多欄選取統計、Excel 級別的複製粘貼。
- 🛡️ **安全交易防護網**：複合主鍵完整性嚴格驗證、自動交易保護 (`BEGIN TRAN ... ROLLBACK`)、`@@ROWCOUNT <> 1` 誤殺攔截。

在過去的藍圖中，許多原列為評估的項目已相繼研發落地（如 Spotlight 搜尋、查詢中斷與 Task Killer、IO 統計分析、自訂 SQL 範本庫、結果表格行內直接編輯等）。  
本修訂版藍圖針對**目前最新程式碼實作現況**進行全面體檢，剔除已完成項目，並依據實務生產痛點、使用者操作反饋與大型企業專案需求，重新梳理出下一階段最具商業與工程價值的優化方向。

---

## 2. 🎉 已落地交付之里程碑功能 (Completed Milestones)

以下項目已於近期版本中完成實作、通過單元測試並整合入主分支，現已納入專案常態維護：

| 功能項目 | 所屬模組 | 實作成效與重點亮點 |
| :--- | :--- | :--- |
| **⚡ 快速物件檢索器 (Spotlight `Ctrl+P`)** | `QuickObjectFinderModal.vue` | 支援 PascalCase/子序列模糊匹配、類型前綴篩選、彩標分類與直覺鍵盤捷徑導航。 |
| **🛑 長時間查詢中斷與取消 (Task Killer)** | `query_commands.rs`, `queryStore.ts` | 微秒級釋放細粒度連線鎖，按下 <kbd>Alt+Break</kbd> / <kbd>Esc</kbd> 即刻終止本地讀取並透過獨立連線發送 `KILL <spid>;`。 |
| **📊 執行統計與 IO 分析器** | `ExecutionStatsViewer.vue`, `statsParser.ts` | 解析 `STATISTICS IO, TIME`，呈現 5 大核心 KPI、單表 8KB 容量換算進度條與 Markdown 調校報告匯出。 |
| **🌐 實際執行計畫圖形檢視器** | `ExecutionPlanViewer.vue`, `planXmlParser.ts` | 抽離 XML Showplan，整合 `html-query-plan` 渲染算子圖形樹、相對成本百分比並支援匯出 `.sqlplan`。 |
| **🚀 客戶端 GO 批次分割引擎** | `sqlStatementExtractor.ts` | 狀態機掃描略過註解與字串內的 `GO`，支援多批次 DDL/DML 循序執行與訊息匯整。 |
| **🎯 物件總管游標快速定位** | `sqlIdentifierExtractor.ts`, `AppSidebar.vue` | 精準擷取游標/選取區物件識別字，側邊欄自動清除過濾遮蔽、連鎖展開、背景載入並置中光暈高亮。 |
| **📚 常用 SQL 範本庫與同層文件** | `SqlTemplateModal.vue`, `template_commands.rs` | 內建 4 大類常用/進階/維護語法，支援可攜版同層實體 `sql_custom_templates.json` 熱重載與 CRUD。 |
| **✏️ 結果表格行內編輯與安全批次變更** | `ResultGrid.vue`, `tableEditability.ts` | 雙擊儲存格直接編輯、琥珀色修訂提示、嚴格 PK 驗證、Monaco 語法審查確認對話框與交易回滾防護。 |
| **🛠️ 資料表結構 ALTER 產生器** | `TableStructureViewer.vue`, `alterTableGenerator.ts` | 支援右鍵產生 `ALTER COLUMN`、`DROP COLUMN`、`ADD COLUMN` 等標準 T-SQL 變更腳本。 |
| **🔍 物件總管 ComboBox 歷史記憶過濾** | `AppSidebar.vue`, `filterHistory.ts` | 側邊欄過濾框升級為 ComboBox，支援 30 筆 LRU 歷史搜尋記錄、一鍵清除與鍵盤歷史選取。 |

---

## 3. 🥇 第一梯隊：安全守護與核心外銷 (P0 - Security & Core Data Export)

### 3.1 🔴 生產環境防呆警示與危險操作攔截 (Production Safe Guard & Environment Badge)

#### 痛點描述
在現代多環境開發流程中，工程師常同時開啟本機開發庫 (Dev)、測試庫 (Staging) 與正式生產庫 (Prod)。一旦在生產環境誤執行了無 `WHERE` 條件的 `UPDATE`、`DELETE` 或誤執行了 `DROP TABLE` / `TRUNCATE TABLE`，將造成不可逆的災難性資料遺失。

#### 設計方案
1. **連線設定擴充環境識別 (Environment Profile)**：
   - 🔴 **Production (生產環境)**
   - 🟡 **Staging / UAT (測試環境)**
   - 🟢 **Development / Local (開發環境)**
2. **沉浸式高警示視覺渲染**：
   - 頂部連線下拉選單、側邊欄連線圖示、以及當前活動中的 Monaco 編輯分頁頂部邊框，自動套用對應環境主題色彩（生產庫套用鮮明警示紅）。
   - 狀態列與分頁標籤常駐醒目徽章（如 `[PROD]`、`[UAT]`）。
3. **危險語句攔截器 (Dangerous Operation Guard)**：
   - 當連線為 `Production` 時，使用者按下執行（<kbd>Ctrl+Enter</kbd>）時自動進行語法預先審查。
   - 若偵測到包含 `UPDATE` 或 `DELETE` 且**未檢測到 `WHERE` 關鍵字**，強制彈出全域紅色阻絕彈窗：
     > 「⚠️ 警告：偵測到生產環境無條件更新/刪除！此操作將影響整張資料表全部資料。」
   - 對於 `DROP`、`TRUNCATE`、`ALTER` 等 DDL 操作，要求使用者在彈窗中**手動鍵入目標資料庫名稱或指定驗證碼 (如 `EXECUTE`)** 方可解鎖執行。

---

### 3.2 💾 實體檔案串流匯出精靈 (Native File Stream Exporter: Excel / CSV / JSON / SQL)

#### 痛點描述
目前系統僅支援「複製至剪貼簿」。當查詢結果達到 10,000 ~ 100,000 列以上時：
1. 剪貼簿往往因資料量過大發生記憶體溢出或崩潰。
2. 業務同仁需要實體 `.xlsx` 或 `.csv` 檔案，手動貼入 Excel 容易發生格式跑掉、科學記號失真（如電話號碼或身分證號丟失前導 0）。
3. Windows Excel 開啟一般 UTF-8 CSV 時常出現中文亂碼。

#### 設計方案
1. **工具列與右鍵選單新增「匯出實體檔案 (Export to File)」**：
   - 📊 **Excel 活頁簿 (.xlsx)**：支援將當前結果集或全部結果集直接產出為真實 Excel 檔案，保留型別（字串保持為文字避免被轉成科學記號）、欄位寬度自動微調、首列凍結與標題加粗。
   - 📄 **CSV / TSV 檔案 (.csv)**：支援**自動寫入 UTF-8 BOM 檔頭 (`0xEF, 0xBB, 0xBF`)**，確保繁體中文/簡體中文於 Excel 開啟時 100% 不亂碼；支援逗號、Tab、分號自訂分隔符。
   - 📦 **JSON 格式檔案 (.json)**：整份結果集格式化為 `[ { "col": val }, ... ]` 實體檔案儲存。
   - 📝 **SQL 批次插入腳本 (.sql)**：將查詢結果自動產生為帶有 `SET IDENTITY_INSERT ON/OFF`、每 1,000 筆分批的 `INSERT INTO ... VALUES` 腳本檔案。
2. **串流式保存 (Stream Saving)**：
   - 整合 Tauri 的 `save` 對話框選擇本機路徑。
   - 大資料量時採用分塊（Chunking）方式寫入硬碟，並在狀態列顯示匯出進度條，避免前端主執行緒凍結。

---

### 3.3 🔐 連線設定檔安全加密匯入/匯出 (AES-256 Portable Encrypted Profiles)

#### 痛點描述
- SQLight 目前透過作業系統 Keychain 保存密碼，連線設定則存於 `%LOCALAPPDATA%`。
- 當使用者更換電腦、重灌系統，或團隊內部需要共享一組資料庫連線清單時，無法方便地遷移設定，每次都要重新手動填寫 Host、Port、帳號、密碼。

#### 設計方案
1. **連線管理器「匯出連線設定檔 (Export Profiles)」**：
   - 使用者可勾選欲匯出的連線設定。
   - 提示設定一組「主密碼 (Master Password)」。
   - 系統利用 `AES-256-GCM` 搭配 `PBKDF2` / `Argon2` 金鑰衍生演算法，將包含密碼在內的連線組態加密產出為副檔名為 `.sqlight.enc` 的安全設定檔。
2. **「匯入連線設定檔 (Import Profiles)」**：
   - 選擇檔案並輸入主密碼進行解密驗證。
   - 提供連線衝突比對介面（覆蓋、略過、重新命名保留兩者），一鍵將密碼安全寫入新環境的 OS Keychain。

---

## 4. 🥈 第二梯隊：專業 DBA 與結構深度洞察 (P1 - Pro DBA & Schema Deep Dive)

### 4.1 🧱 資料表結構進階檢視（索引管理、外鍵、檢查約束、觸發程序）

#### 痛點描述
目前 `TableStructureViewer` 專注於 12 大欄位中繼屬性。但在進行資料庫日常維護、效能調優與 Schema 設計時，工程師與 DBA 必須深入掌握**索引佈局、外鍵關聯、檢查條件與觸發器**。

#### 設計方案
在 `TableStructureViewer` 頂部增設次級標籤導覽列 (Sub-Tabs)：
1. 📋 **欄位清單 (Columns)**：現有 12 大中繼資料表（Ordinal, PK, Type, Nullable, Identity, Default 等）。
2. 🗂️ **索引清單 (Indexes)**：
   - 呈現索引名稱、類型（聚集 Clustered / 非聚集 Non-Clustered / 唯一 Unique / 空間空間 / 欄位存放區 Columnstore）。
   - 鍵值欄位清單 (Key Columns)、包含欄位清單 (Included Columns, `INCLUDE`)、篩選述詞 (Filter Definition)。
   - 即時顯示索引破碎度百分比 (`Fragmentation %`)、頁面數與大小。
   - 右鍵操作選單：支援一鍵產生 `REORGANIZE`、`REBUILD WITH (ONLINE = ON)` 或 `DROP INDEX` 語句。
3. 🔗 **外鍵關聯 (Foreign Keys)**：
   - 外鍵約束名稱、本表參照欄位、目標關聯表、目標主鍵欄位。
   - 連動規則狀態：`ON UPDATE CASCADE/NO ACTION`、`ON DELETE CASCADE/SET NULL`。
4. 🛡️ **條件約束 (Check Constraints & Defaults)**：
   - 約束名稱、約束定義條件式（如 `[Status] IN ('A', 'I', 'D')`）、是否啟用或信任狀態。
5. ⚡ **觸發程序 (Triggers)**：
   - 觸發程序名稱、事件類型 (`AFTER INSERT` / `AFTER UPDATE` / `INSTEAD OF`)、啟用狀態，支援雙擊檢視觸發程序原始碼。

---

### 4.2 🔍 雙結果集資料比對工具 (Result Diff & Data Comparator)

#### 痛點描述
在進行下列工作情境時，缺乏直觀的比對工具是開發者的大痛點：
- 重構舊版大型 Stored Procedure 或複雜 CTE 查詢時，需要驗證「重構前後輸出的資料筆數與每個欄位值是否 100% 完全相同」。
- 排查正式環境與測試環境資料不一致問題時。

#### 設計方案
1. **入口方式**：
   - 於下方任何一個 Results 分頁標籤按右鍵，選擇「**與其他結果分頁比對 (Compare with Tab...)**」。
2. **雙欄/單欄差分視覺化檢視 (Diff Grid)**：
   - 自動對齊兩組結果集的欄位結構與總列數。
   - 支援指定基準比對鍵（Primary Key 或特定欄位），若未指定則依行號逐列對齊。
   - **高亮差異標記**：
     - 🟩 僅存在於左側/右側的列（新增/刪除列）。
     - 🟨 內容不同的儲存格（標示：`舊值 ➔ 新值`），並於懸浮卡片顯示差異字串。
   - 頂部顯示摘要統計（如：98% 相同，2 筆資料差異，0 筆欄位結構不符）。

---

### 4.3 🔗 外鍵關聯快速跳轉與資料穿透 (FK Quick Peek & Navigation)

#### 痛點描述
在檢視訂單表 `Orders` 時，看到 `CustomerID = 1045` 或 `EmployeeID = 5`，使用者若想了解該客戶是誰，只能手動另開分頁或重新手寫 `SELECT * FROM Customers WHERE CustomerID = 1045`，流程繁瑣中斷思路。

#### 設計方案
1. **外鍵標記識別**：
   - 資料表格載入時，比對 Schema 中繼資料中的外鍵定義。
   - 凡屬於外鍵的欄位，標題或儲存格旁顯示微型的藍色關聯小圖示（`ExternalLink`）。
2. **快速懸浮預覽 (Quick Peek)**：
   - 滑鼠懸停於外鍵儲存格時，彈出小懸浮卡片，非同步讀取並展示對應父表的首要資訊（如客戶名稱、電話、地址）。
3. **一鍵跳轉關聯查詢 (Jump to Referenced Row)**：
   - 點擊外鍵圖示或右鍵選單「**跳轉至關聯資料 (Go to Referenced Table)**」：
   - 自動於新分頁開啟該父表，並自動附加 `WHERE CustomerID = '1045'` 條件精確定位。

---

### 4.4 ✏️ 資料瀏覽器 (`TableDataViewer`) 補齊行內編輯與「新增資料列」

#### 痛點描述
目前已於 `ResultGrid` 實作了儲存格行內編輯與安全批次更新。然而：
1. 從側邊欄右鍵「開啟資料表 (Open Data)」所開啟的 `TableDataViewer` 元件尚未同步享有此功能。
2. 現有行內編輯僅支援修改既有列，尚未支援「**新增資料列 (Insert New Row)**」。

#### 設計方案
1. **共用編輯模組**：
   - 將 `ResultGrid` 中成熟的 `tableEditability`、修改暫存追蹤（`modifiedCellsMap`）與 `batchUpdateGenerator` 抽取為共用 Composable，讓 `TableDataViewer` 立即具備行內雙擊修改能力。
2. **增設「+ 新增列」功能**：
   - 表格工具列新增「新增一列 (Add Row)」按鈕。
   - 在表格第一列插入高亮為綠色的待寫入空列，自動鎖定 Identity 欄位。
   - 填寫完畢後點擊「提交變更」，自動產出標準、具防護的 `INSERT INTO ... VALUES (...)` 腳本供預覽與確認執行。

---

## 5. 🥉 第三梯隊：巨量效能調校與現代 AI 體驗 (P2 - Scale, Performance & AI)

### 5.1 ⚡ 伺服器端分頁與鍵值串流 (Server-side Pagination & Keyset Fetching)

#### 痛點描述
目前系統透過全域設定的 `max_rows`（如 5,000 或 10,000 筆）進行客戶端筆數截斷。當使用者需要在數千萬筆的大型日誌表（Logs）中翻找資料時，無法有效且低耗地進行大範圍瀏覽。

#### 設計方案
1. **資料瀏覽器啟用伺服器端動態分頁 (Server-side Pagination)**：
   - 在 `TableDataViewer` 底部增設分頁導覽控制條（第一頁、上一頁、頁碼、下一頁、每頁筆數：100 / 500 / 1,000）。
   - 底層自動運用 T-SQL `OFFSET ... ROWS FETCH NEXT ... ROWS ONLY`，或基於主鍵的 Keyset Pagination 進行高效伺服器端翻頁，記憶體佔用恆定維持在個位數 MB。

---

### 5.2 🤖 現代 AI SQL 助手 (BYOK LLM: 自然語言轉換、語法診斷與優化建議)

#### 痛點描述
- 許多業務分析師或初階工程師不熟悉 T-SQL 複雜的視窗函數、PIVOT、或 CTE 語法。
- 當 SQL 執行報錯（如 Msg 8120 Group By 欄位未聚合、Msg 547 外鍵條件衝突）時，新手往往需要花費時間在 Google/StackOverflow 上搜尋原因。

#### 設計方案
1. **BYOK (Bring Your Own Key) 自備金鑰架構**：
   - 在設定中提供 OpenAI / Anthropic / Gemini / 本地 Ollama 相容之 API Endpoint 與 Key 設定。
   - 絕不上傳使用者資料表中的隱私資料內容，僅傳送使用者編寫的 SQL 語句與簡短 Schema DDL 結構。
2. **Monaco 編輯器內建 AI 側欄或浮動面板**：
   - 💬 **自然語言轉 SQL (Text to SQL)**：輸入「*幫我統計過去 30 天每個業務員的成交總金額並列出排名前 5 名*」，即刻產出正確的 T-SQL 程式碼並附帶反白確認。
   - 🩺 **SQL 報錯一鍵除錯解釋 (Explain Error)**：當查詢出錯時，訊息面板旁顯示「**AI 診斷**」按鈕，點擊立即解析錯誤代碼、定位語法錯誤行號並給出修訂後的語法建議。
   - ⚡ **慢查詢重構建議 (Optimize SQL)**：結合目前已實作的執行計畫與 IO 讀取量，讓 AI 提供索引建議或重寫子查詢為 JOIN 的調校建言。

---

### 5.3 📊 資料庫即時活動與鎖定監控儀表板 (Live Activity & Locks Monitor Dashboard)

#### 痛點描述
當生產資料庫突然 CPU 飆高至 100%、或者大量交易因卡死 (Blocking) 而逾時堆積時，DBA 往往需要手忙腳亂地輸入多次 `sp_who2` 或查詢多張 DMV。

#### 設計方案
1. **獨立工作區分頁：「即時伺服器活動儀表板 (Live Activity Monitor)」**：
   - 整合即時輪詢（可自訂 3 秒 / 5 秒 / 10 秒刷新間隔或手動刷新）。
2. **四大即時監控板塊**：
   - 📈 **CPU 與活動工作階段趨勢圖**。
   - 🔒 **即時阻塞鏈視覺化 (Blocking Tree)**：清楚呈現頭號元兇（Head Blocker SPID）與被阻塞的連線清單，右鍵支援一鍵 `KILL`。
   - ⏳ **即時等待統計排行 (Top Active Waits)**：如 `PAGEIOLATCH_SH`、`WRITELOG`、`CXPACKET`。
   - ⚡ **目前正在跑的長時間查詢 (Currently Running Queries)**：顯示已執行秒數、SQL 語句與讀取數。

---

## 6. 建議實作路線圖 (Implementation Roadmap)

```mermaid
flowchart LR
  subgraph Phase1["Phase 1 (v0.2.0) - 安全與匯出核心"]
    direction TB
    P1A["🔴 生產環境防呆警示 (Safe Guard)"]
    P1B["💾 實體檔案串流匯出 (Excel/CSV/JSON)"]
    P1C["🔐 加密連線檔匯出入 (AES-256)"]
  end

  subgraph Phase2["Phase 2 (v0.3.0) - 結構與編輯深化"]
    direction TB
    P2A["🧱 結構進階檢視 (索引/外鍵/約束)"]
    P2B["✏️ TableDataViewer 行內編輯與新增列"]
    P2C["🔗 外鍵快速預覽與跳轉 (FK Jump)"]
  end

  subgraph Phase3["Phase 3 (v0.4.0) - 比對調校與巨量分頁"]
    direction TB
    P3A["🔍 雙結果集資料比對 (Result Diff)"]
    P3B["⚡ 伺服器端分頁 (OFFSET-FETCH)"]
  end

  subgraph Phase4["Phase 4 (v0.5.0+) - 現代 AI 與即時監控"]
    direction TB
    P4A["🤖 BYOK AI SQL 助手 (Text-to-SQL / 診斷)"]
    P4B["📊 即時活動與阻塞監控儀表板"]
  end

  Phase1 --> Phase2 --> Phase3 --> Phase4
```

| 階段 | 目標版本 | 規劃核心項目 | 預估工期 | 核心價值效益 |
| :---: | :---: | :--- | :---: | :--- |
| **Phase 1** | **v0.2.0** | 1. 🔴 **生產環境防呆警示與危險操作攔截**<br>2. 💾 **實體檔案串流匯出 (Excel .xlsx / CSV with BOM / SQL)**<br>3. 🔐 **連線設定檔 AES-256 加密匯出與匯入** | 1 ~ 2 週 | 徹底杜絕生產重大誤操作，補齊大數據實體存檔缺口，大幅強化設定遷移體驗。 |
| **Phase 2** | **v0.3.0** | 1. 🧱 **資料表結構進階檢視（索引管理、外鍵、檢查約束）**<br>2. ✏️ **資料瀏覽器 (`TableDataViewer`) 補齊行內編輯與新增列**<br>3. 🔗 **外鍵關聯快速跳轉與資料穿透 (FK Navigation)** | 2 週 | 躍升為完整度極高的資料庫結構設計與快速修訂工具，日常操作流暢度翻倍。 |
| **Phase 3** | **v0.4.0** | 1. 🔍 **雙結果集資料比對工具 (Result Diff & Data Compare)**<br>2. ⚡ **資料瀏覽器伺服器端動態分頁 (Server-side Pagination)** | 1.5 週 | 專為預存程序重構、效能優化與數千萬列大型表格檢索提供專業級支撐。 |
| **Phase 4** | **v0.5.0+** | 1. 🤖 **現代 AI SQL 助手 (BYOK LLM 診斷與自然語言轉換)**<br>2. 📊 **資料庫即時活動與阻塞鏈監控儀表板 (Live Activity Monitor)** | 2 ~ 3 週 | 引入新一代智慧輔助編程與一站式 DBA 系統健康監控，形成市場差異化競爭力。 |

---

*文件更新時間：2026-09-16*  
*維護團隊：SQLight Core Engineering Team*
