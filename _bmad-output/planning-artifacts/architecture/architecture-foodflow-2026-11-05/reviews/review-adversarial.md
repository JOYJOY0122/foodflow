---
title: 對抗式架構審查：ARCHITECTURE-SPINE
target: ARCHITECTURE-SPINE.md（status draft，2026-11-05）
references: [docs/srs.md, docs/team-tasks.md, CONTRIBUTING.md]
reviewed: 2026-11-05
verdict: 方向可行，但高嚴重度項目未補前，不宜當 11/6 骨架的平行開發契約
---

# 對抗式架構審查

## 判定

分層、擁有權、鎖順序與防重送的大方向都站得住，**死結與「超領」的主要路徑也確實被擋住**（見「查過沒問題」）。問題在於主幹定了「誰可以寫」，卻沒定「怎麼呼叫」：`StockLedger` 沒有介面、可用量只有批次層級的定義、重送的檢查順序寫反。四位開發者各自完全合規，仍會在 11/11 整合日撞在一起，其中 F-02 會靜默寫錯庫存。

建議 11/6 骨架前先補 **F-01～F-06**，都是一兩段文字或幾十行程式。中、低項目可在骨架推上去時順便定。

| 編號 | 嚴重度 | 主題 | 衝突單位 |
| --- | --- | --- | --- |
| F-01 | 高 | `StockLedger` 只有規則沒有介面 | goods_receipt、issue、waste、stocktake、storage_location |
| F-02 | 高 | 鎖後仍讀到舊值（AD-3 × AD-7） | waste／issue／stocktake × StockLedger |
| F-03 | 高 | `operation_group_id` 對入庫、沖銷、盤點未定 | schema × goods_receipt × stocktake × reports |
| F-04 | 高 | 重送檢查順序與查詢條件 | issue × waste × 前端 alerts |
| F-05 | 高 | 可用量與低庫存沒有彙總層定義 | inventory × alerts × issue |
| F-06 | 高 | UnitOfWork 與 `get_current_employee` 共用 Session | core/uow × auth |
| F-07 | 中 | 重放回應形狀與 `lazy="raise"` | Service × router × 前端 |
| F-08 | 中 | Alert、NotificationResult 與跨 feature 動作 | alerts × waste／issue／goods_receipt 前端；C1、C3 |
| F-09 | 中 | 非 FEFO 判定：前端需要但 AD-9 禁止計算 | 前端 issue × IssueService |
| F-10 | 中 | 報表公式與 REVERSAL 歸類 | reports × goods_receipt × waste |
| F-11 | 中 | 已沖銷批次可被盤點「復活」 | goods_receipt × stocktake |
| F-12 | 中 | `FixedClock` 讓所有 JWT 立即過期 | auth × AD-10 demo 模式 |
| F-13 | 中 | 錯誤轉換與 `details` 形狀 | Repository × Service × 前端 |
| F-14 | 中 | C1～C5 與原始碼結構不一致 | 全體；C 文件評分 |
| F-15 | 低～中 | 11/6 骨架必須給出、主幹未定的介面清單 | 全體 |

## 驗證方式

F-02、F-06、F-12 與 F-15 的 Decimal 項目，已用與 Stack 相同版本（SQLAlchemy 2.1.8、PyJWT 2.15.1）在暫存環境實跑最小重現，結果引在各項中。環境是 Python 3.11 與 SQLite，所以**只驗證 ORM 與函式庫行為**；所有 PostgreSQL 列鎖、併發行為都是依官方文件推論，尚未實測，應由主幹已要求的 `foodflow_test` 整合測試確認。專案目前沒有程式碼，本審查只針對文件。

---

## 高嚴重度

### F-01　高｜`StockLedger` 只有規則沒有介面

**單位：** goods_receipt（ChiaJungTien）、issue 與 storage_location（Ken）、waste 與 stocktake（郭明儒）。

**如何合規卻衝突：** AD-5 只規定 Ledger 必須做到什麼，沒有任何方法簽章。以下寫法都合規，組合起來卻壞掉：

