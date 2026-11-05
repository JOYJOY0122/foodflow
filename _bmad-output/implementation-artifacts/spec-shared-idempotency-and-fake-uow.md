---
title: '共用 Idempotency-Key 解析與 FakeUnitOfWork'
type: 'chore'
created: '2026-11-05'
status: 'done'
baseline_commit: 'cb1818596c25d58a0d86a20025c15f4f7be79f01'
route: 'dispatch'
review_loop_iteration: 0
context:
  - '{project-root}/_bmad-output/planning-artifacts/architecture/architecture-foodflow-2026-11-05/ARCHITECTURE-SPINE.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** 領用、報廢的負責人各自解析 `Idempotency-Key`，會做出不同的錯誤格式與重送判斷，這正是 AD-8 要避免的「每個模組各發明一種機制」。Service 單元測試也沒有共用的 UnitOfWork 替身，各模組會各寫一份，而且行為與真實版不一致。

**Approach:** 在 `app/core/` 提供 `Idempotency-Key` 的 FastAPI 依賴與 AD-8 重送比對純函式，在 `tests/fakes/` 提供 `FakeUnitOfWork`，並以同一份契約測試同時驗證真實與 fake UnitOfWork。不做任何業務端點。

**Decisions:**
- 依 AD-8，`Idempotency-Key` 只給領用、報廢；確認入庫維持狀態機，不收此標頭。
- 一併提供重送比對 `check_replay(existing, requested)`：沒有既有異動為新操作；`{batch_id: quantity}` 完全相同為重放；其他情況丟 `409 DUPLICATE`。只比對，不查詢、不組回應。

## Boundaries & Constraints

**Always:** 錯誤一律走 AD-16 格式（`VALIDATION_ERROR` 422、`DUPLICATE` 409）；`FakeUnitOfWork` 與 `SqlAlchemyUnitOfWork` 的可觀察行為一致：正常結束 commit、例外 rollback 並原樣丟出、巢狀丟 `RuntimeError`。

**Never:** 不新增業務端點、不改 AD-8 規則、不改 migration、不新增錯誤碼、不新增套件。

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| 合法 key | `Idempotency-Key: <uuid>` | 依賴回傳 `UUID` | N/A |
| 缺少標頭 | 無此標頭 | 422 | `VALIDATION_ERROR`，`fields=[{field:"Idempotency-Key", message:"此欄位為必填"}]` |
| 格式錯誤 | `abc`、空字串 | 422 | 同上，message「須為 UUID」 |
| 大小寫不同 | 大寫 UUID | 視為同一把 key | N/A |
| 首次操作 | `existing=[]` | `check_replay` 回傳 `False`（新操作） | N/A |
| 重放 | 既有異動 `{1: -7, 2: -3}`，請求 `{1: 7, 2: 3.000}` | 回傳 `True`（重放） | N/A |
| 內容不同 | 數量不同、批次多或少 | 丟 `DomainError` | `DUPLICATE` 409 |
| Fake 正常結束 | 區塊無例外 | `commits == 1`，附掛的 `FakeStockLedger` 鎖已釋放 | N/A |
| Fake 例外 | 區塊丟例外 | `rollbacks == 1`，例外原樣丟出，鎖已釋放 | N/A |
| Fake 巢狀 | 區塊內再開 `transaction()` | `RuntimeError` | 外層仍正常結束 |

</frozen-after-approval>

## Code Map

- `backend/app/core/uow.py` -- `UnitOfWork` 介面與 `SqlAlchemyUnitOfWork`，Fake 須對齊其行為，不改。
- `backend/app/core/dependencies.py` -- AD-2 組裝點；`get_idempotency_key` 放這裡（router 本來就 import 它），重送比對另放純模組，讓 Service 不經 fastapi 也能用。
- `backend/app/main.py:56` -- `_field_error` 會去掉 `header` 前綴，`uuid_parsing`、`missing` 已有繁中訊息，標頭用 `Header(alias="Idempotency-Key")` 即可沿用。
- `backend/app/core/errors.py` -- `DomainError`、`ErrorCode.DUPLICATE`。
- `backend/app/modules/inventory/ledger.py:67` -- `find_operation(group_id, tx_type)`，重送查詢的來源。
- `backend/tests/fakes/fake_stock_ledger.py:55` -- `end_transaction()`，Fake UoW 結束時呼叫。
- `backend/tests/integration/test_stock_ledger_contract.py` -- 真實／fake 共用契約測試的寫法範本。
- `backend/tests/integration/test_auth_and_write.py` -- `create_app(extra_api_routers=...)` 注入測試路由的範本。

## Tasks & Acceptance

