# 架構主幹審查：檢核表與 SRS 對照

- **審查對象：** `ARCHITECTURE-SPINE.md`（status: draft，2026-11-05）
- **需求依據：** `docs/srs.md` v3.0；參考 `CONTRIBUTING.md`、`docs/team-tasks.md`
- **未讀：** `prds/`、`use-cases/`（已作廢）、`planning-artifacts/prd.md`（非指定需求來源，只確認它存在）、主幹的 `.memlog.md`（維持審查獨立）
- **實際查驗：** 已查 npm 與 PyPI，確認 Stack 的版本存在，也確認 TypeScript、Node 的約束說明正確。沒有執行任何程式，以下「能否通過」都是依文件推演。

## 判定

**修正 6 項 high 後即可上骨架；不需要重寫。** 使用者指定事項全部落實，分層、交易、鎖定順序、防重送的主要設計也站得住。問題集中在三處：

1. 多人共用的接縫沒有寫死，包括 `StockLedger` 的方法契約，以及低庫存與可用量的定義。
2. 報表和營運需求只有綁定，沒有規則（FR-18、NFR-03、NFR-06）。
3. 有兩個實作陷阱，照文字做仍會出錯：列鎖不刷新 ORM 物件，以及 JWT 效期與 `FixedClock` 衝突。

沒有 critical。H1～H6 建議在 11/6 骨架前修掉，因為都會影響骨架程式或 schema，事後才改的成本會明顯變高。

| 嚴重度 | 數量 | 編號 |
| --- | --- | --- |
| critical | 0 | — |
| high | 6 | H1～H6 |
| medium | 12 | M1～M12 |
| low | 7 | L1～L7 |

---

## A. 好主幹檢核表

### A1. 是否固定了真正的分歧點

| 分歧點 | 判定 | 說明 |
| --- | --- | --- |
| 分層、依賴方向、注入 | 已固定 | AD-1、AD-2 可由 import-linter 檢查 |
| 實體形態、ORM 使用方式 | 已固定 | AD-3 |
| 表的寫入權 | 已固定 | AD-4，12 張表與 SRS 第 8 節一致 |
| 交易、鎖定順序、防重送 | 大致固定 | AD-6～AD-8；有陷阱，見 H4、M1、M5 |
| 數量、時間、效期判定 | 大致固定 | AD-9～AD-11；低庫存與可用量沒有對應的單一來源，見 H2 |
| API 與錯誤格式 | 大致固定 | AD-16；欄位路徑未定，見 M9 |
| **`StockLedger` 方法契約** | **遺漏** | 三位組員都要呼叫，見 H1 |
| **低庫存、可用量、食材層級狀態** | **遺漏** | 兩位組員各做一份，見 H2 |
| **同步或非同步處理** | **遺漏** | 見 M4 |
| **前端跨 feature 路由與參數** | **遺漏，且被列入 Deferred** | 見 M6 |
| **OpenAPI 型別的產生流程** | **遺漏** | 見 M11 |

### A2. 每條 AD 的 Rule 是否可執行、能否防止所述分歧

| AD | 判定 | 備註 |
| --- | --- | --- |
| AD-1、AD-2 | 通過 | 跨模組限制未列入檢查，見 L6 |
| AD-3 | 通過 | 與 AD-5 有張力：Service 可寫屬性，沒有機制阻止直接改 `remaining_quantity`，見 L6 |
| AD-4 | 通過 | |
| AD-5 | **部分通過** | 規則正確，但呼叫面未定（H1） |
| AD-6 | **部分通過** | 與 AD-15 共用 Session 時，實作方式可能直接報錯（M5） |
| AD-7 | **部分通過** | 只寫 `FOR UPDATE`，不足以取得最新值（H4） |
| AD-8 | **部分通過** | 查 key 與檢查庫存的先後未定（M1） |
| AD-9、AD-11 | 通過 | AD-9 細節見 L3；AD-11 未涵蓋低庫存（H2） |
| AD-10 | **部分通過** | 未處理 JWT 時間（H5） |
| AD-12、AD-13、AD-14 | 通過 | 建議與確認的算法一致，非 FEFO 判定可執行；C1、C3 的影響範圍合理 |
| AD-15 | **部分通過** | 效期未定（H5）；漏掛驗證時沒有防線（M10） |
| AD-16、AD-17 | 通過 | 見 M9、M6 |
| AD-18 | **部分通過** | 只涵蓋「會變動庫存」的 mutation，涵蓋不足（M3） |
| AD-19 | 通過 | |

### A3. Deferred 是否會造成分歧

| 項目 | 判定 |
| --- | --- |
| 交易更正、遵循率報表、外部通知、CSV、背景排程器、對外部署與 HTTPS | 可延後 |
| 同 key 不同內容的偵測 | 可延後，不跨單位 |
| 欄位細節與索引 | 可延後，但 H1、H2 涉及的欄位語意不能放在這裡 |
| **頁面結構與視覺** | **不可整項延後。** 預警頁連到領用、報廢、進貨的路由與參數跨三位組員（M6），NFR-01 也需要共用規則（M7） |
| **CI 流程內容** | **理由與 AD 矛盾。** 寫「不影響模組間一致性」，但 AD-1、AD-17 的強制力都靠 CI（L7） |

### A4. 結構維度

