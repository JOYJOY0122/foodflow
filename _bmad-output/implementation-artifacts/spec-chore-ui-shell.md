---
title: '全站頁面框架（AppShell 導覽、路由與空白頁）'
type: 'chore'
created: '2026-11-06'
status: 'done'
baseline_commit: '1edf6aa75d3f7cfd7fa30d51c70b8bee90086831'
route: 'dispatch'
review_loop_iteration: 0
context: []
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** 前端只有上方列的首頁與員工帳號，各組員沒有共同的導覽、路由與頁面落點，平行開發會互相衝突。

**Approach:** 抽出主題檔、把 layout 改成 Mantine AppShell 左側導覽、補齊路徑與路由，並依負責人建立空白頁與共用標題列；不做任何業務功能。

## Boundaries & Constraints

**Always:**
- `createTheme` 內容原樣搬到 `src/app/theme.ts`，外觀不變。
- 上方列保留系統名稱、使用者名稱、角色與登出；登出失敗的提示與重試行為不變。
- 導覽順序：預警首頁、庫存、進貨、領用、報廢、盤點、異動與統計、基本資料（食材、分類、供應商、儲存位置）、員工帳號。
- 1024×768 可收合；導覽與收合按鈕的觸控目標至少 44px；不依賴 hover。
- `routes` 既有鍵值與 `alertActionPath` 不變；路由集中在 `router.tsx`，不用 loader／action（AD-17、AD-23）。
- 空白頁只顯示標題、「此功能由 OOO 負責，開發中」與 FR 編號；負責人照 `docs/team-tasks.md`。
- 角色判斷只影響顯示，尚未取得角色時視為非管理者。
- 決定（Ken，2026-11-06）：一般員工看得到「基本資料」四項（SRS 4.1「僅查詢」）；只隱藏盤點與員工帳號。基本資料的新增與修改按鈕日後由各頁只對管理者顯示。
- commit 不加 AI 署名，不 push。

**Never:**
- 不呼叫新 API、不新增 hook 或 `api.ts`、不做業務功能。
- 不改 `LoginPage`、`EmployeesPage` 與既有測試；不新增前端路由守衛（權限由伺服器驗證）。
- 程式碼註解不放 story、epic 或 AI 流程資訊。

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| 管理者導覽 | `role=ADMIN` | 全部項目依序顯示 | N/A |
| 一般員工導覽 | `role=STAFF` | 看不到盤點、員工帳號；看得到基本資料四項 | N/A |
| 收合 | 1024×768 按收合鈕 | 導覽列收起且內部連結無法用鍵盤聚焦，再按可展開 | N/A |
| 預警動作連結 | 開啟 `/issues/new?ingredient_id=5` 等三條既有路徑 | 顯示對應功能空白頁，導覽標示該功能，不落入 404 | N/A |
| 未知路徑 | `/no-such-page` | 維持「找不到頁面」且保留框架 | N/A |
| 預警首頁 | `/` | 預警空白頁內容下方顯示原 `/health` 狀態 | 沿用 `HomePage` 的錯誤顯示 |

</frozen-after-approval>

## Code Map

- `frontend/src/app/providers.tsx` -- `createTheme` 來源；只移除主題定義，保留 401 快取清除邏輯。
- `frontend/src/app/layout.tsx` -- `AppLayout`；保留 `signOut`、`logout.error` 的 Alert、`main` 背景 `#f7f8f2`、`padding="xl"`；移除上方列的首頁與員工帳號按鈕。
- `frontend/src/app/router.tsx` -- 匯出 `RequireLogin`（`Auth.test.tsx` 使用）與 `router`；頁面掛在 `AppLayout` 下。
- `frontend/src/shared/routes.ts` -- 新路徑鍵值加在 `routes`，既有 `issueNew`、`wasteRecordNew`、`goodsReceiptNew` 不動。
- `frontend/src/features/auth/hooks.ts` -- `useCurrentEmployee`、`useLogout`，沿用。
- `frontend/src/features/health/pages/HomePage.tsx` -- 內容不動，由 `AlertsPage` 引入；`HomePage.test.tsx` 不動。
- `frontend/src/features/auth/pages/EmployeesPage.tsx:469` -- 標題列樣式來源：`Title order={1} size="h2"`、`Text c="dimmed" mt={4}`、外層 `maw={1200} mx="auto"`。
- `frontend/src/test/setup.ts` -- 預設 `matchMedia` 回傳 false；測試寬螢幕時需 stub。
- Mantine `NavLink` 預設是沒有 href 的 `<a>`：有子項的「基本資料」要用 `component="button"` 才能以鍵盤操作。Mantine `AppShell` 收合只用 transform 移出畫面，所以導覽列要加 `inert`。