**Execution:**
- [x] `backend/app/core/idempotency.py` -- 新增 `IDEMPOTENCY_KEY_HEADER` 常數與純函式 `check_replay`，不 import fastapi -- Service 共用。
- [x] `backend/app/core/dependencies.py` -- 新增 `get_idempotency_key() -> UUID`（`Header(alias=IDEMPOTENCY_KEY_HEADER)`）-- router 共用。
- [x] `backend/tests/fakes/fake_uow.py` -- 新增 `FakeUnitOfWork(ledger: FakeStockLedger | None = None)`，記錄 `commits`、`rollbacks`，結束時釋放附掛 ledger 的鎖 -- Service 單元測試共用。
- [x] `backend/tests/integration/test_uow_contract.py` -- 真實與 Fake 跑同一份 UnitOfWork 契約測試。
- [x] `backend/tests/integration/test_idempotency.py` -- 以測試路由驗證 I/O 矩陣的標頭案例與 OpenAPI 宣告。
- [x] `backend/tests/unit/test_idempotency.py` -- 測 I/O 矩陣的 `check_replay` 案例。

**Acceptance Criteria:**
- Given 測試路由使用 `get_idempotency_key`，when 產生 OpenAPI，then 該操作宣告必填標頭 `Idempotency-Key`，格式為 `uuid`。
- Given 全部變更，when 跑 pytest、ruff、lint-imports，then 全數通過且既有 230 項不受影響。

## Implementation Notes

- 未派實作 subagent，直接依 spec 實作（範圍小）。
- `/api/v1` 預設掛 `get_current_employee`，標頭測試以 `dependency_overrides` 略過登入。
- `RecordedDeduction` 用 Protocol，`core/idempotency.py` 不 import `app.db.models`。
- 驗證：pytest 262 passed（原 230＋新增 32，含審查後補的 1 項）、ruff check／format、lint-imports 4 kept。反向檢查：Fake 不釋放鎖 → 2 failed；Fake 吞掉例外 → 5 failed。

## Spec Change Log

## Review Triage Log

三層：Blind（B，10 項）、Edge Case（E，6 項）、Verification Gap（無缺口）。

| # | 發現 | 判定 | 依據／處理 |
|---|------|------|-----------|
| B1+E2 | FEFO 領用重送時重新分配批次會誤判 409 | false | AD-12：`POST /issues` 一律送明確 `lines`（ManualStrategy 驗證），requested 來自請求本身；`find_operation` 不受鎖定結果影響。 |
| B2+E1 | 同一把 key 跨 ISSUE／WASTE 重用不會被擋 | low，reject | 前端每個表單一把 v4 key，跨端點重用只有用戶端錯誤才會發生；AD-8 規定依 `(key, type)` 查詢。 |
| B3 | 重送比對不檢查操作者 | low，reject | 需要 v4 碰撞或刻意共用 key；AD-8 未要求。 |
| B4 | 缺共用重放回應 helper、狀態碼未定 | false | AD-8 已定首次與重放都回 200；回應格式各模組不同（AD-12 為領用格式），屬業務端點。 |
| B5 | 同 key 並行、批次不相交時兩邊都通過 | low，reject | 領用鎖定整個食材的批次，同內容的重送必然互斥；內容不同又同 key 只有用戶端錯誤會發生。 |
| B6+E4 | 接受 nil UUID 等格式 | low，reject | 前端以 `uuid` 套件產生 v4，不會出現 nil；需新增分支與訊息。 |
| B7 | Fake rollback 不還原資料 | low，reject | spec Design Notes 已決定並記錄；原子性由真實 UoW 的整合契約測試保證。 |
| B8 | Fake 側契約近乎同義反覆；RealHarness 殘留資料 | false | 共用的例外傳遞、巢狀、釋放鎖都是真實比對；`clean_tables` autouse 每個測試前後清空。 |
| B9 | DUPLICATE 測試沒斷言訊息 | low，patch | 已補 message 與 status_code 斷言。 |
| B10 | 無型別檢查確認 InventoryTransaction 符合 Protocol | low，patch | 專案無 mypy；已補以 `FakeStockLedger.find_operation` 結果餵 `check_replay` 的測試。 |
| E3 | requested 含 0 或負數時當成新操作 | false | 請求經 `PositiveQuantity` 驗證，到不了這裡。 |
| E5 | 兩個 Idempotency-Key 標頭只取其一 | low，reject | 需用戶端送重複標頭，日常不會發生。 |
| E6 | `FakeUnitOfWork()` 未附掛 ledger 時不釋放鎖 | low，reject | 不用 ledger 的 Service 也會用 Fake UoW，不能設為必填；docstring 已示範附掛用法。 |

## Design Notes

- Fake 無法還原 ledger 的狀態：rollback 只記錄次數並釋放鎖，不撤銷已寫入 `FakeStockLedger` 的異動；文件註明「斷言 `rollbacks == 1`，不要斷言 fake 資料已還原」。

## Verification

**Commands:**
- `cd backend && uv run pytest -q` -- expected: 全過
- `cd backend && uv run ruff check . && uv run lint-imports` -- expected: 通過
