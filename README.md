# SQLight

**極致輕量的 Microsoft SQL Server (T-SQL) 跨平台桌面客戶端**

Tauri v2 + Rust + Vue 3 + TypeScript + PrimeVue 4 + Monaco Editor + Tabulator

---

SQLight 是為日常 T-SQL 查詢與簡單資料庫操作設計的桌面客戶端。相較 SSMS、DataGrip、DBeaver 等完整工具，它主打**啟動快、體積小**，把日常最常用的功能做順：原生 Rust 後端、Monaco 編輯器、物件總管、可瀏覽大量資料的結果網格（後端逐列串流，預設每組結果上限 10,000 筆，可調高或取消），以及執行計畫與統計分析。

## 核心特色

- ⚡ **原生輕量後端**：Tauri v2 搭配純 Rust 的 TDS 驅動 (Tiberius)，安裝檔與記憶體佔用遠低於 Electron 方案。
- 💻 **Monaco SQL 編輯器**：語法高亮、IntelliSense 物件補全、Snippet 範本、SQL 格式化與獨立語句執行。
- 🗂️ **物件總管**：資料表 / 檢視表 / 預存程序 / 函數樹狀瀏覽，支援正則過濾與 `Ctrl + P` 模糊檢索。
- 📊 **Tabulator 結果表格**：虛擬捲動瀏覽大量資料，框選即時統計，複製全表或選取範圍為 TSV / CSV / JSON / Markdown。
- 🧱 **多結果集檢視**：一次回傳多個結果集時可切換 SSMS 垂直堆疊或分頁檢視，拖曳等分、單格最大化，還可一鍵隱藏工具列只留資料。
- ✏️ **結果內嵌編輯**：單一資料表且具主鍵的查詢結果可直接改值，退回 / 提交前先檢視實際 T-SQL 與異動範圍。
- 🛑 **查詢取消**：後端以獨立連線發送 `KILL <spid>`，實體中斷長時間執行的查詢。
- 🧭 **執行計畫與統計**：預估 / 實際執行計畫圖形化檢視（可匯出 `.sqlplan`），並解析 `STATISTICS IO, TIME`。
- 🕸️ **ER 關聯圖**：以 AntV X6 依外鍵遞迴展開關聯圖，可匯出 PNG / JSON。
- 🤖 **AI SQL 助理**：自訂 cURL 範本引擎，可介接任何支援 HTTP POST 的 LLM 服務。
- 📥 **TSV 匯入精靈**：逐列驗證、單一交易分批寫入，任一列失敗即整批回滾。
- 🔐 **安全防護**：系統 Keyring 儲存密碼、危險語句雙重確認、連線環境色彩標識。

## 技術棧

| 層 | 技術 |
| :--- | :--- |
| 桌面宿主 | Tauri v2（Windows 使用原生 WebView2） |
| 後端核心 | Rust 2021、Tokio、Tiberius（純 Rust TDS 協定）、Keyring |
| 前端 | Vue 3 Composition API、TypeScript 5、Vite 6、Tailwind CSS |
| 狀態與 UI | Pinia 3、PrimeVue 4、Lucide Vue Next |
| 編輯器與圖表 | Monaco Editor、Tabulator 6、AntV X6、html-query-plan |

架構為前後端雙層解耦：Vue 前端經 Tauri IPC 呼叫 Rust 後端，後端以 Tiberius 連線 SQL Server（2012 ~ 2022 / Azure SQL）。

## 功能總覽

**SQL 編輯與執行**

- 選取優先執行；未選取時只執行游標所在的獨立語句，並以暫態高亮標示本次執行範圍。
- 客戶端依 `GO` 自動拆分批次（TDS 驅動不支援 `GO`），並提供常用查詢下拉選單與 SQL 範本庫。
- 內建 `SET STATISTICS IO, TIME ON` 效能分析、預估執行計畫、實際執行計畫三種互斥模式。

**物件總管與瀏覽**

- 連線 / 資料庫 / 資料表 / 檢視表 / 預存程序 / 函數樹狀瀏覽，支援搜尋過濾與正則規則隱藏。
- 右鍵可檢視定義、產生 `CREATE TABLE` DDL、開啟資料表資料或結構、產生 DML 語法。
- 從編輯器游標或反白文字快速在 Explorer 定位資料表（連鎖展開並高亮置中）。

**結果檢視與分析**

