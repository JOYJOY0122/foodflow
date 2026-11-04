---
title: '專案骨架（chore/skeleton）'
type: 'chore'
created: '2026-11-05'
status: 'done'
baseline_commit: 'cad498c41225e8ebf4a50dfa6ce6584b6d88241a'
route: 'dispatch'
review_loop_iteration: 0
context:
  - '{project-root}/_bmad-output/planning-artifacts/architecture/architecture-foodflow-2026-11-05/ARCHITECTURE-SPINE.md'
  - '{project-root}/_bmad-output/planning-artifacts/architecture/architecture-foodflow-2026-11-05/reviews/review-tech-verification.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** 其他三位組員要在骨架上平行開發；少了共用底層（schema、`core/`、`StockLedger`、前端共用層、CI）就會各做一份。列鎖與 Node 24 建置也還沒在真實環境驗證過。

**Approach:** 依 ARCHITECTURE-SPINE.md「骨架交付清單」建立可運作的前後端骨架，不做任何業務功能，並逐項實跑 6 個完成標準。

## Boundaries & Constraints

**Always:** 遵守 AD-1～AD-23 與 Stack 表的確切版本；測試先行；commit 不加任何 AI 署名；commit 格式依 CONTRIBUTING 第 3 節；`docs/ai-log.md` 補紀錄；併發測試連真實 PostgreSQL。

**Never:** 業務端點與頁面（登入、進貨、領用、報廢、盤點、預警、報表）；`create_all`；`async def`；未經 Ken 確認就 push；開 PR。

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected | Error Handling |
|----------|--------------|----------|----------------|
| 健康檢查正常 | `GET /health`，DB 可連 | 200 `{status:"ok",database:"ok"}` | N/A |
| DB 不通 | `GET /health`，DB 停止 | 503 `{status:"degraded",database:"unavailable"}` | 不洩漏內部細節；首頁顯示異常 |
| 併發超扣 | 批次 10，兩連線各扣 7 | 恰一方成功，剩 3，1 筆 ISSUE | 另一方 409 `INSUFFICIENT_STOCK` |
| 鎖前先讀 | 兩 Session 都先讀到 10 再搶鎖 | 同上，後者看到鎖後的值 | 同上 |
| 未鎖定就扣 | 未經 `lock_*` 呼叫 `deduct` | 丟例外，不寫入 | 程式錯誤，不是 DomainError |
| 憑證無效 | 無 cookie、帳號停用、版本不符、過期 | 401 `UNAUTHENTICATED` | 統一錯誤格式 |
| JWT 未設定 | 缺 `JWT_SECRET` 或短於 32 bytes | 拒絕啟動 | 明確訊息 |

</frozen-after-approval>

## Code Map

- `CONTRIBUTING.md`、`docs/ai-log.md` -- commit 與紀錄規則；ai-log 加一列
- `README.md`、`.gitignore`、`.gitattributes`、`.python-version` -- 既有；README 擴充，其他視需要小改
- `.github/workflows/no-ai-contributors.yml` -- 既有，不動
- `prds/`、`use-cases/` -- 已作廢，不參考
- 技術查證 T1～T20 已知雷：`psycopg[binary]`、`pwdlib[argon2]`、`httpx2`、`tzdata`、TS 5.9.3、`skipLibCheck`、`sub` 為字串、Decimal 不進 `jsonable_encoder`

## Tasks & Acceptance

**Execution:**
- [x] `docker-compose.yml`、`docker/initdb/01-create-test-db.sql`、`.env.example`、`.nvmrc`、`backend/.python-version` -- 環境與版本
- [x] `backend/pyproject.toml`、`uv.lock`、`alembic.ini`、`alembic/` -- 後端專案、import-linter 合約
- [x] `backend/app/core/*` -- config、db（`for_update`）、uow、clock、errors、types、enums、dependencies
- [x] `backend/app/db/models/*`、`alembic/versions/*`、`db/queries/stock_levels.py` -- 12 張表、預設 `alert_setting`、共用查詢
- [x] `backend/app/domain/{expiry,stock}.py` -- AD-11、AD-21 唯一定義，`stock_levels` 對照測試需要
- [x] `backend/app/modules/inventory/{ledger,ledger_sqlalchemy}.py`、`tests/fakes/fake_stock_ledger.py` -- AD-20；真實與 fake 跑同一份契約測試
- [x] `backend/app/modules/auth/dependencies.py` -- stub，驗 cookie JWT 並查 Employee；不提供登入端點
- [x] `backend/app/modules/health/*`、`app/main.py`、`app/cli.py`（僅 `verify-stock`）、`scripts/export_openapi.py` -- `/health`、路由與錯誤處理、靜態檔
- [x] `backend/tests/{unit,integration,fakes}` -- 含併發、架構規則、帶 cookie 寫入測試
- [x] `frontend/*` -- `client.ts`、`queryKeys.ts`、`invalidateStockQueries`、`useIdempotencyKey`、`routes.ts`、`StatusBadge`、ESLint 規則、顯示 `/health` 的首頁、`schema.d.ts`
- [x] `.github/workflows/ci.yml` -- Ruff、import-linter、pytest、tsc、ESLint、vitest、build、單一 head、`schema.d.ts` 差異
- [x] `README.md`、`docs/ai-log.md` -- clone 到跑起來的步驟；AI 紀錄