## Tasks & Acceptance

**Execution:**
- [x] `frontend/src/shared/routes.ts` -- 新增 `inventory:/inventory`、`goodsReceipts:/goods-receipts`、`issues:/issues`、`wasteRecords:/waste-records`、`stocktakes:/stocktakes`、`reports:/reports`、`ingredients:/ingredients`、`ingredientCategories:/ingredient-categories`、`suppliers:/suppliers`、`storageLocations:/storage-locations` -- 路徑與後端模組路由同名。
- [x] `frontend/src/app/theme.ts`、`frontend/src/app/providers.tsx` -- 搬移主題並改為 import。
- [x] `frontend/src/shared/ui/PageHeader.tsx` -- `title`、`description?`、`actions?` -- 共用標題列，樣式同 `EmployeesPage`。
- [x] `frontend/src/features/*/pages/*Page.tsx` -- 依下表建立空白頁 -- 各組員的落點。
- [x] `frontend/src/app/router.tsx` -- 掛上各頁；三條 `*New` 路徑指向同功能空白頁。
- [x] `frontend/src/app/layout.tsx` -- AppShell 導覽、收合、依角色顯示；小於 768px 為覆蓋式，點選後自動關閉。
- [x] `frontend/src/app/layout.test.tsx`、`frontend/src/app/router.test.tsx`、`frontend/src/app/theme.test.ts`、`frontend/src/shared/ui/PageHeader.test.tsx` -- 先寫失敗測試，涵蓋 I/O Matrix、各頁內容與主題值。

| 頁面 | 位置 | 負責人 | FR |
|---|---|---|---|
| 預警首頁 `AlertsPage` | `alerts` | 謝文佳 | FR-12、FR-13、FR-14 |
| 庫存 `InventoryPage` | `inventory` | ChiaJungTien | FR-08、FR-09 |
| 進貨 `GoodsReceiptsPage` | `goods_receipt` | ChiaJungTien | FR-06、FR-07 |
| 領用 `IssuesPage` | `issue` | 黃予岑 Ken | FR-10、FR-11 |
| 報廢 `WasteRecordsPage` | `waste` | 郭明儒 | FR-15 |
| 盤點 `StocktakesPage` | `stocktake` | 郭明儒 | FR-16 |
| 異動與統計 `ReportsPage` | `reports` | 郭明儒 | FR-17、FR-18 |
| 食材 `IngredientsPage` | `master_data` | 謝文佳 | FR-03 |
| 分類 `IngredientCategoriesPage` | `master_data` | 謝文佳 | FR-03 |
| 供應商 `SuppliersPage` | `master_data` | 謝文佳 | FR-04 |
| 儲存位置 `StorageLocationsPage` | `storage_location` | 黃予岑 Ken | FR-05 |

**Acceptance Criteria:**
- Given 任一導覽頁，when 檢視目前項目，then 該項標示為作用中（`/` 僅精確比對，其他含子路徑）。
- Given 直接開啟基本資料的子頁，when 頁面載入，then 基本資料群組為展開。
- Given 寬度 ≥768px，when 首次載入，then 導覽列預設展開。
- Given 收合後，when 檢視內容區，then 內容佔滿可用寬度，1024×768 下沒有水平捲軸。

## Implementation Notes