| 維度 | 狀態 | 備註 |
| --- | --- | --- |
| 系統邊界、原始碼結構、資料表 | 已決定 | |
| 開發環境 | 已決定 | 測試資料庫如何建立未定（M12） |
| demo 部署 | **含糊** | 「`npm run dev`、`uvicorn` 或建置後的靜態檔」未選定；靜態檔沒有服務方式，同源也無從成立（M12） |
| Migration 執行時機、demo 與開發種子資料 | **無決定** | M12 |
| 登入效期、密鑰 | **無決定** | H5 |
| 備份與還原 | **只決定一半** | 有腳本，沒有核對程序與負責人（H6） |
| 效能測試 | **無決定** | 沒有負責人、工具、資料產生方式（M8） |
| 日誌 | 已決定 | |
| 監控 | 未提及 | 課程規模可接受，不列為問題 |
| HTTPS、排程 | 已延後 | |

### A5. FR 與 NFR 涵蓋

frontmatter 宣告綁定全部 FR 與 NFR，但 **NFR-01、NFR-06、NFR-07 沒有任何 AD 綁定**，Capability Map 也只列 FR，因此這三項都沒有負責人。逐條結果見 B1。

---

## B. 逐條對照 SRS

### B1. 涵蓋矩陣

判定：**落實**＝主幹有規則，或無矛盾且一人可依 SRS 直接實作；**部分**＝有不足；**缺**＝主幹沒有對應規則。

| 需求 | 判定 | 對應與缺口 |
| --- | --- | --- |
| FR-01 | 部分 | AD-15 可落實登出與憑證失效；路由漏掛驗證沒有防線（M10） |
| FR-02 | **缺** | 最後管理者不可停用或降權：全文沒有提及（M2）。停用後拒絕請求已由 AD-15 落實 |
| FR-03 | 部分 | 刪除有約定；確認入庫時的停用檢查未定（M3b）。不可換單位、分類停用限制無矛盾，依 SRS 實作 |
| FR-04 | 部分 | 同上（M3b） |
| FR-05 | 落實 | AD-4、AD-5。位置停用檢查依 SRS 實作 |
| FR-06 | 部分 | 交易與防重送完整；編輯草稿與確認的競爭未涵蓋（M3b） |
| FR-07 | 落實 | AD-7、AD-8；沖銷統計見 H3 |
| FR-08 | 部分 | 食材層級狀態與低庫存篩選無定義（H2） |
| FR-09 | 落實 | |
| FR-10 | 落實 | AD-12 |
| FR-11 | 落實 | AD-5～AD-8；須配合 H4 |
| FR-12 | 落實 | AD-11、AD-13 |
| FR-13 | **部分** | 計算即時，但定義不是單一來源（H2）；設定類變更不會觸發前端更新（M3a） |
| FR-14 | 部分 | 排序、更新時間、動作都有；連結目標未定（M6）；預警天數更新後快取未失效（M3a） |
| FR-15 | 部分 | 金額規則完整；一鍵報廢的契約與重送順序未定（M1） |
| FR-16 | 落實 | 預覽過期由 `expected_quantity` 與 `STALE_QUANTITY` 落實；ABA 邊界見 L2 |
| FR-17 | 落實 | AD-5；欄位見 H1 |
| FR-18 | **缺** | 公式、沖銷歸類、時間基準都沒有規則（H3）；金額未知筆數已由 AD-9 落實 |
| NFR-01 | **缺** | M7 |
| NFR-02 | 部分 | 主要機制完整；須配合 H4、M1 |
| NFR-03 | 部分 | 欄位與僅新增都有；重算核對沒有工具（H6） |
| NFR-04 | 落實 | AD-15；HTTPS 合理延後 |
| NFR-05 | 部分 | 錯誤格式有；欄位路徑與中文訊息未定（M9） |
| NFR-06 | **部分** | 有備份腳本與具名 volume；「核對還原後一致」沒有落實（H6） |
| NFR-07 | **缺** | 只有索引延後的一句話（M8） |
| NFR-08 | 落實 | AD-13、AD-14、C1、C3 |
| 第 5 節第 1、2、3、5、6 點 | 落實 | AD-9、AD-10、AD-11、AD-19、AD-6、AD-8、主檔約定 |
| 第 5 節第 4 點 | 部分 | H2 |
| 第 5 節第 7 點 | 部分 | 區間有定義，「按確認時間」的欄位沒有寫（H3） |

### B2. 使用者指定事項

全部落實，沒有矛盾。

| 指定事項 | 落實位置 |
| --- | --- |
| React＋TS＋Vite、Mantine、TanStack Query、React Router | Stack、AD-17 |
| FastAPI、SQLAlchemy 2、Alembic、Pydantic | Stack、AD-3、AD-19 |
| PostgreSQL docker-compose | Structural Seed |
| API→Service→Repository、建構子注入 | Design Paradigm、AD-1、AD-2 |
| Strategy（`FefoStrategy`、`ManualStrategy`） | AD-12 |
| `AlertRule`＋`AlertRuleFactory`、`InAppNotifier` Adapter | AD-13、AD-14 |
| 可注入 Clock | AD-10 |
| `NUMERIC(12,3)` | AD-9 |
| 多批次領用與確認入庫單一交易 | AD-6 |
| 領用列鎖 | AD-7；須補 H4 |
| 確認入庫與報廢防重送 | AD-8；須補 M1 |
| C1～C5 | 變更檢驗表；C4 小缺口見 L5 |