**Acceptance Criteria:**
- Given 新 clone 並完成 `.env`，when `docker compose up -d`，then PostgreSQL 17 可從主機連線，且 `foodflow`、`foodflow_test` 都存在。
- Given 空資料庫，when `alembic upgrade head` 再 `downgrade base`，then 先建出 12 張表與預設 `alert_setting`，後清空，且 `alembic check` 無差異。
- Given 後端已啟動，when `GET /health`，then 回 200；`pytest`、Ruff、`lint-imports` 全過。
- Given 前後端都啟動，when 開首頁，then 瀏覽器顯示後端 `/health` 狀態；`npm run build`、`vitest`、`tsc`、ESLint 全過。
- Given 只看 README 的新組員，when 依序執行，then 能跑起前後端與測試。
- Given 真實 PostgreSQL，when 兩連線同時扣同批次，then 第二連線確實被鎖擋住（`pg_stat_activity` 佐證），不超扣，`verify-stock` 通過；移除 `for_update` 的鎖後此測試轉紅。
- Given 帶 JWT cookie 的請求，when 打測試專用寫入路由，then 另開 Session 可讀到已落地資料。

## Implementation Notes

- 未 commit：依 CONTRIBUTING 第 9 節由本人 commit；未 push、未開 PR。
- 依 Spec「測試先行」的精神補足測試，但實際上是與實作同批完成，並以暫時移除 `with_for_update`、`populate_existing` 驗證測試會轉紅（前者 7 項全紅，後者「鎖前先讀」轉紅）。
- `app.main:create_app` 以 `uvicorn --factory` 啟動，import 不會觸發設定驗證；`scripts/export_openapi.py` 因此不需要 `.env`。
- 測試資料庫的安全檢查：整合測試要求資料庫名稱以 `_test` 結尾，否則拒絕執行。
- 使用者可見的新增依賴僅 Spec 預告的 `jsdom`、`@testing-library/react`，以及後者必要的 peer `@testing-library/dom`。
- `.github/workflows/ci.yml` 未在 GitHub 實跑。
- 審查後改動：網路失敗的 `ApiError` 用 status 0（實作者原用 503，無法與真正的 503 區分），重試規則只排除 4xx；`queryKeys.ts` 要 import `ApiError`，所以對該檔關閉 `no-restricted-imports`。
- 依審查把資料庫埠改綁 127.0.0.1 後，乾淨副本的 `alembic check` 卡住：`localhost` 先試 `::1`，封包被丟棄，而 `env.py` 沒有連線逾時。改為連線字串寫 127.0.0.1、`env.py` 用 `create_db_engine`，並加測試。
- 此機器的 Git Bash 下 `npm run`、`npx` 找不到 node，根因未查明；PowerShell 下正常，前端驗證在 PowerShell 跑，README 已記錄。
- 最終驗證在 `git ls-files` 匯出的乾淨副本執行：pytest 230、vitest 53，全部通過。

## Spec Change Log

## Review Triage Log

第 1 輪。G＝verification-gap、E＝edge-case、B＝blind。路由：patch 修正；reject 不修。

