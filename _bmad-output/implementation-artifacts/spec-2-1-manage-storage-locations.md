---
title: 'Story 2.1：管理儲存位置'
type: 'feature'
created: '2026-11-06'
status: 'done'
baseline_commit: 'eda377e633542b9a64a3b5750f8b79fd3d8cbd9b'
route: 'dispatch'
review_loop_iteration: 0
context:
  - '{project-root}/_bmad-output/implementation-artifacts/epic-2-context.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**問題：** FR-05 的位置主檔還沒有 API 與畫面，進貨無法選位置，員工也查不到食材放在哪。

**方案：** 新增 `storage_location` 模組（清單、新增、修改含停用與啟用、刪除），並把前端「儲存位置」占位頁換成實際頁面；管理者可寫入，一般員工只能查詢。

## Boundaries & Constraints

**必要：** 沿用 auth 模組的分層與組裝方式；寫入由路由層 `require_admin` 把關；錯誤一律用 `DomainError`；`storage_location` 表與 `uq_storage_location_code` 已存在，不改 schema。停用與刪除的引用檢查在 Service 內、同一交易中，先對目標位置 `for_update` 取鎖再檢查。刪除另以 FK 違反作為最後防線，轉成 `409 REFERENCED`。

**界線：** 不做整批換位置與位置頁展開批次（Story 2.2）；不寫 `inventory_batch`、`batch_location_change`；不加 migration；不呼叫其他模組的 Service 或 Repository。停用的「檢查後寫入」競態依架構延後處理，不另加鎖。

## I/O & Edge-Case Matrix

| 情境 | 輸入／狀態 | 結果 | 錯誤 |
|---|---|---|---|
| 新增 | 管理者送 code、name、storage_type，description 可省略 | `201`，`is_active=true` | — |
| 代碼重複 | 新增或修改成已存在的 code | 不寫入 | `409 DUPLICATE`，`fields=[code]` |
| 缺漏 | name 或 storage_type 空白／缺，或 code 空白 | 不寫入 | `422 VALIDATION_ERROR`，指出欄位 |
| 停用有庫存位置 | 有 `remaining_quantity > 0` 的批次 `current_location_id` 指向它 | 不變 | `409 REFERENCED`，`details.batch_count` |
| 停用只放過耗盡批次 | 批次都已 `remaining_quantity = 0` | 停用成功 | — |
| 刪除被引用位置 | 被進貨明細（含草稿）、批次、位置變更紀錄（from 或 to）引用 | 不刪 | `409 REFERENCED`，訊息提示改用停用 |
| 刪除未被引用 | 無任何引用 | `204` | — |
| 只列啟用 | `GET ?is_active=true` | 停用位置不在結果 | — |
| 員工寫入 | 一般員工 POST／PATCH／DELETE | 不變 | `403 FORBIDDEN` |
| 不存在 | PATCH／DELETE 不存在的 id | — | `404 NOT_FOUND` |

</frozen-after-approval>

## Code Map

