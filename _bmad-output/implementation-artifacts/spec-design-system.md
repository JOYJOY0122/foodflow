---
title: '全站設計系統（主題、共用元件、色碼守門）'
type: 'refactor'
created: '2026-11-08'
status: 'done'
baseline_commit: 'd9e0afe640e4a0545ff82622538664b06a27182a'
route: 'dispatch'
review_loop_iteration: 0
context:
  - '{project-root}/docs/design/DESIGN.md'
  - '{project-root}/CONTRIBUTING.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** 各頁各自寫顏色、表格、對話框與空狀態，外觀跟 `docs/design/DESIGN.md` 對不上，新頁面也沒有可以照著用的元件和規則。

**Approach:** 把 DESIGN.md 的 token 寫進 Mantine 主題與 CSS 變數；把儲存位置頁可以共用的部分抽到 `frontend/src/shared/ui/`；儲存位置、版面、登入、員工帳號與各空白頁改用這些元件；用 ESLint 擋住 features 裡寫死的色碼；寫 CLAUDE.md 與 AGENTS.md；最後截圖驗收。只改外觀，不改功能。

## Boundaries & Constraints

**Always:**
- 行為不變：路由、權限、API 呼叫、表單驗證、文字標籤、aria 名稱、儲存位置頁的三種版面（table／cards／list）與斷點都維持原樣。既有測試只能因為外觀 API 改變而調整，不能放寬行為斷言。
- 可點擊目標至少 44px；狀態一律文字加顏色（AD-23、NFR-01）。
- 顏色只從主題取：Mantine 色票名稱，或 `--ff-*` CSS 變數。hex 只能出現在 `src/app/theme.ts` 與 `src/app/*.css`。
- commit 不加 AI 署名，不 push。

**Decisions（2026-11-08 Ken 確認）：**
- 儲存位置頁：版面、間距、元件排列不變；顏色、圓角、陰影、字級跟著新主題走；標題列加 DESIGN.md 的 42px 漸層圖示方塊。
- 9 個空白頁：「對應需求：FR-xx」改放進 EmptyState 卡片，卡片標題寫「功能開發中」，原有文字不變。
- 截圖：由 agent 自行啟動 Docker Desktop，用 `seed-demo` 的真實資料，不攔截 API。

**Never:**
- 不改後端；不新增 npm 依賴（截圖用現成的 `scripts/ai-evidence/node_modules/playwright-core`）。
- 不動 `ExpiryHint` 的計算邏輯（前端算天數屬於既有功能，不在這次範圍內）。
- 不改寫 `docs/ai-log.md`。

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| 色碼守門 | features 底下的 `.ts(x)` 出現 `"#1f2a24"`、`` `rgb(1,2,3)` ``、`"rgba(...)"` | ESLint 回報 `no-restricted-syntax` | 訊息指向 DESIGN.md 與主題 |
| 不誤擋 | features 裡出現 `"#1"`（序號文字）、`color="forest"`、`var(--ff-line)` | 不報錯 | N/A |
| 主題外允許 | `src/app/theme.ts` 裡的 hex | 不報錯 | N/A |
| FormModal 忙碌中 | `busy=true` 時按 Esc 或點遮罩 | 對話框不關閉，關閉鈕隱藏 | N/A |
| StatusBadge 強度 | EXPIRED／EXPIRES_TODAY／LOW_STOCK、EXPIRING_SOON、NORMAL | 實心底＋圓點、只有圓點、灰字不加圓點；都顯示文字 | N/A |

</frozen-after-approval>

## Code Map

- `frontend/src/app/theme.ts` -- 現在只有 forest 色階和 44px；`theme.test.ts` 鎖住 forest 陣列（保留），其餘斷言要跟著更新
- `frontend/src/app/providers.tsx` -- `MantineProvider` 在這裡傳入 `cssVariablesResolver`
- `frontend/src/app/layout.tsx` -- AppShell 寫死 `#f7f8f2`；header 有 Burger、品牌、姓名、登出；`layout.test.tsx` 依賴這些文字、aria 與 `inert`，要保留
- `frontend/src/features/storage_location/pages/StorageLocationsPage.tsx` -- 內部的 `TypeAvatar`、`ActiveBadge`、`CodeTag`、`EmptyState`、`headerStyle`、篩選 SimpleGrid、3 個 Modal 都是抽出來源；`typeIconColors` 用 cyan／indigo／orange
- `frontend/src/features/storage_location/components/StorageLocationForms.tsx` -- 用 `Paper bg="gray.0"`，主題調整後就會一致
- `frontend/src/features/auth/pages/EmployeesPage.tsx` -- 自己寫標題列、篩選、表格、2 個 Modal、啟用 Badge
- `frontend/src/features/auth/pages/LoginPage.tsx` -- 寫死 `#f7f8f2`
- `frontend/src/features/{alerts,inventory,goods_receipt,issue,waste,stocktake,reports,master_data}/pages/*.tsx` -- 空白頁；`router.test.tsx` 斷言「此功能由 X 負責，開發中」與「對應需求：FR」
- `frontend/src/shared/ui/{PageHeader,StatusBadge,statusBadgeMap,icons}.tsx` -- 既有共用元件；`shared.test.tsx` 斷言每個狀態都顯示文字
- `frontend/eslint.config.js`、`frontend/tests/eslint-rules.test.ts` -- 照既有的 `ruleIds()` 寫法補色碼規則的測試
- `frontend/index.html` -- 目前沒有載入 Noto Sans TC 與 JetBrains Mono