| ID | 發現 | 判定 | 路由 | 依據 |
| --- | --- | --- | --- | --- |
| G1 | `lock_ingredient_batches` 沒有併發測試 | medium | patch | FEFO 領用的鎖定入口；併發測試全走 `lock_batches` |
| G2 | CHECK 消失時 `alembic check` 看不到 | medium | patch | 探針已證實 `compare_metadata` 回 `[]`；併入 B12 |
| G3 | `test_flush_reraises_unmapped_constraints` 實際撞 NOT NULL | medium | patch | 未給 `created_by_id`、`created_at`，測試名稱與路徑不符 |
| G4 | 缺 claim 的 JWT 沒有測試 | medium | patch | 拿掉 `require` 時 `KeyError` 變 500，現有測試仍全綠 |
| G5 | `verify-stock` 未測無異動的批次 | medium | patch | 所有測試批次都經 `receive`，改成 inner join 也不會失敗 |
| G6 | `expired_quantity` 位置篩選未斷言 | medium | patch | 既有測試的批次都未過期 |
| G7 | AD-5 架構測試擋不到 `.values(remaining_quantity=...)` | medium | patch | 只掃屬性賦值；併入 B8 |
| G8 | `.env.example` 載入路徑無測試 | low | patch | `env_ignore_empty` 拿掉時 CI 仍綠，但照 README 做會啟動失敗；補一個測試即可 |
| G9 | 瀏覽器接線只有人工驗證 | low | reject | 本輪已實跑；目前沒有 e2e 基礎設施，補上不是小修 |
| G10 | CI 尚未在 GitHub 實跑 | low | reject | 非程式缺陷；push 前無法驗證，於交付時明確告知 |
| E1 | refetch 失敗時同時顯示異常與正常 | medium | patch | `isError` 與舊 `data` 可並存，HomePage 兩個分支都會渲染 |
| E2 | 回應 status 非 ok／degraded 時無訊息 | low | reject | 後端只回這兩值；undefined 時 TanStack 轉為 error，會顯示異常 |
| E3 | 2xx 非 JSON 被當成功 | medium | patch | `parseJson` 吞掉錯誤，違反 NFR-05「未確認成功不得顯示完成」；併入 B16 |
| E4 | 網路失敗丟 `TypeError` 而非 `ApiError` | medium | patch | `fetch` 未包住，違反 AD-17 統一錯誤格式；併入 B16 |
| E5 | 401 INVALID_CREDENTIALS 被導頁 | false | reject | 只有登入端點回此碼，而 `redirectToLogin` 已排除登入頁 |
| E6 | 查詢對 4xx 重試 | medium | patch | `new QueryClient()` 用預設重試 3 次；併入 B15 |
| E7 | 未知 `AlertAction` 回 undefined | low | reject | switch 已窮舉；後端新增類型須同步改前端，日常不會遇到 |
| E8 | 未列出的 4xx 回 `VALIDATION_ERROR` | low | reject | 只有打錯方法才會遇到；修正要新增 AD-16 未列的錯誤碼，已告知 Ken |
| E9 | 有 dist 時 POST 未知 `/api/v1` 回 405 | low | reject | 同 E8，前端型別由 OpenAPI 產生，日常不會遇到 |
| E10 | details 含 date、UUID 時序列化失敗 | low | reject | 目前沒有呼叫者，AD-16 的固定 details 不含這些型別，失敗時明確報錯 |
| E11 | details 內金額輸出三位小數 | low | reject | AD-16 的固定 details 沒有金額，目前沒有呼叫者；併入 B14 |
| E12 | `DataError` 溢位回 500 | low | reject | 要接近上限的數量乘單價才會發生，餐廳資料不會遇到 |
| E13 | FK 違反不會預設轉 `REFERENCED` | low | reject | `constraint_errors` 參數已提供覆寫；未對應者明確失敗是設計 |
| E14 | 鎖等待無上限、死結回 500 | low | reject | AD-7 鎖定順序已防死結，交易短且 AD 未要求逾時；已告知 Ken 於壓測再評估 |
| E15 | `taipei_day_range` 的 date.max、反向區間 | low | reject | 區間驗證屬於 reports 模組的輸入檢查 |
| E16 | 型別直接放行 Decimal | false | reject | HTTP 輸入只會是字串或數字，走正規式；Decimal 只來自內部 |
| E17 | Ledger 傳 NaN 丟 `InvalidOperation` | false | reject | API 型別已擋 NaN，內部傳入時明確失敗 |
| E18 | Ledger 接受其他 Session 的舊物件 | false | reject | AD-6 同請求共用 Session，`populate_existing` 更新同一物件，未證明可達 |
| E19 | 未 flush 時讀 `receipt_number` 丟 `TypeError` | false | reject | 明確失敗屬正確行為 |
| E20 | `verify-stock` 不查報廢數量不符 | low | reject | 主幹只定義三項檢查，骨架依此實作；併入 B11，已告知 Ken |
| E21 | `verify-stock` 不查異動鏈中段 | low | reject | 同 E20 |
| E22 | 未檢查 `DATABASE_URL` 驅動 | false | reject | SQLAlchemy 2.1 的 `postgresql://` 預設即 psycopg，且 `.env.example` 已註明 |
| E23 | 資料庫埠綁定所有介面 | medium | patch | `docker ps` 實見 `0.0.0.0:5432`，密碼已進版控；併入 B1 |
| E24 | 改 `POSTGRES_PORT` 要同步改 URL | low | patch | 一行註解即可，直接修正 |
| E25 | 測試路由 `quantity_after` 不接受 0 | low | patch | 扣到 0 時會 500，組員可能照抄；直接改型別 |
| B1 | 資料庫埠對區網開放 | medium | patch | 同 E23 |
| B2 | 列鎖等待沒有上限 | low | reject | 同 E14 |
| B3 | HTTP 狀態對應與 demo 差異 | low | reject | 同 E8、E9 |
| B4 | 遺失的靜態資產回 200 HTML | low | patch | 程式碼確認；`assets/` 回 404 是直接修正 |
| B5 | 外鍵錯誤沒有共用轉換 | low | reject | 同 E13；`commit` 時的違反屬未遵守 AD-6，明確失敗；`move` 到不存在位置由 Service 先驗證 |
| B6 | 缺共用 `FakeUnitOfWork` | medium | reject | 真實但不在骨架交付清單，intent 限定依清單；已告知 Ken |
| B7 | 後端缺 `Idempotency-Key` 共用解析 | medium | reject | 同 B6 |
| B8 | AD-5 架構測試可被繞過 | medium | patch | 同 G7；`.values` 與建構子走 keyword 掃描 |
| B9 | AD-10 禁用清單有缺口 | low | patch | AD-10 明列 `CURRENT_DATE`，清單卻沒有；加幾行。前端 `new Date()` 不在 AD-10 檢查範圍，不做 |
| B10 | 併發測試只測最簡單路徑 | medium | patch | 同 G1，含等鎖期間被扣到 0；防重送競態屬業務功能、反向順序已有回傳順序測試，不做 |
| B11 | `verify-stock` 核對範圍不足 | low | reject | 同 E20 |
| B12 | 資料庫約束不完整 | medium | patch | 只修約束比對（同 G2）；delta 正負等新約束不在 AD-5 列表，Ledger 已保證 |
| B13 | `clean_tables` 不還原 `alert_setting`、只後清 | medium | patch | 預警測試改天數後會互相影響；中斷的上一輪會造成唯一鍵衝突 |
| B14 | `DomainError` 金額三位小數 | low | reject | 同 E11 |
| B15 | 查詢對 4xx 重試 | medium | patch | 同 E6 |
| B16 | `client.ts` 錯誤處理未統一 | medium | patch | 同 E3、E4 |
| B17 | 路由無錯誤邊界、缺 dates 樣式 | low | patch | 預設錯誤頁是英文，違反 NFR-01；`@mantine/dates` 已是相依卻沒載入樣式。dayjs 語系不做 |
| B18 | 日誌無設定、可能帶出參數 | medium | patch | 只加 `hide_parameters=True`，對應「不可記錄密碼」；logging 設定為 low，不做 |
| B19 | README 與 CI 不符、缺區網 demo | low | patch | 文件直接修正 |
| B20 | 前端測試名稱與內容不符 | low | patch | 改名即可；staleTime 測試不動 |
| B21 | production 仍公開 `/docs` | low | reject | Deferred 明列對外部署前才處理，目前只在本機與區網 |

