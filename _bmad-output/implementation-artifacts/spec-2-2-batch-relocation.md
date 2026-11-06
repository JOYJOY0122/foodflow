---
title: 'Story 2.2：整批換位置'
type: 'feature'
created: '2026-11-06'
status: 'done'
baseline_commit: 'cd401c2a2688e4bda7392555190541d1d6ed7db2'
route: 'dispatch'
review_loop_iteration: 0
context:
  - '{project-root}/_bmad-output/implementation-artifacts/epic-2-context.md'
  - '{project-root}/_bmad-output/implementation-artifacts/spec-2-1-manage-storage-locations.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**問題：** 實際擺放改變時，系統顯示的批次位置無法更新，也沒有移動紀錄（FR-05、A3）。

**方案：** 在儲存位置頁展開某位置可看到該處有剩餘量的批次；管理者可把批次整批移到另一個啟用中的位置並填原因，經 `StockLedger.move` 更新目前位置並留下位置變更紀錄，數量與到期日不變。

## Boundaries & Constraints

**必要：** 端點放在 `storage_location` 模組；批次只經 `StockLedger.lock_batches` 鎖定、`move` 寫入（AD-5、AD-20），不寫數量異動。處理順序：鎖批次 → 讀來源進貨單狀態（不鎖單頭，遵守 `goods_receipt` → `inventory_batch` 的鎖序）→ 其他檢查 → 鎖目標位置（`for_update`，鎖序為 `inventory_batch` → `storage_location`）並確認啟用 → `move`。時間取自 `Clock`，以 `StockOp` 傳入，`operation_group_id` 用 `uuid4()`。寫入限管理者；查看批次清單所有登入者都可以。

**界線：** 不做部分數量移位、不做批次的異動歷程頁（Epic 4）、不加 migration、不呼叫其他模組的 Service 或 Repository。

## I/O & Edge-Case Matrix

| 情境 | 輸入／狀態 | 結果 | 錯誤 |
|---|---|---|---|
| 查看位置批次 | `GET /storage-locations/{id}/batches` | 只列 `current_location_id = id` 且 `remaining_quantity > 0`，含食材名稱、單位、批號、剩餘量、到期日、`source_status`，依到期日再依 id 排序 | 位置不存在 `404` |
| 換位置成功 | 批次在 A，B 啟用，填原因 | `200` 回批次目前狀態（新位置）；新增一筆 `batch_location_change`（A→B、操作者、時間、原因）；剩餘量與到期日不變，`inventory_transaction` 筆數不變 | — |
| 原因空白 | `reason` 缺或只有空白 | 位置不變 | `422 VALIDATION_ERROR`，`fields=[reason]` |
| 目標無效 | B 不存在或已停用 | 位置不變 | `422 RULE_VIOLATION`，`fields=[to_location_id]` |
| 同位置 | B 就是目前位置 | `200` 回批次目前狀態，不新增紀錄 | — |
| 來源已沖銷 | 來源進貨單 `REVERSED` | 位置不變 | `422 RULE_VIOLATION` |
| 已耗盡 | `remaining_quantity = 0` | 位置不變 | `422 RULE_VIOLATION` |
| 批次不存在 | 未知 id | — | `404 NOT_FOUND` |
| 員工 | 一般員工呼叫換位置 | 位置不變，介面不顯示換位置按鈕 | `403 FORBIDDEN` |

</frozen-after-approval>

## Code Map

