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

## 已實作（2026-09-22）：AG Grid 官方 Scrolling Performance 對照

對照 AG Grid 官方 «Scrolling Performance»（v36.2.0）逐項檢查結果網格：

| 文章建議 | SQLight 現況 | 處置 |
| --- | --- | --- |
| Setting Expectations | 已有 dev-only HUD + 捲動 benchmark | 擴充 filter benchmark |
| Check / Defer / Avoid Cell Renderers | 結果網格完全沒有 cellRenderer，只用 valueGetter / valueFormatter | 無需處理 |
| Avoid Auto Height | 主題固定 rowHeight 28、headerHeight 30 | 無需處理 |
| Skip Off-screen Grids | `App.vue` 底部面板為 `v-if`，`AppBottomPanel` 分頁與 `AppMain` 編輯分頁皆為 `v-else-if`，同時只掛載一個網格；堆疊模式各窗格本身仍在可視區內 | 評估後不採用 `enableContentVisibilityAuto` |
| Configure Row Buffer | `columnBuffer: 4` 已調降，`rowBuffer` 維持預設 10 | 維持預設（量測後無垂直重繪症狀） |
| Debounce Vertical Scroll | 未設定 | 不採用（垂直捲動是核心操作，且症狀在水平方向） |
| Disable Row Highlighting | 已開 `suppressRowHoverHighlight` | 無需處理 |

已實作：

1. **移除 `:suppress-column-virtualisation="true"`**（2026-09-22 的 `2d56f02` 所加）。該設定會讓寬結果集把全部欄位鋪進 DOM，與同檔案的 `ensureColumnVirtualisation()` 修補、以及 HUD 的 `columnVirtualisationSuspected` 判準直接矛盾，是本輪最可能造成回歸的一行。
2. **新增 dev-only 合成結果集** `src/utils/perfGridFixture.ts`：固定種子的決定性產生器，型別混合 int / bigint / nvarchar / nvarchar(max) / bit / datetime2 / decimal / uniqueidentifier / varbinary，可為 NULL 的欄位每 17 列插入 NULL。`queryService.executeQuery` 在 `import.meta.env?.DEV` 且 SQL 帶有 `sqlight:perf-fixture` 區塊註解時直接回傳 fixture，不走 IPC，因此 Tauri 桌面版也能重現。已確認正式建置中查無 fixture 的任何痕跡（rollup 已移除整支模組）。
3. **擴充 `useGridPerfDiag`**：新增 `runFilterSettleBenchmark()` 與 HUD 上的「Run filter benchmark」按鈕，量測 quick filter 每次套用的主執行緒阻塞時間（`applyMs`）與下一次繪製的 settle 時間，並在結束後還原原本的 `quickFilterText`。
4. **Quick Filter debounce**：超過門檻的結果集改為 250ms debounce，門檻 10,000 列。輸入框綁 `quickFilterInput`，網格綁 debounce 後的 `quickFilter`；門檻以下維持即時篩選，timer 於 `onBeforeUnmount` 清除。

### 實機量測（2026-09-22，Tauri desktop，150 欄）

水平捲動 benchmark（120 幀）：

| 資料量 | avg | p95 | max | over32 |
| --- | --- | --- | --- | --- |
| 150 欄 × 1,000 列 | 16.67ms | 17.8ms | 24.8ms | 0 |
| 150 欄 × 50,000 列 | 16.68ms | 17.4ms | 23.3ms | 0 |

Quick filter benchmark（`applyMs` = 單次套用阻塞主執行緒的時間）：

| 資料量 | 1 | 12 | 123 | abc | zzzz | p95 |
| --- | --- | --- | --- | --- | --- | --- |
| 150 欄 × 1,000 列 | 1.2ms | 1.7ms | 17.3ms | 20.9ms | 17.7ms | 20.9ms |
| 150 欄 × 50,000 列 | 19.8ms | 57.2ms | 411ms | 497ms | 465ms | 497ms |