- 未另開實作 subagent，依 spec 直接實作；review 的 3 個 subagent 經 Ken 同意後執行。
- `router.tsx` 另外匯出 `appRoutes`，讓測試以 `createMemoryRouter` 渲染完整路由表；測試共用 `src/test/renderApp.tsx`。
- `HomePage` 標題是 h2「系統狀態」，放在預警首頁的 h1 下方，層級正確，所以沒有改動。
- 以 Edge headless 實測 1024×768（管理者）、1366×768（一般員工）、390px：觸控目標都是 44px，沒有水平捲軸，收合後導覽列帶 `inert`。
- review 後的修正：基本資料群組改成受控元件，換頁時自動展開，收起時由父項目標示目前位置。換頁時關閉覆蓋式導覽。網址比對不分大小寫。斷點收斂為 `NAVBAR_BREAKPOINT` 一個常數，測試依寬度模擬 1024px 與 700px。補上管理者標頭的測試。
- `npm run build` 會出現「chunk 大於 500 kB」的既有警告，不影響建置。

## Spec Change Log

## Review Triage Log

| 來源 | 發現 | 判定 | 證據與處理 |
|---|---|---|---|
| Blind、Edge | 一般員工直接開 `/stocktakes` 沒有前端守衛 | false | 使用者指示「前端判斷只影響顯示」，frozen 區塊也禁止新增前端路由守衛；權限由伺服器驗證。駁回 |
| Blind、Edge | 基本資料群組用 `defaultOpened`，用應用程式內導覽進入子頁時不會展開 | medium | 瀏覽器上一頁或頁內連結都會觸發。patch：改成受控元件，換頁時展開，並補測試 |
| Edge | 群組收起時看不出目前在哪一頁 | low | patch：父項目加 `active`，並補測試 |
| Edge | 窄螢幕用上一頁換頁時，覆蓋式導覽不會關 | low | 修法是同一個換頁 effect 的一行。patch，並補測試 |
| Blind、Edge | 覆蓋式導覽不能用 Escape 關閉，背後內容可聚焦 | low | 只在小於 768px 出現，不在 NFR-01 的裝置範圍，修法要再加 hotkey 與 inert 分支。駁回 |
| Blind | 手機寬度標頭擁擠 | low | 已實測 390px 未溢出，只是標題換行；手機不在 NFR 範圍。駁回 |
| Blind | 11 個空白頁重複、負責人寫死 | false | 使用者要求每個功能一個頁面元件並顯示負責人，各負責人會整頁替換。駁回 |
| Blind | `AlertsPage` 跨 feature 引用 `HomePage` | false | 使用者要求保留在預警首頁下方；ESLint 只限制 `api.ts`；`HomePage` 註解原本就寫由 alerts 接手。駁回 |
| Blind | 找不到頁面沒有 h1 | low | 既有行為，不是這次造成的，而且修正需要另做版面。駁回 |
| Blind | `renderApp` 沒有用 `createQueryClient` 或 `Providers` | false | 測試刻意關閉 retry；`Providers` 改 import theme 後，`Auth.test.tsx` 的 Providers 測試仍有涵蓋。駁回 |
| Blind | 標頭的管理者分支沒有測試 | low | patch：補「王店長 · 管理者」測試 |
| Blind | `theme.test.ts` 是 change-detector | false | 需求明確要求外觀不變，這個測試就是要釘住這些值。駁回 |
| Blind | 導覽權限與路由沒有共用設定 | false | 前端路由守衛已被 intent 排除。駁回 |
| Verification | 斷點沒有測試釘住；`useMediaQuery` 與 AppShell 的斷點各寫一次 | medium | 把斷點改成 `lg`，原本的測試照樣全過。patch：抽成 `NAVBAR_BREAKPOINT`，測試依寬度模擬 |
| Edge | 網址大小寫不同時沒有 `aria-current` | low | React Router 預設不分大小寫。patch：比對改用 `toLowerCase`，並補測試 |
| Edge | `PageHeader` 的 `description=0` 會顯示 0 | false | 沒有任何呼叫端傳數字，這個情況不會發生。駁回 |

## Verification

**Commands:**
- `npm run build`（`frontend/`）-- expected: 成功
- `npm run lint`（`frontend/`）-- expected: 無錯誤
- `npx vitest run`（`frontend/`）-- expected: 全數通過，既有測試檔未修改

**Manual checks (if no CLI):**
- 以 1024×768 與 1366×768 檢查導覽展開、收合與上方列不重疊。
