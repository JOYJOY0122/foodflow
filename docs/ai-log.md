# AI 使用紀錄

每次使用 AI 都要記錄，尤其是 AI 錯在哪裡、怎麼修正。

| 日期 | 成員 | SE activity | 用的 skill／工具 | 輸入摘要 | AI 產出 | 人工修正與原因 |
| --- | --- | --- | --- | --- | --- | --- |
| 2026-10-29 | Ken | 環境建置 | BMAD v6.12.4、Test Architect、Claude | 安裝 BMAD 與 Test Architect；請 Claude 修正輸出資料夾並設定對話語言 | 覆寫設定：輸出資料夾改回 `_bmad-output`，全組對話語言設為繁體中文 | 安裝時把語言誤填進輸出資料夾，所以用覆寫設定改回 |
| 2026-10-29 | Ken | 需求 | bmad-agent-pm | 請 PM agent 產出 PRD | PRD | 範圍太大（食譜、銷售扣料、Email），改採 SRS v2.0 並刪減 |
| 2026-11-04 | Ken | 需求 | Claude | 兩份 AI 產出的 PRD／SRS（FoodFlow PRD 初稿、SRS v2.0） | 合併為 SRS v3.0（`docs/srs.md`） | 刪減範圍（食譜、銷售扣料、Email 改列延伸或不做）；補低庫存提醒、進貨單價與報廢損失金額、非 FEFO 標記；交易更正延到期末；修正定位為單一門市不限規模 |
| 2026-11-05 | Ken | 架構設計 | bmad-agent-architect、bmad-architecture | SRS v3.0；指定技術棧、設計層次 4、NUMERIC(12,3)、交易與列鎖、防重送、C1～C5 | 架構主幹（`_bmad-output/planning-artifacts/architecture/architecture-foodflow-2026-11-05/`）與三份審查 | 初稿經三個獨立審查抓出問題後由 AI 修正：鎖後讀到舊值、StockLedger 無介面、低庫存定義分歧、FR-18 算法、固定時鐘下 JWT 失效。人工審閱：確認不做每日排程（SRS 為查詢時即時計算），並修正分工表中殘留的排程描述；確認報廢分布權限；要求補寫 AD-3 的取捨說明 |
| 2026-11-05 | Ken | 架構設計 | bmad-agent-architect | 定稿的架構主幹、`docs/team-tasks.md` 的 C 文件章節 | C 文件草稿 `docs/c-software-design.md`、PlantUML 原始檔、README 開發環境需求、更新分工表 | 待 Ken 檢查：repo 內沒有範例 G2，章節依分工表，須對照範例；PlantUML 圖尚未匯出。AI 發現主幹 C3 寫了 Email，違反分工表規則，已改為外部通知 |
| 2026-11-05 | Ken | 架構設計 | Claude、PlantUML、Graphviz | `docs/diagrams/` 的兩個 PlantUML 原始檔 | PNG 圖檔，並放入 `docs/c-software-design.md` | 中文正常，不需另設字型；檢查圖時發現 AI 把 alerts 標成「唯讀查詢的模組」，但它會寫 `alert_setting`，已改為「不修改庫存的模組」 |
| 2026-11-05 | Ken | 需求 | bmad-agent-architect | 定稿的架構決定 | 更新 SRS 第 4.1、7.1、10.3 節並同步 `prd.md`；更新架構主幹的已確認決策 | Ken 決定：報廢分布與損失金額限管理者；NFR-07 負載測試排期末，負責人待定 |
| 2026-11-05 | Ken | 架構設計 | Claude、PlantUML | 系統架構圖太寬，要求改為由上往下、寬度約 1000 像素內 | 調整 `c-system-architecture.puml` 版面並重新轉成 PNG | 第一版寬 1185 未達標；第二版的隱藏連線打亂前端順序，已捨棄；比較多種版面後採用寬 791 的版本 |
| 2026-11-05 | Ken | 實作 | Claude Code | `spec-chore-skeleton.md`、架構主幹、技術查證審查 | 前後端骨架（`backend/`、`frontend/`、`docker-compose.yml`、CI）：12 張表 migration、`core/`、`StockLedger` 與 fake、auth stub、`/health`、`verify-stock`、前端共用層、ESLint 規則；未做業務功能 | 實跑時抓到 AI 的錯：`stock_levels` 無批次時實體量回 NULL；`alembic.ini` 含中文，在 cp950 的 Windows 無法讀取；自動命名的外鍵超過 PostgreSQL 63 字元；ESLint glob `**/api`、`**/client` 誤擋 `shared/api/*` 與 `react-dom/client`；FastAPI 0.162 的 `app.routes` 只有外殼，路由檢查要用 `iter_route_contexts`。以暫時移除列鎖確認併發測試轉紅。待 Ken 檢查：CI 尚未在 GitHub 實跑；程式碼需本人看懂後才 commit |
| 2026-11-05 | Ken | 實作審查 | bmad-build、三個獨立審查 subagent | 骨架 diff | 56 項發現，逐項驗證後修正 AI 的錯：瀏覽器在 refetch 失敗時同時顯示正常與異常；網路失敗沒有轉成統一錯誤；對 4xx 也重試；缺少 `lock_ingredient_batches` 併發測試；`test_flush_reraises_unmapped_constraints` 實際撞的是 NOT NULL；架構測試擋不到 `.values(remaining_quantity=...)`；資料庫埠對區網開放 | AI 把網路失敗標成假的 503，改為 status 0。依審查把埠改綁 `127.0.0.1` 後，乾淨副本驗證時 `alembic check` 卡住：`localhost` 先試 `::1` 而 `env.py` 沒有連線逾時，改為連線字串寫 `127.0.0.1`、`env.py` 用共用 engine，並加測試。不修的項目與原因見 spec 的 Review Triage Log |
| 2026-11-05 | Ken | 實作 | Claude Code、bmad-build、三個獨立審查 subagent | `spec-shared-idempotency-and-fake-uow.md`、AD-8、AD-6 | `core/idempotency.py`（`check_replay`）、`get_idempotency_key`、`tests/fakes/fake_uow.py` 與真實／fake UnitOfWork 契約測試；未做業務端點 | Ken 決定：依 AD-8，確認入庫不收 `Idempotency-Key`；重送比對一併提供。AI 原本把確認入庫列為共用對象，對照 AD-8 後發現與狀態機規則衝突，改提問確認。審查 16 項，補了 DUPLICATE 訊息斷言、以 `find_operation` 結果串接的測試；其餘駁回原因見 spec 的 Review Triage Log。已知限制：Fake rollback 不還原 fake 資料 |