判讀：

- **捲動不是瓶頸**：兩個資料量都維持 60fps、`overBudgetFrames` 皆為 0，與 2026-09-21 的基準一致（avg 16.7ms / p95 17.8ms）。移除 `suppressColumnVirtualisation` 沒有讓捲動變差。max 由 18.9ms 變為 22.3～24.8ms 屬單一尖峰，p95 未變；同一設定重跑兩次的 p95 分別為 17.4ms 與 17.6ms，fixture 的重複性成立。
- **欄虛擬化已回復**（驗收關閉）：HUD 快照在兩個資料量下都相同 —— `cells 286 cols dom/visible/total 22/150/151`、`virtualisation ok`。150 個顯示欄只把 22 個放進 DOM（1780px viewport / 13884px 內容寬），且 1,000 列與 50,000 列的 DOM 足跡完全一致，代表 DOM 大小已與資料量脫鉤。對照 2026-09-21 停用欄虛擬化時的 3,384 cells（140 欄、不同 viewport），DOM cell 數降低約 92%。
- **Quick Filter 才是真瓶頸**：1,000 列時單次套用最高 20.9ms（可接受），50,000 列時變成 411～497ms。以兩點線性推估，單次套用達到 100ms 預算約在 10,000 列，正好是應用程式的預設 `maxRows`，因此 debounce 門檻訂在 10,000 列。debounce 不會降低單次成本，但會把「每敲一鍵各付一次」收斂成「停手後付一次」：輸入 `abc` 由 19.8 + 57.2 + 411ms 降為單次 411ms。
- **`cacheQuickFilter` 不採用**：官方語意是每列預先串接所有欄位值（含 value getter）後只做字串搜尋，對 150 欄 × 7.5M 次 valueGetter 的掃描確實對症，但它標記為 `@initial`，只能在建立網格時決定，而同一元件實例會因切換結果分頁／重新整理而換掉資料集，無法隨列數動態開關；加上每列約 1.5–2KB 的聚合字串，50,000 列約 75–90MB、無上限（`maxRows = none`）情境可達 GB 級。決策理由：5 萬列的篩選本來就應該下推成 SQL `WHERE` 由伺服器執行，用戶端 quick filter 只是已載回結果集的便利功能，不該為一個不應存在的用法付出 GB 級記憶體。
- **`rowBuffer` 維持預設 10**：沒有觀察到垂直重繪問題，且調整它是拿首次繪製時間去換一個尚未出現的症狀。

後續待辦：

- 移除 `suppressColumnVirtualisation` 後若出現可重現的渲染缺陷（捲動空白欄、釘選欄錯位、右鍵選單對錯儲存格）：先把 `columnBuffer` 由 4 提高到 8 再測；仍存在才改為條件式啟用（computed 初值 false，僅在重現出的確切條件下為 true，並註記症狀）。
- 尚未人工確認移除該行後的互動正確性：捲動時無空白欄、釘選 `#` 欄對齊、欄位拖曳排序、釘選切換、右鍵選單與 DML 產生、框選高亮、匯出。

## 已實作（2026-09-23）：深色／淺色佈景配色全面檢查

依 WCAG 2.1 對比準則檢查 5 種 surface × 深淺 2 種模式，完整報告見 `docs/theme-color-audit.md`。

量測到的問題（修正前）：深色 muted 文字 3.07–3.78:1、分隔線文字 2.29–2.36:1、淺色 muted 文字 4.34–4.40:1、淺色模式約 325 處沿用深色底用的亮 accent（1.5–4.0:1）、狀態色塊上的文字最低 1.12:1、分頁圖示 1.54–2.54:1、Tabulator 淺色 binary／modified 1.80／1.12:1、Monaco 淺色行號 2.56:1、連線標籤色最低 1.9:1。

已實作：

