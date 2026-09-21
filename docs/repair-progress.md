# SQLight 修正進度

目標：依專案分析逐步修正執行正確性、DML 產生、查詢資源管理、資料保真及維護性。整體目標尚未完成。

## 已實作（2026-09-12）

- 每次 query IPC 必須指定 database；後端在同一個 session lock 內切換並執行，切換失敗即停止。
- 全域連線表改為短時間取用；不同連線使用各自的執行鎖。
- 切換成功後才更新前端顯示及持久化；過期連線回應不覆蓋最近選擇。
- SQL 分頁及表格瀏覽使用分頁綁定的連線／資料庫。刪除連線後的分頁不再靜默改綁其他伺服器。
- metadata 請求重新選擇指定資料庫，不依賴可能被使用者 USE 指令改變的快取狀態。
- encrypt 設定套用 Tiberius Required／Off。
- 結果逐列讀取，超出每個結果集上限後不保留或轉換資料；仍讀完伺服器串流。空結果集保留 metadata，串流中途錯誤保留已取得結果。
- bigint 超過 JS 安全整數範圍時輸出字串；datetime2/time 保留七位小數，datetimeoffset 使用驅動的時區轉換。
- DML 要求完整 PK metadata 才只使用 PK；否則用全投影欄位。UPDATE/DELETE 包含獨立交易及單筆影響數驗證，零筆／多筆時回滾。空列、缺欄、重名欄、無原始值的 binary 和不精確 JS 整數會拒絕產生。
- DML 省略 Identity 寫入；保留目標 database／connection。右鍵操作改以 event.data 找原始列，避免排序／篩選後誤用顯示索引。
- 語句擷取先遮蔽字串、識別字、巢狀註解，再判斷 GO。控制流程、變數與交易保留整個 batch；不因一般空白行移除 WHERE。空擷取結果不再退回執行整頁。
- 新增 npm test 及 Rust 核心測試。核心單元測試不引用 Tauri UI 啟動程式，避免 GNU 測試執行檔缺 Common Controls v6 manifest 的 TaskDialogIndirect 入口點問題。

## 已實作（2026-09-21）：寬表格水平捲軸拖曳效能

症狀：查詢結果欄位過多（實測 140 欄、約 1000 列）時，於 Tauri 桌面版拖曳水平捲軸非常慢。

量測（暫存區獨立 benchmark，使用 repo 內同一顆 ag-grid-community 36.1.0，重現同一組 grid options、pinned `#` 欄、每欄 valueGetter/valueFormatter/5 條 cellClassRules、Vue reactive 列資料、140 欄 × 1000 列）：

- 純 AG Grid 預設：frame 平均 16.7ms、p90 17.8ms、max 18.9ms（336 cells 在 DOM）。
- SQLight 完整設定：平均 16.7ms、p90 17.7ms、max 18.9ms。
- 加上捲動時選取高亮 DOM 掃描、Vue reactive 列資料、長文字欄位：皆維持 60fps。
- 快速拖曳（每 frame 跳約 17 欄）：平均 16.9ms、max 20.2ms。
- 對照組強制關閉欄虛擬化：3384 cells 在 DOM，仍為 16.7ms。

結論：目前 grid 設定與此資料規模本身不是瓶頸，欄虛擬化正常運作；因此改為「先量測、再依判準修正」，並移除已知的每幀額外成本。

已實作：

1. 新增 dev-only 診斷 `src/composables/useGridPerfDiag.ts`：即時 FPS/p95/max、DOM cell 數、DOM/可見/總欄數、viewport 寬度與 dpr，並內建「Run scroll benchmark」以 120 幀掃過整個水平範圍。啟用方式：`localStorage.setItem('sqlight.perfHud', '1')` 後重載，正式版不註冊任何程式碼。
2. `useGridSelection`：可見欄順序改為快取（欄位搬移／釘選／換結果集時失效）；無選取時捲動不再走訪 cell DOM；捲動高亮只處理可見列範圍；window `mousemove`/`mouseup` 改為僅在框選拖曳期間掛載。
3. `ResultGridItem`：交給 AG Grid 的 `rowData` 改為 `toRaw(...)`（避免 10 萬筆以上的深層 reactive proxy 與 ag-grid-vue3 的 deep watch）；`columnDefs` 以欄位簽章記憶化，避免 AG Grid 重套整個欄位模型；`#` 釘選欄改為不透明底色；選取高亮移除 inset box-shadow；水平捲動期間加 `.is-h-scrolling` 關閉裝飾性 transition。
4. `ResultGridItem`：`first-data-rendered` 後檢查欄虛擬化是否被抑制（AG Grid 在 `viewportRight === 0` 時會渲染全部欄位），必要時微調 viewport 觸發重算。

