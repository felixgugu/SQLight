# SQLight 未來功能擴充與優化建議藍圖 (Feature Recommendations Blueprint)

> 本文件彙整針對 **SQLight** 桌面管理客戶端的後續功能擴充與優化建議，從「高頻實用性」、「資料安全性」與「專業 DBA 深度」三個維度進行評估與排序，作為後續版本演進之規劃指南。

---

## 📖 目錄 (Table of Contents)

1. [執行摘要 (Executive Summary)](#1-執行摘要-executive-summary)
2. [🥇 第一梯隊：立竿見影、最高頻實用功能 (Top Priority)](#2--第一梯隊立竿見影最高頻實用功能-top-priority)
   - [2.1 🔴 生產環境防呆警示與連線標籤 (Environment Badge & Production Safe Guard)](#21--生產環境防呆警示與連線標籤-environment-badge--production-safe-guard)
   - [2.2 ⚡ 快速物件檢索器 (Quick Object Finder / Spotlight `Ctrl + P`)](#22--快速物件檢索器-quick-object-finder--spotlight-ctrl--p)
   - [2.3 💾 實體檔案串流匯出精靈 (Export to Excel / CSV / JSON / SQL Script)](#23--實體檔案串流匯出精靈-export-to-excel--csv--json--sql-script)
   - [2.4 🛑 長時間查詢中斷與取消機制 (Cancel Query / Task Killer)](#24--長時間查詢中斷與取消機制-cancel-query--task-killer)
3. [🥈 第二梯隊：專業 DBA 與性能調校神兵利器 (Pro DBA & Performance Tuning)](#3--第二梯隊專業-dba-與性能調校神兵利器-pro-dba--performance-tuning)
   - [3.1 📊 執行統計與 IO 分析器 (Execution Stats & IO Analyzer)](#31--執行統計與-io-分析器-execution-stats--io-analyzer)
   - [3.2 🧱 資料表結構進階檢視（索引、外鍵、檢查約束）](#32--資料表結構進階檢視索引外鍵檢查約束)
   - [3.3 🔍 雙結果集資料比對工具 (Result Diff & Data Compare)](#33--雙結果集資料比對工具-result-diff--data-compare)
4. [🥉 第三梯隊：極致細節與團隊生產力 (Productivity & UX Polish)](#4--第三梯隊極致細節與團隊生產力-productivity--ux-polish)
   - [4.1 📝 自訂 SQL 代碼範本庫 (User Custom Snippets & Favorites)](#41--自訂-sql-代碼範本庫-user-custom-snippets--favorites)
   - [4.2 🔗 外鍵關聯快速跳轉 (FK Quick Jump & Reference Navigation)](#42--外鍵關聯快速跳轉-fk-quick-jump--reference-navigation)
   - [4.3 🔐 加密連線設定檔匯出/匯入 (Portable Encrypted Profiles)](#43--加密連線設定檔匯出匯入-portable-encrypted-profiles)
   - [4.4 ✏️ 儲存格行內直接編輯與安全變更 (Inline Editing with Safe Patch)](#44--儲存格行內直接編輯與安全變更-inline-editing-with-safe-patch)
5. [建議實作路線圖 (Implementation Roadmap)](#5-建議實作路線圖-implementation-roadmap)

---

## 1. 執行摘要 (Executive Summary)

**SQLight** 目前已奠定了極為優秀的技術基礎：
- **極速輕巧**：Tauri v2 + Rust 原生核心，免除肥重 JVM/Electron 開銷。
- **編輯極致**：Monaco Editor 整合 T-SQL Monarch 語法分析、DBA 診斷工具箱、自訂醒目分頁配色。
- **百萬渲染**：AG Grid Community 搭配虛擬滾動、框選統計列、多格式快速匯出。
- **結構洞察**：專屬資料表結構檢視器（12 大中繼屬性、主鍵/自動識別標記）。
- **嚴謹安全**：複合主鍵完整性驗證、自動交易保護 (`BEGIN TRAN ... ROLLBACK`)、`@@ROWCOUNT <> 1` 誤殺防護。

為進一步將 SQLight 打造成市場上最受信賴且稱手的 SQL Server 桌面客戶端，本藍圖規劃了 11 項極具實用價值的進階功能。

---

## 2. 🥇 第一梯隊：立竿見影、最高頻實用功能 (Top Priority)

### 2.1 🔴 生產環境防呆警示與連線標籤 (Environment Badge & Production Safe Guard)

#### 痛點描述
工程師或 DBA 最具毀滅性的操作事故，往往源自於「以為自己在測試環境，卻在正式環境誤執行了 UPDATE、DELETE 或 DROP」。

#### 設計方案
1. **連線設定擴充環境屬性**：
   - 🔴 **Production (生產環境)**
   - 🟡 **Staging / UAT (測試環境)**
   - 🟢 **Development / Local (開發環境)**
2. **高視覺化環境警示**：
   - 連線成功後，頂部標題列、連線下拉框與查詢分頁邊框自動套用高辨識度的環境色調。
   - 生產環境呈現高警示鮮紅色邊框與 `[PROD]` 醒目徽章。
3. **高風險語句二次確認攔截 (Dangerous Query Interceptor)**：
   - 當處於生產環境時，若執行包含 `UPDATE`、`DELETE`、`DROP`、`TRUNCATE`、`ALTER` 等變更語句：
     - 自動彈出鮮紅色全域確認對話框。
     - 顯示目標主機位址、目標資料庫名稱、受影響 SQL 預覽。
     - 若 `UPDATE` / `DELETE` 缺少 `WHERE` 條件，強制提示「警告：未包含 WHERE 條件，將影響全表！」。
     - 需在輸入框中鍵入指定確認字元（如 `EXECUTE`）或點擊確認才允許送出執行。

#### 技術評估
- **前端工作量**：連線設定增設欄位、Monaco 執行前過濾器增加正規表示式檢查與 ConfirmModal。
- **性價比**：⭐⭐⭐⭐⭐（極高，徹底杜絕人為誤操作）。

---

### 2.2 ⚡ 快速物件檢索器 (Quick Object Finder / Spotlight `Ctrl + P`)

#### 痛點描述
在大型資料庫中，資料表、檢視表與預存程序往往多達數百甚至數千個。使用者在側邊欄一層層點開資料夾、滑動滾輪尋找目標非常耗時。

#### 設計方案
1. **快捷鍵呼出**：按下 <kbd>Ctrl</kbd> + <kbd>P</kbd>（或 <kbd>Ctrl</kbd> + <kbd>O</kbd>）立即於視窗正上方中央彈出懸浮搜尋面板。
2. **模糊搜尋 (Fuzzy Search)**：
   - 支援拼音/縮寫模糊匹配（例如輸入 `uslog` 可即時命中 `dbo.UserLoginLogs`）。
   - 依類型分組並標示圖示：資料表 (`Table`)、檢視表 (`View`)、預存程序 (`Procedure`)、函數 (`Function`)。
3. **鍵盤直覺操作**：
   - <kbd>↑</kbd> / <kbd>↓</kbd> 鍵切換選取項目。
   - <kbd>Enter</kbd> 預設開啟該表資料 (`TableDataViewer`)。
   - <kbd>Shift</kbd> + <kbd>Enter</kbd> 開啟該表結構 (`TableStructureViewer`)。
   - <kbd>Ctrl</kbd> + <kbd>Enter</kbd> 於新 SQL 分頁產生 `SELECT TOP 100 * FROM [schema].[name];` 並自動聚焦。

#### 技術評估
- **前端工作量**：直接複用 `schemaStore` 中已快取的物件清單，配合微型模糊匹配演算法，效能極高（毫秒級反應）。
- **性價比**：⭐⭐⭐⭐⭐（使用者每天使用數十次的高頻神器）。

---

### 2.3 💾 實體檔案串流匯出精靈 (Export to Excel / CSV / JSON / SQL Script)

#### 痛點描述
目前系統支援將表格選取區域複製為 TSV、JSON、Markdown。然而當查詢筆數達到數萬至數十萬筆時，剪貼簿無法承受龐大資料量，且常常需要實體檔案提供給業務或匯入其他系統。

#### 設計方案
1. **工具列新增「匯出檔案 (Export to File)」下拉按鈕**：
   - 📊 **Excel 工作表 (.xlsx)**：支援自動套用欄位標題樣式與適當數值格式。
   - 📄 **CSV / TSV 檔案 (.csv)**：支援自訂分隔符，並自動加入 **UTF-8 with BOM**（解決 Windows Excel 開啟中文亂碼問題）。
   - 📦 **JSON 檔案 (.json)**：格式化輸出為物件陣列檔案。
   - 📝 **SQL 插入腳本 (.sql)**：自動產出整批具備交易保護的 `INSERT INTO ... VALUES (...)` 腳本檔案。
2. **串流式保存 (Stream Saving)**：
   - 透過 Tauri Dialog 呼叫系統存檔對話框選擇路徑。
   - 支援大資料集分塊（Chunking）寫入本機硬碟，避免前端記憶體耗盡。

#### 技術評估
- **前端/後端工作量**：前端整合 `xlsx` 函式庫或由 Rust 後端直接接收資料流寫檔。
- **性價比**：⭐⭐⭐⭐（實務工作必備）。

---

### 2.4 🛑 長時間查詢中斷與取消機制 (Cancel Query / Task Killer)

#### 痛點描述
當下錯查詢條件（例如缺乏 JOIN 關聯導致笛卡兒積、或者在數千萬列的大表執行了全表掃描），查詢長時間佔用連線且鎖定資料庫資源時，使用者只能無奈乾等或強行關閉程式。

#### 設計方案
1. **動態取消按鈕**：
   - 當發起查詢且 `isExecuting === true` 時，頂部的執行按鈕自動切換為紅色閃爍的「**取消執行 (Cancel Query)**」按鈕。
2. **後端連線中斷處理**：
   - Rust 端在執行查詢時記錄該查詢對應的伺服器工作階段 ID (`SPID`)。
   - 點擊取消時，立即在背景獨立通道發送 `KILL <spid>`，或中斷當前 Tiberius TCP 資料流，秒級終止伺服器端耗能作業並釋放 Shared/Exclusive Locks。

#### 技術評估
- **後端工作量**：Rust `src-tauri` 增加 `cancel_query` 命令與連線任務代碼對應。
- **性價比**：⭐⭐⭐⭐（保障資料庫伺服器健康的關鍵機制）。

---

## 3. 🥈 第二梯隊：專業 DBA 與性能調校神兵利器 (Pro DBA & Performance Tuning)

### 3.1 📊 執行統計與 IO 分析器 (Execution Stats & IO Analyzer)

#### 痛點描述
在進行 SQL 效能優化時，僅看執行秒數往往受快取影響而失真。專業 DBA 最重視的指標是 **邏輯讀取量 (Logical Reads)** 與 **CPU 耗時**。

#### 設計方案
1. **底層統計探針**：
   - 執行時自動啟用 `SET STATISTICS IO, TIME ON;`。
2. **統計資訊視覺化面板**：
   - 下方結果面板新增「**效能統計 (Execution Stats)**」分頁。
   - 結構化解析 SQL Server 傳回的訊息字串，將各資料表的讀取量整理為視覺化表格：
     - **Logical Reads**（邏輯讀取，越低越好，代表索引覆蓋佳）
     - **Physical Reads**（磁碟物理讀取）
     - **Read-Ahead Reads**（預先讀取量）
     - **CPU Time vs. Elapsed Time**（CPU 時間與實際流逝時間）
   - 以彩色進度條標記出「消耗最大資源的資料表」，一眼揪出效能瓶頸。

#### 技術評估
- **前端工作量**：純文字 Regex 剖析器 + 簡易進度條表格，開發成本極低但專業價值極大。
- **性價比**：⭐⭐⭐⭐⭐。

---

### 3.2 🧱 資料表結構進階檢視（索引、外鍵、檢查約束）

#### 痛點描述
目前的 `TableStructureViewer` 聚焦於欄位清單。但在資料庫設計與故障排查時，索引狀態與外鍵關聯同樣至關重要。

#### 設計方案
在資料表結構檢視器中擴充次級標籤列（Sub-Tabs）：
1. 📋 **欄位清單 (Columns)**：現有之 12 大屬性完整清單。
2. 🗂️ **索引清單 (Indexes)**：
   - 索引名稱、類型（聚集 Clustered / 非聚集 Non-Clustered）、是否唯一 (Unique)、主鍵索引標記。
   - 鍵值欄位 (Key Columns) 與包含欄位 (Included Columns)。
   - 右鍵選單支援：「重新組織索引 (Reorganize)」、「重建索引 (Rebuild)」。
3. 🔗 **外鍵關聯 (Foreign Keys)**：
   - 外鍵名稱、本表欄位、參照目標資料表與目標主鍵欄位。
   - 連動規則：`ON DELETE CASCADE/NO ACTION`、`ON UPDATE CASCADE/NO ACTION`。
4. 🛡️ **約束條件 (Check Constraints & Defaults)**：
   - 檢查約束運算式（例如 `[Age] >= 0`）。

#### 技術評估
- **後端/查詢工作量**：利用 `sys.indexes`、`sys.index_columns` 與 `sys.foreign_keys` 撰寫一次性查詢即可取得完整結構。
- **性價比**：⭐⭐⭐⭐。

---

### 3.3 🔍 雙結果集資料比對工具 (Result Diff & Data Compare)

#### 痛點描述
在重構複雜預存程序或改寫 SQL 時，開發者需要確保「改寫前與改寫後的查詢結果完全一模一樣」。

#### 設計方案
1. **分頁右鍵選單新增「比對結果 (Compare with Tab...)」**：
   - 選擇要進行比對的兩個 Results 分頁。
2. **雙欄視覺化比對視圖 (Side-by-Side Diff Grid)**：
   - 自動比對總列數、欄位型別與順序。
   - 依據主鍵或第一欄作為基準鍵進行逐列對齊。
   - 數值變動的儲存格以柔和的黃色/紅色高亮顯示，並標明舊值與新值。

#### 技術評估
- **前端工作量**：前端在記憶體中比對兩組 row 陣列並渲染差分標記。
- **性價比**：⭐⭐⭐。

---

## 4. 🥉 第三梯隊：極致細節與團隊生產力 (Productivity & UX Polish)

### 4.1 📝 自訂 SQL 代碼範本庫 (User Custom Snippets & Favorites)
- **概念**：除了內建的 `sel`、`ins`、`upd`，允許使用者在「設定」中新增自己常用的專案代碼片段（例如常用的權限檢查、標準審核欄位、多表關聯樣板），於編輯器中輸入前綴即可展開。
- **最愛查詢 (Saved Queries)**：支援將常用維護語句收藏至側邊欄「我的收藏」，點擊直接載入。

### 4.2 🔗 外鍵關聯快速跳轉 (FK Quick Jump & Reference Navigation)
- **概念**：在結果表格或資料瀏覽器中，當游標停留在外鍵欄位時顯示小箭頭圖示；點擊後直接於新分頁開啟所關聯的父表，並自動過濾出對應的關聯列。

### 4.3 🔐 加密連線設定檔匯出/匯入 (Portable Encrypted Profiles)
- **概念**：更換工作電腦或設定新環境時，可將已儲存的伺服器連線設定匯出為 `.json` 檔案。支援主密碼（Master Password）以 AES-256 加密保存的敏感認證資訊，並可安全一鍵匯入。

### 4.4 ✏️ 儲存格行內直接編輯與安全變更 (Inline Editing with Safe Patch)
- **概念**：雙擊結果表格中的特定儲存格進行直接修改。修改後的儲存格以藍色標示為 Pending，點擊「套用變更 (Apply)」時，自動利用現有的「複合主鍵安全 DML 引擎」產出具備交易保護的單筆 `UPDATE` 語句，提示確認後執行並即時重新整理。

---

## 5. 建議實作路線圖 (Implementation Roadmap)

| 階段 | 目標版本 | 規劃核心項目 | 預期效益 |
| :---: | :---: | :--- | :--- |
| **Phase 1** | **v0.2.0** | 1. 🔴 **生產環境防呆警示 (Production Safe Guard)**<br>2. ⚡ **快速物件檢索器 (Ctrl+P Spotlight)** | 大幅消除生產誤操作風險，將物件尋找時間縮短 80%。 |
| **Phase 2** | **v0.3.0** | 1. 💾 **實體檔案串流匯出 (Excel / CSV / SQL)**<br>2. 🛑 **長時間查詢取消機制 (Cancel Query)** | 補齊大數據匯出短板，避免卡死連線提升穩定性。 |
| **Phase 3** | **v0.4.0** | 1. 📊 **執行統計與 IO 分析器 (STATISTICS IO)**<br>2. 🧱 **結構檢視器索引與外鍵分頁 (Indexes & FKs)** | 躋身專業 DBA 效能診斷工具之列。 |
| **Phase 4** | **v0.5.0** | 1. 🔍 **雙結果集比對工具 (Result Diff)**<br>2. 📝 **自訂代碼範本庫 (Custom Snippets)** | 針對複雜查詢調校與團隊協作打造極致手感。 |

---

*文件生成時間：2026-09-12*  
*適用版本：SQLight v0.1.0+*
