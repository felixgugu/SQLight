# SQLight 深色／淺色佈景配色檢查報告

檢查日期：2026-09-23
範圍：`src/` 全部使用者可見介面（Vue 元件、Tabulator 樣式、Monaco 主題、PrimeVue 覆寫、啟動畫面）

## 1. 檢查方法

- 以 WCAG 2.1 相對亮度公式計算對比：一般文字 4.5:1、大字與非文字 UI（圖示、邊框、控制項狀態）3:1。
- 逐一量測 5 種 surface（slate / gray / zinc / neutral / stone）× 深淺 2 種模式，背景取 `--color-dark-750 / 800 / 850 / 900`。
- 掃描全部硬編碼色碼與 Tailwind 色階 class，找出未經主題分流的用色。
- 對比計算已寫成自動化測試（`tests/theme_contrast.test.ts`），後續改色若低於門檻會直接讓 `npm test` 失敗。

## 2. 修正前的問題（實測值）

| 類別 | 修正前 | 影響 |
| --- | --- | --- |
| 深色 muted 文字（`--color-dark-500`） | 3.07–3.78:1 | 側邊欄、狀態列、統計、placeholder 等 111 處低於 4.5:1 |
| 深色分隔線文字（`--color-dark-600`） | 2.29–2.36:1 | 分隔用的「\|」與 hover 邊框過淡 |
| 淺色 muted 文字 | 4.34–4.40:1 | 面板底色（`#f1f5f9`）上的次要文字略低於 4.5:1 |
| 淺色分隔線文字 | 2.45–2.56:1 | 淺色模式下幾乎不可見 |
| 淺色模式沿用深色底用的亮 accent | 1.5–4.0:1（約 325 處） | `text-emerald-400`、`text-brand-400`、`text-rose-400` 等在全白底上不可讀 |
| 淺色模式狀態色塊上的文字 | 1.12–2.69:1 | 錯誤／成功提示框（`bg-rose-950/xx` + 亮字）在淺色模式整個糊掉 |
| 側邊欄 4 個 NEW 徽章（白字 + 500 色底） | 2.15–3.96:1 | 9px 白字不合格 |
| 分頁列非作用中圖示（淺色） | 1.54–2.54:1 | 圖示是唯一的分頁類型提示，低於 3:1 |
| Tabulator 淺色 binary／modified 儲存格 | 1.80 / 1.12:1 | 二元與已修改值在淺色網格不可讀 |
| Tabulator 排序箭頭（淺色，含 0.75 透明度） | 2.45:1 再乘透明度 | 排序是唯一透過箭頭提示的操作 |
| Monaco 淺色行號 / 深色註解 | 2.56 / 3.4:1 | 行號與註解不易辨識 |
| 連線標籤色（淺色） | 1.9–4.0:1 | 使用者選的黃／綠／青／藍連線名稱在淺色模式看不清楚 |

其他一致性問題：兩個 AI／資料檢視 modal 使用固定 charcoal 色碼（脫離 surface 設定）、`border-dark-650` 在 Tailwind 設定中不存在（3 處無效 class）、執行計畫 tooltip 為固定深色、`index.html` 固定 `class="dark"` 導致淺色使用者看到深色閃爍、未宣告 `color-scheme`。

## 3. 修正後的量測（自動化測試把關）

| 角色 | 深色模式 | 淺色模式 |
| --- | --- | --- |
| muted 文字（`dark-500`） | 4.99–6.96:1 | 6.08–7.03:1 |
| 次要文字（`dark-400`） | 8.18–8.90:1 | 8.18–8.40:1 |
| 內文（`dark-300`） | 10.2–10.5:1 | 11.7–12.1:1 |
| 強調文字（`dark-100`） | 8.6–8.9:1 | 15.7–16.4:1 |
| 分隔線（`dark-600`，非文字角色） | 3.65–3.78:1 | 4.74–4.83:1 |
| 語意角色色（accent/ok/danger/warn/info/plan/er/structure） | 對 `dark-900` 與 `dark-750` 皆 ≥ 4.5:1 | 對白底、面板底與 15–25% 同色系底色皆 ≥ 4.5:1 |
| 分頁非作用中圖示 | 5.08–8.38:1 | 4.39–5.34:1 |
| Tabulator muted／bool／binary／modified | ≥ 4.5:1（含半透明底合成後） | ≥ 4.5:1 |
| Tabulator 排序箭頭 | ≥ 3:1 | ≥ 3:1 |
| Monaco 語法色與行號 | 語法 ≥ 4.5:1、行號 ≥ 3:1 | 相同基準 |
| 連線標籤色 | 原色不變 | 自動加深至 ≥ 4.5:1 |