## Tasks & Acceptance

**Execution:**
- [x] `frontend/src/app/theme.ts`（＋`theme.css`）-- 加入 DESIGN.md 的色票：forest 不動；覆寫 gray、red、orange、green；新增 expired／today／soon／lowStock／normal／chilled／frozen／ambient。再加字級、間距、圓角、綠調陰影、`black`、等寬字體；Button 漸層、Input、Select、Modal、Table、Badge、Paper、NavLink、Alert 的預設樣式；`cssVariablesResolver` 輸出 `--ff-*`（畫布、側欄、線條、表面）。更新 `theme.test.ts` -- 讓 token 只有一個來源
- [x] `frontend/index.html` -- 載入 Google Fonts -- 讓 DESIGN.md 指定的字體真的生效
- [x] `frontend/src/shared/ui/` -- 新增 `Toolbar`（含 `SearchInput`）、`DataTable`、`EmptyState`、`FormModal`、`ActiveBadge`、`CodeTag`、`StorageTypeIcon`；`PageHeader` 加上選用的 `icon`；`StatusBadge` 改成三種強度；`icons.tsx` 補導覽用圖示。每個元件都附用法註解，並補單元測試 -- 抽出共用元件
- [x] `StorageLocationsPage.tsx`、`StorageLocationForms.tsx` -- 改用共用元件，刪掉內部重複的元件 -- 結構與行為不變
- [x] `layout.tsx` -- 側欄用漸層並加上導覽圖示，選中項用漸層；畫布用 CSS 變數；header 換成新風格 -- 保留所有行為與 aria
- [x] `LoginPage.tsx`、`EmployeesPage.tsx` -- 改用 PageHeader、Toolbar、DataTable、FormModal、ActiveBadge -- 套用新風格
- [x] 9 個空白頁 -- 把「對應需求」放進 EmptyState 卡片（標題「功能開發中」）-- 套用新風格，文字不變
- [x] `frontend/eslint.config.js`、`tests/eslint-rules.test.ts` -- 在 `src/features/**` 用 `no-restricted-syntax` 擋 hex、`rgb()`、`rgba()`、`hsl()`、`hsla()`（字串與模板字串）-- 色碼守門
- [x] `CLAUDE.md`、`AGENTS.md`（根目錄，內容相同）-- 寫前端設計規則與 CONTRIBUTING 重點（分支、commit 格式、PR、ai-evidence 流程、看不懂不 commit、`_bmad-output` 要 commit）
- [x] 截圖腳本（放 scratchpad，不 commit）-- 啟動 Docker 與 seed 資料，1024×768 與 1366×768 各截登入、首頁、儲存位置、員工帳號 4 頁，輸出到 `docs/design/screenshots/`

**Acceptance Criteria:**
- Given 新主題，when 打開儲存位置頁，then 三種版面的結構、文字與操作跟改版前一樣，顏色與圓角符合 DESIGN.md
- Given 1024×768，when 打開截圖的 4 個頁面，then 沒有橫向捲動，主要按鈕與輸入框高度至少 44px
- Given `src/features` 底下的檔案，when 搜尋 hex 或 `rgb(`，then 一筆都沒有
- Given 改版完成，when 執行 test、lint、typecheck、build，then 全部通過

## Implementation Notes

## Spec Change Log

## Review Triage Log