- 多結果歷史分頁、訊息面板、查詢歷史，結果分頁可釘選保留，超過保留上限時自動淘汰最舊的未釘選分頁。
- 單次查詢回傳多個結果集時，可切換 SSMS 垂直堆疊或分頁檢視；分割線可拖曳、可雙擊等分，也可最大化單一網格。
- 多結果集檢視列的「隱藏工具列」會同時收起該分頁下所有網格的上方工具列與下方資訊列，只留資料區；狀態依結果分頁記憶，關閉分頁即清除。
- 儲存格 / 整欄 / 整列框選與即時統計（Sum / Avg / Min / Max / Count / Distinct）。
- 複製全表或選取範圍為 TSV、CSV、JSON、Markdown；雙擊唯讀儲存格可複製該格值。
- 每個結果集各自記住欄寬、欄位順序、顯示狀態與排序（工作階段內），切換分頁再回來仍保留。
- 內嵌編輯：單一資料表且具主鍵的結果可直接修改，退回 / 提交前顯示實際 T-SQL 與異動列數、格數；不支援編輯時顯示原因（多表 JOIN、缺主鍵、非查詢結果等）。
- 結果超過每組上限時逐列串流讀取並在工具列標示截斷筆數；上限可由上方工具列即時調整或取消，新分頁的預設值在「查詢與結果」設定。
- 表格資料與結構瀏覽器、ER 關聯圖、執行計畫 XML 視覺化。

**個人化與安全**

- 深色 / 亮色模式、PrimeVue 佈景預設、12 色主色調與 5 色表面色調即時切換。
- 全域介面字型（按鈕、選單、對話框與 DataGrid 外框）、編輯器字型 / 大小 / 縮排 / 自動換行，以及只套用表格內容的結果表格字型。
- 記憶上次連線與資料庫、開啟即自動復原；連線可設定別名與環境代表色。
- 結果分頁啟用色彩、物件名稱過濾規則、AI 助理 API Key 與 cURL 請求範本（含測試連線）皆可自訂。

## 鍵盤快捷鍵

| 快捷鍵 | 功能 |
| :--- | :--- |
| `Ctrl` + `Enter` | 執行當前語句（有選取時執行選取範圍） |
| `Ctrl` + `Shift` + `Enter` | 執行全部語句 |
| `Alt` + `Break` / `Pause` | 中斷並取消查詢 |
| `Escape` | 取消查詢 / 關閉浮窗 / 清除表格選取 |
| `Ctrl` + `P` | 快速物件檢索 (Spotlight) |
| `Ctrl` + `Alt` + `A` | 喚起 AI SQL 助理 |
| `Ctrl` + `Space` | 手動觸發程式碼自動補全 |
| `Shift` + `Alt` + `F` | 格式化 SQL（有選取時僅格式化選取範圍） |
| `Ctrl` + `D` | 向下複製整行或選取區塊 |
| `Ctrl` + `S` / `Ctrl` + `O` / `Ctrl` + `N` | 儲存 / 開啟 / 新增 SQL 分頁 |
| `Ctrl` + `C` | 複製結果表格選取範圍為 TSV |

編輯器內輸入 `sel`、`ins`、`upd`、`del`、`join`、`cte` 等前綴後按 `Tab`，可展開對應 SQL 範本。

## 快速開始

環境需求：

- Node.js 18+
- Rust 1.75+（透過 [rustup.rs](https://rustup.rs/) 安裝）
- Windows 需安裝 Microsoft C++ Build Tools 或 Visual Studio（C++ 桌面開發工作負載）
- WebView2（Windows 10/11 通常已內建）

```bash
npm install          # 安裝依賴
npm run dev:tauri    # 啟動桌面端開發模式（推薦）
npm run dev          # 僅啟動 Vite 前端開發伺服器（瀏覽器模式）
```

驗證與建置：

```bash
npm run typecheck          # TypeScript 靜態型別檢查
npm test                   # 單元與回歸測試（Node 原生 test runner）
npm run build              # 前端生產環境打包
npm run build:tauri        # 建置桌面安裝檔
npm run build:portable:ps1 # 免安裝可攜版（亦可執行 build-portable.bat）
```

建置輸出位於 `src-tauri/target/release/`。

## 專案結構

```text
src/             Vue 3 前端（components / composables / services / stores / utils）
src-tauri/src/   Rust 後端（commands / drivers / models / services）
tests/           單元與回歸測試
scripts/         建置、依賴修補與測試腳本
docs/            架構規劃與維護進度
```

## 授權

Copyright © 2026 SQLight Team. All rights reserved.