| 未定的點 | 甲的合規理解 | 乙的合規理解 | 結果 |
| --- | --- | --- | --- |
| 誰上鎖 | waste 認為 Ledger 內部上鎖（AD-4 的 Ledger 是批次寫入者） | Ledger 依 AD-5「變動前必須已上鎖」，假設呼叫者已鎖 | 完全沒鎖，併發時超扣 |
| 鎖查詢放哪 | AD-4 禁止呼叫他人 Repository，所以四個模組各寫一份 `FOR UPDATE` | — | 四份鎖查詢，條件與排序各自維護 |
| 數量正負 | issue 傳 `quantity=3`，預期 Ledger 轉負 | Ledger 依 AD-5 接收 `quantity_delta` | 領用變成加庫存 |
| 建批次 | goods_receipt 傳哪些欄位、批號誰產生（`B-{item.id}`） | Ledger 自行讀 `goods_receipt_item`，或要求傳值 | 介面對不上 |
| 回傳值 | waste 需要 `transaction.id` 寫 `waste_record` | Ledger 回 `None` | 報廢無法連到異動 |
| 操作時間 | 各模組各呼叫 `clock.now()` | Ledger 自注入 Clock | 同次操作跨午夜時 `waste_record` 與異動落在不同日 |
| 所在層 | AD-2 要求型別為介面，但結構樹只有 `inventory/ledger.py` | AD-6 說 Ledger 可 `flush`，AD-1 禁止 Service 碰 `sqlalchemy`，Ledger 屬哪層未定 | import-linter 契約寫不出來；C4 若 SQL 在 ledger 內就漏列；Service 單元測試沒有 fake 可用 |

**修法（收緊 AD-5，新增 AD-20）：** 把介面寫進主幹，11/6 由 Ken 連同空實作推上去：

```python
@dataclass(frozen=True)
class StockOp:                       # 同次操作共用，時間只取一次
    operation_group_id: UUID
    operator_id: int
    occurred_at: datetime            # Service 以 clock.now() 取一次後傳入
    reason: str | None = None

class StockLedger(ABC):              # modules/inventory/ledger.py
    # 鎖：唯一入口，依 id 遞增，內部強制 populate_existing（F-02）
    def lock_batches(self, batch_ids: Sequence[int]) -> list[InventoryBatch]: ...
    def lock_ingredient_batches(self, ingredient_id: int) -> list[InventoryBatch]: ...
    # 防重送查詢（F-04）
    def find_operation(self, group_id: UUID, tx_type: TransactionType) -> list[InventoryTransaction]: ...
    # 變動：quantity 一律 > 0，正負由 Ledger 決定；皆回傳已 flush 的紀錄
    def receive(self, item: ReceiptLine, op: StockOp) -> InventoryTransaction: ...   # 建批次＋RECEIPT
    def deduct(self, batch, quantity, tx_type, op, is_non_fefo=False) -> InventoryTransaction: ...  # ISSUE|WASTE
    def adjust(self, batch, actual_quantity, op) -> InventoryTransaction | None: ...  # 無差額回 None
    def reverse(self, original: InventoryTransaction, op: StockOp) -> InventoryTransaction: ...
    def move(self, batch, to_location_id, op) -> BatchLocationChange | None: ...      # 同位置回 None
```

- `SqlAlchemyStockLedger` 放 `inventory/ledger_sqlalchemy.py`，只由 `inventory/dependencies.py` 的 `get_stock_ledger` 建立。import-linter 只放行跨模組 import `modules.inventory.ledger` 與該 provider。
- Ledger 每請求一個實例，記住本次鎖過的 id；`deduct`、`adjust`、`reverse`、`move` 遇到未鎖的批次直接丟例外。這條 3 行的防線可以把「忘了鎖」從併發時才出現的錯，變成每次都失敗。
- `occurred_at` 同時寫入 `goods_receipt.confirmed_at`、`waste_record` 的時間欄位。AD-2 綁定的 Clock 因此從 Ledger 移除。

### F-02　高｜鎖後仍讀到舊值：AD-3 與 AD-7 合起來會靜默寫錯庫存

**單位：** waste／issue／stocktake 的 Service × StockLedger。

**如何合規卻衝突：** 這類程式碼很自然，而且逐字符合 AD-7（判斷依據確實在鎖之後）：

```python
batch = repo.get_batch(batch_id)            # 先查，不存在回 404
locked = repo.lock_batch(batch_id)          # with_for_update
if quantity > locked.remaining_quantity:    # 「鎖後才檢查」
```

但 Session 的 identity map 已經有這個物件。一般 `select(...).with_for_update()` **不會更新已載入的屬性**。實測（SQLAlchemy 2.1.8）：批次 8，鎖前讀過，他人提交成 2，重查：

```text
requery without populate_existing q = 8.000
requery with populate_existing q = 2.000
```

**後果：** 實際剩 2、領 4，檢查通過，Ledger 以 `8 - 4` 寫回 `remaining_quantity = 4`，庫存憑空增加，`quantity_before` 也是錯的。結果非負，`CHECK` 擋不住，也不一定有錯誤訊息，正是 NFR-02、SM-2 要防的情況。而且只在時序剛好時發生，一般測試抓不到。

**修法（收緊 AD-7）：** 列鎖只能透過 `StockLedger.lock_*`，內部固定 `execution_options(populate_existing=True)`，不可在其他 Repository 寫 `with_for_update`（可用 Ruff 或 grep 檢查）。同時明文交易隔離固定為 `READ COMMITTED`，因為「鎖後查 key」依賴逐句快照。併發整合測試必須涵蓋「鎖前先讀同一批次」的情境。

