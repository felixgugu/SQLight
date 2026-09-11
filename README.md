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
   - [智慧記憶與自動復原 (Auto-Restore Last Session)](#2-智慧記憶與自動復原)
   - [專業級 Monaco SQL 編輯器 (Monaco SQL Workspace)](#3-專業級-monaco-sql-編輯器)
   - [多結果歷史分頁與 AG Grid (Multi-Result Tabs & AG Grid)](#4-多結果歷史分頁與-ag-grid)
   - [訊息面板與執行歷史 (Messages & Query History)](#5-訊息面板與執行歷史)
   - [資料表資料瀏覽器 (Table Data Viewer)](#6-資料表資料瀏覽器)
   - [個人化設定與防護 (Settings & Preferences)](#7-個人化設定與防護)
4. [鍵盤快捷鍵與快速代碼範本 (Shortcuts & Snippets)](#-鍵盤快捷鍵與快速代碼範本-shortcuts--snippets)
5. [安裝、開發與建置指南 (Installation & Development)](#-安裝開發與建置指南-installation--development)

---

## 🌟 專案簡介與特色 (Overview)

**SQLight** 是一款專為開發者、資料庫管理員 (DBA) 與數據分析師打造的極致輕量化 Microsoft SQL Server (T-SQL) 桌面管理客戶端。

傳統的 SQL Server 管理工具（如 SQL Server Management Studio (SSMS)、DataGrip、DBeaver）往往存在啟動載入過慢、記憶體資源佔用過大、介面老舊厚重等痛點。**SQLight** 旨在保留最核心且高頻使用的資料庫操作體驗，同時提供：
- ⚡ **秒開啟動**：原生 Rust 後端核心，體積輕巧且無肥重執行環境開銷。
- 🎨 **現代暗色美學**：精雕細琢的 Dark Theme，搭配流暢的微互動動畫與清晰的層次感。
- 💻 **媲美 VS Code 的編程手感**：深度整合 Monaco Editor，支援智慧補全、單句語法隔離、快速複製與自適應格式化。
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

### 4. 多結果歷史分頁、AG Grid & 即時統計列
- **全方位多欄選取與跨區域框選 (Multi-Column & Range Selection Engine)**：
  - **欄位標題拖曳選取 (Header Drag)**：滑鼠於任何欄位標題按住並左右拖曳，即可連續框選多個整欄資料。
  - **Shift + 點擊欄位標題 (Shift + Click Header)**：點擊任一欄位後，按住 <kbd>Shift</kbd> 點擊另一欄位，自動連續選取兩欄間的所有整欄。
  - **Ctrl + 點擊欄位標題 (Ctrl + Click Header)**：按住 <kbd>Ctrl</kbd> 點擊欄位標題，支援非連續性自由挑選多個欄位（如同時選取第 1 欄與第 5 欄）。
  - **儲存格拖曳矩形框選 (Cell Box Drag)**：滑鼠於任一儲存格按住拖曳，自由框選任意跨列、跨欄的矩形資料區域。
  - **Shift + 點擊儲存格 (Shift + Click Cell)**：點擊起始儲存格後，按住 <kbd>Shift</kbd> 點擊結束儲存格，快速建立矩形選取範圍。
  - **點擊左上角 `#` 標題或快捷鍵 <kbd>Ctrl</kbd> + <kbd>A</kbd> 全選**：一鍵選取整張表格所有列與欄位。
  - **點擊列號 `#` 整列選取與拖曳**：點擊左側行號選取整列，按住拖曳或配合 <kbd>Shift</kbd> 快速連續選取多列。
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
- **自動智慧分頁命名與自訂名稱**：
  - 每次執行查詢自動產生獨立的 Result 分頁，分頁名稱自動識別並擷取 SQL 中第一個涉及的資料表名稱（如 `Users`、`Orders`）。
  - **支援重新命名**：滑鼠雙擊結果分頁名稱或點擊右鍵「重新命名」，即可自由更改為易識別的自訂名稱。
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
- **一鍵自動產生 INSERT / UPDATE / DELETE 語法**：
  - 於結果列任何一處點選滑鼠右鍵，即可一鍵建立該列的 **INSERT、UPDATE 或 DELETE** SQL 語句。
  - **時間戳記註解**：自動於首行附加註解 `-- 自動產生語法 時間: YYYY-MM-DD HH:mm:ss`。
  - **智慧 PK 與全欄位防呆條件**：
    - 若資料表具有主鍵且結果包含 PK，自動使用 PK 作為 `WHERE` 條件。
    - **若無 PK 或結果未含 PK**，自動改以**當前查詢結果的全部欄位**作為 `WHERE` 條件（並將 NULL 轉為 `IS NULL`），防止誤更新或誤刪多筆資料！
  - **自動開分頁與剪貼簿**：自動建立新 SQL 查詢分頁開啟並聚焦，且同步寫入剪貼簿與跳出 Toast 通知。
- **多結果集 (Multiple Result Sets)**：
  - 單次查詢返回多張表格時，自動提供子分頁標籤切換檢視。

### 5. 訊息面板與執行歷史
- **Messages 面板**：
  - 顯示查詢執行歷時、受影響列數 (Affected Rows) 以及資料庫伺服器傳回的 Print 訊息。
  - 查詢發生錯誤時，標籤顯示紅色錯誤徽章，並提供清楚的錯誤碼與說明。
- **History 面板**：
  - 自動記錄歷次執行的 SQL 語句、執行時間與耗時，點擊歷史記錄可直接重新填入新查詢分頁。

### 6. 資料表資料瀏覽器 (Table Data Viewer)
- 於側邊欄任何資料表右側點擊檢視按鈕，立即開啟獨立分頁瀏覽該表前 10,000 筆資料。
- 提供分頁控制、每頁筆數設定 (20/50/100/200 筆)、欄位型別快速預覽。

### 7. 個人化設定與防護 (Settings & Preferences)
透過右上角齒輪開啟設定對話框（固定尺寸設計，切換分頁不晃動）：
- **編輯器設定 (Editor)**：
  - 字型大小 (12px ~ 20px)。
  - 字型系列 (Font Family，預設 JetBrains Mono, Fira Code, Consolas)。
  - 自動換行 (Word Wrap) 開關。
  - 代碼縮圖小地圖 (Minimap) 開關。
  - 執行反饋高亮色彩自訂（預設柔和淡黃色 `#feffe0`）。
- **結果與安全防護 (Results)**：
  - Results 歷史分頁保留上限（5 ~ 50 組，預設 10 組，超額自動清除最舊未釘選分頁）。
  - 預設最大查詢筆數截斷防護（1,000 ~ 50,000 筆或無限制，防止 `SELECT *` 意外打爆記憶體）。
- **關於與手冊 (About)**：
  - 完整鍵盤快捷鍵清單與快速代碼範本操作說明。

---

## ⌨️ 鍵盤快捷鍵與快速代碼範本 (Shortcuts & Snippets)

### 常用快捷鍵總表

| 快捷鍵 | 作用範圍 | 功能說明 |
| :--- | :--- | :--- |
| <kbd>Ctrl</kbd> + <kbd>Enter</kbd> | SQL 編輯器 | **執行當前語句**：若有選取文字則執行選取範圍；無選取時自動執行游標所在獨立 SQL |
| <kbd>Ctrl</kbd> + <kbd>Shift</kbd> + <kbd>Enter</kbd> | SQL 編輯器 | **執行全部語句**：無條件執行整個編輯器內的所有 SQL 代碼 |
| <kbd>Ctrl</kbd> + <kbd>D</kbd> | SQL 編輯器 | **向下快速複製**：無選取時向下複製游標行；有選取時向下複製區塊並插入空白行間隔 |
| <kbd>Shift</kbd> + <kbd>Alt</kbd> + <kbd>F</kbd> | SQL 編輯器 | **格式化 SQL**：有選取時格式化選取部分；無選取時格式化游標所在獨立語句 |
| <kbd>Ctrl</kbd> + <kbd>Space</kbd> | SQL 編輯器 | **程式碼智慧自動補全**：手動觸發 IntelliSense（關鍵字、資料庫、資料表、欄位） |
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

### 程式碼檢查與打包建置 (Production Build)

```bash
# 執行 TypeScript 靜態型別檢查
npm run typecheck

# 執行前端生產環境打包
npm run build

# 建置發布版桌面應用程式 (.exe 安裝包 / 二進位檔)
npm run build:tauri
```

打包完成後的 Windows 執行檔將位於 `src-tauri/target/release/` 目錄中。

---

## 📄 授權條款 (License)

本專案採用私有或開放授權規範，詳見儲存庫授權聲明。
Copyright © 2026 SQLight Team. All rights reserved.