- `backend/app/modules/auth/{router,dependencies,repository,repository_sqlalchemy,schemas,service}.py` -- 照抄的分層樣板：`StrictRequest`（`extra="forbid"`）、`StringConstraints(strip_whitespace)`、清單回 `{items,total,page,page_size}`、`contains(autoescape=True)`、`build_*_service` 加 `get_*_service`。
- `backend/app/db/models/master_data.py` `StorageLocation` -- 欄位 code(32)、name(100)、storage_type(`StorageType`)、description(Text)、is_active；沒有 `created_at`，不要加。
- `backend/app/db/models/{goods_receipt,inventory}.py` -- 引用來源：`GoodsReceiptItem.location_id`、`InventoryBatch.current_location_id` 與 `remaining_quantity`、`BatchLocationChange.from_location_id`／`to_location_id`。只能讀。
- `backend/app/core/errors.py` -- `flush_or_raise(session, constraint_errors)`；`uq_storage_location_code` 已對應到 DUPLICATE。FK 名稱見 migration：`fk_goods_receipt_item_location_id_storage_location`、`fk_inventory_batch_current_location_id_storage_location`、`fk_batch_location_change_{from,to}_location_id_storage_location`。
- `backend/app/core/db.py` `for_update` -- 取鎖唯一入口（架構測試禁止直接 `with_for_update`）。
- `backend/app/main.py` `create_app` -- 在 `api_router` 加掛新 router。
- `backend/tests/unit/test_api_conventions.py` `PRODUCTION_API_ROUTES` -- 要列出新的四條路由。
- `backend/tests/integration/factories.py` -- `add_location`、`seed_batch`、`receive_batch`、`add_item`、`make_token`；`test_auth_management.py` 的 `client_for` 是 HTTP 整合測試樣板。
- `frontend/src/features/auth/{api,hooks}.ts`、`pages/EmployeesPage.tsx`、`pages/Auth.test.tsx` -- 前端樣板：`fieldError`、Modal 表單失敗保留輸入、`renderPage` 測試寫法。
- `frontend/src/shared/api/queryKeys.ts` -- 已有 `storageLocations.all`，補 `list(filters)`。
- `frontend/src/app/router.test.tsx` -- `placeholders` 中的儲存位置那列要移除。
- `frontend/src/shared/api/schema.d.ts` -- 以 `npm run gen:api` 重新產生，不手改。

## Tasks & Acceptance

**Execution:**
- [x] `backend/app/modules/storage_location/__init__.py`、`schemas.py` -- `StorageLocationCreate`（code 1–32、name 1–100、storage_type、description ≤ 500 可 null，空字串轉 null）、`StorageLocationUpdate`（同欄位外加 `is_active`）、`StorageLocationResponse`、`StorageLocationList` -- API 契約。
- [x] `backend/app/modules/storage_location/repository.py`、`repository_sqlalchemy.py` -- ABC 與實作：`list_locations(search, storage_type, is_active, page, page_size)`（搜尋 code 或 name，依 code 排序）、`lock(id)`、`find_code(code)`、`count_stocked_batches(id)`、`is_referenced(id)`、`add`、`delete`、`flush` -- 只做查詢與鎖，不判斷規則、不 commit。
- [x] `backend/app/modules/storage_location/service.py` -- `StorageLocationService(repository, uow)`：create、update、delete、list；update 由啟用改停用時才檢查剩餘批次 -- 規則與交易邊界。
- [x] `backend/app/modules/storage_location/dependencies.py`、`router.py` -- `GET /storage-locations`（所有登入者）、`POST`（201）、`PATCH /{location_id}`、`DELETE /{location_id}`（204），寫入掛 `require_admin` -- 權限在路由層。
- [x] `backend/app/main.py`、`backend/tests/unit/test_api_conventions.py` -- 掛 router，更新路由清單。
- [x] `backend/tests/unit/test_storage_location_service.py` -- fake repository 加 `FakeUnitOfWork`，涵蓋矩陣中的規則分支，並斷言失敗時 rollback。
- [x] `backend/tests/integration/test_storage_locations.py` -- 真實 PostgreSQL 的 HTTP 測試：建立、重複、缺漏欄位、停用被擋與耗盡可停用、四種引用阻擋刪除、未引用可刪、只列啟用、員工 403、404。
- [x] `frontend/src/features/storage_location/{api,hooks}.ts`、`pages/StorageLocationsPage.tsx` -- 清單（搜尋、類型、狀態篩選、分頁），管理者另有新增／編輯 Modal（含啟用勾選）與刪除確認；員工不顯示寫入按鈕。錯誤用 `fieldError` 標欄位並保留輸入，`REFERENCED` 顯示訊息與批次數。寫入成功後失效 `storageLocations.all`；停用、啟用、改名都會影響庫存與預警的位置顯示，所以也呼叫 `invalidateStockQueries()`。
- [x] `frontend/src/shared/api/queryKeys.ts`、`schema.d.ts`、`src/app/router.test.tsx` -- 補 key、重新產生型別、移除占位測試列。
- [x] `frontend/src/features/storage_location/pages/StorageLocationsPage.test.tsx` -- 管理者新增成功、重複代碼錯誤保留輸入、停用被擋顯示批次數、員工看不到寫入按鈕。