### B3. 第 9 節端到端驗收逐列走查

前提：今天 10/31，T＝3，安全庫存量 10，A＝5（120 元，11/01 到期），B＝8（115 元，11/07 到期）。

| # | 操作 | 走查後狀態 | 依據 | 能否通過 |
| --- | --- | --- | --- | --- |
| 1 | 確認兩批進貨 | A5、B8；可用 13；A 的 D＝1 為即期，B 的 D＝7 為正常 | AD-5、AD-11 | **有條件**：在 `APP_FIXED_NOW` 下登入後可能全部 401（H5） |
| 2 | 領用 3 公斤 | 建議 A；A2、B8；可用 10≤10 | AD-12、AD-13 | **有條件**：首頁可通過；庫存總覽的低庫存由另一人實作，定義可能不同（H2） |
| 3 | 改選 B 領 1 公斤並填原因 | 基準分配 A1，B 明細 1＞0，標記非 FEFO；A2、B7 | AD-12 | 可通過 |
| 4 | 再從 A 領 3 公斤 | A 僅 2，回 409，回滾 | AD-7 | 可通過 |
| 5 | 11/01 查詢 | A 的 D＝0 為今日到期 | AD-10、AD-11 | **有條件**：H5 |
| 6 | 11/02 查詢 | A 過期，不在候選名單；實體 9、可用 7 | AD-11、AD-12、AD-14 | **有條件**：H5；可用量定義見 H2 |
| 7 | 一鍵報廢 A 的 2 公斤 | A0，移出預警；2×120＝240 | AD-5、AD-9 | 可通過；一鍵的請求形式未定（M1） |
| 8 | 盤點 B 實際 6 | B7→6，差額 -1，`ADJUSTMENT` | AD-5、AD-8 | 可通過，原因欄位須寫入（H1） |
| 9 | 兩人同時各領 B 的 4 公斤 | B6→2；第二人 409 並收到可用量 2 | AD-7 | **有條件**：若同一 Session 已先讀過該批次，可能以舊值覆寫（H4） |
| 10 | 重送同一進貨或報廢請求 | 進貨：鎖單後看狀態，回原結果。報廢：查 key | AD-8 | 進貨可通過。**報廢有條件**：全數報廢後重送，若先查庫存會誤回 409（M1） |
| 11 | 員工嘗試盤點 | `require_admin` 回 403 | AD-15 | 可通過；須涵蓋預覽端點 |

**結論：** 依主幹規則推演，數值都正確。第 1、5、6 列受 H5 影響，第 2、6 列受 H2 影響，第 9 列受 H4 影響，第 10 列的報廢部分受 M1 影響。第 9 節沒有列出的 FR-18 公式（UJ-4、SM-2）受 H3 影響。

---

## C. 發現

### High

#### H1. `StockLedger` 只規定不能做什麼，沒有規定怎麼呼叫

- **嚴重度：** high
- **位置：** AD-2、AD-4、AD-5、AD-6、AD-7；原始碼結構 `inventory/ledger.py`；分層表
- **問題：**
  - ChiaJungTien（進貨）、Ken（領用、位置）、郭明儒（報廢、盤點）都要呼叫它，而且 11/10 前要平行完成，但主幹沒有方法簽章。
  - 誰負責取列鎖也不清楚。AD-5 只說「必須已上鎖」，如果各模組各寫鎖定查詢，AD-7 的順序規則就要靠每個人自己遵守。
  - 層級也未定。分層表沒有 Ledger 這一列，AD-6 暗示它直接操作 Session，AD-2 又要求注入介面；是否有 ABC、單元測試的 fake 放哪裡都沒有答案。
  - AD-5 的欄位清單漏了 SRS 第 8 節與 FR-17 需要的 `reason`、`is_non_fefo`、`operation_group_id`。
- **修法：** 在 AD-5 固定下列介面，由 Ken 在骨架提供實作與 `tests/fakes/fake_stock_ledger.py`：

  ```python
  class StockLedger(ABC):
      def lock_batches(self, batch_ids: Iterable[int]) -> list[InventoryBatch]: ...      # 依 id 遞增
      def lock_available_batches(self, ingredient_id: int) -> list[InventoryBatch]: ...  # AD-7 領用用
      def create_batch(self, item: GoodsReceiptItem, *, actor_id: int,
                       operation_group_id: UUID) -> tuple[InventoryBatch, InventoryTransaction]: ...
      def apply(self, batch: InventoryBatch, delta: Decimal, type: TransactionType, *, actor_id: int,
                operation_group_id: UUID, reason: str | None = None, is_non_fefo: bool = False,
                reverses_transaction_id: int | None = None) -> InventoryTransaction: ...
      def move_location(self, batch: InventoryBatch, new_location_id: int, *, actor_id: int,
                        reason: str) -> BatchLocationChange: ...
  ```

  並補三點：鎖定只能經由這個介面；時間由注入的 Clock 取得；`apply` 對未鎖定的批次丟例外（實例內記錄已鎖定的 id，測試就能抓到）。領用與報廢的 `operation_group_id` 來自 `Idempotency-Key`，其他操作由 Service 產生，欄位設為 `NOT NULL`。

