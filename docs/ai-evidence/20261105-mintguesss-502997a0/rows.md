# AI 使用紀錄草稿：/bmad-agent-dev

> AI 依對話紀錄自動起草。**請本人檢查每一列**，特別是「人工判斷與修正」與「採用程度」；確認後把「狀態」改成「已確認」。
> 「軟工活動」只能填：需求、設計、程式、測試、除錯、審查、文件、管理；「採用程度」只能填：直接採用、小幅修改、大幅修改、僅參考、不採用。不需要的列整段刪掉。

## 1

- 日期：2026-11-05
- 成員：黃予岑
- 軟工活動：程式
- 具體工作：建立 chore/skeleton 分支，依 ARCHITECTURE-SPINE.md 骨架清單實作後端（12張表 migration、FastAPI /health、core/db.py 列鎖、StockLedger、auth stub）與前端骨架（共用 API 層、首頁健康狀態顯示），逐項實跑 6 項完成標準後本地 commit
- AI 工具／BMad 技能：Claude Code＋bmad-build（含 implementation subagent）
- Prompt 重點：開新分支依架構骨架交付清單建立專案骨架，不做業務功能；列出 6 項完成標準（DB 連線、Alembic 升降版、pytest 全過、前端 build/vitest 通過、README 步驟完整、真實 PostgreSQL 驗證列鎖）需逐項實跑回報；commit 不加 AI 署名，push 前需使用者確認
- AI 產出摘要：spec-chore-skeleton.md；12 張資料表 migration；backend/app/core/db.py、StockLedger、auth stub、/health endpoint；前端共用 API 層與首頁健康狀態顯示；並發鎖測試；本地 commit cb18185（104 檔案／+11099 行），pytest 230 passed、vitest 53 passed
- 人工判斷與修正：對 AI 提出的 5 項 spec 未明決定（health 路徑放根路徑、auth stub 真實驗 JWT、測試專用寫入路由、模組範圍排除 create-admin/seed-demo、前端加測試套件）皆選擇 AI 建議選項；spec token 數超標準提議拆分時，選擇保留完整 spec；核准審查流程可用 subagent；完成後明確指示「不要 push，我自己來」
- 採用程度：直接採用
- 截圖／檔案：docs/ai-evidence/20261105-mintguesss-502997a0/turn-02.png、docs/ai-evidence/20261105-mintguesss-502997a0/turn-06.png、docs/ai-evidence/20261105-mintguesss-502997a0/turn-07.png、docs/ai-evidence/20261105-mintguesss-502997a0/turn-08.png、docs/ai-evidence/20261105-mintguesss-502997a0/turn-09.png、docs/ai-evidence/20261105-mintguesss-502997a0/transcript.md
- 對應文件章節：C（軟體設計）
- 狀態：待確認

## 2

- 日期：2026-11-05
- 成員：黃予岑
- 軟工活動：審查
- 具體工作：以三個獨立審查者（Blind Hunter、Edge Case Hunter、Verification Gap）對 skeleton 實作 diff 交叉審查，AI 逐項驗證並分級記錄於 spec 的 Review Triage Log，另駁回「以假 503 代表斷線」建議並改為查 code 修正
- AI 工具／BMad 技能：Claude Code＋bmad-build 審查步驟（3 個 review subagent，背景執行＋SendMessage 接續）
- Prompt 重點：要求三個審查者各自找問題（盲審、邊界案例、驗證缺口），再由 AI 逐項對照程式碼判定是否為 intent_gap／bad_spec，決定是否需要修正
- AI 產出摘要：共 56 項審查發現（7+3 項驗證缺口相關、25 項邊界案例、21 項盲審），分級後部分交回實作 subagent 修正，並由 AI 自行修正前端網路斷線誤判 503 的問題
- 人工判斷與修正：（待本人補充）
- 採用程度：小幅修改
- 截圖／檔案：docs/ai-evidence/20261105-mintguesss-502997a0/turn-02.png、docs/ai-evidence/20261105-mintguesss-502997a0/turn-06.png、docs/ai-evidence/20261105-mintguesss-502997a0/turn-07.png、docs/ai-evidence/20261105-mintguesss-502997a0/turn-08.png、docs/ai-evidence/20261105-mintguesss-502997a0/transcript.md
- 對應文件章節：C（軟體設計）
- 狀態：待確認