1. 文字色階整體位移一格（`buildThemeTokens()` 純函式 + `main.css` 靜態初值），muted 文字在深淺模式皆 ≥ 4.5:1，且 5 種 surface 全部通過。
2. 新增 8 個語意角色色（`accent/ok/danger/warn/info/plan/er/structure`）並全面替換 36 個檔案、456 處 accent 文字；淺色值以「白底、面板底、15–25% 同色系底色」三者最差情況選定。
3. 63 處深色專用色塊補上淺色版本（`bg-<hue>-50|100 dark:bg-<hue>-950/…`），錯誤／成功提示在淺色模式恢復可讀。
4. Tabulator（muted／binary／bool／modified／排序箭頭）、Monaco（抽出 `utils/editorThemeTokens.ts`）、分頁圖示（`iconColorLight`）、執行計畫 tooltip、連線標籤色（新增 `utils/connectionColor.ts`）等元件層修正。
5. 一致性：AI／資料檢視 modal 固定色碼改回 surface token、`border-dark-650`（Tailwind 未定義）改為 `border-dark-700`、對話框 ring 改為深淺分流、`index.html` 於首次繪製前套用已儲存的色彩模式並宣告 `color-scheme`。

## 已實作（2026-09-23）：多結果集「隱藏工具列」純資料檢視

一次查詢回傳多個 DataGrid 時，逐格檢視資料的可用高度被每個網格自己的工具列（快速篩選、複製、重新整理、DML）與下方統計列吃掉。於多結果集檢視列的「等分高度」左側新增「隱藏工具列」切換鈕。

- 切換後該結果分頁下所有網格（堆疊、最大化、分頁檢視皆同）同時隱藏上方工具列與下方資訊／統計列，只留標題列與資料區；按鈕再按一次（標籤變為「顯示工具列」）即還原。
- 狀態存放於 `gridLayoutStore`（`isToolbarHidden`／`setToolbarHidden`／`toggleToolbarHidden`），以結果分頁 ID 為 key，切換結果分頁、底部面板分頁或重繪網格都不會遺失，關閉該結果分頁時由 `clearTab` 一併清除。
- 單一結果集沒有此檢視列，維持原本的工具列；`ResultGrid` 端以 `resultSets.length > 1` 守門，避免舊狀態讓單一網格被鎖在無工具列的畫面。
- 雙擊分割線等分、拖曳分割線、欄寬與排序記憶皆不受影響（各網格容器高度不變，省下的高度直接給資料區）。
- 同一波調整：多結果集時每個網格工具列最左側的 `Result #N (N)` 標籤改回一般字重。PrimeVue Aura 的 `.p-tag` 預設 `font-weight: 700`，以 `!font-normal` 覆寫（與 AppMain／AppBottomPanel 的既有寫法一致）。

## 已實作（2026-09-23）：DataGrid 工具列字型回歸「外觀與主題」

症狀：`外觀與主題` 的「全域介面字型」對 DataGrid 沒有作用。原因是三個網格元件的根容器硬寫 `font-mono`（Tailwind 的 Fira Code 堆疊），工具列、快速篩選、列數與空狀態全部繼承它，等於自行跳脫 `--app-font-sans`。

邊界改為：`查詢與結果` 的「結果表格字型」只作用在表格內容（`.tabulator` 由 `--sqlight-grid-font` 決定），其餘屬於 DataGrid 外框的部分一律跟隨全域介面字型。

已實作：