#### H2. 低庫存、可用量與食材層級狀態沒有單一來源

- **嚴重度：** high
- **位置：** AD-11（只涵蓋效期）、AD-13、Capability Map；SRS FR-08、FR-13、第 5 節第 4 點、SM-3
- **問題：**
  - 謝文佳的 `LowStockRule` 在 Python 裡判定；ChiaJungTien 的庫存總覽要顯示低庫存，還要用它篩選（多半寫成 SQL）。AD-4 又禁止模組互相呼叫，所以一定會有兩份實作，也沒有規定要對照。
  - 這正是 AD-11 要防止的分歧，只是換了一個概念。
  - 三個容易出錯的地方沒有寫明：
    1. 從未進貨或批次全部耗盡的食材也必須觸發（SM-3 的零庫存）。只查 `inventory_batch` 就會漏掉，必須從 `ingredient` 做 `LEFT JOIN`。
    2. FR-08 篩選位置時，數量只合計該位置，但低庫存應依全部位置的可用量判定，否則在單一位置篩選下會誤報。
    3. 一項食材可能同時有多種批次效期狀態，FR-08 的狀態篩選語意未定。
- **修法：** 將 AD-11 擴充為「庫存狀態只有一個來源」，在 `app/domain/stock_status.py` 定義：
  - `available_quantity`：`expiry_date >= today` 的 `remaining_quantity` 合計
  - `expired_quantity`：`expiry_date < today` 的 `remaining_quantity` 合計
  - `is_low_stock(available, safety)`：`safety > 0 and available <= safety`
  - `shortage(available, safety)`：`safety - available`

  同時寫明：
  - 低庫存一律以全部位置的可用量判定，不受位置篩選影響
  - 食材符合某效期狀態篩選，等於「至少有一個剩餘量大於 0 的批次屬於該狀態」
  - 低庫存項目沒有位置，選了位置篩選時不顯示低庫存項目（或另行明定）
  - 另寫一組對照測試，涵蓋無批次、全過期、等於安全量、安全量為 0，比對 SQL 與 Domain 的結果
  - 停用食材是否觸發低庫存，SRS 沒有寫，建議不觸發，並列入待確認（預警會連到建立進貨單，而停用食材不能進貨）

#### H3. FR-18 的公式與沖銷歸類沒有任何規則

- **嚴重度：** high
- **位置：** AD-5（`REVERSAL` 是獨立類型）、AD-10、Capability Map 的 FR-17、FR-18 列；SRS FR-18、第 5 節第 7 點
- **問題：**
  - SRS 公式只有進貨、領用、報廢、調整四個項目，主幹卻有五種異動類型。如果把 `REVERSAL` 排除，公式就不平衡；如果單獨成列，又違反「歸入對應項目」。
  - 主幹沒有說明沖銷如何歸類，只有欄位 `reverses_transaction_id`。
  - 時間基準也沒有寫：開發者可能用 `goods_receipt.receipt_date`（使用者輸入的進貨日期），而 SRS 要求按確認時間。
  - 依 FR-18 也要處理：進貨在上月、沖銷在本月時，本月淨進貨為負值；期間內無異動但期初不為零的食材仍要列出；報廢分布要依單位分開。
- **修法：** 新增一條 AD（或擴充 AD-9）：

  | 項目 | 定義 |
  | --- | --- |
  | 時間基準 | 一律用 `inventory_transaction.occurred_at`（Clock 寫入的確認時間），不用進貨日期；`waste_record` 與對應異動使用同一時間值 |
  | 期初量 | `SUM(quantity_delta)`，條件 `occurred_at < 起日 00:00` |
  | 期末量 | `SUM(quantity_delta)`，條件 `occurred_at < 迄日次日 00:00` |
  | 淨進貨量 | `RECEIPT` 的 delta 合計＋`reverses` 指向 `RECEIPT` 的 `REVERSAL` delta 合計（可為負） |
  | 淨領用量、淨報廢量 | 同法取對應類型，再取負號，使其符合 SRS 公式的減項 |
  | 調整淨額 | `ADJUSTMENT` 的 delta 合計 |

  報表回傳每列都要符合公式，整合測試必須包含「跨期沖銷」與「期間內無異動」。報廢統計依 `(分組鍵, unit)` 分組，不同單位不合計。

#### H4. `SELECT ... FOR UPDATE` 不保證 ORM 物件是最新值，AD-7 仍可能失效

- **嚴重度：** high
- **位置：** AD-7、AD-3（`expire_on_commit=False`）、AD-6（同一請求共用 Session）；第 9 節第 9 列；SM-2
- **問題：**
  - SQLAlchemy 的 `select(...).with_for_update()` 若遇到 Session 中已載入的物件，預設會保留舊屬性，不用查詢到的新值覆蓋。
  - 只要鎖定前讀過該批次（例如先查是否存在以回 404），鎖定後看到的 `remaining_quantity` 仍是舊值。
  - 結果可能是餘量檢查誤判通過，並用舊值算出的結果寫回，**造成遺失更新，但不會產生負數，`CHECK` 也攔不住**。AD-7 那句「鎖定前的讀取結果不可作為依據」，並不會讓開發者知道這個行為。
