---
title: '新增 seed-demo 示範資料指令'
type: 'chore'
created: '2026-11-05'
status: 'done'
route: 'oneshot'
review_loop_iteration: 0
context:
  - '{project-root}/_bmad-output/planning-artifacts/architecture/architecture-foodflow-2026-11-05/ARCHITECTURE-SPINE.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** 全新資料庫沒有任何資料，demo 與手動驗收看不到預警首頁的各種情境。架構主幹已預留 `seed-demo` 指令，但尚未實作。

**Approach:** 在 `app/cli.py` 新增 `seed-demo`：灌入 2 個儲存位置、3 個供應商、4 個分類、約 10 種食材（含安全庫存量）、2 張已確認進貨單與其批次，涵蓋已過期、今日到期、即期、正常、低於安全庫存量各至少一個；日期以執行當天的 Clock 為基準相對計算。批次與異動一律經 StockLedger 建立，灌完後 `verify-stock` 必須通過。已有資料時只提示，加 `--reset` 才清空重灌。README 補上使用方式並附測試。commit 不加 AI 署名，不 push。

</frozen-after-approval>

## Implementation Notes

- 架構主幹規定 `APP_ENV=production` 時拒絕執行，一併實作（也擋 `--reset`）。
- 已有資料時印提示並以 0 結束，因為要求可重複執行；判斷範圍是帳號與預警設定以外的所有表，所以先 `create-admin` 再 `seed-demo` 不受影響。
- `--reset` 保留 `employee` 與 `alert_setting`：帳號要留著才能登入，預警天數是管理者的設定。清空與重灌同一交易，失敗時全部還原。
- `create-admin` 尚未實作，異動又必須有操作者，所以建立停用、STAFF 的 `demo-seed` 帳號，密碼是隨機值的 Argon2 雜湊，不影響有效管理者計數。
- 到期日依目前預警天數 T 計算，T 調大時「正常」批次才不會全變即期。T＝0 依 SRS 不可能有即期，只提示不繞過規則。
- 進貨與入帳時間落在過去（12 天前、2 天前），已過期批次才符合 FR-06。雞胸肉兩批對應 SRS 第 9 節示例的起點。
- 變更：`backend/app/cli.py`、`backend/tests/integration/test_seed_demo.py`、`README.md`、`docs/ai-log.md`。
- 驗證：以真實子程序對 `foodflow_test` 跑過 seed、verify、重跑、`APP_FIXED_NOW` 下 `--reset`、production 拒絕；開發庫 `foodflow` 未動。

## Review Triage Log

Blind Hunter 共 11 項。

- `--reset` 只靠 `APP_ENV` 防護：medium，屬實（預設為 development，`DATABASE_URL` 指向真實庫時會清空）。加互動確認會改變需求指定的介面，defer。
- 假雜湊 `!`：medium，屬實（`pwdlib/_hash.py` 丟 `UnknownHashError`，登入若先驗密碼會 500）。patch，改存 Argon2 雜湊並以 `verify` 斷言。
- `_demo_operator` 不檢查既有帳號狀態：low，要有人手動啟用才會發生且不影響資料正確性，不值得加分支，拒絕。
- 缺零庫存與等於安全量的邊界：false，需求未要求，且需求列的五種情境都已涵蓋。
- 只有進貨歷史、下游畫面是空的：low，需求只要求進貨單與批次，defer。
- README 缺前置步驟、「登入請用自己的帳號」目前做不到：medium，屬實，patch。未跑 migration 時的 traceback 與 `verify-stock` 相同，拒絕另外處理。
- README 沒提改預警天數要重灌：low，屬實且只需一句，patch。
- 測試沒鎖定 README 情境表與 SRS 雞胸肉數值：medium，屬實，patch，新增兩個測試。
- `--reset` 不重設序列、批次編號會跳：low，情境以食材名稱呈現，編號不是承諾的一部分，改 `TRUNCATE` 不值得，拒絕。
- Spec 未完成：false，審查當時尚未進入定稿步驟，本次已補上。
- 綠野蔬果行沒有進貨單、高麗菜向順發進貨：false，3 個供應商配 2 張進貨單必有一家沒有單，「生鮮批發」賣蔬菜也合理。