1. `ResultGridItem`／`ResultGrid`／`TableDataViewer`／`TableStructureViewer` 根容器由 `font-mono` 改為 `font-sans`（`var(--app-font-sans)`）。
2. 工具列內會蓋掉容器字型的寫法一併移除：`Result #N (N)` 標籤的 `!font-mono`、三處快速篩選 `InputText` 的 `font-mono`、`N rows` 列數的 `font-mono`、`TableStructureViewer` 三個統計 Tag 的 `!font-mono`、多結果集分頁按鈕的列數 `font-mono`。PrimeVue 的 `.p-button`／`.p-inputtext` 都是 `font-family: inherit`，因此會直接吃到新設定。
3. 表格內容不受影響：`--sqlight-grid-font` 仍只綁在 `.sqlight-grid` 外框（`tests/grid_font_settings.test.ts` 既有斷言不變）。下方資訊列的統計數字、右鍵選單的欄名數值、Commit 對話框的 SQL 仍保留等寬字，因為它們顯示的是資料值／SQL，不是外框文案。

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

- （2026-09-23）`npm test`：388 個通過（新增 `tests/global_font_scope.test.ts` 三項：四個 DataGrid 根容器必須用 `font-sans` 且不得攜帶 `--sqlight-grid-font`、工具列區塊不得出現 `font-mono`、網格字型變數僅能綁在 `.sqlight-grid` 外框）。
- （2026-09-23）`npm test`：385 個通過（新增 `tests/grid_layout.test.ts` 兩項：「隱藏工具列」狀態為每結果分頁獨立且隨分頁關閉清除、以及按鈕位於「等分高度」左側並傳到全部 4 種網格容器且上下兩列都受 `hideToolbar` 控制；新增 `tests/tab_label_weight.test.ts` 一項：多結果集 `Result #N (N)` 標籤必須為一般字重且仍只在 `totalSets > 1` 出現）。
- （2026-09-23）`npm run typecheck`、`npm run build`：通過。
- （2026-09-23）`npm test`：370 個通過（新增 `tests/theme_contrast.test.ts`：5 surface × 深淺色階對比、角色色在純色與 15–25% 色塊底的對比、分頁圖示、Monaco 主題、連線標籤色、Tabulator CSS token 對比、啟動前套用色彩模式；並擴充 `tab_category_colors` 的淺色圖示斷言、更新 `grid_selection` 的排序箭頭期望值）。
- （2026-09-23）`npm run typecheck`、`npm run build`：通過。
- （2026-09-22）`npm test`：311 個通過（新增合成 fixture 的 spec 解析／維度／決定性／NULL 分佈／型別，以及「結果網格不得無條件停用欄虛擬化」「fixture 必須 dev-gated」「filter benchmark 必須還原 quickFilterText」「quick filter 必須 debounce 並清除 timer」四項回歸）。
- （2026-09-22）`npm run typecheck`、`npm run build`：通過；已確認 `dist/` 無 `sqlight:perf-fixture` 任何痕跡。
- （2026-09-22）Tauri 實機量測（150 欄 × 1,000 / 50,000 列）已完成，數據與判讀見上一節；欄虛擬化驗收關閉（`virtualisation ok`、dom/visible/total = 22/150/151）。`cacheQuickFilter` 決策為不採用（理由見上）。移除該行後的互動人工確認仍待補。
- （2026-09-21）`npm test`：271 個通過（新增 grid 捲動效能回歸：可見欄快取、無選取時零 DOM 走訪、raw rowData 交付、selection 高亮不繪製陰影、mousemove 僅延遲掛載）。
- （2026-09-21）`npm run typecheck`：通過。
- `npm test`：19 個通過（連線狀態／IPC、DML、語句擷取）。
- `cargo test --offline --manifest-path src-tauri/Cargo.toml --lib`：8 個通過（目標資料庫、不同連線並行、資料型別與逐列保留上限）。
- `npm run typecheck`：通過。
- `npm run build`：通過；仍有 bundle 過大及 workspaceStore 動／靜態 import 混用警告，列入後續整理。
- `cargo check --offline --manifest-path src-tauri/Cargo.toml`、`git diff --check`：通過。
- 已取得 esbuild 開發依賴安裝授權並更新 package-lock。
- MSVC 工具鏈存在但 link.exe 未安裝；不依賴 MSVC 執行上述已通過的 GNU 核心測試。