- **修法：** 在 AD-7 加上：「鎖定查詢一律使用 `.with_for_update().execution_options(populate_existing=True)`，集中在 `StockLedger` 與 `goods_receipt` 的鎖定方法中。」並增加一個連真實 PostgreSQL 的整合測試：同一 Session 先讀批次，另一連線提交變更，再鎖定，驗證讀到新值。

#### H5. JWT 效期與 Clock 的關係未定，跨日驗收可能全部 401

- **嚴重度：** high
- **位置：** AD-10、AD-15、C5；第 9 節第 1、5、6 列
- **問題：**
  - AD-15 沒有定義 token 效期。AD-10 又禁止 `SystemClock` 以外的地方讀系統時間，所以合規的做法是用 `Clock.now()` 計算 `exp`。
  - 但 PyJWT 驗證 `exp` 時用的是真實系統時間。今天是 11/05，設 `APP_FIXED_NOW=2026-10-31` 時，簽發的 token 一開始就已過期，登入後每個請求都是 401。
  - 反過來，若固定時間設在未來，`iat` 也會被判為尚未生效。C5 的手動驗收路徑因此走不通，而第 9 節正好以 10/31 為基準。
- **修法：** 在 AD-15 明確規定：
  - token 有效 12 小時（數值可由小組決定），放進 `core/config.py`
  - 解碼時用 `options={"verify_exp": False, "verify_iat": False}`，再由 `get_current_employee` 以注入的 `Clock` 比對 `exp`
  - cookie 不設固定到期時間，或以相對的 `max_age` 設定，因為瀏覽器只看真實時間
  - HTTP 區網 demo 不可設 `Secure`；對外部署改由設定開啟
  - `JWT_SECRET` 列入 `.env.example`，沒有設定時拒絕啟動
  - 增加 API 測試：`FixedClock` 設在過去，能登入並正常操作；時間前進超過效期後回 401

#### H6. NFR-03、NFR-06 的核對程序不存在，而且沒有負責人

- **嚴重度：** high
- **位置：** Structural Seed「環境」段落、`scripts/`；Capability Map；SRS NFR-03、NFR-06、SM-2
- **問題：**
  - NFR-06 要求「核對還原後批次與異動一致」，NFR-03 要求「可由有效異動重算目前量」，SM-2 要求「庫存可與異動核對」，但主幹只有 `pg_dump`、`pg_restore` 腳本。
  - 沒有核對查詢，Capability Map 也不列 NFR，這項工作沒人會做。
  - 另外三個細節未定：組員使用 Windows，`.sh` 要靠 Git Bash；本機未必有 `pg_dump`，應透過容器執行；還原要不要先停後端、是否清空目標資料庫也沒有寫。
- **修法：**
  - 新增 `python -m app.cli verify-stock`，檢查三件事並在有差異時以非零狀態結束：
    1. 每批次 `remaining_quantity == SUM(quantity_delta)`
    2. 每批次最新一筆的 `quantity_after == remaining_quantity`
    3. 每筆 `WASTE` 異動都有對應 `waste_record`
  - 腳本統一用 `docker compose exec` 執行；還原寫明順序：停後端、還原、跑 `verify-stock`、比對還原前後的批次與異動筆數。
  - 將 `verify-stock` 同時放進併發整合測試的結尾。
  - 在 Capability Map 增加「跨功能需求」表，至少指定 NFR-01、NFR-03、NFR-06、NFR-07 的負責人。

### Medium

#### M1. 防重送時查 key 與檢查庫存的順序未定，一鍵報廢的契約也未定

- **嚴重度：** medium
- **位置：** AD-7（「所有檢查」都在取得鎖之後，沒有先後）、AD-8、`useIdempotencyKey`；FR-15；第 9 節第 10 列
- **問題：**
  - 全數報廢後重送，若先檢查庫存：報廢量 2＞剩餘量 0，會回 409 而不是原結果，第 10 列就失敗。領用把某批次用完後重送也一樣。
  - 領用的鎖定範圍是 `remaining_quantity > 0`，重送時可能鎖不到列；若把「沒有列」當成錯誤，也會誤判。
  - 一鍵報廢的請求形式未定：是前端帶入顯示的數量，還是由後端取全部剩餘量？
  - 預警清單沒有表單實例，「每個表單實例一個 key」也不適用。
- **修法：** 在 AD-8 加上：「取得鎖後第一件事是查 key；命中就直接回原結果，不再做任何商業檢查。鎖不到列不算錯誤。」一鍵報廢定為同一端點，由前端明確帶入畫面上的數量與原因 `EXPIRED`；數量不符就回 409，不新增「全部」語意。key 以批次為單位，由預警項目的 hook 持有，請求確認成功後才換新。

#### M2. FR-02 的最後管理者規則完全沒有落實

- **嚴重度：** medium
- **位置：** AD-15、AD-7（未涵蓋 `employee`）、Capability Map 的 FR-01、FR-02 列；SRS FR-02
- **問題：** 全文沒有提到最後一名有效管理者。此外，先計數再更新在 READ COMMITTED 下有 write skew：兩位管理者同時互相降權或停用，兩筆都會看到「還有 2 人」，最後一位管理者也就沒了。這個規則還要涵蓋停用、降權、編輯時一併改兩個欄位這三條路徑。
- **修法：** 在 AD-15 或 AD-7 加上：「任何會讓有效管理者變少的變更，在交易內先鎖定所有有效管理者（依 `id` 遞增，`with_for_update(key_share=True)`，以免擋住引用 `employee` 的外鍵檢查），鎖後計數；若結果為 0，回 `409 STATE_CONFLICT`。」並加入併發整合測試。

