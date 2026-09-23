# SQLight 專案架構地圖 (AGENTS.md)

## 1. 專案簡介與技術棧
- **用途**：極致輕量、現代高效的 Microsoft SQL Server (T-SQL) 跨平台桌面客戶端。
- **核心架構**：Tauri v2 雙層解耦架構（Rust 原生後端核心 + WebView2 前端 UI）。
- **前端技術棧**：Vue 3 (Composition API / `<script setup>`)、TypeScript 5、Vite 6、Tailwind CSS。
- **前端核心庫**：Pinia 3 (狀態管理)、Monaco Editor (SQL 編輯補全)、Tabulator 6 (百萬列資料表格)、AntV X6 (ER 關聯圖視覺化)。
- **後端技術棧**：Rust 2021、Tokio (非同步執行期)、Tiberius (純 Rust TDS 協定驅動)、Keyring (系統級憑證安全儲存)。

## 2. 目錄結構與職責
```text
SQLight/
├── src/                          # 前端應用核心（Vue 3 + TypeScript）
│   ├── assets/                   # 靜態資源與全域樣式定義
│   ├── components/               # Vue UI 組件庫
│   │   ├── common/               # 基礎共用元件（通用彈窗、可拖曳分割條、SQL 預覽）
│   │   ├── editor/               # 編輯器與圖形檢視器（Monaco、ER 圖、執行計畫、結構與資料檢視）
│   │   ├── layout/               # 視窗版面框架（標頭列、側邊導覽欄、主工作區、底部面板、狀態列）
│   │   ├── modals/               # 互動對話框（連線管理、物件快搜、系統設定、SQL 範本庫）
│   │   └── results/              # 查詢輸出介面（Tabulator 網格、執行訊息、歷史記錄、IO 統計分析）
│   ├── composables/              # 跨組件可複用邏輯（網格選取、資料匯出、分割拖曳、欄寬自適應）
│   ├── data/                     # 內建靜態預設資料（預設 SQL 程式碼範本）
│   ├── services/                 # 前端業務服務層，封裝 Tauri IPC 通訊與瀏覽器 Mock 降級
│   ├── stores/                   # Pinia 集中狀態管理（連線池、查詢分頁、工作區、結構快取、設定）
│   ├── styles/                   # 樣式定義檔（Tabulator 深色／淺色主題覆寫）
│   ├── types/                    # 全域 TypeScript 型別定義契約（Connection, Query, Schema 等）
│   └── utils/                    # 純函數工具函式庫（SQL 解析、DDL 產生、統計解析、模糊搜尋）
├── src-tauri/                    # 後端桌面宿主核心（Rust）
│   ├── icons/                    # 應用程式各尺寸圖示資源
│   └── src/                      # Rust 核心原始碼
│       ├── commands/             # Tauri IPC 命令進入點，負責參數驗證與分發
│       ├── drivers/              # 資料庫驅動抽象層與 MSSQL/Tiberius 具體實作
│       ├── models/               # 後端共用資料結構體與 Serde 序列化模型
│       ├── services/             # 後端領域服務（連線集區生命週期、Keyring 密鑰、範本檔案 I/O）
│       ├── error.rs              # 系統集中錯誤類型定義（AppError）
│       └── lib.rs                # Tauri 應用程式初始化、狀態註冊與命令掛載
├── scripts/                      # 建置、依賴修補與自動化測試腳本
├── tests/                        # 前端單元測試與邏輯回歸測試套件（Node 原生 test runner）
└── docs/                         # 架構規劃、功能建議與維護進度文件
```

## 3. 核心資料流向
1. **連線與憑證流**：`ConnectionModal` 提交設定 &rarr; `connectionService` 經 Tauri IPC 發送 &rarr; 後端 `ConnectionManager` 透過 `Keyring` 安全存取密碼，並藉由 `Tiberius` 建立與驗證 TDS 連線集區。
2. **查詢與中斷流**：`MonacoEditor` 觸發 SQL 執行 &rarr; `queryStore` 配置 Request ID / SPID 並呼叫 `queryService` &rarr; 後端 `mssql/connection.rs` 串流執行；若發起取消，後端另開獨立連線發送 `KILL <spid>` 實體中斷。
3. **結果渲染與分析流**：後端回傳 `QueryResult` &rarr; `queryStore` 儲存歷程並派發至 `AppBottomPanel` &rarr; `ResultGrid` 進行虛擬化滾動渲染，訊息與統計分別送入 `ResultMessages` 與 `ExecutionStatsViewer` 解析。
4. **結構快取與智慧補全流**：側邊欄載入觸發 `schemaService` 擷取綱要樹 &rarr; 寫入 `schemaStore` 快取 &rarr; 供 `sqlCompletionProvider` 注入 Monaco Editor 提供補全提示，或由 `ErDiagramViewer` 渲染 X6 關聯圖。

## 4. 開發與修改規範
- **模組職責與行數控制**：單一程式碼檔案行數建議控制在 400 行以內；若邏輯膨脹應拆分為 Composables、子組件或 Utils 工具函數。
- **IPC 隔離與 Web 相容**：UI 組件嚴禁直接呼叫 `@tauri-apps/api` 的 `invoke`，一律經由 `services/` 封裝；所有 IPC 呼叫需在 `api.ts` 提供 Mock 降級以支援瀏覽器開發。
- **統一錯誤處理規範**：後端統一採用 `AppError`（基於 `thiserror`）列舉型別回傳；前端一律透過 `normalizeBackendError` 統一轉譯，嚴禁未捕獲的 Promise 拋錯或靜默吞沒異常。
- **狀態單一真實來源 (SSOT)**：視窗層與跨組件狀態必須由 Pinia Stores（`stores/`）統一管理，禁止跨組件任意深層 Prop Drilling 或直接修改外部非自身負責之狀態。
- **無副作用與模組邊界**：`utils/` 必須維持無副作用的純函數，不依賴 Vue 響應式狀態或後端 IPC；後端 `drivers/` 專注 TDS 通訊協定，禁止依賴 Tauri IPC 命令邏輯。