| # | 來源 | 發現 | 判定 | 依據與處理 |
|---|---|---|---|---|
| 1 | edge | 主要按鈕 hover 無效（`--button-hover` 填漸層） | medium | Mantine `styles.css:3616` 對 hover 設 `background-color: var(--button-hover)`，漸層無效 → patch |
| 2 | blind、edge | 錯誤欄位聚焦時出現綠色光暈 | low | `theme.css` focus 規則沒排除 `[data-error]` → patch |
| 3 | blind | ActiveBadge「停用」對比約 2.3:1 | medium | 「停用」是狀態文字不是停用控制項，DESIGN.md 也寫錯 → patch（含 DESIGN.md） |
| 4 | blind | gray 色票明暗不單調 | low | gray[1] #f0f1ef 與 gray[2] #eff3ec 順序顛倒，Mantine 假設 0→9 由淺到深 → patch |
| 5 | blind | red／expired、orange／today 重複定義 | low | 同一組 ramp 參數寫兩次，改一邊會漂移 → patch |
| 6 | blind | 畫布漸層畫兩次 | low | body fixed 與 AppShell main 各畫一次，登入前後行為不同 → patch |
| 7 | verif | variantColorResolver 沒有測試 | medium | grep 只出現在 theme.ts → patch |
| 8 | verif、blind | Button isPrimaryFilled 沒有測試 | medium | 紅色危險按鈕可能被套漸層而測不到 → patch |
| 9 | verif | `--ff-*` 只抽查 9 個 | medium | ActiveBadge、icon-tile 等引用的變數沒被檢查 → patch |
| 10 | verif、edge、blind | FormModal 遮罩測試沒有證明力 | medium | 預設 closeOnClickOutside=false，閒置時點遮罩沒測 → patch |
| 11 | blind | eslint 測試把 hooks.ts 換成 .tsx | low | `file.replace(/\.ts$/, ".tsx")` 讓 hooks.ts 設定區塊沒被測到 → patch |
| 12 | blind、edge、verif | hex 規則誤擋「#123」這類 3 碼以上序號 | low | 失敗是 lint 明確報錯，程式碼裡寫死序號字串少見；收緊規則無法分辨「#123」是色碼還是序號 → reject |
| 13 | blind、edge | 色碼守門不含 shared 與 features 的 CSS module | maybe-false | 需求寫的是「在 eslint.config.js 加規則、src/features 底下」，ESLint 不檢查 CSS；features 的 CSS module 目前沒有色碼 → defer |
| 14 | blind | ExpiryHint 前端算天數，違反新寫的規則 | low | 計算邏輯沿用改版前；spec Never 不動 ExpiryHint → defer（既有問題） |
| 15 | blind | AGENTS.md 與 CLAUDE.md 只靠人工同步 | low | 修法要改 agent 指令檔 → defer |
| 16 | blind | Google Fonts 斷網時退回系統字 | low | 已在 Checkpoint 說明，版面不會壞；自架字型要加依賴 → reject |
| 17 | blind | 主卡片 CARD_PADDING 重複、框線色不一致 | low | 只有兩處使用，未達抽象門檻；框線差異肉眼難辨 → reject |
| 18 | blind | statusBadgeMap.color 型別只是 string | low | theme.test 已驗證每個 color 都有色票 → reject |
| 19 | blind | StatusBadge 舊用法沒處理 | false | grep 只有 shared 測試與 ui 測試使用，沒有其他呼叫端 |
| 20 | edge | StatusBadge detail 為空字串時多一個空白 | low | 沒有呼叫端傳空值，修法要加判斷 → reject |
| 21 | edge | StorageTypeIcon 遇到未知類型會崩潰 | false | `StorageType` 是 OpenAPI 產生的列舉型別，改版前的 TypeAvatar 行為相同，不是這次造成的 |
| 22 | edge | StorageLocationForms.tsx 沒有改 | false | 表單沒有寫死色碼或可抽出的元件，Code Map 已註明主題調整後就一致 |
| 23 | edge | spec 寫 9 個空白頁，實際 10 頁 | false | 10 頁（含預警首頁）都已轉換，沒有遺漏 |
| 24 | blind | diff 沒有包含 DESIGN.md 與截圖 | false | DESIGN.md 是上一個步驟的產出，截圖是二進位檔，都會一起 commit；審查範圍刻意只放程式碼 |

## Design Notes

DataTable 只負責外框和表頭樣式，列由呼叫端自己放 `Table.Tr`，因為儲存位置頁要用 `Fragment` 插入展開列，做成欄位設定式的 API 反而包不住：

```tsx
<DataTable label="儲存位置" head={<><Table.Th>位置</Table.Th>…</>}>{rows}</DataTable>
```

FormModal 統一處理忙碌時不可關閉的規則：`<FormModal opened title busy fullScreen={phone} onClose>`。

## Verification

**Commands:**
- `cd frontend && npm test` -- expected: 全部通過
- `cd frontend && npm run lint && npm run typecheck && npm run build` -- expected: 0 error
- `grep -rnE "#[0-9a-fA-F]{3,8}\b|rgba?\(" frontend/src/features` -- expected: 沒有結果

**Manual checks:**
- 檢查 8 張截圖：顏色符合 DESIGN.md、狀態有文字、1024 寬度沒有橫向捲動