- `backend/app/modules/inventory/ledger.py` -- `StockLedger.lock_batches`（不存在的 id 回空清單）、`move`（同位置回 `None`）、`StockOp`。`apply_move` 已處理同位置與 `DEFAULT_MOVE_REASON`。不要改。
- `backend/app/modules/inventory/ledger_sqlalchemy.py` `SqlAlchemyStockLedger(session)` -- 正式實作，在 `storage_location/dependencies.py` 組裝。
- `backend/tests/fakes/fake_stock_ledger.py` -- `FakeStockLedger.add_batch`、`move`；搭配 `FakeUnitOfWork(ledger)` 釋放鎖。
- `backend/app/db/models/inventory.py` `InventoryBatch`（`source_item`、`ingredient`、`current_location` 皆 `lazy="raise"`）、`BatchLocationChange`。`goods_receipt.py`：`GoodsReceiptItem.receipt` → `GoodsReceipt.status`。
- `backend/app/modules/storage_location/{repository,repository_sqlalchemy,service,router,schemas,dependencies,errors}.py` -- Story 2.1 已建；沿用 `lock(id)`（`for_update`）與錯誤集中在 `errors.py` 的做法。
- `backend/app/core/dependencies.py` `get_clock`；`backend/app/core/clock.py` `FixedClock`。
- `backend/tests/unit/test_api_conventions.py` `PRODUCTION_API_ROUTES` -- 加兩條路由。
- `backend/tests/integration/factories.py` -- `seed_batch`、`receive_batch`、`add_item`、`op_for`、`NOW`；`test_storage_locations.py` 的 `_client` 樣板。
- `frontend/src/features/storage_location/{api,hooks}.ts`、`pages/StorageLocationsPage.tsx`、`pages/StorageLocationsPage.test.tsx` -- Story 2.1 已建，在此擴充。
- `frontend/src/shared/api/queryKeys.ts` -- 批次清單 key 放在 `storage-locations` 底下，換位置後與 `invalidateStockQueries()` 一起失效。

## Tasks & Acceptance

**Execution:**
- [x] `backend/app/modules/storage_location/repository.py`、`repository_sqlalchemy.py` -- 新增 `list_location_batches(location_id, page, page_size)`、`load_batch(batch_id)`（`selectinload` 食材、目前位置、來源明細與單頭）、`source_status(source_item_id)`（一般讀取，不上鎖）。
- [x] `backend/app/modules/storage_location/schemas.py` -- `BatchMoveRequest`（`to_location_id: int`、`reason` 去空白後 1–500 字）、`LocationBatchResponse`（id、batch_number、ingredient_id、ingredient_name、unit、remaining_quantity 字串、expiry_date、current_location_id／code／name、source_status）、`LocationBatchList`。
- [x] `backend/app/modules/storage_location/service.py`、`errors.py` -- 新增 `BatchRelocationService(repository, ledger, uow, clock)`：`list_batches`、`move(batch_id, to_location_id, reason, operator_id)`，依 Boundaries 的處理順序與矩陣回錯；成功或同位置都回 `load_batch` 的結果。
- [x] `backend/app/modules/storage_location/dependencies.py`、`router.py` -- `GET /storage-locations/{location_id}/batches`（所有登入者）、`POST /inventory-batches/{batch_id}/location`（`require_admin`，Service 收 `admin.id`）。
- [x] `backend/tests/unit/test_api_conventions.py` -- 更新路由清單。
- [x] `backend/tests/unit/test_batch_relocation_service.py` -- `FakeStockLedger` 加 fake repository 加 `FixedClock`：矩陣中各分支，斷言失敗時 rollback、成功時紀錄的 from／to／operator／occurred_at／reason。
- [x] `backend/tests/integration/test_batch_relocation.py` -- 真實 PostgreSQL：清單只列剩餘量大於 0、成功換位置後異動筆數不變且有紀錄、各 422 與 404、員工 403、沖銷來源 422（把來源單頭狀態改成 `REVERSED`）；以兩條連線驗證「先鎖住目標位置（模擬停用中）時，換位置會等待，停用 commit 後換位置回 422」。
- [x] `frontend/src/features/storage_location/api.ts`、`hooks.ts`、`shared/api/queryKeys.ts` -- `listLocationBatches`、`moveBatch`、`listActiveLocations`（`is_active=true`、`page_size=100`，供目標選單）；`useMoveBatch` 成功後失效 `storageLocations.all` 並呼叫 `invalidateStockQueries()`。
- [x] `frontend/src/features/storage_location/pages/StorageLocationsPage.tsx` -- 每列加「查看批次」展開列（所有人），列出批次；管理者每個批次有「換位置」，開 Modal 選目標（啟用中、排除目前位置）與必填原因；錯誤標欄位並保留輸入，成功顯示訊息並關閉。
- [x] `frontend/src/shared/api/schema.d.ts` -- 以 `npm run gen:api` 重新產生（Git Bash 下找不到 `uv`／`node`，請在 PowerShell 執行）。
- [x] `frontend/src/features/storage_location/pages/StorageLocationsPage.test.tsx` -- 展開看到批次、員工看不到換位置按鈕、換位置成功送出的 body 與快取失效、422 錯誤保留原因並標欄位。