#### M3. 前端更新與進貨單狀態有兩個缺口

- **嚴重度：** medium
- **位置：** AD-18（M3a）；AD-7、AD-8（M3b）；SRS FR-13、FR-14、FR-03～FR-06
- **問題：**
  - **M3a：** `invalidateStockQueries()` 只規定給「會變動庫存」的 mutation 使用。修改預警天數（FR-14「更新後新查詢套用」）、修改安全庫存量或停用食材（影響 FR-13）、整批換位置（影響預警與庫存的位置欄位）都不在範圍內。失效清單也沒有 `goods-receipts`，確認或沖銷後的列表可能是舊的。主幹也沒有定 `staleTime`，有人設長時間快取時，後端即時計算也沒用。
  - **M3b：** AD-7 只提到確認與沖銷會鎖 `goods_receipt`。編輯草稿若不鎖，可能在確認提交後才寫入明細，造成明細與批次不一致。「停用的供應商、食材、位置不可用於進貨」也沒有規定確認時要重新檢查；草稿可能是停用之前建立的。
- **修法：**
  - **M3a：** 把規則改為「會影響庫存顯示的 mutation」，明列數量異動、換位置、食材與分類變更、預警設定變更；失效清單加入 `goods-receipts`；`alerts`、`inventory` 的 `staleTime` 固定為 0。
  - **M3b：** 在 AD-7 加上「所有 `goods_receipt` 與明細的寫入都先鎖單頭，再檢查 `DRAFT`」；在 AD-8 加上「確認時，於鎖內重新驗證必填、日期規則與主檔啟用狀態」。

#### M4. 同步或非同步未定

- **嚴重度：** medium
- **位置：** AD-6、Stack；NFR-07
- **問題：** 主幹隱含同步 `Session`，但沒有明說。FastAPI 範例多用 `async def`。若有人在 `async def` 路由裡呼叫同步 Service，等待 `FOR UPDATE` 或查詢時會卡住整個事件迴圈，併發時服務會停頓，而且單人測試不會發現。
- **修法：** 在 AD-6 寫明：「使用同步 SQLAlchemy 與 psycopg；路由與依賴一律是 `def`，不用 `async def`。」可加 Ruff 或 import-linter 以外的簡單 grep 檢查。

#### M5. 共用 Session 與 UnitOfWork 的實作可能互相衝突

- **嚴重度：** medium
- **位置：** AD-6（共用 Session）、AD-15（每個請求查資料庫）
- **問題：** `get_current_employee` 先用同一個 Session 查詢時，SQLAlchemy 會自動開始交易。之後若 UnitOfWork 用 `session.begin()`，會丟出 `A transaction is already begun`。改用獨立 Session 也不對，因為 AD-6 要求共用。骨架第一天就會遇到，而且解法會影響每個 Service 的交易語意。
- **修法：** 在 AD-6 固定 UoW 實作語意：`transaction()` 不呼叫 `begin()`，區塊正常結束時 `commit()`，發生例外時 `rollback()`；`get_session` 在請求結束時 `close()`。並補一句：交易開始前的讀取與交易內的寫入屬於同一個資料庫交易，這也是 H4 必須強制刷新的原因。

#### M6. 前端跨 feature 路由與預警動作被放進 Deferred

- **嚴重度：** medium
- **位置：** Deferred「頁面結構與視覺」、AD-14、AD-17；FR-01、FR-14
- **問題：** 預警頁（謝文佳）要連到領用（Ken）、報廢（郭明儒）、建立進貨單（ChiaJungTien），路由和帶入參數是真實的跨人契約。「一鍵報廢」由哪個 feature 的 hook 提供、登入狀態與角色如何取得（`/auth/me`？）、401 如何導回登入頁、頁面如何依角色隱藏，也都未定。若等 11/11 整合才對，會集中爆發。
- **修法：** 只把「視覺」留在 Deferred，把路由表移入主幹（在 `app/router` 集中宣告），至少固定：
  - `/`（預警首頁）
  - `/issues/new?ingredient_id=`
  - `/waste-records/new?batch_id=`
  - `/goods-receipts/new?ingredient_id=`

  另外定 `Alert.actions` 的列舉值；固定 `GET /auth/me` 與 `useCurrentEmployee`；`client.ts` 統一處理 401。前端角色判斷只影響顯示，權限仍由伺服器決定。

#### M7. NFR-01 沒有規則

- **嚴重度：** medium
- **位置：** 全文；Deferred 寫「各 feature 使用 Mantine 預設元件」
- **問題：** 1024×768 下完成關鍵操作、不依賴滑鼠懸停、狀態同時使用文字與顏色，都不是使用 Mantine 預設元件就會自動滿足。多欄明細表格尤其容易超寬。四個人各自處理，效期徽章的文字與顏色也會不一致。
- **修法：** 新增一條短 AD 或約定：
  - 效期與低庫存狀態只用共用元件 `shared/ui/StatusBadge`，同時顯示文字與顏色，由 `AlertKind` 與效期狀態對應
  - 操作不放在 `Tooltip` 或 hover 中
  - 主要操作目標至少 44px
  - 每個關鍵流程 PR 都在 1024×768 與 1366×768 檢查
  - 指定負責人；Mantine 的中文語系與日期元件也在此一併決定