### F-03　高｜`operation_group_id` 與唯一鍵對入庫、沖銷、盤點未定

**單位：** Ken 的 schema × goods_receipt × stocktake × reports。

**如何合規卻衝突：** AD-8 只定了領用與報廢使用 key，但 SRS 第 8 節的「庫存異動」每筆都有「操作群組」。

- schema 設 `NOT NULL`（欄位語意如此），goods_receipt 依 AD-8 沒有 key 而傳 `None`：確認入庫全數失敗。
- 或 goods_receipt 為了把整張單串起來，用固定值（例如由單據 id 推導的 UUID）當群組；沖銷時沿用同一個以便關聯：`(group, batch)` 與原 RECEIPT 相同，**唯一鍵衝突，沖銷永遠失敗**。
- 或 schema 設可為 NULL：PostgreSQL 的 NULL 彼此不相等，唯一鍵不生效。對入庫無害，但 reports 的「同次操作」分組與來源單據判斷要分兩套邏輯，且領用若漏帶 key 也不會被擋。
- 同一請求對同一批次送兩行：撞唯一鍵後變 500，而不是 422。

**修法（收緊 AD-8）：** 欄位 `UUID NOT NULL`，Ledger 介面必填。補一張表：

| 操作 | group 來源 | 同 group 的列 |
| --- | --- | --- |
| 領用、報廢 | `Idempotency-Key` | 同次各批次一列 |
| 確認入庫 | Service `uuid4()` | 整張單各批次一列 |
| 沖銷 | **新的** `uuid4()`，靠 `reverses_transaction_id` 連回原紀錄 | 整張單各批次一列 |
| 盤點 | 每次確認新的 `uuid4()` | 同次各批次一列 |

防重送的機制仍依 AD-8 三分法，非 key 操作的 group 只作分組用途，不可拿來判斷重送。領用與盤點的明細，同一批次重複時回 422。

### F-04　高｜重送檢查順序與查詢條件

**單位：** issue、waste × 前端 alerts。

**如何合規卻衝突：**

1. **順序。** AD-7 寫「所有檢查（剩餘量、效期、FEFO 基準、防重送）都在取得鎖之後」，把防重送列在最後。照此順序：第一次已把批次領光（或跨午夜後批次過期），回應遺失後重試，先撞剩餘量或效期檢查，得到 `409`／`422`，而不是 AD-8 承諾的 200。使用者會以為失敗而重做。領用的情況更隱微：`remaining > 0` 的鎖集合可能已為空，若實作成「沒候選就報不足」也會提早失敗。
2. **查詢條件。** AD-8 寫「查此 key」，唯一鍵卻是 `(key, batch)`。issue 必須只查 key（重送時分配可能不同）；waste 可以合法地查 key 或 `(key, batch)`。
3. **一鍵報廢。** alerts 清單上多個批次，若 `useIdempotencyKey` 掛在頁面層（AD-8 的「表單實例」沒定義這種情況），A 成功尚未換 key 就點 B：查 key 的實作回「200 與 A 的結果」，**B 沒有報廢但畫面顯示完成**，違反 NFR-05。主幹把這個偵測列為 Deferred，理由是「前端已在內容變更時換 key」，但這個情境正是前端可能換不到 key 的時候。

**修法（收緊 AD-7、AD-8）：**

- 固定順序：取鎖 → **防重送** → 其他檢查。重放分支必須在任何庫存、效期檢查之前返回。
- 查詢一律 `ledger.find_operation(key, type)`，條件是 key＋異動類型。
- 查到後比對 `{batch_id: quantity}`，不同則回 `409 DUPLICATE`。這已由異動列提供資料，約 5 行，建議從 Deferred 移除。
- 一鍵報廢：每次開啟確認對話框是一個表單實例，產生一把 key。

### F-05　高｜可用量與低庫存沒有彙總層定義

**單位：** inventory（ChiaJungTien）、alerts（謝文佳）、issue（Ken）。

**如何合規卻衝突：** AD-11 只統一了**單一批次**的效期判定。可用量的合計與低庫存判定由各自的 Repository 實作，因為 AD-4 禁止互相呼叫 Repository。FR-13 卻要求首頁與庫存總覽兩處都顯示同一提醒。分歧點：