**Acceptance Criteria:**
- Given 任一登入者，when 開啟 `/storage-locations`，then 看到位置清單與儲存類型的中文標示（冷藏、冷凍、常溫）與啟用狀態。
- Given 管理者在表單送出失敗，when 看到錯誤，then 已填欄位仍保留，Modal 不關閉，也不顯示成功訊息。

## Design Notes

- 停用與啟用走 `PATCH` 的 `is_active`，與員工管理一致，不另開端點。
- code 只去頭尾空白、區分大小寫，與 DB unique 一致。
- 引用判斷用 `EXISTS` 查四個欄位，不載入關聯實體（`lazy="raise"`）。

## Verification

**Commands:**
- `cd backend && uv run ruff check . && uv run lint-imports && uv run pytest` -- 全部通過
- `cd frontend && npm run gen:api && git diff --stat src/shared/api/schema.d.ts` -- 型別已更新並提交
- `cd frontend && npm run lint && npx tsc --noEmit && npx vitest run && npm run build` -- 全部通過

## Implementation Notes

- 由主 session 直接實作（使用者只授權審查用 subagent）。
- 錯誤訊息集中在 `storage_location/errors.py`，讓 Service 的檢查與 Repository 的 constraint／FK 防線回同一個錯誤（DUPLICATE 一律帶 `fields=[code]`）。
- 停用被擋時另帶 `fields=[is_active]`，前端顯示在「啟用此位置」勾選框下方。
- 儲存類型中文標示放在 `frontend/src/shared/storageTypes.ts`：食材的保存方式（Epic 1）用同一個列舉，可直接沿用。
- 表單加 `noValidate`，空白欄位交給伺服器回 422 並標欄位；只有儲存類型在前端先擋，因為未選時沒有值可送。
- `Textarea` 不用 `autosize`：jsdom 缺 `document.fonts`，Mantine 的 Autosize 會丟例外。
- 「位置變更紀錄引用」的整合測試直接新增 `batch_location_change` 列：經正式流程換位置後，目標位置一定同時被批次引用，無法單獨驗證 from／to 欄位。
- `npm run gen:api` 在 Git Bash 下找不到 `uv`／`node`，改在 PowerShell 執行。
- 首次跑 `npx vitest run` 時 `tests/eslint-rules.test.ts` 有一項超過 5 秒逾時，重跑通過；與本次變更無關。
- 驗證：backend 335 passed、ruff、lint-imports 4 kept；frontend 108 passed、lint、tsc、build 通過。

## Spec Change Log

## Review Triage Log

第 1 輪（Blind Hunter 14、Edge Case Hunter 4、Verification Gap 3，共 21 項）。

