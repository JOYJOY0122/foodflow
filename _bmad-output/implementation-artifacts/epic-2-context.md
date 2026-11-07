# Epic 2 Context: 儲存位置與整批換位置

<!-- Compiled from planning artifacts. Edit freely. Regenerate with compile-epic-context if planning docs change. -->

## Goal

讓管理者維護食材的實際存放處（例如冷藏庫 A、冷凍庫 B、常溫架 C），收貨時可登記批次位置、員工找得到食材；實際擺放改變時，管理者可把批次整批移到另一個位置，系統保留前後位置、原因、操作者與時間，數量與到期日不變。負責人 Ken，`storage_location` 模組，分支 `feat/storage-location`。

## Stories

- Story 2.1: 管理儲存位置
- Story 2.2: 整批換位置

## Requirements & Constraints

- 位置欄位：識別碼、位置代碼、名稱、儲存類型（冷藏、冷凍、常溫）、說明（選填）、啟用狀態。儲存類型與食材的「保存方式」是分開記錄的兩件事。
- 代碼唯一；名稱與儲存類型必填。新增後預設啟用。
- 有剩餘量大於 0 的批次的位置不能停用；只放過已耗盡批次的位置可以停用。
- 被進貨明細、批次或位置變更紀錄引用的位置不能刪除，只能停用；從未被引用者可刪除。
- 進貨只能選啟用中的位置（其他模組以「只列啟用」條件查詢）。
- 權限：管理者可新增、修改、停用、刪除；一般員工只能查詢。權限在伺服器端驗證，前端角色判斷只影響顯示。
- 一個批次只有一個位置，不做部分數量移位；整批換位置須填原因，不產生數量異動。
- 錯誤回饋要指出欄位並保留已填內容；未確認成功不顯示完成。
- 用語用 SRS 名詞（領用、儲存位置）；不在首版範圍的功能不出現在程式與文件。

## Technical Decisions

- **分層：** `modules/storage_location/` 內分 `router.py`、`schemas.py`、`service.py`、`repository.py`（ABC）、`repository_sqlalchemy.py`、`dependencies.py`。具體類別只在 `dependencies.py` 組裝；交易邊界在 Service（經 UnitOfWork），Repository 不 `commit`。
- **資料表擁有權：** `storage_location` 只有本模組可寫。`inventory_batch.current_location_id` 與 `batch_location_change` 只能經 `inventory.StockLedger` 寫入（`lock_batches` 後 `move(batch, to_location_id, op)`，同位置回 `None`）。讀取不受限，可 `SELECT`／`JOIN` 其他表判斷引用與剩餘量。
- **跨模組相依：** 只能用 `StockLedger` 與 `auth.dependencies` 的 `get_current_employee`、`require_admin`；不可呼叫其他模組的 Service 或 Repository。
- **API：** 資源路徑 `/api/v1/storage-locations`；換位置為 `POST /api/v1/inventory-batches/{id}/location`。JSON 欄位 snake_case，清單回 `{items, total, page, page_size}`，列舉值定義在 `core/enums.py`。
- **錯誤：** Service 丟 `DomainError(code, message, details, fields)`；代碼重複 `409 DUPLICATE`、被引用 `409 REFERENCED`、缺漏 `422 VALIDATION_ERROR`、規則違反 `422 RULE_VIOLATION`、權限 `403 FORBIDDEN`。Repository 以 `flush_or_raise` 依 constraint 名稱把 `IntegrityError` 轉成 `DomainError`。
- **實體：** relationship 一律 `lazy="raise"`，需要的關聯由 Repository `selectinload`。Schema 變更只能經 Alembic。
- **換位置規則：** 來源進貨單為 `REVERSED` 的批次不可換位置（`422 RULE_VIOLATION`）；位置變更不阻擋沖銷。時間取自 `Clock`，以 `StockOp.occurred_at` 傳給 Ledger。
- **前端：** feature 資料夾 kebab-case；元件只透過 `features/<f>/hooks.ts` 取資料；query key 集中在 `shared/api/queryKeys.ts`；換位置成功後呼叫 `invalidateStockQueries()`。型別由 OpenAPI 產生的 `shared/api/schema.d.ts`，改 API 後重新產生並提交。Mantine 預設元件，操作目標至少 44px、不依賴 hover。
- **測試：** Service 單元測試用 fake Repository、`FakeStockLedger`、`FixedClock`；涉及列鎖的寫入要有真實 PostgreSQL 整合測試。
- **已知限制：** 停用位置的「檢查後寫入」競態已列為延後處理，記入測試報告的已知限制。

## Cross-Story Dependencies

- 2.2 依賴 2.1 的位置清單與「只列啟用」查詢，以及位置頁（2.2 在位置頁展開位置看批次）。
- Epic 3（進貨）選位置時依賴 2.1 的「只列啟用」查詢；2.1 的停用與刪除判斷需要讀進貨明細、批次、位置變更紀錄，這些表已存在於骨架 migration。
- Epic 4、Epic 7 的位置篩選會讀位置清單。
