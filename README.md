# SQLight - 極致輕量、現代高效的 Microsoft SQL Server 桌面客戶端

<p align="center">
  <strong>基於 Tauri v2 + Rust + Vue 3 + TypeScript + Monaco Editor + AG Grid Community 打造</strong>
</p>

---

## 📖 目錄 (Table of Contents)

1. [專案簡介與特色 (Overview)](#-專案簡介與特色-overview)
2. [系統架構與技術棧 (Architecture & Tech Stack)](#-系統架構與技術棧-architecture--tech-stack)
3. [核心功能與設計細節 (Feature Deep Dive)](#-核心功能與設計細節-feature-deep-dive)
   - [連線與資料庫物件瀏覽 (Connection & Schema Explorer)](#1-連線與資料庫物件瀏覽)
   - [快速定位游標處資料表 (Locate Table in Explorer)](#-快速定位游標處資料表-locate-table-in-explorer)
   - [智慧記憶與自動復原 (Auto-Restore Last Session)](#2-智慧記憶與自動復原)
   - [專業級 Monaco SQL 編輯器 & DBA 工具箱 (Monaco SQL Workspace & DBA Diagnostics)](#3-專業級-monaco-sql-編輯器--dba-診斷工具箱)
   - [長時間查詢中斷與取消機制 (Cancel Query / Task Killer & SPID)](#-長時間查詢中斷與取消機制-cancel-query--task-killer)
   - [常用 SQL 範本庫與同層自訂語法文件 (SQL Templates & Co-located Custom File)](#-常用-sql-範本庫與應用程式同層自訂文件-sql_custom_templatesjson)
   - [客戶端 GO 批次分割執行引擎 (Client-Side GO Batch Runner)](#-客戶端-go-批次分割執行引擎-client-side-go-batch-runner)
   - [多結果歷史分頁、AG Grid & 即時統計列 (Multi-Result Tabs, AG Grid & Live Stats)](#4-多結果歷史分頁-ag-grid--即時統計列)
   - [訊息面板與執行歷史 (Messages & Query History)](#5-訊息面板與執行歷史)
   - [執行統計與 IO 分析器 (Execution Stats & IO Analyzer)](#6-執行統計與-io-分析器-execution-stats--io-analyzer)
   - [資料表資料與結構瀏覽器 (Table Data & Structure Viewer)](#7-資料表資料與結構瀏覽器-table-data--structure-viewer)
   - [實際執行計畫與 XML 視覺化檢視器 (Actual Execution Plan & XML Viewer)](#8-實際執行計畫與-xml-視覺化檢視器)
   - [個人化設定與安全防護 (Settings & Preferences)](#9-個人化設定與安全防護-settings--preferences)
4. [鍵盤快捷鍵與快速代碼範本 (Shortcuts & Snippets)](#-鍵盤快捷鍵與快速代碼範本-shortcuts--snippets)
5. [安裝、開發與建置指南 (Installation & Development)](#-安裝開發與建置指南-installation--development)

---

## 🌟 專案簡介與特色 (Overview)

**SQLight** 是一款專為開發者、資料庫管理員 (DBA) 與數據分析師打造的極致輕量化 Microsoft SQL Server (T-SQL) 桌面管理客戶端。

傳統的 SQL Server 管理工具（如 SQL Server Management Studio (SSMS)、DataGrip、DBeaver）往往存在啟動載入過慢、記憶體資源佔用過大、介面老舊厚重等痛點。**SQLight** 旨在保留最核心且高頻使用的資料庫操作體驗，同時提供：
- ⚡ **秒開啟動**：原生 Rust 後端核心，體積輕巧且無肥重執行環境開銷。
- 🎨 **現代暗色美學**：精雕細琢的 Dark Theme，搭配流暢的微互動動畫與清晰的層次感。
- 💻 **媲美 VS Code 的編程手感**：深度整合 Monaco Editor，支援智慧補全、單句語法隔離、快速複製與自適應格式化。
- 🛑 **秒級查詢取消與 Task Killer**：點擊取消或按下快捷鍵即刻中斷本地讀取，後端自動透過獨立連線發送 `KILL <spid>;` 釋放資料庫鎖定與運算資源。
- 🎯 **快速定位資料表 (Locate in Explorer)**：編輯器游標或反白處物件一鍵在左側 Explorer 自動連鎖展開、載入欄位、光暈高亮並置中捲動。
- 📚 **常用 SQL 範本庫與同層自訂文件**：內建豐富 T-SQL 與變數宣告範例，同層實體文件 `sql_custom_templates.json` 隨拷隨走、外部編輯熱重載。
- 🚀 **客戶端 GO 批次引擎**：狀態機智慧隔離註解與字串內的 `GO`，無縫支援多批次 DDL 與大型腳本執行。
- 📊 **百萬級資料流暢瀏覽**：採用 AG Grid 虛擬化捲動引擎，海量資料渲染依然絲滑不卡頓。
- 🎯 **人性化的操作細節**：智慧記憶上次連線與資料庫、可自訂執行閃爍高亮、Pointer Events 無縫分頁拖曳、多結果歷史防清除釘選。

---

## 🏗️ 系統架構與技術棧 (Architecture & Tech Stack)

SQLight 採用現代跨平台桌面客戶端的雙層解耦架構：

```
+-------------------------------------------------------------------------+
|                              SQLight UI                                 |
|          (Vue 3 Composition API + TypeScript + Tailwind CSS)           |
+------------------------------------+------------------------------------+
|            Monaco Editor           |              AG Grid               |
|   (T-SQL Monarch / IntelliSense)   |  (Virtual Scroll / Multi-ResultSet)|
+------------------------------------+------------------------------------+
|                         Pinia State Stores                              |
|   (connectionStore / workspaceStore / queryStore / settingsStore)       |
+------------------------------------+------------------------------------+
                                      |
                     Tauri IPC Bridge (invoke / events)
                                      |
+-------------------------------------+-----------------------------------+
|                        Tauri v2 Rust Backend                            |
|             (Tokio Async Runtime + Tiberius TDS Protocol)               |
+-------------------------------------------------------------------------+
|                  Microsoft SQL Server (2012 ~ 2022 / Azure SQL)         |
+-------------------------------------------------------------------------+
```

### 技術選型：
- **桌面宿主 (Desktop Host)**：[Tauri v2](https://v2.tauri.app/) — 使用作業系統原生 WebView2 (Windows)，大幅降低安裝檔大小與記憶體佔用。
- **後端非同步連線 (Rust Core)**：[Tiberius](https://github.com/steffengy/tiberius) — 純 Rust 實作的 TDS (Tabular Data Stream) 協定驅動，搭配 `tokio` 與連線池管理，提供高併發、極致效能的查詢傳輸。
- **前端核心框架 (Frontend UI)**：Vue 3 (Composition API / `<script setup>`) + Vite 6 + TypeScript 5。
- **狀態集中管理 (State Management)**：Pinia 3。
- **代碼編輯核心 (Code Editor)**：Monaco Editor (VS Code 核心編輯器)。
- **高效表格引擎 (Data Grid Engine)**：AG Grid Community (支援百萬列虛擬滾動、儲存格複製、自適應寬度)。
- **樣式與主題 (Styling)**：Tailwind CSS (自訂 900/850/800 階層深色系暗黑主題) + Lucide Vue Next 圖標庫。
- **SQL 格式化**：`sql-formatter` (T-SQL Dialect)。

---

## 🚀 核心功能與設計細節 (Feature Deep Dive)

### 1. 連線與資料庫物件瀏覽
- **彈性連線設定**：
  - 支援設定伺服器位址 (Host)、連接埠 (Port，預設 1433)、資料庫名稱 (Database)、帳號 (Username) 與密碼 (Password)。
  - 支援 SSL/TLS 加密連線開關 (`encrypt`) 與信任伺服器憑證 (`trustServerCertificate`)，可順暢連線內部自簽憑證或雲端 Azure SQL。
  - 內建**測試連線 (Test Connection)** 功能，連線前先行驗證網路與帳密正確性。
- **樹狀結構分類瀏覽 (Database Objects Tree)**：
  - 清晰展開 `連線` &rarr; `資料庫 (Databases)`，底下分類歸檔為四大資料夾：
    - 📁 **資料表 (Tables)**：以標準資料表圖示展示所有資料表，點擊可進一步展開欄位清單。
    - 📁 **檢視表 (Views)**：以專屬檢視圖示展示所有檢視表，支援右鍵檢視定義與查詢。
    - 📁 **預存程序 (Stored Procedures)**：列出資料庫中所有預存程序，支援右鍵檢視定義與產生 EXEC 呼叫樣板。
    - 📁 **函數 (Functions)**：列出資料庫中所有純量與資料表值函數，支援右鍵檢視定義與產生呼叫語法。
  - 支援搜尋過濾框，輸入關鍵字即時跨資料表、檢視表、預存程序與函數進行全域過濾，並動態展開包含符合項目的分類資料夾。
- **快速物件檢索器 (Quick Object Finder / Spotlight `Ctrl + P`)**：
  - 按下 <kbd>Ctrl</kbd> + <kbd>P</kbd>（或點擊頂部工具列「物件檢索」按鈕），立即彈出懸浮 Spotlight 檢索視窗。
  - 支援極速**子序列模糊搜尋 (Fuzzy Search)** 與 PascalCase/縮寫匹配（如輸入 `uslog` 命中 `UserLoginLogs`），匹配字元即時高亮呈現。
  - 物件彩標：🟩 `TABLE`、🟪 `VIEW`、🟧 `PROC`、🟦 `FUNC`，支援類型標籤頁切換或前綴過濾（如 `t: `、`v: `、`p: `、`f: `）。
  - 鍵盤一鍵直覺操作：
    - <kbd>↑</kbd> / <kbd>↓</kbd>：快速切換選取項目並自動平滑滾動。
    - <kbd>Enter</kbd>：開啟資料表/檢視表資料 (`TableDataViewer`)，或檢視程序/函數定義。
    - <kbd>Shift</kbd> + <kbd>Enter</kbd>：開啟資料表結構 (`TableStructureViewer`)。
    - <kbd>Ctrl</kbd> + <kbd>Enter</kbd>：新分頁產生 `SELECT TOP 1000 ...` 或 `EXEC ...` 呼叫腳本。
    - <kbd>Esc</kbd>：隨時關閉並交還編輯器焦點。
  - 檢索器頂端支援即時切換同一連線下的其他資料庫，自動重載並同步檢索。
- **資料表結構檢視 (Table Structure Viewer)**：
  - 於側邊欄任何資料表或檢視表按右鍵點選「**資料表結構 (Table Structure)**」，即刻開啟專屬結構分頁。
  - 清晰呈現欄位序號 (`#`)、主鍵標記 (`PK`)、欄位名稱、基礎型別 (`Data Type`)、完整型別與長度/精度 (`Full Type`，如 `nvarchar(50)`、`decimal(18, 2)`)、可為 NULL (`YES`/`NO`)、自動識別 (`Identity`)、預設值、最大字節長度、數值精度與小數位數、資料定序 (`Collation`)。
  - 支援文字搜尋過濾、Excel 等級儲存格/整欄/整列選取、動態數值統計列與複製為 TSV、JSON、Markdown 表格。
- **一鍵產生資料表結構腳本 (Generate CREATE TABLE DDL)**：
  - 於側邊欄任何資料表右鍵點選「**產生 CREATE TABLE 腳本**」，系統自動解析欄位型態、長度（如 `varchar(50)`、`nvarchar(MAX)`）、精度與小數位數（如 `decimal(18, 2)`）、Nullable、Identity(1,1) 與主鍵 (Primary Key Clustered) 條件，產出格式優美、可直接執行的標準 T-SQL DDL 腳本並在新分頁開啟。
- **檢視表與預存程序原始定義檢視 (View Definition / Script ALTER)**：
  - 於任何檢視表、預存程序或函數按右鍵點選「**檢視定義 (View Definition)**」或直接雙擊，自動透過 SQL Server 系統層級之 `OBJECT_DEFINITION(OBJECT_ID(...))` 秒級讀取原始 SQL 原始碼，直接載入 Monaco Editor 供閱讀與修改。
- **欄位智慧複製貼上 (Smart Context-Aware Column Paste)**：
  - 滑鼠雙擊展開清單中的任意欄位名稱，系統立即記住該欄位並複製到剪貼簿，側邊欄顯示「待貼上」呼吸燈標籤。
  - 點擊 Monaco 編輯區時，自動根據游標當前 SQL 語境進行極致貼心的格式化：
    - **`SELECT` 清單**：自動判斷前後欄位並智慧補齊逗號 `,`（例如 `SELECT id |` &rarr; `SELECT id, [col]`；`SELECT | name` &rarr; `SELECT [col], name`）。
    - **`WHERE` / `ON` / `SET` 條件**：自動補齊 ` = ?`（例如 `WHERE |` &rarr; `WHERE [col] = ?`），並**自動反白聚焦 `?`**，鍵入數值立即覆寫。若後方或前方已有比較運算子則絕不重複加上。
    - **一般語境防黏結**：若緊鄰字母數字單字，最少自動補上空白間隔（如 `foo [col] bar`）。
- **快速定位游標處資料表 (Locate Table in Explorer)**：
  - **雙重入口**：點選 Explorer 頂部工具列「**定位**」按鈕（`LocateFixed` 準星圖示），或於 Monaco 編輯器內任何資料表/檢視表名稱處按右鍵選擇「**在物件總管中定位 (Locate Table in Explorer)**」。
  - **智慧識別抽取器**：
    - **選取優先**：使用者反白文字（如 `Orders`、`[Orders]`、`'Orders'`）優先解析。
    - **行內游標邊界解析**：自動精準解析單段或多段式識別字，包括 `[dbo].[Orders]`、`dbo.Orders`、`[Sales].[Order Details]`（支援空格）、`[Northwind].[dbo].[Customers]` 與一般單詞。
    - **SQL 關鍵字防誤判**：自動排除 `SELECT`、`FROM`、`WHERE`、`JOIN` 等語法關鍵字。
  - **智慧連鎖展開與載入**：
    - 若 Explorer 搜尋框（`filterQuery`）有過濾字串且會遮蔽目標物件，自動清空搜尋框以確保可見。
    - 依序自動展開「`連線` &rarr; `資料庫` &rarr; `資料表 (或檢視表/預存程序/函數)` &rarr; `目標物件`」。
    - 自動背景非同步載入該資料表之欄位清單。
  - **醒目反饋與置中滾動**：
    - 節點套用品牌色微亮背景、高對比發光邊框與動態呼吸「**已定位**」標籤。
    - 自動觸發平滑滾動 (`scrollIntoView({ behavior: 'smooth', block: 'center' })`) 將該資料表捲動至畫面可視正中央，並於 3.5 秒後優雅恢復常態。
- **連線右鍵操作選單**：
  - **重新整理**：即時從伺服器重新讀取資料庫與物件清單。
  - **行內重新命名 (Inline Rename)**：在側邊欄直接雙擊或右鍵重新命名連線代稱，並自動防重名檢查。
  - **編輯連線**：開啟彈窗修改主機或認證參數。
  - **中斷連線 / 刪除連線**：安全清理連線會話。

### 2. 智慧記憶與自動復原
- **跨工作階段記憶**：
  - 系統於使用者切換連線或資料庫時，即刻將連線 ID、資料庫名稱及每個連線專屬的最後資料庫對應記錄於本機持久化儲存 (`localStorage`)。
- **開啟即連線**：
  - 下次啟動 SQLight 時，程式會自動讀取最後紀錄，**直接將左上角的「連線下拉選單」與「資料庫下拉選單」復原至上次狀態**，並在背景自動發起連線與切換，無需每次反覆點選。

### 3. 專業級 Monaco SQL 編輯器 & DBA 診斷工具箱
- **頂部工具列極簡圖示與浮動提示 (Pure Icon-Only Toolbar with Tooltips)**：
  - 上方所有操作按鈕與控制項全面採用**純圖示設計**（無外顯文字標籤），所有功能說明、參數與快捷鍵統一收整於浮動提示 (`title`) 中，介面極致精緻乾淨不壅擠。
  - 整合「**效能分析 (Performance Analysis)**」核取方塊（`Gauge` 圖示，琥珀金色高亮），僅在需要深入排查或調優語句時勾選啟用，測量實際 IO 與 CPU 耗時。
  - 整合「**預估執行計畫 (Estimated Plan `SET SHOWPLAN_ALL ON;`)**」核取方塊（`Workflow` 圖示，青空藍高亮），勾選後直接以表格型態輸出編譯期最佳化執行計畫至查詢結果分頁，不實際執行語句。
  - 整合「**實際執行計畫 (Actual Plan `SET STATISTICS XML ON;`)**」核取方塊（`Network` 圖示，霓虹紫高亮），實際執行語句並自動擷取底層 XML Showplan，在新工作區分頁中以專業圖形化計畫呈現。
  - 三大調優模式（效能分析／預估計畫／實際計畫）內建**三向智慧互斥保護機制**，防止同時勾選造成 T-SQL 衝突或伺服器連線狀態混亂。
- **常用 DBA 維護與監控快速代碼庫 (Built-in DBA Diagnostics Toolbox)**：
  - 頂部工具列整合「**DBA 工具箱**」下拉選單，內建最頂級、高頻使用且經過最佳化的 SQL Server 專用排查語法：
    1. 🔒 **即時鎖定與阻塞鏈 (Locks & Blocking)**：快速抓出誰卡住了誰（Lead Blocker、SPID、等待類型與秒數、阻塞 SQL 語句）。
    2. ⚡ **Top 20 慢查詢 (Top Slow Queries by CPU)**：透過 DMV 依累計 CPU 與執行時間分析最耗效能的語句。
    3. 💾 **資料表空間與筆數排行 (Table Sizes & Rows)**：秒級查詢全庫資料表列數與 MB 佔用排行（無需緩慢的 `COUNT(*)`）。
    4. 🧩 **索引破碎度分析 (Index Fragmentation > 20%)**：精準揪出破碎度過高索引並自動附帶 `REBUILD` / `REORGANIZE` 語法。
    5. 🗑️ **未使用的冗餘索引 (Unused Indexes)**：找出 0 次搜尋使用卻佔用龐大寫入維護開銷的索引。
    6. 🌐 **目前活動連線與客戶端統計 (Active Sessions)**：即時掌握連線 SPID、來源主機、程式名稱與 IP。
  - 點擊任何項目即刻自動開啟新查詢分頁並填入完整代碼，按下 <kbd>Ctrl</kbd> + <kbd>Enter</kbd> 即可秒級執行。
- **多分頁標籤管理 (Multi-Tab SQL Editor)**：
  - 支援多開查詢分頁，各分頁擁有獨立的 SQL 內容與游標狀態。
  - 分頁列超出寬度時，支援**滑鼠滾輪直接左右橫向滾動**。
  - **Pointer Events 無縫拖曳換位**：上方查詢分頁支援滑鼠按住拖曳自由調整排列順序，具備目標落點藍色指示條。
  - **當前所選分頁顯眼色彩 (Active Tab Colors)**：當前啟用中的 SQL 編輯分頁採用高對比度醒目色彩（預設皇家藍 `#1e40af` 配純白字 `#ffffff`），分頁圖示、資料庫標籤與關閉按鈕同步高對比適配，於多工作分頁中一目了然；可於設定中完全自訂。
  - **行內重新命名 (Inline Tab Rename)**：滑鼠雙擊分頁名稱即可直接在原地編輯命名，按下 <kbd>Enter</kbd> 保存、<kbd>Esc</kbd> 取消；亦可透過**滑鼠右鍵選單**選擇「重新命名」、「關閉此分頁」或「關閉其他分頁」。
- **介面佈局靈活掌控 (Layout Controls)**：
  - **側邊欄快速收合/展開**：於右上角版面控制區點擊側邊欄按鈕，即可一鍵收合左方 Explorer 側邊欄，釋放最大代碼編輯空間，並自動記憶收合狀態。
  - **結果面板收合/展開**：右上角一鍵折疊下方查詢結果面板，專注於 SQL 撰寫。
- **智慧語法高亮與 IntelliSense 補全**：
  - 內建 T-SQL 關鍵字、系統函數、聚合函數語法高亮。
  - **即時物件補全**：連線後背景預先載入快取，編輯器中輸入即自動提示當前資料庫中的資料表名稱、檢視表名稱與欄位名稱。
  - **常用代碼範本 (Snippets)**：輸入 `sel`、`upd`、`join` 等前綴按 <kbd>Tab</kbd> / <kbd>Enter</kbd> 即可展開完整 SQL 語句骨架。
- **獨立語句智慧識別與執行**：
  - **選取優先**：若有反白選取文字，按下 <kbd>Ctrl</kbd> + <kbd>Enter</kbd> 僅執行選取內容。
  - **無選取時單句執行**：自動依據空白行、分號 (`;`) 或 `GO` 關鍵字精準切分，只執行游標所在的那一段獨立 SQL，絕不誤執行整頁。
  - **暫態高亮反饋**：按下執行瞬間，被執行的語句區塊會以**淡黃色高亮 (#feffe0)** 漸變閃爍，明確告知使用者本次執行的範圍，護眼且直觀。
- **快速向下複製 (`Ctrl + D`)**：
  - **無選取時**：游標所在整行往下複製一行。
  - **有選取時**：將整個選取區塊往下複製一份，並**自動在中間插入空白行**隔開，避免頭尾 SQL 黏在一起。
- **智慧 SQL 格式化 (`Shift + Alt + F`)**：
  - 有選取時僅格式化選取的 SQL；未選取時僅格式化當前游標所在的獨立語句。
- **長時間查詢中斷與伺服器 Task Killer (Cancel Query / Task Killer & SPID)**：
  - **細粒度連線鎖定**：後端由全域獨占鎖重構為細粒度連線鎖，查詢執行期間微秒級釋放，確保取消信號立即可達。
  - **動態執行/取消按鈕與停止按鈕**：
    - 查詢執行中時，頂部綠色執行按鈕動態轉化為紅色呼吸燈「**點擊中斷並取消查詢**」按鈕，獨立停止按鈕同步點亮。
    - 支援快捷鍵 <kbd>Alt</kbd> + <kbd>Break</kbd> / <kbd>Pause</kbd>（SSMS 標準）與 <kbd>Escape</kbd> 秒級取消。
  - **伺服器端 KILL 命令發送 (Task Killer)**：
    - 在連線建立時自動記錄當前會話 `SELECT @@SPID;`。
    - 取消觸發時，透過 `tokio::select!` 毫秒級中斷本機讀取，並立即透過獨立背景連線向 SQL Server 發送 `KILL <spid>;`，即刻終止伺服器端計算、回滾交易並釋放資料庫鎖定 (Locks)。
  - **即時 SPID 與碼錶計時**：狀態列左側常駐顯示 `SPID: <id>`，右側動態顯示 `執行中 (00:04)...` 與中斷狀態。
  - **髒連線隔離與透明自動重連**：被中斷的 TCP 連線自動安全捨棄並在背景重連，使用者完全無感，後續查詢順暢無阻。
- **常用 SQL 範本庫與應用程式同層自訂文件 (`sql_custom_templates.json`)**：
  - **雙重入口**：頂部工具列專屬 `BookOpen` 圖示按鈕（位於「快速物件檢索」旁），或 Monaco 編輯器內滑鼠右鍵「**常用 SQL 範本庫 (SQL Templates)...**」。
  - **豐富內建語法庫**：
    - **常用語法**：高效分頁 (`OFFSET...FETCH`)、關聯更新 (`UPDATE...FROM...JOIN`)、`MERGE` (UPSERT)、`OUTPUT` 異動擷取、防重複插入 (`WHERE NOT EXISTS`)。
    - **變數與中繼運算**：純量變數預設值宣告與賦值、含索引資料表變數 (`@TableVariable`)、區域暫存表 (`#TempTable`) 與索引最佳化、系統環境變數 (`SCOPE_IDENTITY()`、`@@ROWCOUNT`、`@@SPID`)、自訂 TVP 資料表型別批次傳遞。
    - **CTE 語法**：多重 CTE 串接、遞迴樹狀組織階層展開 (`OrgHierarchy`)、CTE 刪除重複資料、遞迴日期序列生成。
    - **進階用法**：視窗函數 (`DENSE_RANK`, `Running Total`)、`CROSS APPLY` 取得分組最新 Top N、`STRING_SPLIT` 與 `STRING_AGG`、動態 PIVOT 行列轉置、生產級交易防護 (`TRY...CATCH` + `XACT_ABORT`)、安全參數化動態 SQL (`sp_executesql`)、分批刪除海量資料防鎖定升級。
    - **診斷維護**：DMV 缺失索引建議、即時鎖定與阻塞源頭排查。
  - **應用程式同層實體自訂文件 (`sql_custom_templates.json`)**：
    - 正式打包版本自動座落於 `SQLight.exe` 同層目錄（免安裝可攜版隨拷隨走，極致方便團隊統一共用）。
    - 支援外部編輯器（VS Code、記事本）自由維護修改，視窗內支援「**📂 在檔案總管顯示**」與「**🔄 重新載入**」熱重載。
    - 介面內建完整 CRUD（新增、編輯、刪除自訂範本），自動即時回寫該實體 JSON 檔。
  - **游標處一鍵插入**：支援按下 <kbd>Enter</kbd> 精準貼入編輯器當前游標處（自動覆蓋選區），或以新分頁開啟。
- **客戶端 GO 批次分割執行引擎 (Client-Side GO Batch Runner)**：
  - **智慧 GO 解析器**：內建狀態機語意掃描，精確略過字串常值 (`'...'`) 與單行/多行註解（`--`, `/*...*/`）中的 `GO` 關鍵字，解決 TDS 驅動傳送未支援的 `GO` 造成之 Msg 102 語法報錯。
  - **多批次連續執行**：將大型 SQL 腳本依 `GO` 邊界自動拆分為多個獨立 Batch 循序發送至資料庫執行，並自動整合所有 ResultSets、受影響列數與訊息。
  - **DDL 體驗優化**：產生與執行 `CREATE TABLE` 等無資料列回傳之指令時，執行後自動導向「Messages」面板顯示完成狀態，貼合 SSMS 標準使用體驗。

### 4. 多結果歷史分頁、AG Grid & 即時統計列
- **欄位拖曳重排與全方位選取引擎 (Column Reordering & Selection Engine)**：
  - **欄位拖曳重排 (Column Reordering)**：滑鼠於任何欄位標題按住拖曳（移動距離 > 4px），即可自由調換欄位前後排列順序，具備原生的拖曳陰影與插入定位箭頭。已選取的欄位在重排後持續維持選取高亮狀態。
  - **單擊欄位標題 (Click Header)**：單擊任一欄位標題即可選取該整欄所有儲存格，底部統計列即時更新該欄之數值總和與平均。
  - **Shift + 點擊欄位標題 (Shift + Click Header)**：點擊起點欄位後，按住 <kbd>Shift</kbd> 點擊另一欄位，自動依據當前畫面最新排列順序，連續選取兩欄間的所有整欄。
  - **Ctrl + 點擊欄位標題 (Ctrl + Click Header)**：按住 <kbd>Ctrl</kbd>（或 <kbd>Cmd</kbd>）點擊欄位標題，支援非連續性自由挑選多個欄位（如同時選取第 1 欄與第 5 欄）。
  - **儲存格拖曳矩形框選 (Cell Box Drag)**：滑鼠於任一儲存格按住拖曳，自由框選任意跨列、跨欄的矩形資料區域。
  - **Shift + 點擊儲存格 (Shift + Click Cell)**：點擊起始儲存格後，按住 <kbd>Shift</kbd> 點擊結束儲存格，快速建立矩形選取範圍。
  - **點擊左上角 `#` 標題或快捷鍵 <kbd>Ctrl</kbd> + <kbd>A</kbd> 全選**：一鍵選取整張表格所有列與欄位。
  - **點擊列號 `#` 整列選取與拖曳**：點擊左側行號選取整列，按住拖曳或配合 <kbd>Shift</kbd> 快速連續選取多列。
  - **視覺順序同步匯出**：當欄位經過拖曳調整前後順序後，選取複製、TSV、CSV、JSON 與 Markdown 匯出自動忠實依據使用者所排定之**畫面視覺順序**輸出。
  - **直觀視覺高亮與清除**：被選取的欄位標題以專屬淡藍色高亮標示（`.sqlight-header-selected`），儲存格呈現清晰反白效果；按 <kbd>Esc</kbd> 鍵隨時清除所有選取。
- **Excel 級即時統計列 (Excel-Grade Live Aggregate Bar)**：
  - 於查詢結果表格（`ResultGrid`）與資料表瀏覽器（`TableDataViewer`）底部配備即時統計狀態列。
  - **任意區域拖曳框選**：按住滑鼠左鍵自由拖曳框選一格或多格儲存格（或多欄選取、多列選取），立即呈現：
    - `選取: N 格 (M 個數值)`（多欄選取時顯示 `選取: X 欄 / Y 列`）
    - `總和 (Sum): 1,540,200`
    - `平均 (Avg): 128,350`
    - `最小值 (Min): 1,200`
    - `最大值 (Max): 890,000`
    - `非重複計數 (Distinct): 11`
  - **框選複製快捷**：支援選取後直接點擊「複製選取」或按下 <kbd>Ctrl</kbd> + <kbd>C</kbd>，直接將選取區塊複製為 TSV 貼入 Excel；按下 <kbd>Esc</kbd> 立即清除選取。
- **現代程式碼匯出（Export as JSON / Markdown）**：
  - 工具列與右鍵選單全面支援一鍵匯出：
    - **複製為 JSON 物件陣列**：直接將全表或選取區域轉為 `[ { "id": 1, "name": "Alice" }, ... ]`，單元測試、Mock API 開發即貼即用。
    - **複製整列為 JSON**：複製單筆物件 `{ "id": 1, "name": "Alice" }`。
    - **複製為 Markdown 表格**：自動處理 Pipe 轉義與斷行，直接貼入 GitHub Issue、Pull Request 或 Notion 文件中呈現排版漂亮的表格。
- **分頁序號累計與命名規範 (`$SEQ.$Tabname $rowNumber'r'`)**：
  - 記憶體維護單調遞增計數器（由 0 起算持續累計），每次執行查詢自動依序編號，分頁名稱自動格式化為 `$SEQ.$Tabname $rowNumber'r'`（例如 `1.Customers 50r`、`2.Orders 12r`、出錯時為 `3.Query 0r`）。
  - 分頁列排版乾淨俐落，若標題已內含筆數資訊則不重複顯示額外徽章，發生錯誤時自動以高警示紅色 `Err` 徽章標示。
  - **支援重新命名**：滑鼠雙擊結果分頁名稱或點擊右鍵「重新命名」，即可自由更改為易識別的自訂名稱。
- **當前所選結果分頁顯眼色彩 (Active Result Tab Colors)**：
  - 當前啟用中的結果分頁套用顯眼高對比色彩（預設深森林綠 `#065f46` 配純白字 `#ffffff`），與上方藍色 SQL 分頁產生清晰視覺層次，即使多個查詢結果切換也能迅速定位。
  - 顏色可於「設定」中自由自訂，並提供 7 種設計師精選調色盤預設與即時預覽。
- **釘選保護機制 (Pin / Unpin)**：
  - 點擊分頁左側圖釘或右鍵選單即可釘選；**被釘選的分頁會自動移動至最左側**，受特殊保護，即使超過歷史保留上限也不會被自動清理。
- **嚴謹的分頁排列順序**：
  - `[所有釘選分頁] -> [最新執行分頁] -> [次新分頁] -> [更舊分頁...]`
- **Pointer Events 無縫拖曳換位**：
  - 捨棄 HTML5 原生拖曳（解決 Windows Tauri WebView2 下觸發系統 OLE 拖放時強制覆蓋的 🚫 禁止圖示）。
  - 全程採用 Pointer Events 搭配抓手手勢 (`grabbing`)，支援任意拖曳分頁變更左右排列順序，並具備即時目標落點高亮。
- **AG Grid 現代化暗色資料表格**：
  - 支援百萬列等級 DOM 虛擬捲動，流暢無阻。
  - 欄位寬度智慧自適應內容。
  - 儲存格選取與複製。
  - **右鍵快捷選單**：支援「複製儲存格」、「複製整行」、「匯出/複製為 TSV」、「匯出/複製為 CSV」、「複製為 JSON」、「複製為 Markdown 表格」。
- **一鍵自動產生 INSERT / UPDATE / DELETE 語法（內建交易安全防護）**：
  - 於結果列任何一處點選滑鼠右鍵，即可一鍵建立該列的 **INSERT、UPDATE 或 DELETE** SQL 語句。
  - **時間戳記註解**：自動於首行附加註解 `-- 自動產生語法 時間: YYYY-MM-DD HH:mm:ss`。
  - **複合主鍵完整性驗證 (Composite PK Validation)**：
    - 嚴格比對資料表所有主鍵欄位：只有當資料表定義的**所有複合主鍵欄位**皆完整存在於查詢結果中時，才以主鍵建立 `WHERE` 條件。
    - **若無 PK、未取得 PK 定義或僅投影部分主鍵**：自動安全退回（fallback）改以**當前查詢結果的全部欄位**作為 `WHERE` 條件（並將 NULL 轉為 `IS NULL`），徹底防範因部分複合主鍵匹配多筆資料而造成誤更新或誤刪！
  - **自動交易保護機制 (Transaction Guards)**：
    - 產生的 `UPDATE` 與 `DELETE` 自動包覆於 `BEGIN TRANSACTION`、`BEGIN TRY ... COMMIT`、`BEGIN CATCH ... ROLLBACK` 結構中。
    - 前置防護檢查 `IF @@TRANCOUNT <> 0 THROW`，執行後嚴格檢查 `IF @@ROWCOUNT <> 1 THROW`，確保影響筆數恰為 1 筆，否則自動觸發 `ROLLBACK`，保障生產資料絕對安全。
  - **欄位安全過濾與逸出**：
    - `INSERT` 與 `UPDATE SET` 自動排除 `Identity` 自動識別欄位。
    - 二進位佔位符與超出 JS 安全範圍的超大整數主動防呆攔截，防止資料截斷與失真。
    - 識別字逸出改為標準 T-SQL `[${name.replace(/\]/g, ']]')}]`，完整支援包含閉合括號 `]` 的欄位名稱。
  - **自動開分頁與剪貼簿**：自動建立新 SQL 查詢分頁開啟並聚焦，且同步寫入剪貼簿與跳出 Toast 通知。
- **多結果集 (Multiple Result Sets)**：
  - 單次查詢返回多張表格時，自動提供子分頁標籤切換檢視。

### 5. 訊息面板與執行歷史
- **Messages 面板**：
  - 顯示查詢執行歷時、受影響列數 (Affected Rows) 以及資料庫伺服器傳回的 Print 訊息。
  - 查詢發生錯誤時，標籤顯示紅色錯誤徽章，並提供清楚的錯誤碼與說明。
- **History 面板**：
  - 自動記錄歷次執行的 SQL 語句、執行時間與耗時，點擊歷史記錄可直接重新填入新查詢分頁。

### 6. 執行統計與 IO 分析器 (Execution Stats & IO Analyzer)
- **頂部開關隨選啟用 (On-Demand Performance Toggle)**：
  - 預設保持關閉 (`false`)，避免日常查詢產生非必要的伺服器追蹤與網路開銷。
  - 勾選頂部功能列的「**效能分析**」核取方塊後執行查詢，系統自動注入 `SET STATISTICS IO, TIME ON` 與階段性 DMV 遙測腳本。
  - 執行完成後自動切換至底部「**Stats (效能)**」儀表板分頁，並主動將底層遙測資料集隔離剔除，使用者查詢結果集 100% 保持乾淨。
- **5 大核心效能 KPI 摘要卡片**：
  1. ⏱️ **總執行時間 (Elapsed Time)**：整體查詢端到端歷時。
  2. ⚡ **CPU 時間 (CPU Time)**：資料庫引擎實際消耗之 CPU 計算毫秒數。
  3. 🛠️ **編譯與解析時間 (Compile Time)**：SQL Server 生成查詢計畫與編譯所耗費的時間。
  4. 📖 **邏輯讀取量 (Logical Reads)**：從記憶體緩衝區 (Buffer Cache) 讀取的 8KB 資料頁數與換算容量（如 `1,250 頁 (9.8 MB)`）。
  5. 🎯 **緩衝快取命中率 (Buffer Cache Hit Ratio)**：精準換算 `(Logical Reads - Physical Reads) / Logical Reads` 百分比，快速評估是否發生硬碟實體 I/O 瓶頸。
- **各資料表實體/邏輯 IO 細部展開 (Per-Table Breakdown)**：
  - 清晰列出查詢所涉及的每一張資料表：掃描次數 (`Scan Count`)、邏輯讀取 (`Logical Reads`)、實體讀取 (`Physical Reads`)、預讀次數 (`Read-Ahead`)、LOB 大型物件讀取。
  - **自動容量換算**：根據 SQL Server 內部 8KB 資料頁規格，自動換算為人類友善的資料量單位（`B` / `KB` / `MB` / `GB`）。
  - **高 IO 警示 (High IO Alert)**：當單表邏輯讀取 > 1,000 頁或發生全表掃描且讀取 > 200 頁時，自動標記琥珀金警示與進度條，協助工程師一眼揪出效能殺手（Table Scan / Index Scan / 遺漏索引）。
- **工作階段等待事件統計 (Session Wait Stats)**：
  - 自動抓取當次查詢在 `sys.dm_exec_session_wait_stats` 中所累積的等待事件（如 `PAGEIOLATCH_SH`、`ASYNC_NETWORK_IO`、`CXPACKET` 等）。
  - 清楚展示等待任務數 (`Waiting Tasks`)、累計等待毫秒數 (`Wait Time`) 與最大單次等待時間。
- **一鍵匯出 Markdown 效能調優報告**：
  - 點擊「複製 Markdown 報告」，即可產出包含總結指標、高 IO 警示標記、各資料表詳細 IO 表格與等待事件分析的完整排版報告，方便直接貼入 Pull Request、Jira 效能工單或 Slack/Teams 團隊討論。

### 7. 資料表資料與結構瀏覽器 (Table Data & Structure Viewer)
- **資料表資料瀏覽器 (Table Data Viewer)**：
  - 於側邊欄任何資料表右鍵點選「**開啟資料表 (Open Data)**」，立即以獨立分頁開啟該資料表資料。
  - 採用 AG Grid 虛擬滾動流暢瀏覽，支援快速文字篩選、儲存格矩形框選、多欄多列拖曳選取、Excel 級即時統計列（Sum/Avg/Min/Max/Distinct）、以及複製為 TSV/JSON/Markdown 與 DML 產生。
- **資料表結構檢視器 (Table Structure Viewer)**：
  - 於側邊欄任何資料表或檢視表右鍵點選「**資料表結構 (Table Structure)**」，即刻開啟專屬結構分頁。
  - 完整展示 12 大欄位中繼資料屬性：
    1. `# (Ordinal)`：欄位序號
    2. `PK`：主鍵金黃色徽章標記
    3. `欄位名稱 (Column Name)`：主鍵高亮呈現
    4. `基礎型別 (Data Type)`：如 `nvarchar`、`int`、`decimal`
    5. `完整型別與長度 (Full Type)`：如 `nvarchar(50)`、`decimal(18, 2)`、`nvarchar(MAX)`
    6. `可為 NULL (IsNullable)`：YES（綠色徽章）／NO（紅色徽章）
    7. `自動識別 (Identity)`：YES（青色徽章）／`-`
    8. `預設值 (Default)`：預設值內容或 NULL
    9. `最大長度 (Bytes)`：文字或二進位長度（支援 MAX）
    10. `精確度 (Precision)`：數值型別精確度
    11. `小數位數 (Scale)`：數值型別小數位數
    12. `定序 (Collation)`：資料定序名稱
  - 支援快速搜尋過濾、多格/多欄/多列框選、即時統計與一鍵匯出為 TSV、JSON、Markdown 表格。

### 8. 實際執行計畫與 XML 視覺化檢視器 (Actual Execution Plan & XML Viewer)
- **隨選勾選實際執行計畫 (SET STATISTICS XML ON)**：
  - 勾選頂部功能列的「**實際執行計畫**」核取方塊（`Network` 網狀節點圖示，霓虹紫色高亮）。
  - 執行查詢時，系統以非同步方式啟用 `SET STATISTICS XML ON;`，實際執行語句以取得真實執行統計（包括實際處理列數、運算子成本比例、實際執行時間與平行處理資訊）。
  - **Fail-Safe 連線保護**：在 `try ... finally` 區塊中嚴格調用 `SET STATISTICS XML OFF;`，即使查詢因語法或逾時報錯，也 100% 確保連線工作階段不會殘留 XML 統計模式。
- **資料結果集潔淨分離 (Clean Result Sets)**：
  - SQL Server 傳回的 ShowPlan XML 欄位（`Microsoft SQL Server 2005 XML Showplan`）由底層引擎自動識別並安全抽離。
  - 使用者執行的業務查詢資料（如 `SELECT * FROM Orders`）依然正常、乾淨地呈現在底部「**Results**」資料表格中，完全不被巨大的 XML 字串污染。
- **獨立工作區分頁 (`ExecutionPlanTab` & `ExecutionPlanViewer`)**：
  - 自動於上方工作區開啟專屬分頁（紫色標籤，圖示為 `Network`），以專屬視覺化畫布呈現圖形化計畫。
  - **整合開源 `html-query-plan` 視覺化引擎**：
    - 將 XML Showplan 精準轉譯為與 SSMS / Azure Data Studio 高度相符的樹狀圖形化計畫。
    - 完整呈現各節點圖示（Clustered Index Scan/Seek、Table Scan、Hash Match、Nested Loops、Sort、Filter 等）。
    - 清楚標記每個算子的**相對成本百分比 (Cost %)** 與資料流線段寬度（依實際資料傳輸量動態粗細）。
    - **智慧懸浮資訊卡 (Rich Tooltips)**：滑鼠懸停於任何算子或線段上，即刻彈出包含實際列數、估計列數、述詞 (Predicate)、輸出欄位 (Output List)、I/O 與 CPU 成本的完整規格卡片。
- **縮放與平移導覽控制 (Zoom & Pan Controls)**：
  - 支援 <kbd>+</kbd> 放大（最高 250%）、<kbd>-</kbd> 縮小（最低 30%）、<kbd>100%</kbd> 一鍵重設大小。
  - 大畫布自由捲動瀏覽，適合分析大型多表 JOIN 與複雜平行處理查詢。
- **雙模式檢視：圖形計畫 (Diagram) 與 原始 XML (Raw XML)**：
  - 支援一鍵於「**圖形計畫**」與「**原始 XML**」間無縫切換。
  - 原始 XML 模式提供完整排版縮排、總行數統計、KB 容量換算與自動換行開關。
- **一鍵複製原始 XML (One-Click Copy XML)**：
  - 工具列提供專屬「**複製原始 XML**」按鈕，點擊後毫秒級寫入作業系統剪貼簿，並附帶動態綠色 Checkmark 與 Toast 提示反饋。
- **一鍵另存為 `.sqlplan` 檔案 (Export to .sqlplan)**：
  - 點擊「**另存為 .sqlplan**」按鈕，直接將完整的 ShowPlanXML 匯出為微軟標準的 `.sqlplan` 副檔名檔案。
  - 下載之檔案可直接使用官方 **SQL Server Management Studio (SSMS)**、**Azure Data Studio** 或 **SentryOne Plan Explorer** 開啟、分析與分享。

### 9. 個人化設定與安全防護 (Settings & Preferences)
透過右上角齒輪開啟設定對話框（固定尺寸設計，切換分頁不晃動）：
- **編輯器設定 (Editor)**：
  - 字型大小 (12px ~ 20px)。
  - 字型家族 (Font Family，支援 Fira Code, JetBrains Mono, Cascadia Code, Consolas, Monaco 等寬字型)。
  - 自動換行 (Word Wrap) 開關 (On / Off)。
  - Tab 縮排空格數 (2 空格 / 4 空格)。
  - 執行暫態高亮色彩自訂（預設柔和淡黃色 `#feffe0`，附調色盤與色碼輸入）。
  - **SQL 編輯分頁啟用色彩 (Active Tab Colors)**：自訂上方分頁在選取時的背景色與前景色（預設皇家藍 `#1e40af` 配純白字 `#ffffff`），提供 7 種設計師快速預設與即時分頁預覽。
- **查詢與結果設定 (Results)**：
  - Results 歷史分頁保留上限（5 ~ 50 組，預設 10 組，超額自動清理最舊未釘選分頁）。
  - 預設最大查詢筆數截斷防護（1,000 ~ 50,000 筆或無限制，防止意外撈取海量資料打爆記憶體）。
  - **查詢結果分頁啟用色彩 (Active Result Tab Colors)**：自訂下方結果分頁在選取時的背景色與前景色（預設深森林綠 `#065f46` 配純白字 `#ffffff`），提供 7 種設計師快速預設與即時分頁預覽。
- **關於與手冊 (About)**：
  - 完整常用鍵盤快捷鍵清單與快速 SQL 代碼範本操作說明。
  - 支援一鍵重設所有設定為原廠預設值。

---

## ⌨️ 鍵盤快捷鍵與快速代碼範本 (Shortcuts & Snippets)

### 常用快捷鍵總表

| 快捷鍵 | 作用範圍 | 功能說明 |
| :--- | :--- | :--- |
| <kbd>Ctrl</kbd> + <kbd>P</kbd> | 全域 / 編輯器 | **快速物件檢索 (Spotlight)**：呼出浮動搜尋面板，模糊檢索資料表、檢視表、預存程序、函數 |
| <kbd>Ctrl</kbd> + <kbd>Enter</kbd> | SQL 編輯器 | **執行當前語句**：若有選取文字則執行選取範圍；無選取時自動執行游標所在獨立 SQL |
| <kbd>Ctrl</kbd> + <kbd>Shift</kbd> + <kbd>Enter</kbd> | SQL 編輯器 | **執行全部語句**：無條件執行整個編輯器內的所有 SQL 代碼 |
| <kbd>Alt</kbd> + <kbd>Break</kbd> / <kbd>Pause</kbd> | 全域 / 編輯器 | **中斷並取消查詢 (Cancel Query)**：微軟 SSMS 標準中斷快捷鍵，中止本地讀取並發送 `KILL <spid>` 終止伺服器運算 |
| <kbd>Escape</kbd> | 全域 / 編輯器 | **取消查詢 / 關閉浮窗**：查詢執行中時中斷取消查詢；浮窗/檢索器開啟時關閉並交還編輯器焦點；表格選取時清除框選 |
| <kbd>Ctrl</kbd> + <kbd>D</kbd> | SQL 編輯器 | **向下快速複製**：無選取時向下複製游標行；有選取時向下複製區塊並插入空白行間隔 |
| <kbd>Shift</kbd> + <kbd>Alt</kbd> + <kbd>F</kbd> | SQL 編輯器 | **格式化 SQL**：有選取時格式化選取部分；無選取時格式化游標所在獨立語句 |
| <kbd>Ctrl</kbd> + <kbd>S</kbd> | 全域 / 編輯器 | **儲存 SQL 檔案**：將當前查詢內容另存或儲存至本機檔案 |
| <kbd>Ctrl</kbd> + <kbd>O</kbd> | 全域 | **開啟 SQL 檔案**：開啟本機 SQL 檔案至新查詢分頁 |
| <kbd>Ctrl</kbd> + <kbd>Space</kbd> | SQL 編輯器 | **程式碼智慧自動補全**：手動觸發 IntelliSense（關鍵字、資料庫、資料表、欄位） |
| 滑鼠右鍵 (<kbd>Right Click</kbd>) | SQL 編輯器 | **編輯器快顯選單**：在物件總管中定位 (Locate in Explorer)、常用 SQL 範本庫 (SQL Templates)... |
| 工具列按鈕 (<kbd>LocateFixed</kbd>) | 物件總管 (Explorer) | **快速定位資料表**：捕捉游標/反白處資料表名稱，左側自動連鎖展開、載入欄位、光暈高亮並置中捲動 |
| 工具列按鈕 (<kbd>BookOpen</kbd>) | 頂部工具列 | **常用 SQL 範本庫**：開啟內建常用/CTE/進階/變數範本與應用程式同層實體自訂文件 |
| 滑鼠雙擊 (<kbd>Double Click</kbd>) | 查詢/結果分頁 | **分頁重新命名**：行內雙擊分頁標籤名稱即可直接修改名稱 |
| 滑鼠右鍵 (<kbd>Right Click</kbd>) | 查詢/結果分頁 | **分頁操作選單**：重新命名、關閉分頁、關閉其他分頁（結果分頁可釘選） |
| 滑鼠滾輪 (<kbd>Wheel</kbd>) | 分頁列 | **橫向滾動**：於頂部 Query 分頁列或底部 Results 分頁列滾動滑鼠可左右橫向捲動 |
| 滑鼠拖曳 (<kbd>Pointer Drag</kbd>) | 查詢/結果分頁 | **拖曳排序**：按住分頁左右拖動可自由調整排列順序（無禁止符號） |
| 滑鼠框選 (<kbd>Mouse Drag</kbd>) | 結果表格 | **即時統計**：拖曳選取儲存格，底端狀態列即時計算 Sum / Avg / Min / Max / Count / Distinct |
| <kbd>Ctrl</kbd> + <kbd>C</kbd> | 結果表格 | **複製選取內容**：框選儲存格後按下即可將選取區域複製為 TSV 貼入 Excel |
| <kbd>Esc</kbd> | 結果表格 | **清除選取**：取消儲存格框選狀態並還原列數統計 |

---

### 快速代碼範本 (SQL Code Snippets)

於 Monaco 編輯器中輸入前綴代碼後，按下 <kbd>Tab</kbd> 或 <kbd>Enter</kbd> 鍵即可快速展開範本：

| 前綴代碼 | 範本名稱 | 展開效果預覽 |
| :--- | :--- | :--- |
| `sel` | SELECT 基礎查詢 | `SELECT * FROM table WHERE 1 = 1;` |
| `seltop` | TOP N 限制筆數查詢 | `SELECT TOP 100 * FROM table ORDER BY 1;` |
| `ins` | INSERT 資料新增 | `INSERT INTO table (col1, col2) VALUES (val1, val2);` |
| `upd` | UPDATE 資料更新 | `UPDATE table SET col = val WHERE id = val;` |
| `del` | DELETE 資料刪除 | `DELETE FROM table WHERE condition;` |
| `join` | INNER JOIN 內部關聯 | `JOIN table t ON t.id = other.id` |
| `leftjoin` | LEFT JOIN 左外部關聯 | `LEFT JOIN table t ON t.id = other.id` |
| `cte` | WITH CTE 通用資料表運算式 | `WITH CteName AS (SELECT * FROM table) SELECT * FROM CteName;` |

---

## 🛠️ 安裝、開發與建置指南 (Installation & Development)

### 環境需求 (Prerequisites)
1. **Node.js**：建議 `v18.0.0` 或更高版本。
2. **Rust & Cargo**：建議 `1.75.0` 或更高版本（可透過 [rustup.rs](https://rustup.rs/) 安裝）。
3. **C++ 建置工具 (Windows)**：需安裝 Microsoft C++ Build Tools 或 Visual Studio（包含 C++ 桌面開發工作負載）。
4. **WebView2**：Windows 10/11 通常已內建。

---

### 安裝依賴 (Install Dependencies)

```bash
# 安裝前端 NPM 套件
npm install
```

---

### 本地開發 (Local Development)

```bash
# 僅啟動前端 Vite 開發伺服器 (網頁模式)
npm run dev

# 啟動完整 Tauri 桌面端偵錯應用 (推薦)
npm run dev:tauri
```

---

### 程式碼檢查、測試與打包建置 (Verification & Build)

```bash
# 執行 TypeScript 靜態型別檢查
npm run typecheck

# 執行自動化單元測試套件 (90 項涵蓋連線、安全 DML、語句切分、Spotlight 模糊檢索、預估執行計畫 SHOWPLAN_ALL、資料表結構、分頁顏色、執行統計分析、長時間查詢中斷取消與 Task Killer、常用 SQL 範本庫與快速定位抽取器)
npm test

# 執行前端生產環境打包
npm run build

# 建置發布版桌面應用程式 (.exe 安裝包 / 二進位檔)
npm run build:tauri

# 建置免安裝綠色版可攜式執行檔 (Portable .exe)
npm run build:portable
```

打包完成後的 Windows 執行檔將位於 `src-tauri/target/release/` 目錄中。

---

## 📄 授權條款 (License)

本專案採用私有或開放授權規範，詳見儲存庫授權聲明。
Copyright © 2026 SQLight Team. All rights reserved.