| 情境 | inventory 的合規寫法 | alerts 的合規寫法 | 結果 |
| --- | --- | --- | --- |
| 食材完全沒有批次或剩餘量都是 0 | LEFT JOIN，可用量 0，低庫存 | `AlertContext` 從「`remaining > 0` 的批次」載入 | **應提醒卻沒提醒**；SM-3 明列零庫存邊界 |
| 依位置篩選（FR-08、FR-14 皆有） | FR-08 要求只合計該位置，再拿這個數比安全量 | 全店量判定 | 同一食材總覽顯示低庫存、首頁沒有；或冷藏庫 A 篩選下誤報 |
| 位置篩選下的低庫存項目 | — | 食材沒有批次在該位置時是否顯示，未定 | 顯示結果不一致 |
| 停用食材（FR-03：仍可領用報廢，不能進貨） | 列入低庫存 | 過濾 `is_active` | 提醒無法照做（不能補貨）且兩邊不一致 |

**修法（新增 AD-21）：**

- 新增 `app/domain/stock.py`：`is_low_stock(available, safety)`、`shortfall(available, safety)`，是唯一定義。
- 新增唯讀共用查詢 `app/db/queries/stock_levels.py`：`stock_level_stmt(today, location_id=None)`，從 `ingredient` LEFT JOIN 批次，回傳實體量、可用量、過期量。AD-4 增列「共用唯讀查詢可被任何 Repository 使用」。
- 規則：**低庫存一律以全店可用量判定**，不受位置篩選影響。位置篩選只影響顯示的數量；低庫存項目在有位置篩選時，僅在該食材有批次（`remaining > 0`）位於該位置才顯示。
- `[ASSUMPTION，待 Ken 確認]` 停用食材不產生低庫存提醒，但其批次仍產生效期提醒。SRS 未明文。
- issue 的 `INSUFFICIENT_STOCK.details.available_quantity` 用鎖內候選批次合計，定義相同。

### F-06　高｜UnitOfWork 與 `get_current_employee` 共用 Session

**單位：** `core/uow.py`（Ken）× auth（謝文佳）。

**如何合規卻衝突：** AD-6 要求同一請求共用 Session，AD-15 要求每個請求由 `get_current_employee` 查資料庫。兩者都走 `get_session`，FastAPI 依賴快取讓它們拿到同一個 Session。查詢觸發 autobegin。接著最直覺的 UoW 實作 `with session.begin():` 會出錯。實測：

```text
begin after autobegin: InvalidRequestError A transaction is already begun on this Session.
```

代表**所有需要登入的寫入 API 全部失敗**。錯誤很明顯，但會在 11/7 auth 接上時才爆發，此時大家已依舊 UoW 開發。更糟的「修法」是改成 `begin_nested()`：SAVEPOINT 釋放後外層交易沒有提交，寫入在 Session 關閉時全部消失，且 API 回 200。

**修法（收緊 AD-6）：** 明文指定實作：

```python
@contextmanager
def transaction(self):
    try:
        yield
        self._session.commit()
    except Exception:
        self._session.rollback()
        raise
```

並規定 `get_session` 只負責 `close()`，不提交；Service 不得巢狀使用 `transaction()`（可在 UoW 內放旗標，巢狀時丟例外）；不用 `begin_nested`。骨架必須附一個整合測試：帶登入 cookie 打一個寫入端點，並用獨立 Session 確認資料確實落地。

---

## 中嚴重度

### F-07　中｜重放回應形狀與 `lazy="raise"`

**單位：** Service × router × 前端。

**如何合規卻衝突：**

- AD-8「回 200 與原結果」沒定義原結果如何重建。領用**沒有單據表**，首次回應來自剛建立的物件，重放只能從異動列重建。首次回傳的 `remaining_quantity` 若取自批次，重放就會顯示目前量；前端對同一請求看到兩個值。
- AD-3 的 `lazy="raise"`：Service 回傳實體，router 以 `from_attributes` 轉 Pydantic 並讀 `batch.ingredient.name`，首次路徑若已載入可過，重放路徑沒載入就 500。Service 回傳什麼（實體或結果物件）主幹未定。
- 首次回 201 或 200 未定。

**修法（收緊 AD-8、AD-3）：**

- 寫入端點首次與重放都走同一個方法：`_load_result(group_id)` 在交易內從已持久化的列讀取，包含需要的關聯。數量取自 `quantity_after`，不取批次目前值。
- 寫入端點一律回 200（已與 AD-8 重放結果一致）。
- 領用回應固定：`{operation_group_id, lines: [{transaction_id, batch_id, batch_number, quantity, quantity_after, is_non_fefo, reason}]}`。
- Service 回傳實體時，**必須已載入 router 需要的關聯**，或回傳 dataclass。確認入庫的重放回傳單據目前狀態即可，因為狀態機沒有快照需求。

### F-08　中｜Alert、NotificationResult 與跨 feature 動作

**單位：** alerts（謝文佳）× waste、issue、goods_receipt 前端；C1、C3。

**如何合規卻衝突：**