**Acceptance Criteria:**
- Given 換位置成功，when 前端收到回應，then 呼叫 `invalidateStockQueries()`，展開新位置時看得到該批次，原位置已不列出。
- Given 兩位管理者同時處理同一批次，when 一人換位置，then 另一人的請求在鎖釋放後以最新位置判斷，不會留下錯誤的 from 位置。

## Design Notes

- 鎖目標位置是為了堵住「移入 B」與「停用 B」的競態：2.1 的停用先鎖位置再數批次，因此兩者必有一方看到另一方 commit 後的結果。
- 已耗盡的批次不需要換位置，直接回 `RULE_VIOLATION`，避免已不存在的庫存留下位置紀錄。
- 換位置天然冪等：重送時目標已等於目前位置，不會產生第二筆紀錄，所以不用 `Idempotency-Key`。

## Verification

**Commands:**
- `cd backend && uv run ruff check . && uv run ruff format --check . && uv run lint-imports && uv run pytest` -- 全部通過
- PowerShell：`cd frontend; npm run gen:api; git diff --stat src/shared/api/schema.d.ts` -- 型別已更新
- PowerShell：`cd frontend; npm run lint; npx tsc --noEmit; npx vitest run; npm run build` -- 全部通過

## Implementation Notes

- 由主 session 直接實作（使用者只授權審查用 subagent）。
- `BatchRelocationService` 與 `StorageLocationService` 共用 `StorageLocationRepository`，新增 `get`（不上鎖的查詢，用在批次清單）、`list_location_batches`、`load_batch`、`source_status`。2.1 的單元測試 fake 也補上這幾個方法。
- 同位置時直接回傳，不鎖目標位置、不檢查目標是否啟用：重送時目標可能剛被停用，但批次本來就在那裡。
- router 以 dict 組 `LocationBatchResponse`：AD-5 架構測試會把 `remaining_quantity=`／`current_location_id=` 關鍵字參數視為寫入批次。
- `load_batch` 加 `populate_existing`，換位置後才會載入新的 `current_location` 關聯。
- 列鎖測試以 `pg_blocking_pids` 確認請求真的在等鎖。拿掉目標位置的鎖後，FK 插入仍會等停用 commit，但 commit 之後會回 200，所以測試能抓到缺鎖。
- 前端「查看批次」所有人都看得到，「換位置」只有管理者有；目標選單只列啟用位置（一次 100 筆），並排除目前位置。
- 審查修正：目標位置的鎖改為 `FOR NO KEY UPDATE`（新增 `lock_as_move_target`，並更新 `core/db.py` 的 `for_update` 說明），避免對向換位置死結。詳見 Review Triage Log。
- 驗證（審查前）：backend 358 passed、ruff、format、lint-imports 4 kept；frontend 115 passed、lint、tsc、build 通過，`schema.d.ts` 已重新產生。

## Spec Change Log

## Review Triage Log

第 1 輪：Blind Hunter 15 項、Edge Case Hunter 6 項、Verification Gap 2 項加 1 項其他，共 24 項。