待確認（需實機量測）：

- 若 HUD 顯示 `virtualisation ok`、benchmark 亦順暢，但手動拖曳捲軸仍卡，代表瓶頸落在 WebView2 的原生捲軸拖曳繪製路徑，才進一步評估 `additionalBrowserArgs`（`--enable-gpu-rasterization` 等）並以同一 benchmark 前後比較。
- `TableDataViewer`（資料表瀏覽網格）尚未套用 raw rowData 與 `#` 欄不透明底色，如需一致化可後續處理。

## 待完成與待審核

1. **DML 來源可靠性**：目前仍由 SQL 文字猜測來源；JOIN、別名／運算式、跨庫、跨 server、多結果集的來源應以可驗證 metadata 解析，不能僅依第一個表名。表格與結果面板應共用來源／DML 邏輯。確認 computed、rowversion 等不可寫欄位。
2. **查詢生命週期**：取消、逾時、連線建立逾時；取消後不能重用不完整協定 session，移除／中斷連線要停止或失效化正在執行與排隊的請求。目前移除 registry 不會終止已持有 Arc 的查詢。
3. **GO 批次執行**：編輯器已識別 GO，但後端目前仍直接執行整段 SQL。需在同一連線／session lock 下依序執行 batches，保留 USE、暫存表、交易語意，處理 GO 次數與錯誤行號。
4. **真實影響列數與 PRINT**：affected_rows 仍是回傳列數，需取得 TDS DONE 計數與 INFO 訊息。Tiberius 0.12.3 QueryStream 公開 API 只暴露 Metadata/Row，內部會忽略 DONE/INFO；不得重跑 SQL 或以 SELECT 筆數冒充 DML 影響筆數。
5. **資料與資源限制**：binary 真實內容／匯出、各型別 round-trip；結果歷史及 pin、查詢歷史／localStorage 的容量；大型欄位與多結果集的總量限制。現有逐列上限不限制伺服器執行工作或網路流量。
6. **前端狀態競態**：connect/switchDatabase 過期請求目前 return void，呼叫方仍可能更新當下 activeTab；需檢查使用者在等待期間切換分頁／伺服器的所有路徑。同步失敗要保留可辨識的目標並呈現錯誤。
7. **連線與持久化**：重複 connect 目前會重建 session；儲存密碼錯誤仍被忽略，JSON parse 失敗仍轉成空清單。需修正並驗證不遺失原設定。
8. **Schema/DDL**：來源名稱 escaping、相同表名跨 schema 的消歧；CREATE TABLE 目前仍簡化 Identity seed、PK 類型／順序、預設值與其他約束，需要明確界定腳本是否完整還原。
9. **共用邏輯及文件**：兩個大型表格元件的選取、統計、匯出及 DML 重複邏輯；README 連線池、百萬列效能、PRINT、DDL、防誤刪等宣稱需對齊驗證後的實作。
10. **完整驗證**：重跑前端測試、typecheck/build、Rust tests/check；增加真實 SQL Server 整合測試入口並驗證空集、多集、PRINT、DML、GO、取消／逾時、交易與型別。尚未使用任何使用者 SQL Server 或憑證，mock/unit tests 不能當作實機驗證。

## 驗證紀錄

- （2026-09-21）`npm test`：271 個通過（新增 grid 捲動效能回歸：可見欄快取、無選取時零 DOM 走訪、raw rowData 交付、selection 高亮不繪製陰影、mousemove 僅延遲掛載）。
- （2026-09-21）`npm run typecheck`：通過。
- `npm test`：19 個通過（連線狀態／IPC、DML、語句擷取）。
- `cargo test --offline --manifest-path src-tauri/Cargo.toml --lib`：8 個通過（目標資料庫、不同連線並行、資料型別與逐列保留上限）。
- `npm run typecheck`：通過。
- `npm run build`：通過；仍有 bundle 過大及 workspaceStore 動／靜態 import 混用警告，列入後續整理。
- `cargo check --offline --manifest-path src-tauri/Cargo.toml`、`git diff --check`：通過。
- 已取得 esbuild 開發依賴安裝授權並更新 package-lock。
- MSVC 工具鏈存在但 link.exe 未安裝；不依賴 MSVC 執行上述已通過的 GNU 核心測試。