- `Alert` 無欄位定義，但批次型（批號、位置、到期日、剩餘天數）與低庫存型（可用量、安全量、缺口）形狀不同。
- `NotificationResult` 同時要當站內項目的載體（AD-14 投遞管道就是 API 回應）與外部投遞結果（C3 的 Email）。
- AD-14 規定由 `InAppNotifier` 決定可用動作，那新規則必然要改 `InAppNotifier`，**與 C1「`Notifier` 不用改」矛盾**，也與 NFR-08 衝突。
- 動作形狀未定。謝文佳可能回 URL 字串，郭明儒的報廢頁期待別種參數。後端也不該知道前端路由。
- AD-14 禁止 GET 觸發外部通知，但 `AlertService` 只注入單一 `Notifier`：C3 若在組裝點換成 Email，GET 就會寄信。
- 一鍵報廢的數量：API 傳 `all` 還是明確數量未定。

**修法（收緊 AD-13、AD-14）：**

```python
@dataclass(frozen=True)
class AlertAction:
    type: Literal["ISSUE", "WASTE", "CREATE_GOODS_RECEIPT"]
    ingredient_id: int
    batch_id: int | None = None
    quantity: Quantity | None = None      # 一鍵報廢帶快照剩餘量
    reason_code: str | None = None        # 一鍵報廢帶 EXPIRED

@dataclass(frozen=True)
class Alert:
    kind: AlertKind
    rank: int
    ingredient_id: int
    ingredient_name: str
    unit: str
    batch: BatchAlertInfo | None          # 批次型
    stock: StockAlertInfo | None          # 低庫存型
    actions: tuple[AlertAction, ...]      # 由規則宣告，新增規則不動 Notifier
```

- `NotificationResult(delivered: int, items: tuple[Alert, ...])`：站內回 items，外部回 `items=()`。
- `AlertService.evaluate()` 只計算；`list_alerts()` 呼叫 `evaluate()` 加站內 Notifier。C3 的 job 呼叫 `evaluate()` 再呼叫 `EmailNotifier`，不靠替換 GET 路徑的 Notifier。
- 報廢 API 只收明確數量，不提供「全部」語意。UJ-3 本來就要員工確認數量；若快照已過時，由後端回 409。
- 前端在 `shared/routes.ts` 將 `AlertAction` 對應到路由與 query 參數，由三個 feature 共同遵守。一鍵報廢使用 `features/waste` 匯出的 hook（AD-17）。

### F-09　中｜非 FEFO 判定：前端需要，但 AD-9 禁止計算

**單位：** 前端 issue × IssueService（同為 Ken，但影響 demo 流程與 B 文件 use case）。

**如何合規卻衝突：** `reason` 必填與否取決於「明細量 > 鎖內基準量」，但 AD-9 規定前端不做數量運算，也沒有端點回答「這些明細是否非 FEFO」。前端只能：(a) 違反 AD-9 自行比較；或 (b) 送出後收 422 才知道要填。此外，就算照建議送出，如果其間進了更早到期的新批次，鎖內基準已改變，沒填原因也會收到 422，前端必須能處理。

**AD-12 邊界檢查結果：** 以 A 5 公斤（早）、B 8 公斤（晚）為例，規則本身一致：

| 提交 | 基準 | 判定 | 符合 SRS |
| --- | --- | --- | --- |
| A:3 | A:3 | 無 | 是 |
| B:1 | A:1 | B 非 FEFO | 是（第 9 節） |
| A:2＋B:4 | A:5、B:1 | 只有 B 非 FEFO | 是，原因放在該筆 |
| A:5＋B:1 | A:5、B:1 | 無 | 是 |
| 同到期日，選進貨較晚者 | 基準選較早者 | 非 FEFO | 符合 FR-10「偏離建議順序」，但名詞定義寫「最早到期批次」，兩處有落差 |

**修法（收緊 AD-12）：**

- 建議端點 `POST /issues/suggestions` 接受可選 `lines`，回傳每行 `is_non_fefo`。前端依此顯示原因欄位，不自行比較。送出後的 422 仍要能處理：`RULE_VIOLATION`，`fields` 指向 `lines.N.reason`。
- 明文裁定同到期日也算非 FEFO（依 FR-10，規則單純），寫入測試。若小組認為只要到期日相同就不算偏離，必須現在決定，否則影響期末遵循率報表。
- 明文錯誤碼。`ManualStrategy` 只收已過濾的候選，無法區分原因，所以由 `IssueService` 在過濾前判定：批次不存在或屬於其他食材回 `404`／`422`，過期回 `422 RULE_VIOLATION`，超過剩餘量（含 0）回 `409 INSUFFICIENT_STOCK`。

### F-10　中｜報表公式與 REVERSAL 歸類

**單位：** reports（郭明儒）× goods_receipt（ChiaJungTien）× waste。

**如何合規卻衝突：**