## 3

- 日期：2026-11-05
- 成員：黃予岑
- 軟工活動：審查
- 具體工作：使用 bmad-walkthrough 技能，請 AI 帶著檢視 ledger_sqlalchemy.py、db.py、test_concurrency.py 三個檔案的設計意圖與列鎖實作邏輯
- AI 工具／BMad 技能：Claude Code＋bmad-walkthrough
- Prompt 重點：指定三個檔案，要求 AI 依 Orientation→Walkthrough→Detail Pass→Testing 路線說明列鎖（for_update）、StockLedger 寫入口與並發測試的設計理由
- AI 產出摘要：產生閱讀路線與逐段說明，指出 AD-7 要求所有鎖取得都經過 for_update() 並帶 populate_existing，避免讀到鎖前舊值；逐行對應 db.py、ledger_sqlalchemy.py、test_concurrency.py 程式碼
- 人工判斷與修正：指定只看這 3 個檔案，聚焦列鎖與並發測試邏輯
- 採用程度：僅參考
- 截圖／檔案：docs/ai-evidence/20261105-mintguesss-502997a0/turn-10.png、docs/ai-evidence/20261105-mintguesss-502997a0/turn-11.png、docs/ai-evidence/20261105-mintguesss-502997a0/transcript.md
- 對應文件章節：D（物件設計）
- 狀態：待確認

## 4

- 日期：2026-11-05
- 成員：黃予岑
- 軟工活動：程式
- 具體工作：在 chore/skeleton 分支上新增兩個共用工具：依 AD-8 規範的 Idempotency-Key 標頭解析／重送比對（check_replay），以及測試用 FakeUnitOfWork，並撰寫對應測試後本地 commit
- AI 工具／BMad 技能：Claude Code＋bmad-build
- Prompt 重點：補兩個共用工具（Idempotency-Key 驗證給領用／報廢／確認入庫共用、測試用 FakeUnitOfWork），附測試，不做業務功能，完成後 commit 不 push
- AI 產出摘要：core/idempotency.py（標頭常數＋check_replay 純函式）、dependencies.py 新增 get_idempotency_key、tests/fakes/fake_uow.py、真實與 fake UnitOfWork 共用契約測試；pytest 由 230 增至 261 passed；本地 commit e2aa474
- 人工判斷與修正：對 AI 提問選擇：確認入庫依 AD-8 不收 Idempotency-Key（靠狀態機防重送）；重送比對（check_replay）要一併提供而不只做標頭解析
- 採用程度：直接採用
- 截圖／檔案：docs/ai-evidence/20261105-mintguesss-502997a0/turn-12.png、docs/ai-evidence/20261105-mintguesss-502997a0/transcript.md
- 對應文件章節：D（物件設計）
- 狀態：待確認

## 5

- 日期：2026-11-05
- 成員：黃予岑
- 軟工活動：審查
- 具體工作：以三個獨立審查者對 idempotency／FakeUoW 實作 diff 審查，AI 驗證後決定保留 2 項修正、其餘駁回並記錄理由
- AI 工具／BMad 技能：Claude Code＋bmad-build 審查步驟（3 個 review subagent）
- Prompt 重點：同前次審查流程，針對新增共用工具的 diff 進行盲審、邊界案例、驗證缺口檢查
- AI 產出摘要：共 16 項審查發現，AI 驗證後僅採納 2 項（補強訊息斷言、改用真實 find_operation 結果串接），其餘駁回並記錄理由；同步更新 docs/ai-log.md
- 人工判斷與修正：（待本人補充）
- 採用程度：小幅修改
- 截圖／檔案：docs/ai-evidence/20261105-mintguesss-502997a0/turn-12.png、docs/ai-evidence/20261105-mintguesss-502997a0/turn-13.png、docs/ai-evidence/20261105-mintguesss-502997a0/transcript.md
- 對應文件章節：D（物件設計）
- 狀態：待確認