| # | 來源 | 發現 | 判定 | 依據與處理 |
|---|---|---|---|---|
| 1 | ECH | 兩個批次對向換位置（A→B、B→A）會死結 | high → patch | 已實測確認。兩邊各對目標位置取 `FOR UPDATE`，寫入 `batch_location_change` 時 FK 檢查要對原位置取 `KEY SHARE`，雙方互相擋住。目標位置改用 `FOR NO KEY UPDATE`（`lock_as_move_target`，`for_update(key_share=True)`）：仍與停用時的 `FOR UPDATE` 互斥，但不擋 KEY SHARE。新增互換的整合測試：用舊鎖時逾時，改用新鎖後通過。 |
| 2 | ECH | 死結或序列化錯誤會變成 500 | false | 修正 1 之後，換位置的鎖只有「批次 → 目標位置」一種順序，停用與刪除只鎖位置，不會再形成循環等待。 |
| 3 | VG | 換位置成功回應的 `current_location_code`／`name` 沒有測試 | medium → patch | 拿掉 `populate_existing` 也測不出來。已補斷言，值要等於位置 B。 |
| 4 | VG、BH | 換位置後位置批次清單的快取失效沒有測試（AC 1） | medium → patch | 已補斷言：成功後原位置的批次清單會重新請求。 |
| 5 | BH、ECH | 失敗分支沒有斷言 rollback | low → patch | 已在沖銷來源、已耗盡、批次不存在三個測試補 `(0, 1)`。 |
| 6 | BH | 同批次並行測試沒有證明 commit 前請求還在等鎖，也沒驗證最終位置 | low → patch | 已補 `assert not pending.done()`、回應位置、資料庫的最終位置。 |
| 7 | BH | 查紀錄時沒有依 `batch_id` 篩選 | low → patch | 已加上篩選，與 `_counts` 一致。 |
| 8 | BH | 批次清單分頁沒有測試 | low → patch | 整合測試已補 `page=2&page_size=1`。 |
| 9 | BH、ECH、VG | 批次清單固定取 100 筆，超過的部分沒有提示 | low → patch | 實際上不常見，但修正只要直接加提示：`total` 大於顯示筆數時，提示只顯示到期日最早的 N 筆。已補測試。 |
| 10 | BH、ECH | 目標選單只取 100 個啟用位置 | low，駁回 | 一間店的位置不會超過 100 個；要修就得做伺服器端搜尋，複雜度太高。 |
| 11 | ECH | 頁碼超出範圍時，`items` 是空的、`total` 卻大於 0 | false | 前端固定請求第 1 頁。 |
| 12 | BH | 單元測試沒有保護鎖序 | low，駁回 | 沒有指出具體的失敗情境。修正 1 的整合測試已涵蓋並行行為，要保護鎖序得在 fake 記錄呼叫順序。 |
| 13 | BH | 「天然冪等」的說法不完整：重送前批次已耗盡或來源已沖銷時會回 422 | low，駁回 | 這時確實不會產生第二筆紀錄，回 422 也反映了最新狀態，矩陣的同位置列只適用於有效批次。 |
| 14 | BH | 前端沒有先擋空白原因 | false | 伺服器回 `422` 並把錯誤標在 `reason` 欄位，輸入會保留，與 2.1 的 `noValidate` 做法一致。 |
| 15 | BH | `source_status` 回傳了，介面卻沒用到 | false | 沖銷後批次剩餘量是 0，不會出現在清單裡。這個欄位是 AD-8 規定批次查詢要回傳的。 |
| 16 | BH | sprint-status 與 spec 狀態不一致 | false | 流程在 step-05 才同步成 review。 |
| 17 | BH | spec 寫的函式名稱與實作不同 | 駁回 | 修正方式是改 spec。 |
| 18 | BH | 唯讀端點也組裝了 ledger 與 clock | low，駁回 | 建構成本可忽略，沒有指出具體的損害。 |
| 19 | BH | `/inventory-batches` 路由放在 storage_location 模組，可能與 Epic 4 衝突 | false | 架構的 Capability Map 已指定這條路徑歸 storage_location；FastAPI 只要完整路徑不同就不會衝突。 |

修正後驗證：backend 359 passed、ruff、format、lint-imports 4 kept；frontend 116 passed、lint、tsc、build 通過，API 未變動，`schema.d.ts` 不需重新產生。

過程中發現：等鎖偵測迴圈原本在同一個交易裡反覆查 `pg_stat_activity`，讀到的是同一份快照，這是測試能否通過的時序問題。已改成每次輪詢後 rollback。