- AD-5 只寫 `REVERSAL` 以 `reverses_transaction_id` 連回，沒有資料庫層強制。goods_receipt 若寫出沒有連結的 REVERSAL，reports 依原紀錄類型歸類時它不屬於任何項目，`期初＋淨進貨－淨領用－淨報廢＋調整＝期末` 就不成立。
- 主幹沒有規定報表的計算依據。reports 用 `goods_receipt` 的進貨日期算進貨量，就違反 FR-18「沖銷於實際確認當日反映」及第 5 節第 7 點；用 `waste_record.quantity` 算報廢量也合規，但與異動表可能分歧。
- 報廢時間若由 `waste_record` 與異動各取一次 Clock，午夜前後會落在不同日，「展開明細核對」對不上（已由 F-01 的 `StockOp.occurred_at` 解決）。
- FR-17 的「原因」：waste 把原因只存在 `waste_record`，reports 讀 `inventory_transaction.reason` 就是空的。

**修法（收緊 AD-5、AD-9，或新增報表規則）：**

- 加約束 `CHECK ((type = 'REVERSAL') = (reverses_transaction_id IS NOT NULL))`。
- `quantity_delta` 帶正負號，首版只有進貨可沖銷，歸類規則：`COALESCE(原紀錄.type, type)`。
- FR-18 統計的**數量**一律只來自 `inventory_transaction`，依 `occurred_at` 落區間；期初＝區間前 `SUM(quantity_delta)`；金額與原因分布來自 `waste_record`。
- `inventory_transaction.reason` 每種類型都寫入可顯示文字。報廢寫原因文字，另保留 `waste_record.reason_code`。
- 列表排序以 `id` 作次要鍵：`FixedClock` 下所有異動同一時間。
- 新增跨模組整合測試：`SUM(quantity_delta) == remaining_quantity`（NFR-03）及報表恆等式。這一個測試可抓出多數分歧，建議 11/11 整合日前完成。

### F-11　中｜已沖銷批次可被盤點「復活」

**單位：** goods_receipt × stocktake。

**如何合規卻衝突：** 沖銷後批次剩餘量 0，狀態記在 `goods_receipt`，批次本身沒有狀態。stocktake 依 FR-16 可調整任何批次（剩餘量 0 的批次盤點找到貨是合法需求），AD-8 只比對 `expected_quantity`。管理者對已沖銷批次輸入 5：**作廢單據的批次又有庫存**，可領用、可預警，SRS「再重建正確單據」後庫存重複。

另外，「尚無後續異動」的定義未明文：`remaining == initial` 與「沒有非 RECEIPT 異動」會有不同結果（領 1 再盤 +1 時前者通過）；位置變更算不算也未定。

**修法（收緊 AD-8 或 AD-5）：**

- 沖銷判定固定為鎖內查詢：該單所有批次**不存在 `type <> 'RECEIPT'` 的異動**。位置變更不寫異動，不阻擋沖銷。
- 盤點與換位置在鎖內檢查來源單據狀態，`REVERSED` 時回 `422 RULE_VIOLATION`。或在 `StockLedger.adjust`、`move` 內統一檢查。
- 批次查詢回傳 `source_status`，FR-09 才能區分「耗盡」與「已沖銷」。

### F-12　中｜`APP_FIXED_NOW` 讓所有 JWT 立即過期

**單位：** auth（謝文佳）× AD-10 的 demo 模式；影響 11/18 的 demo。

**如何合規卻衝突：** AD-10 規定除 `SystemClock` 外不可用系統時間，所以 auth 合規地用 `clock.now() + 8h` 產生 `exp`。但 PyJWT 解碼時以**真實時間**驗證。SRS 端到端示例的日期是 2026/10/31，已早於今天。實測：

```text
decode: ExpiredSignatureError Signature has expired
```

代表設了 `APP_FIXED_NOW` 後**登入成功但下一個請求就 401**，而 C5 的手動驗收與 demo 跨日正是依賴這個設定。反過來把 `exp` 改用真實時間，又違反 AD-10。

**修法（收緊 AD-10、AD-15）：** `jwt.decode(..., options={"verify_exp": False})`，再由 `get_current_employee` 以注入的 Clock 比較 `exp`，簽發與驗證同一時間來源。Cookie 不設絕對 `Expires`（瀏覽器用真實時間），以 session cookie 或 `Max-Age` 為準。把「`APP_FIXED_NOW` 下可登入並完成一次寫入」加進 C5 驗收。

### F-13　中｜錯誤轉換與 `details` 形狀

**單位：** Repository × Service × 前端 `client.ts`。

**如何合規卻衝突：**