| # | 來源 | 發現 | 判定 | 依據與處理 |
|---|---|---|---|---|
| 1 | VG | 前端篩選與分頁轉成 query 參數沒測 | medium → patch | 誤寫參數名稱時測試仍全過。已補測試，斷言 `search`、`storage_type`、`is_active`、`page`。 |
| 2 | VG | 前端編輯與刪除的成功路徑（失效快取、成功訊息、關閉 Modal）沒測 | medium → patch | 唯一走成功路徑的是新增。已補編輯成功與刪除成功兩個測試。 |
| 3 | VG | 後端依代碼搜尋與分頁 offset 沒測 | medium → patch | 拿掉 `code.contains` 或 offset，測試仍全過。已補 `search="F-0"` 與 `page=2&page_size=1`。 |
| 4 | BH | 頁面測試沒涵蓋編輯、刪除成功、篩選參數、`name` 欄位錯誤 | medium → patch（與 1、2 同源） | 前三項由 1、2 補上。`name` 欄位錯誤與 `code` 走同一個 `fieldError`，重複代碼測試已涵蓋這段機制。 |
| 5 | BH、ECH | 在第 2 頁刪掉或停用最後一筆後，停在空白頁，分頁元件也消失 | low → patch | 實際會發生。修正方式比照員工頁，在 `done()` 呼叫 `setPage(1)`。 |
| 6 | BH | 停用被擋應回 `422 RULE_VIOLATION`，不是 `409 REFERENCED` | false | epics 的 Story 2.1 驗收條件明訂停用回 `409 REFERENCED`。 |
| 7 | BH | 草稿明細的位置被停用後，確認入庫仍會建立批次 | false | AD-8 規定確認入庫要在鎖內重新驗證位置是否啟用，屬於 Epic 3 的責任。 |
| 8 | BH | spec 對 `for_update` 擋住哪段、哪段延後，說法矛盾 | low，駁回 | 鎖只擋住並行刪改，FK 插入仍會在 commit 後成功；剩下的競態依架構延後處理，進貨端另有檢查。修正方式只是改 spec 文字。 |
| 9 | BH | PATCH 送完整欄位，兩位管理者同時編輯會互相覆蓋 | low，駁回 | 與員工管理同一模式。主檔很少同時編輯，要修就得加版本欄位，複雜度太高。 |
| 10 | BH | `fieldError` 複製了一份，沒有共用 | low，駁回 | 要抽到 shared 得同時改 auth 頁，超出直接修正的範圍。Epic 1 若要再用時可以順手抽出。 |
| 11 | BH | queryKeys 的 filters 型別與 api.ts 重複 | false | query key 收的是整個 filters 物件，新增欄位時不會漏進 key。改成從 feature 匯入型別反而會讓 shared 依賴 feature。 |
| 12 | BH | 搜尋沒有 debounce，key 也沒先 trim | low，駁回 | 員工頁同樣如此，資料量小。加 debounce 會增加複雜度。 |
| 13 | BH | 觸控目標可能不到 44px | false | `app/theme.ts` 已設 Button `mih: 44`，TextInput、Select 的 input `minHeight: 44`。 |
| 14 | BH | 後端沒測 PATCH 的驗證、長度上限、`extra="forbid"` | low，駁回 | Update 繼承 Create 的欄位定義，`extra="forbid"` 沿用既有的 `StrictRequest`。沒有指出具體的損害。 |
| 15 | BH | spec 是 in-review，sprint-status 卻還是 in-progress | false | 流程在 step-05 才把 sprint-status 同步成 review。 |
| 16 | BH | `admin` 參數沒用到；Service 沒收操作者 | false | 照抄 auth 的寫法。FR-05 沒有要求記錄主檔的操作者，位置變更紀錄由 Story 2.2 透過 StockLedger 寫入。 |
| 17 | BH | 錯誤同時出現在頂部 Alert 和欄位下方 | low，駁回 | 屬於外觀問題，員工頁也一樣，不影響操作。 |
| 18 | ECH | `location_id` 超過 BIGINT 時回 500 | low，駁回 | 正常操作碰不到。員工端點也有同樣情況，修正要另加 guard。 |
| 19 | ECH | `page` 過大，OFFSET 溢位回 500 | low，駁回 | 同上，介面不會產生這種頁碼。 |
| 20 | ECH | 輸入含 NUL 字元時回 500 | low，駁回 | 同上，修正要在全專案加 pattern。 |
| 21 | ECH | 刪除最後一筆後停在空白頁 | low → patch（與 5 合併） | 同 5。 |

修正後驗證：backend 335 passed、ruff、lint-imports 4 kept；frontend 111 passed、lint、tsc、build 通過，`schema.d.ts` 重新產生後無差異。`tests/eslint-rules.test.ts` 第一個測試在冷啟動時偶爾超過 5 秒，baseline 上也會發生，重跑後通過。