## 4. 修正內容

1. **色階映射**：文字段（100–600）在兩種模式各位移一格，muted 文字脫離 4.5:1 以下；表面段（750–950）與邊框色維持原觀感。做法在 `services/themeManager.ts` 的純函式 `buildThemeTokens()`，並同步 `assets/main.css` 的靜態初值。
2. **語意角色色**：新增 `accent / ok / danger / warn / info / plan / er / structure` 八個 Tailwind 顏色鍵，深色用 300–400 階、淺色用 700–800 階，兩者皆對各自的 15–25% 色塊底色維持 4.5:1。
3. **全面替換 accent 用色**：36 個檔案、456 處 `text-<hue>-<shade>` 換成角色色；`text-amber-800 dark:text-amber-300` 這類成對寫法收斂為單一角色色。深色外觀維持不變。
4. **深色專用色塊補淺色版本**：63 處 `bg-<hue>-950/900`、`border-<hue>-800/900` 改成 `bg-<hue>-50|100 dark:bg-<hue>-950/…`，淺色模式的錯誤／成功提示恢復可讀。`ErTextNode` 因原本就有深淺分流而排除。
5. **元件層修正**：Tabulator（muted、binary、bool、modified、排序箭頭）、Monaco（註解、行號、語法色，並抽出 `utils/editorThemeTokens.ts` 以便測試）、分頁圖示（新增 `iconColorLight`）、執行計畫 tooltip 改用語意 token、連線標籤色（新增 `utils/connectionColor.ts` 純函式）、4 個 NEW 徽章改用 600/700 底色、SettingsModal 色票勾選圖示改用可讀色。
6. **一致性與啟動**：AI／資料檢視 modal 的 15 處固定色碼改回 surface token、`border-dark-650` 改為 `border-dark-700`、對話框 `ring-white/10` 改為 `ring-black/5 dark:ring-white/10`、標籤列捲軸改語意色、`index.html` 於首次繪製前套用已儲存的色彩模式並宣告 `color-scheme`（消除淺色模式閃爍與原生控件配色不一致）。

## 5. 驗證

- `npm test`：370 個測試通過，含新增的 `tests/theme_contrast.test.ts`（色階／角色色／狀態色塊／分頁圖示／Monaco／連線色／Tabulator CSS／啟動腳本）。
- `npm run typecheck`、`npm run build`：通過。
- 人工驗收矩陣（建議於 Tauri 實機逐項確認）：
  1. 深／淺色 × 5 種 surface × 代表性 primary 色（至少 blue、emerald、amber）。
  2. 側邊欄（連線名稱、NEW 徽章、篩選歷史）、標頭（連線與資料庫狀態）、狀態列、分頁列。
  3. 結果網格：NULL、bit、binary、已修改、框選、排序箭頭、tooltip。
  4. 錯誤／成功提示：TSV 匯入驗證與結果、DML 二次確認、QueryHistory、ResultMessages、ExportSchema。
  5. 執行計畫（圖形 + tooltip + XML）、ER 圖（淺色畫布、連線、port、圖例）、Monaco（SQL 與 XML 檢視）。
  6. 各 modal（連線、設定、SQL 範本、物件快搜、資料檢視、AI 對話）與 toast／tooltip。

## 6. 刻意保留／已知事項

- **Monaco 色碼必須保留 `#`**：`Color.Format.CSS.parseHex` 只接受 `#RRGGBB`／`#RRGGBBAA`，其他字串一律回退成 `Color.red`（`#FF0000`）。抽出 `utils/editorThemeTokens.ts` 時曾誤將 `#` 去掉，導致整個 SQL 編輯區底色變成大紅色；現已保留前綴，並在 `theme_contrast.test.ts` 加上「所有 Monaco 主題色都必須是 `#` 開頭」的斷言防止再犯。
- 執行計畫「經典（SSMS）」主題（白底 + `#FFFFCC` 節點 + 黑字）維持原樣，屬刻意的對照風格。
- ER 文字節點的深色分支色塊（`bg-*-950/40`）與裝飾性陰影（`shadow-*-950/xx`）保留原值：前者僅在深色分支使用，後者為裝飾不承載資訊。
- dev-only 的網格效能 HUD（`useGridPerfDiag`）仍使用固定深色，不屬於使用者介面。
- 側邊欄 NEW 徽章字級為 9px（低於建議的 12px）；本次僅修正色彩對比，未調整字級。
- PrimeVue 自身的 `--p-*` 色票未改寫，僅在既有覆寫處對齊語意 token。
