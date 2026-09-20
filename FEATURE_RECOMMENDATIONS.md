# SQLight 未來功能擴充與優化建議藍圖 (Feature Recommendations Blueprint)

> **版本**：v0.3.0-draft  
> **更新時間**：2026-09-20  
> **適用架構**：Tauri v2 + Rust (Tiberius TDS) + Vue 3 + TypeScript 5 + PrimeVue 4 + Monaco Editor + AG Grid Community + AntV X6  

---

## 📖 目錄 (Table of Contents)

1. [執行摘要與現況評估 (Executive Summary & Status Review)](#1-執行摘要與現況評估-executive-summary--status-review)
2. [🎉 已落地交付之里程碑功能 (Completed Milestones)](#2--已落地交付之里程碑功能-completed-milestones)
3. [🥇 第一梯隊：核心外銷與資料庫操作補完 (P0 - Core Export & Data Operations)](#3--第一梯隊核心外銷與資料庫操作補完-p0---core-export--data-operations)
   - [3.1 💾 實體檔案串流匯出精靈 (Native File Stream Exporter: Excel / CSV / JSON / SQL)](#31--實體檔案串流匯出精靈-native-file-stream-exporter-excel--csv--json--sql)
   - [3.2 ✏️ 資料瀏覽器 (`TableDataViewer`) 補齊行內編輯與「新增資料列」](#32--資料瀏覽器-tabledataviewer-補齊行內編輯與新增資料列)
   - [3.3 🔐 連線設定檔安全加密匯入/匯出 (AES-256 Portable Encrypted Profiles)](#33--連線設定檔安全加密匯入匯出-aes-256-portable-encrypted-profiles)
4. [🥈 第二梯隊：專業 DBA 與結構深度洞察 (P1 - Pro DBA & Schema Deep Dive)](#4--第二梯隊專業-dba-與結構深度洞察-p1---pro-dba--schema-deep-dive)
   - [4.1 🧱 資料表結構進階檢視（索引管理、外鍵、檢查約束、觸發程序）](#41--資料表結構進階檢視索引管理外鍵檢查約束觸發程序)
   - [4.2 🔍 雙結果集資料比對工具 (Result Diff & Data Comparator)](#42--雙結果集資料比對工具-result-diff--data-comparator)
   - [4.3 🔗 外鍵關聯快速跳轉與資料穿透 (FK Quick Peek & Navigation)](#43--外鍵關聯快速跳轉與資料穿透-fk-quick-peek--navigation)
5. [🥉 第三梯隊：巨量效能調校與高階監控 (P2 - Scale, Performance & Advanced Ops)](#5--第三梯隊巨量效能調校與高階監控-p2---scale-performance--advanced-ops)
   - [5.1 ⚡ 伺服器端動態分頁與鍵值串流 (Server-side Pagination & Keyset Fetching)](#51--伺服器端動態分頁與鍵值串流-server-side-pagination--keyset-fetching)
   - [5.2 📊 資料庫即時活動與鎖定監控儀表板 (Live Activity & Locks Monitor Dashboard)](#52--資料庫即時活動與鎖定監控儀表板-live-activity--locks-monitor-dashboard)
   - [5.3 🩺 AI 助手深度整合（錯誤一鍵診斷與執行計畫調校建言）](#53--ai-助手深度整合錯誤一鍵診斷與執行計畫調校建言)
6. [建議實作路線圖 (Implementation Roadmap)](#6-建議實作路線圖-implementation-roadmap)

---

## 1. 執行摘要與現況評估 (Executive Summary & Status Review)

**SQLight** 經過密集的迭代優化，已建構起極具競爭力的桌面端架構優勢：
- 🚀 **極致啟動與記憶體表現**：採用 Tauri v2 + Rust 原生非同步核心 (Tiberius TDS)，擺脫 Electron/JVM 動輒 500MB~1GB 的巨大記憶體開銷。
- 🎨 **現代 UI 與雙模式主題**：全面導入 PrimeVue 4 元件體系，支援 Aura / Lara / Nora 風格切換、12 主色 × 5 表面色組合，深色 (Dark) 與亮色 (Light) 模式全介面自適應。
- 🤖 **通用 AI SQL 助理**：自建跨廠商通用 cURL 請求範本引擎（去識別化支援 MiniMax、OpenAI、Claude、DeepSeek、Gemini、Ollama 等），支援浮動視窗縮放與膠囊收合。
- 🛡️ **嚴格交易與危險操作防護**：連線色彩環境標記（生產紅、測試黃、開發綠）、DML 危險語法預先審查阻絕彈窗、複合主鍵嚴格驗證、自動交易保護 (`BEGIN TRAN ... ROLLBACK`) 與 `@@ROWCOUNT <> 1` 防呆。
- 🌐 **深度可視化診斷**：整合 AntV X6 互動式 ER 圖、`html-query-plan` 圖形化執行計畫、`STATISTICS IO/TIME` 分析器。
- 🧪 **穩定品質工程**：累積 230+ 項全自動化單元與整合測試，覆蓋 SQL 解析、連線安全、過濾器、匯出格式等核心模組。

本藍圖全面盤點截至 **2026 年 9 月** 的最新程式碼現況，將近期已落地交付的重大功能（AI 智能助理、連線環境色彩防護網、ER 關聯圖、本機 SQL 檔案監控、資料庫結構 CSV 匯出等）移入已交付清單，並依據實務生產痛點重新梳理下一階段最具價值的工程規劃。

---

## 2. 🎉 已落地交付之里程碑功能 (Completed Milestones)

以下核心項目已完整實作、通過單元測試並整合入主分支，現已納入專案常態維護：

| # | 功能項目 | 所屬模組 / 核心檔案 | 實作成效與亮點摘要 |
| :-: | :--- | :--- | :--- |
| 1 | **🤖 AI SQL 智能助理** | `AiAssistantModal.vue`, `AiFloatingPill.vue` | 通用 cURL 請求範本引擎（適配任何 HTTP LLM）、Monaco 選取上下文智慧注入、自由拖曳縮放、最小化膠囊列、快捷 Prompt 範本管理與 `ai.log` 請求日誌。 |
| 2 | **🔴 連線環境色彩與危險操作攔截** | `DangerousQueryModal.vue`, `sqlGuard.ts` | 連線環境色彩識別（紅/黃/綠等 8 色）、分頁標籤即時外框提醒、未帶 `WHERE` 條件之 `UPDATE`/`DELETE` 與 `DROP`/`TRUNCATE` 雙重確認阻絕彈窗。 |
| 3 | **🌐 互動式 ER 關聯圖視覺化檢視器** | `ErDiagramViewer.vue`, `schemaService.ts` | 整合 AntV X6 畫布，以選定資料表為中心遞迴展開外鍵關聯，卡片顯示 PK 🔑 / FK 🔗，支援自訂註記與 PNG/JSON 雙向匯出匯入。 |
| 4 | **📁 本機 SQL 檔案監控與瀏覽區** | `AppSidebar.vue`, `workspaceStore.ts` | 側邊欄整合本機 SQL 資料夾監控區，可拖曳分割條調節高度，支援雙向檔案樹瀏覽、點擊開啟與 <kbd>Ctrl+S</kbd> 原地寫回。 |
| 5 | **⚡ 快速物件檢索器 (Spotlight `Ctrl+P`)** | `QuickObjectFinderModal.vue` | 支援 PascalCase/子序列模糊匹配、類型前綴篩選（`t:`, `v:`, `p:`, `f:`）、物件彩標分類與直覺鍵盤捷徑導航。 |
| 6 | **🛑 長時間查詢中斷與取消 (Task Killer)** | `query_commands.rs`, `queryStore.ts` | 微秒級釋放細粒度連線鎖，按下 <kbd>Alt+Break</kbd> / <kbd>Esc</kbd> 即刻終止本地讀取並透過獨立連線發送 `KILL <spid>;` 釋放資源。 |
| 7 | **📊 執行統計與 IO 分析器** | `ExecutionStatsViewer.vue`, `statsParser.ts` | 解析 `STATISTICS IO, TIME`，呈現 5 大核心 KPI、單表 8KB 容量換算進度條與 Markdown 調校報告匯出。 |
| 8 | **🌐 實際執行計畫圖形檢視器** | `ExecutionPlanViewer.vue`, `planXmlParser.ts` | 抽離 XML Showplan，整合 `html-query-plan` 渲染算子圖形樹、相對成本百分比並支援匯出 `.sqlplan`。 |
| 9 | **🚀 客戶端 GO 批次分割引擎** | `sqlStatementExtractor.ts` | 狀態機掃描略過註解與字串內的 `GO`，支援多批次 DDL/DML 循序執行與訊息匯整。 |
| 10 | **🎯 物件總管游標快速定位** | `sqlIdentifierExtractor.ts`, `AppSidebar.vue` | 精準擷取游標/選取區物件識別字，側邊欄自動清除過濾遮蔽、連鎖展開、背景載入並置中光暈高亮。 |
| 11 | **📚 常用 SQL 範本庫與同層文件** | `SqlTemplateModal.vue`, `template_commands.rs` | 內建 4 大類常用/進階/維護語法，支援可攜版同層實體 `sql_custom_templates.json` 熱重載與介面 CRUD。 |
| 12 | **✏️ 結果表格行內編輯與安全批次變更** | `ResultGrid.vue`, `tableEditability.ts` | 雙擊儲存格直接編輯、琥珀色修訂提示、嚴格 PK 驗證、Monaco 語法審查確認對話框與交易回滾防護。 |
| 13 | **🛠️ 資料表結構 ALTER 產生器** | `TableStructureViewer.vue`, `alterTableGenerator.ts` | 支援右鍵產生 `ALTER COLUMN`、`DROP COLUMN`、`ADD COLUMN` 等標準 T-SQL 變更腳本。 |
| 14 | **🔍 物件總管 ComboBox 歷史記憶過濾** | `AppSidebar.vue`, `filterHistory.ts` | 側邊欄過濾框升級為 ComboBox，支援 30 筆 LRU 歷史搜尋記錄、一鍵清除與鍵盤歷史選取。 |
| 15 | **📄 資料庫結構 CSV 匯出與表結構探勘** | `ExportSchemaModal.vue`, `schemaExport.ts` | 4 步驟匯出精靈，產出含 UTF-8 BOM 之結構 CSV（資料表/欄位、索引約束、Programmability 簽章），新增 13 組探勘語法。 |
| 16 | **📜 查詢日誌記錄與 SSMS 多結果集垂直堆疊** | `query_logger.rs`, `ResultGridItem.vue` | 後端非同步寫入 `query.log`，前端支援多結果集垂直堆疊與子分頁切換，支援原地快速重新整理。 |
| 17 | **🎨 PrimeVue 4 主題系統與雙模式適配** | `themeManager.ts`, `SettingsModal.vue` | 全面導入 PrimeVue 4（Aura/Lara/Nora），12 主色 × 5 表面灰階，深淺色一鍵切換與分頁啟用色自訂。 |
| 18 | **📑 查詢分頁複製與正則物件過濾規則** | `workspaceStore.ts`, `TableFilterTab.vue` | 支援分頁右鍵一鍵複製會話，設定頁支援正則規則批次隱藏系統或特定資料庫/資料表並即時測試。 |
| 19 | **🩺 AI 助手深度整合（錯誤一鍵診斷與計畫/IO調校）** | `ResultMessages.vue`, `ExecutionPlanViewer.vue`, `ExecutionStatsViewer.vue`, `aiPromptBuilder.ts` | 訊息面板每筆錯誤/警告即時「AI 診斷」、頂部「AI 診斷最新錯誤」；執行計畫自動萃取 Missing Index 與 Top 成本算子產生建議；執行統計自動換算 IO 瓶頸與等候事件分析。 |

---

## 3. 🥇 第一梯隊：核心外銷與資料庫操作補完 (P0 - Core Export & Data Operations)

### 3.1 💾 實體檔案串流匯出精靈 (Native File Stream Exporter: Excel / CSV / JSON / SQL)

#### 痛點描述
目前查詢結果僅支援「複製至剪貼簿」與資料庫結構 CSV 匯出。當查詢結果達到 10,000 ~ 100,000 列以上時：
1. 剪貼簿因資料量過大容易發生記憶體溢出或桌面卡死。
2. 業務同仁需要實體 `.xlsx` 或 `.csv` 檔案，手動貼入 Excel 容易發生格式失真（如電話號碼、身分證號丟失前導 0 或變成科學記號）。
3. Windows Excel 開啟一般無 BOM 的 UTF-8 CSV 時經常出現中文亂碼。

#### 設計方案
1. **工具列與結果表格右鍵選單新增「匯出實體檔案 (Export to File)」**：
   - 📊 **Excel 活頁簿 (.xlsx)**：支援將當前結果集或全部結果集直接產出為實體 Excel 檔案，保留型別（文字字串避免被轉為科學記號）、欄位寬度自動微調、首列凍結與標題加粗。
   - 📄 **CSV / TSV 檔案 (.csv)**：支援**自動寫入 UTF-8 BOM 檔頭 (`0xEF, 0xBB, 0xBF`)**，確保繁體/簡體中文於 Excel 開啟時 100% 不亂碼；支援逗號、Tab、分號自訂分隔符。
   - 📦 **JSON 格式檔案 (.json)**：整份結果集格式化為 `[ { "col": val }, ... ]` 實體檔案儲存。
   - 📝 **SQL 批次插入腳本 (.sql)**：將查詢結果自動產生為帶有 `SET IDENTITY_INSERT ON/OFF`、每 1,000 筆分批的 `INSERT INTO ... VALUES` 腳本檔案。
2. **串流式保存 (Stream Saving)**：
   - 呼叫 Tauri 原生 `save` 對話框挑選本機儲存路徑。
   - 大資料量時採分塊 (Chunking) 方式串流寫入硬碟，並在狀態列顯示匯出進度條，避免前端主執行緒凍結。

---

### 3.2 ✏️ 資料瀏覽器 (`TableDataViewer`) 補齊行內編輯與「新增資料列」

#### 痛點描述
目前已於查詢結果網格 (`ResultGrid`) 實作了儲存格雙擊編輯、修改暫存追蹤與安全批次更新。然而：
1. 從側邊欄右鍵「開啟資料表 (Open Data)」開啟的 `TableDataViewer` 專屬瀏覽元件尚未同步具備行內編輯能力。
2. 現有行內編輯僅能修改既有資料列，尚未支援「**新增資料列 (Insert New Row)**」與「**刪除資料列 (Delete Row)**」。

#### 設計方案
1. **共用編輯模組重構**：
   - 將 `ResultGrid` 中成熟的 `tableEditability`、修改暫存追蹤（`modifiedCellsMap`）與 `batchUpdateGenerator` 抽離為共用 Composable (`useTableEditing`)，讓 `TableDataViewer` 立即具備行內雙擊修改與琥珀色變更提示。
2. **增設「+ 新增列 (Add Row)」功能**：
   - 工具列新增「新增一列」按鈕。
   - 在表格第一列插入高亮為綠色的待寫入空列，自動鎖定 Identity 自動識別欄位。
   - 填寫完畢後點擊「提交變更」，自動產出具備交易保護的 `INSERT INTO ... VALUES (...)` 腳本供確認執行。
3. **支援右鍵「標記刪除列 (Mark as Deleted)」**：
   - 選取一列或多列按右鍵「刪除資料列」，標記為紅色刪除狀態，確認後產生帶有 `@@ROWCOUNT = 1` 檢查的 `DELETE` 交易腳本。

---

### 3.3 🔐 連線設定檔安全加密匯入/匯出 (AES-256 Portable Encrypted Profiles)

#### 痛點描述
- SQLight 目前透過作業系統 Keychain 保存密碼，連線設定則存於 `%LOCALAPPDATA%`。
- 當使用者更換電腦、重灌系統，或團隊內部需要共享一組資料庫連線清單時，無法方便遷移，每次都必須重新手動填寫 Host、Port、帳號、密碼。

#### 設計方案
1. **連線管理器「匯出連線設定檔 (Export Profiles)」**：
   - 使用者可勾選欲匯出的連線項目。
   - 提示輸入一組「主密碼 (Master Password)」。
   - 系統利用 `AES-256-GCM` 搭配 `PBKDF2` / `Argon2` 金鑰衍生演算法，將連線組態及密碼安全加密為 `.sqlight.enc` 檔案。
2. **「匯入連線設定檔 (Import Profiles)」**：
   - 選擇檔案並輸入主密碼進行解密驗證。
   - 提供連線衝突比對清單（覆蓋、略過、重新命名保留兩者），一鍵將密碼安全寫入新環境的 OS Keychain。

---

## 4. 🥈 第二梯隊：專業 DBA 與結構深度洞察 (P1 - Pro DBA & Schema Deep Dive)

### 4.1 🧱 資料表結構進階檢視（索引管理、外鍵、檢查約束、觸發程序）

#### 痛點描述
目前 `TableStructureViewer` 專注於 12 大欄位中繼屬性。但在進行日常資料庫維護、效能調優與 Schema 設計時，工程師與 DBA 必須深入掌握**索引分佈、外鍵關聯、檢查條件與觸發器**。

#### 設計方案
在 `TableStructureViewer` 頂部增設次級標籤頁 (Sub-Tabs)：
1. 📋 **欄位清單 (Columns)**：現有 12 大中繼資料表（Ordinal, PK, Type, Nullable, Identity, Default 等）。
2. 🗂️ **索引清單 (Indexes)**：
   - 索引名稱、類型（聚集 Clustered / 非聚集 Non-Clustered / 唯一 Unique / 欄位存放區 Columnstore）。
   - 鍵值欄位清單 (Key Columns)、包含欄位清單 (Included Columns, `INCLUDE`)、篩選條件 (Filter Definition)。
   - 即時顯示索引破碎度百分比 (`Fragmentation %`)、頁面數與容量。
   - 右鍵操作選單：支援一鍵產生 `REORGANIZE`、`REBUILD WITH (ONLINE = ON)` 或 `DROP INDEX` 語句。
3. 🔗 **外鍵關聯 (Foreign Keys)**：
   - 外鍵約束名稱、本表參照欄位、目標關聯表、目標主鍵欄位。
   - 連動規則狀態：`ON UPDATE CASCADE/NO ACTION`、`ON DELETE CASCADE/SET NULL`。
4. 🛡️ **條件約束 (Check Constraints & Defaults)**：
   - 約束名稱、約束定義條件式（如 `[Status] IN ('A', 'I', 'D')`）、啟用與信任狀態。
5. ⚡ **觸發程序 (Triggers)**：
   - 觸發程序名稱、事件類型 (`AFTER INSERT` / `AFTER UPDATE` / `INSTEAD OF`)、啟用狀態，支援雙擊檢視定義原始碼。

---

### 4.2 🔍 雙結果集資料比對工具 (Result Diff & Data Comparator)

#### 痛點描述
在進行下列情境時，缺乏直觀的資料比對工具是一大痛點：
- 重構舊版大型預存程序或複雜 CTE 查詢時，需要驗證「重構前後輸出的資料筆數與每個欄位值是否 100% 完全相符」。
- 排查正式環境與測試環境資料不一致時。

#### 設計方案
1. **入口方式**：
   - 於下方任何一個 Results 分頁標籤按右鍵，選擇「**與其他結果分頁比對 (Compare with Tab...)**」。
2. **雙欄/單欄差分視覺化檢視 (Diff Grid)**：
   - 自動對齊兩組結果集的欄位結構與總列數。
   - 支援指定基準比對鍵（Primary Key 或特定欄位），若未指定則依行號逐列對齊。
   - **高亮差異標記**：
     - 🟩 僅存在於左側/右側的列（新增/刪除列）。
     - 🟨 內容不同的儲存格（標示：`舊值 ➔ 新值`），並於懸浮卡片顯示字串級差異。
   - 頂部顯示摘要統計（例如：`98.5% 相符，3 筆資料差異，0 筆欄位結構不符`）。

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

## 5. 🥉 第三梯隊：巨量效能調校與高階監控 (P2 - Scale, Performance & Advanced Ops)

### 5.1 ⚡ 伺服器端動態分頁與鍵值串流 (Server-side Pagination & Keyset Fetching)

#### 痛點描述
目前系統透過全域設定的 `max_rows`（如 5,000 或 10,000 筆）進行客戶端筆數截斷。當使用者需要在數千萬筆的大型日誌表（Logs）中翻找資料時，無法有效且低耗地進行大範圍瀏覽。

#### 設計方案
1. **資料瀏覽器啟用伺服器端動態分頁 (Server-side Pagination)**：
   - 在 `TableDataViewer` 底部增設分頁導覽控制條（第一頁、上一頁、頁碼、下一頁、每頁筆數：100 / 500 / 1,000）。
   - 底層自動運用 T-SQL `OFFSET ... ROWS FETCH NEXT ... ROWS ONLY`，或基於主鍵的 Keyset Pagination 進行高效伺服器端翻頁，記憶體佔用恆定維持在個位數 MB。

---

### 5.2 📊 資料庫即時活動與鎖定監控儀表板 (Live Activity & Locks Monitor Dashboard)

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

### 5.3 🩺 AI 助手深度整合（錯誤一鍵診斷與執行計畫調校建言）

#### 痛點描述
現有的 AI 助手已具備通用的浮動對話與 SQL 上下文帶入能力。但在發生 SQL 語法報錯或慢查詢調優時，使用者仍需手動複製錯誤訊息或指標貼入對話框。

#### 設計方案
1. **錯誤訊息面板「一鍵 AI 診斷 (Diagnose with AI)」**：
   - 當查詢出錯時，Messages 面板旁出現醒目的「診斷」按鈕，點擊自動呼出 AI 視窗，直接注入錯誤代碼（如 Msg 8120、Msg 547）、出錯語句與精確定位建議。
2. **執行統計與計畫結合 AI 最佳化建言 (Plan Tuning Advice)**：
   - 於 Execution Stats 與 Execution Plan 介面提供「AI 調校建言」按鈕，將高 IO 表格、未建立索引警示或主要耗時算子作為上下文傳送給 AI，產出具體的索引建立建議與重構語法。

---

## 6. 建議實作路線圖 (Implementation Roadmap)

```mermaid
flowchart LR
  subgraph Completed["🎉 Completed (已交付落地)"]
    direction TB
    C1["🤖 AI 智能助理 (cURL Engine)"]
    C2["🔴 連線環境色與安全防護 (Safe Guard)"]
    C3["🌐 互動式 ER 關聯圖 (AntV X6)"]
    C4["📁 本機 SQL 檔案監控區"]
    C5["🎨 PrimeVue 4 雙模式主題系統"]
    C6["📄 資料庫結構 CSV 匯出"]
    C7["🩺 AI 錯誤診斷與計畫/IO調校"]
  end

  subgraph Phase2["Phase 1 (v0.3.0) - 核心外銷與編輯補完"]
    direction TB
    P1A["💾 實體檔案串流匯出 (Excel/CSV/SQL)"]
    P1B["✏️ TableDataViewer 行內編輯與新增列"]
    P1C["🔐 連線檔 AES-256 加密匯出入"]
  end

  subgraph Phase3["Phase 2 (v0.4.0) - 結構進階與資料比對"]
    direction TB
    P2A["🧱 結構進階檢視 (索引/外鍵/約束)"]
    P2B["🔍 雙結果集資料比對 (Result Diff)"]
    P2C["🔗 外鍵快速預覽與跳轉 (FK Jump)"]
  end

  subgraph Phase4["Phase 3 (v0.5.0+) - 巨量分頁與即時監控"]
    direction TB
    P3A["⚡ 伺服器端動態分頁 (OFFSET-FETCH)"]
    P3B["📊 即時活動與阻塞監控儀表板"]
  end

  Completed --> Phase2 --> Phase3 --> Phase4
```

| 階段 | 目標版本 | 規劃核心項目 | 預估工期 | 核心價值效益 |
| :---: | :---: | :--- | :---: | :--- |
| **已交付** | **v0.2.x** | 1. 🤖 **AI SQL 智能助理（通用 cURL 引擎、浮動視窗、Prompt 管理）**<br>2. 🔴 **連線環境色彩識別與 DML 危險語法攔截阻絕**<br>3. 🌐 **AntV X6 互動式 ER 關聯圖檢視器**<br>4. 📁 **本機 SQL 檔案即時監控與原地儲存**<br>5. 🎨 **PrimeVue 4 雙模式主題與 12 主色 × 5 表面色引擎**<br>6. 📄 **資料庫結構 CSV 4 步驟匯出精靈與 13 組結構探勘範本**<br>7. 🩺 **AI 助手深度整合（Messages 錯誤診斷、執行計畫/IO 調校建議）** | 已完成 | 建立極具競爭力的輕量桌面端核心體驗，兼具現代感、生產安全與 AI 調優。 |
| **Phase 1** | **v0.3.0** | 1. 💾 **實體檔案串流匯出精靈 (Excel .xlsx / CSV with BOM / SQL)**<br>2. ✏️ **資料瀏覽器 (`TableDataViewer`) 補齊行內編輯與新增列**<br>3. 🔐 **連線設定檔 AES-256 加密匯出與匯入** | 1 ~ 2 週 | 解決大數據導出崩潰痛點，補齊基礎資料快速維護閉環，強化團隊配置遷移體驗。 |
| **Phase 2** | **v0.4.0** | 1. 🧱 **資料表結構進階檢視（索引管理、外鍵、檢查約束、觸發程序）**<br>2. 🔍 **雙結果集資料比對工具 (Result Diff & Data Comparator)**<br>3. 🔗 **外鍵關聯快速跳轉與資料穿透 (FK Quick Peek & Navigation)** | 2 週 | 躍升為專業級 DBA 結構設計與除錯工具，重構預存程序與跨環境對齊效率翻倍。 |
| **Phase 3** | **v0.5.0+** | 1. ⚡ **資料瀏覽器伺服器端動態分頁 (Server-side Pagination & Keyset)**<br>2. 📊 **資料庫即時活動與阻塞鏈監控儀表板 (Live Activity Monitor)** | 2 ~ 3 週 | 突破巨量資料瀏覽瓶頸，提供即時系統健康監控，讓客戶端具備企業級承載力。 |

---

*文件更新時間：2026-09-20*  
*維護團隊：SQLight Core Engineering Team*