## Design Notes

- **`/health` 放根路徑**：符合完成標準字面，不受 `/api/v1` 預設驗證影響；Vite 另加 `/health` proxy。走完整分層（router → service → repository），兼作組員範例。
- **auth stub 驗 cookie，不回固定帳號**：回固定帳號等於認證後門，「帶登入 cookie」的測試也失去意義。解碼方式依 AD-15（Clock 比對 `exp`、比對 `token_version`、確認啟用）；謝文佳 11/7 接手時補登入端點與 token 簽發。
- **寫入測試路由只存在於測試**：`create_app(extra_api_routers=...)` 由測試注入，正式 app 沒有任何業務寫入端點。
- **清單外的納入項**：`domain/expiry.py`、`domain/stock.py`（AD-11、AD-21 指定唯一定義，兩個模組共用）、`cli.py verify-stock`（架構要求併發測試結尾執行）。
- **清單外的不納入**：`create-admin`、`seed-demo`、`scripts/backup.sh`、`restore.sh`、Strategy、Rule、Notifier。
- **Stack 外新增**：前端測試需要的 `jsdom`、`@testing-library/react`（T5 已預告）。
- **`inventory_batch.received_date`**：SRS 概念資料未列；FEFO 依進貨日排序，鎖定查詢又不可 join，所以由 `receive` 寫入一份不可變副本。
- **時間欄位無 server default**：AD-10 禁 `func.now()`，由 Service 傳入；migration 預設列用 `SystemClock`。

## Verification

**Commands:**
- `docker compose up -d` -- 容器 healthy，主機可連
- `uv run alembic upgrade head`、`uv run alembic check`、`uv run alembic downgrade base` -- 全部成功
- `uv run pytest`、`uv run ruff check .`、`uv run lint-imports` -- 全過
- `npm ci`、`npm run lint`、`npx tsc --noEmit`、`npx vitest run`、`npm run build` -- 全過

**Manual checks (if no CLI):**
- 同時啟動 uvicorn 與 `npm run dev`，以瀏覽器（或等效方式）確認首頁實際顯示 `/health` 狀態；以暫時移除列鎖確認併發測試轉紅。