#### M8. NFR-07 沒有負責人、工具與資料產生方式

- **嚴重度：** medium
- **位置：** Deferred「欄位細節與索引」；Capability Map
- **問題：** SRS 要求 500 項食材、5,000 批次、20,000 筆異動、10 人併發，並出具記載環境與失敗率的報告。主幹只說索引依測試結果調整，但測試本身沒人負責，也沒有工具。預警是每次查詢即時計算，所以這項風險是真的，不只是形式問題。
- **修法：** 新增 `python -m app.cli seed-load-test`（只在非正式環境可用）與一份負載腳本（例如 Locust 或 k6，選一個寫進 Stack），指定負責人和完成日。若小組認為報告可排在期中後，也應明確列入 Deferred，並註明 SRS 第 7.1 節把品質需求列入首版，以免被當成已涵蓋。

#### M9. 錯誤格式缺少巢狀欄位路徑、中文訊息與兜底處理

- **嚴重度：** medium
- **位置：** AD-16；NFR-01、NFR-05；AD-8（唯一鍵最後防線）
- **問題：**
  - `fields[].field` 的格式未定。進貨單與領用都有多筆明細，`items[0].quantity`、`items.0.quantity`、`quantity` 各寫一種時，前端無法統一對應到表單欄位。
  - Pydantic 的 422 預設是英文訊息，不符合繁體中文介面。
  - 未預期例外沒有錯誤碼。唯一鍵或 `CHECK` 違反屬於併發情況下的最後防線，Service 又不能 import `sqlalchemy`，沒人轉換就會變成 500，格式也不符。
- **修法：**
  - 路徑固定為 `items.0.quantity`（可直接給 `@mantine/form` 的 `setErrors`）
  - 422 handler 統一把 Pydantic `loc` 轉成此格式，並依 `type` 對應中文訊息
  - 新增 `500 INTERNAL_ERROR`，不回傳內部細節
  - Repository 把 `IntegrityError` 依 constraint 名稱轉成 `DomainError`（AD-19 已固定命名）；`source_item_id` 違反視為重送，重查後回原結果

#### M10. 權限規則防不住路由漏掛驗證

- **嚴重度：** medium
- **位置：** AD-15；FR-01
- **問題：** 規則只說權限在路由層宣告。若某路由漏掛 `get_current_employee`，就會無驗證開放，也沒有測試會失敗；FR-01 的「未登入不能取得營運資料」會靜默失守。盤點預覽這類端點也可能漏掛 `require_admin`。
- **修法：** `/api/v1` 主路由預設掛 `dependencies=[Depends(get_current_employee)]`，只有登入端點放在明確的公開路由。再加一個測試：列舉 `app.routes`，比對公開清單，並用一份權限表（對應 SRS 第 4.1 節）驗證員工存取管理端點一律回 403。

#### M11. OpenAPI 產生流程未定

- **嚴重度：** medium
- **位置：** AD-16；原始碼結構 `shared/api/schema.d.ts`；`CONTRIBUTING.md` 第 1 節
- **問題：** 四人平行開 PR，都會改同一份產生檔。主幹沒有規定是否提交、由誰產生、怎麼產生（需不需要啟動後端與資料庫）、如何偵測過期。結果可能是每個 PR 都衝突，或者型別悄悄與後端不同步。
- **修法：** 提交產生檔；提供 `backend/scripts/export_openapi.py`（不連資料庫，直接輸出 `app.openapi()`）與 `npm run gen:api`；衝突時不手動合併，一律重新產生；CI 以 `git diff --exit-code` 檢查。

#### M12. demo 部署與環境初始化未定

- **嚴重度：** medium
- **位置：** Structural Seed「環境」段落、系統圖；AD-15
- **問題：**
  - 「或建置後的靜態檔」沒有服務方式。靜態檔若由其他 port 提供，就不是同源，而主幹又不開 CORS。
  - 平板連線需要 `server.host`，後端也要有對應設定。
  - `foodflow_test` 怎麼建立未定（官方映像只會自動建立一個資料庫，需要 init script）。
  - Migration 何時執行未定。
  - 11/11 整合與第 9 節驗收都需要一致的資料，但只有 `create-admin`，沒有種子資料。
- **修法：** demo 定為一種方式，建議 FastAPI 掛載 `frontend/dist` 並提供 SPA fallback，這樣同源成立，只要一個 port。補 `docker/initdb/` 建立測試資料庫；啟動程序寫明先 `alembic upgrade head`，不在應用程式啟動時自動執行；新增 `python -m app.cli seed-demo`，建立第 9 節場景，且 `APP_ENV=production` 時拒絕執行。

### Low

#### L1. 主幹引用了非指定的需求來源，待確認事項也會影響他人當日工作