- AD-1 禁止 Service import `sqlalchemy`，所以 Service 接不到 `IntegrityError`。master_data 的重複名稱、帳號（`DUPLICATE`）、`source_item_id` 最後防線都會變成 500，AD-16 也沒有對應的處理器。每個人可能各想一種解法（事前查詢仍有競態）。
- `INSUFFICIENT_STOCK.details`：AD-7 要求「最新可用量」，Ledger 只知道單批次剩餘量，issue 需要食材可用量（FR-11），waste 需要批次剩餘量。前端依 `details` 顯示時無法通用。
- AD-16 說型別由 OpenAPI 產生、不手寫，但 FastAPI 預設 OpenAPI 的 422 是 `HTTPValidationError`（`detail[]`），產生的型別與實際格式相反。

**修法（收緊 AD-16）：**

- `core/errors.py` 提供 `flush_or_raise`：Repository 實作 `flush` 時捕捉 `IntegrityError`，依 constraint 名稱（AD-19 已固定命名規則）對應到 `DomainError`（`DUPLICATE` 等）。未對應的才維持 500。
- 固定 `details`：`INSUFFICIENT_STOCK` 為 `{batch_id: int | null, remaining_quantity: str | null, available_quantity: str | null}`；`STALE_QUANTITY` 為 `{current_quantity}`。
- 在 `main.py` 以全域 `responses` 宣告錯誤格式 `ErrorResponse`，覆蓋預設 422。
- `fields[].field` 用點號路徑（`lines.0.quantity`），與 Mantine form 相同；handler 將 Pydantic 的 `loc` 轉成此格式並移除 `body` 前綴。

### F-14　中｜C1～C5 與原始碼結構不一致

C 文件要交這張表，老師也會對照，所以列入中嚴重度。

| 情境 | 問題 | 修法 |
| --- | --- | --- |
| C1 | 「`Notifier` 不用改」與 AD-14 由 `InAppNotifier` 決定動作矛盾（見 F-08）。`alertKinds.ts` 不在結構樹。若新增的規則屬於新形狀，`Alert` 與 `alerts/schemas.py` 也要改 | 採 F-08 後成立；結構樹補 `features/alerts/alertKinds.ts`；補充說明增列新形狀時的影響 |
| C2 | 成立。`select(candidates, request)` 的 `request` 建議端與確認端形狀不同，需定義 | 定義 `SelectionRequest(total_quantity, lines=None)` |
| C3 | `app/jobs/` 不在結構樹。`alerts/dependencies.py` 以 `Depends` 組裝，job 在請求外沒有 `get_session` 可用，所以組裝無法重用；AD-2 只容許 `dependencies.py` 建立具體類別，job 也卡住 | `dependencies.py` 提供純函式 `build_alert_service(session, clock, notifier)`，`Depends` 版與 job 都呼叫它；表內明列 `AlertService` 不改的前提是已有 `evaluate()`（F-08） |
| C4 | 未列 `app/db/models/`。AD-19 的 `BIGINT IDENTITY`、`UUID` 若寫 PostgreSQL 專用型別，模型就要改。補充未提 MySQL 預設 `REPEATABLE READ`，會讓 AD-7 的鎖後非鎖定查詢（防重送、沖銷判定）讀到舊快照 | 模型只用 SQLAlchemy 通用型別（`Uuid`、`DateTime(timezone=True)`、`Numeric`）；C4 補充 `core/db.py` 必須設定 `READ COMMITTED`。若 SQL 放 `ledger_sqlalchemy.py`，修改欄也要列入 |
| C5 | 依賴單一 `get_clock`，但結構樹沒有存放處。AD-2 說具體類別只在 `modules/<m>/dependencies.py` 建立，照字面每個模組各寫一個 `get_clock`，`dependency_overrides` **只蓋掉其中一個**，測試靜默使用真實時間。另見 F-12 | 新增 `app/core/dependencies.py`，放 `get_session`、`get_clock`、`get_uow`，並修正 AD-2 的例外 |

---

## 低～中嚴重度

### F-15　11/6 骨架必須給出、主幹未定的介面

郭明儒、ChiaJungTien、謝文佳都要在骨架完成當天開工，而 Deferred 把「欄位細節」交給 11/6 的 migration，只有 Ken 看得到。以下每項只要在骨架決定一次，否則就會各做一份：

| 項目 | 不定的後果 | 建議 |
| --- | --- | --- |
| `get_current_employee`、`require_admin` 的回傳與用法 | 認證 11/7 才有，11/6～7 各自造假；Service 操作者型別分歧 | 骨架放 stub，回傳 `Employee`；`Depends(require_admin)`；Service 收 `operator_id: int` |
| `/auth/me` | cookie 是 httpOnly，前端讀不到角色，無法隱藏管理功能 | 列為必要端點，前端 `useCurrentEmployee` |
| `Quantity` 型別只有一個 | 領用要 `> 0`、盤點 `≥ 0`、異動可負 | `PositiveQuantity`、`NonNegativeQuantity`、`SignedQuantity` |
| Decimal 傳輸（已實測） | Pydantic `Decimal` 接受 JSON number，輸入 schema 是 `number \| string`，所以產生的 TS 型別允許數字；輸出是 `"12.5"` 不是 AD-9 範例的 `"12.500"` | 輸入只收字串，`WithJsonSchema` 宣告為 string；輸出統一 `quantize` 到 3 位 |
| 列舉值 | 報廢原因、角色、保存方式與儲存類型、單據狀態，前後端及 alerts 都要用 | 定義於 `core/enums.py`，透過 OpenAPI 匯出 |
| 異動與單據時間欄位名 | reports、inventory 各猜一個 | `occurred_at` 定稿；`waste_record` 同名 |
| 單號與批號 | `GR-{id}` 依賴 id，若欄位 `NOT NULL` 則首次 INSERT 就失敗 | 不存欄位，由實體 property 產生；FR-07 單號查詢解析後比對 `id` |
| `alert_setting` 取列方式 | `LIMIT 1` 與依名稱查詢不一致 | 單例，取 `id` 最小者並集中在共用唯讀查詢；無列時視為部署錯誤 |
| 整批換位置 | 路由未定（只寫 `/storage-locations`），AD-7、AD-8 未涵蓋；重送多一筆 A→A 紀錄 | `POST /inventory-batches/{id}/location`，路由屬 storage_location；透過 `ledger.lock_batches`、`move`，同位置不寫入 |
| 盤點預覽端點 | AD-9 要後端算差額，但沒有端點 | `POST /stocktakes/preview`，不寫入 |
| Query key 與 feature 清單 | AD-18 的 `transactions` 不是 feature 名稱；未含 `goods-receipt` 及 `waste`；換位置不在「變動庫存」內，預警顯示舊位置 | `queryKeys.ts` 一次列全部 feature；`invalidateStockQueries` 補上這些鍵，換位置也呼叫 |
| `useIdempotencyKey` | 換 key 時機各自實作 | 骨架提供 `{key, rotate}`，內容變更與成功時由 hook 使用端呼叫 |
| `schema.d.ts` | 四條分支都重新產生，每次 PR 都衝突 | 明訂：提交產生檔；衝突時不手動合併，rebase 後重新產生 |

---

## 查過沒問題（不需要動）

避免重複討論，以下攻擊路線**依文件邏輯沒有打穿**，PostgreSQL 行為仍待整合測試確認：

- **報廢與領用同批次：** 兩者都鎖該批次列，任一先取得鎖，另一方鎖後看到最新量（前提是 F-02）。
- **沖銷與領用競態：** 沖銷先鎖單再依 id 鎖批次。領用先贏：沖銷鎖後查到異動而拒絕。沖銷先贏：領用的 `remaining > 0` 條件在等鎖後重新評估，該列被排除，回不足。前提是判定在鎖內（AD-7 已要求）。
- **死結：** 全系統只有 `goods_receipt → inventory_batch` 這個跨表順序，批次一律依 id 遞增，領用只鎖單一食材。沒有反向路徑。讀取查詢不上鎖。
- **同 key 併發重送：** 兩個請求鎖相同批次而序列化，後者取鎖後看到前者已提交的 key（`READ COMMITTED` 逐句快照）。
- **盤點重送：** 回應遺失後重試得到 `409 STALE_QUANTITY`，不會重複調整。雖不是 200，但重新核對後無差額，符合 FR-16，不需另加 key。
- **FastAPI 同步端點：** `def` 端點與 yield 依賴可能在不同執行緒進出，但是順序使用，不違反 Session 的非併發限制。`Depends(get_session)` 預設快取，同請求同 Session。禁止使用 `use_cache=False` 即可。
- **連線池：** 每個請求從首次 SQL 到結束佔一條連線，SQLAlchemy 預設上限 15（5＋10），NFR-07 的 10 人足夠。此為預設值推算，未經負載實測。
- **FR-05 停用位置、最後一名管理者等檢查後寫入的競態：** 理論上存在，但機率低、後果可人工更正，四人兩週不值得處理；放進測試報告的已知限制即可。

## 建議動作順序

1. **11/6 骨架前（主幹修訂）：** F-01～F-06，連同新增 AD-20（StockLedger 介面）、AD-21（可用量與低庫存）。
2. **11/6 骨架內：** F-15 清單、F-13、`core/dependencies.py`、帶登入的寫入整合測試。
3. **11/10 前：** F-07～F-12。
4. **11/11 整合日：** 跑 `SUM(delta) == remaining` 與報表恆等式測試。
5. **11/13 C 文件定稿前：** F-14 的 C1～C5 修正。