- **嚴重度：** low
- **位置：** frontmatter `sources`；待確認第 1 點；`docs/team-tasks.md` 的 Ken 與謝文佳段落
- **問題：** `sources` 列了 `_bmad-output/planning-artifacts/prd.md`，但需求來源只有 SRS；該檔仍存在，後人可能誤以為它有效。待確認第 1 點的結論正確（依 SRS 不做排程），但 `team-tasks.md` 還要求 use case 圖加入「系統排程」、架構圖加入「每日預警排程」，而謝文佳的 use case 圖 11/6 就要交。
- **修法：** 從 `sources` 移除 `prd.md`。11/6 前由 Ken 通知小組並更新 `team-tasks.md`：移除首版的排程角色與排程元件。

#### L2. 盤點 `expected_quantity` 的邊界行為

- **嚴重度：** low
- **位置：** AD-8 盤點列；FR-16
- **問題：** 預覽後，數量被改動又改回相同值時不會被擋下（ABA）；這與 SRS「被他人修改庫存就拒絕」的字面有落差，但實務上很少見。另外，請求成功但回應遺失時重送會收到 409，雖然不會重複調整（符合第 5 節第 5 點），但使用者會以為失敗了。
- **修法：** 若要嚴格符合，改比對批次最新異動 id（`expected_last_transaction_id`）。否則維持現狀，並在 AD-8 註明這是已接受的取捨；409 訊息提示使用者先核對異動紀錄。

#### L3. AD-9 共用型別的細節

- **嚴重度：** low
- **位置：** AD-9；`core/types.py`
- **問題：** Pydantic 的 `Decimal` 在 OpenAPI 中通常是 `number | string`，前端可能傳數字，違反「以字串傳輸」。超過 `NUMERIC(12,3)` 的範圍會變成資料庫錯誤。輸出也可能是 `12.5`，不是規定的 `12.500`。
- **修法：** `Quantity` 只接受字串（正規式限制整數最多 9 位、小數最多 3 位），序列化固定 3 位小數，並區分 `PositiveQuantity` 與 `NonNegativeQuantity`。

#### L4. Stack 少列必要套件

- **嚴重度：** low
- **位置：** Stack；AD-8
- **問題：** 已確認 `@mantine/core@9.7.5` 的 peer dependency 要求 `@mantine/hooks` 同版本，但 Stack 沒列。AD-8 指定的 `uuid` 也沒列版本。進貨日期與到期日需要日期元件，若用 `@mantine/dates` 還需要 `dayjs`。Windows 上的 `psycopg` 應明確指定 `psycopg[binary]`。其餘版本與相依約束都已查證無誤。
- **修法：** 補上 `@mantine/hooks` 9.7.5、`uuid`、`psycopg[binary]`；決定是否使用 `@mantine/dates`（含 `dayjs`）及 `@mantine/notifications`。

#### L5. C4 的修改範圍少了模型

- **嚴重度：** low
- **位置：** C4 列；`db/models/`；AD-10
- **問題：** 若模型用了 PostgreSQL 專屬型別，就要改 `app/db/models/`，但 C4 沒列。MySQL 也沒有帶時區的時間型別，會影響 AD-10 的 UTC 假設。
- **修法：** 加一條規則：模型只用 SQLAlchemy 通用型別（`DateTime(timezone=True)`、`Numeric`）。C4 的「修改」欄補上「`db/models/`（僅時區與不相容型別）」。

#### L6. AD-4、AD-5 只靠約定

- **嚴重度：** low
- **位置：** AD-1、AD-3、AD-4、AD-5
- **問題：** import-linter 只檢查分層，不檢查「模組不可呼叫彼此的 Service 或 Repository」。AD-3 允許 Service 寫實體屬性，所以直接改 `remaining_quantity` 也不會被抓到。
- **修法：** 增加 import-linter 的模組獨立性契約，只放行 `inventory.ledger` 與 `auth.dependencies`；CI 加一個簡單 grep，禁止 `ledger` 以外出現 `.remaining_quantity =`、`.current_location_id =`。

#### L7. CI 的 Deferred 理由與 AD 矛盾；統計權限未涵蓋欄位層級

- **嚴重度：** low
- **位置：** Deferred「CI 流程內容」；AD-1、AD-17；待確認第 2 點
- **問題：**
  - Deferred 寫 CI 不影響模組間一致性，但 AD-1、AD-17 的強制力都來自 CI。約定也要求列鎖測試連真實 PostgreSQL，CI 必須有資料庫服務。
  - 待確認第 2 點把損失金額限管理者，但沒有處理員工可存取的 `/waste-records` 回應是否含 `loss_amount`。
- **修法：** 把 CI 從 Deferred 移到骨架交付項目，指定 Ken 在 11/6 完成，內容包含 PostgreSQL service、Ruff、import-linter、pytest、`tsc`、ESLint、Alembic 單一 head 檢查。在待確認第 2 點補上欄位層級的決定，例如員工回應不含 `loss_amount`。

---

## D. 建議處理順序

1. **11/6 骨架前（會影響 schema 或共用程式）：** H1、H2、H3、H4、H5、M4、M5、M1、L7
2. **11/7 認證版本前：** M2、M10、M9
3. **11/10 主要功能完成前：** M3、M6、M7、M11、L1（L1 的小組通知要在 11/6 前完成）
4. **11/11 整合日前：** H6、M12
5. **11/13 文件定稿前：** M8、L2～L6
