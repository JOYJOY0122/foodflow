# AI 使用紀錄草稿：<pasted_content id="dc2b">

> AI 依對話紀錄自動起草。**請本人檢查每一列**，特別是「人工判斷與修正」與「採用程度」；確認後把「狀態」改成「已確認」。
> 「軟工活動」只能填：需求、設計、程式、測試、除錯、審查、文件、管理；「採用程度」只能填：直接採用、小幅修改、大幅修改、僅參考、不採用。不需要的列整段刪掉。

## 1

- 日期：2026-11-05
- 成員：黃予岑
- 軟工活動：設計
- 具體工作：依 ARCHITECTURE-SPINE.md 的骨架交付清單撰寫 chore/skeleton 任務的實作規格
- AI 工具／BMad 技能：Claude Code＋bmad-agent-dev（bmad-build）
- Prompt 重點：依架構主幹的骨架交付清單建立專案骨架，訂定 6 項完成標準
- AI 產出摘要：`spec-chore-skeleton.md` 實作規格與 5 項待決事項
- 人工判斷與修正：使用者對5項決策、spec是否拆分、審查是否用subagent三個問題都選擇AI建議選項（批准並繼續、保留完整spec、可以用subagent）
- 採用程度：直接採用
- 截圖／檔案：docs/ai-evidence/20261105-mintguesss-502997a0/turn-02.png、docs/ai-evidence/20261105-mintguesss-502997a0/transcript.md
- 對應文件章節：C（架構）
- 狀態：已確認

## 2

- 日期：2026-11-05
- 成員：黃予岑
- 軟工活動：程式
- 具體工作：以背景subagent依spec實作前後端專案骨架（12張資料表migration、core模組、StockLedger、auth stub、/health、前端共用層）
- AI 工具／BMad 技能：Claude Code＋bmad-build（subagent）
- Prompt 重點：依 spec 實作前後端骨架，不做業務功能
- AI 產出摘要：12 張表的 migration、core、StockLedger、auth stub、/health、前端共用層與 CI，共 104 個檔案
- 人工判斷與修正：本人在指令中訂定 6 項完成標準，並要求以真實 PostgreSQL 驗證列鎖不會超扣，不只依賴 SQLite
- 採用程度：小幅修改
- 截圖／檔案：docs/ai-evidence/20261105-mintguesss-502997a0/turn-02.png、docs/ai-evidence/20261105-mintguesss-502997a0/transcript.md
- 對應文件章節：C（架構）
- 狀態：已確認

## 3

- 日期：2026-11-05
- 成員：黃予岑
- 軟工活動：測試
- 具體工作：逐項實跑6項骨架完成標準，包括PostgreSQL連線、Alembic升降版、/health與pytest、前端build與vitest、README照做驗證、真實PostgreSQL列鎖併發測試
- AI 工具／BMad 技能：Claude Code
- Prompt 重點：6 項完成標準逐項實際執行並回報
- AI 產出摘要：後端 230 個測試、前端 53 個測試通過；真實 PostgreSQL 列鎖併發測試 15 項通過
- 人工判斷與修正：本人要求每項標準實際執行並回報結果，不接受只回報「已完成」
- 採用程度：直接採用
- 截圖／檔案：docs/ai-evidence/20261105-mintguesss-502997a0/turn-02.png、docs/ai-evidence/20261105-mintguesss-502997a0/turn-08.png、docs/ai-evidence/20261105-mintguesss-502997a0/turn-09.png、docs/ai-evidence/20261105-mintguesss-502997a0/transcript.md
- 對應文件章節：F（測試報告）
- 狀態：已確認

## 4

- 日期：2026-11-05
- 成員：黃予岑
- 軟工活動：審查
- 具體工作：以三個獨立審查subagent（Blind Hunter、Edge Case Hunter、Verification Gap）審查骨架實作，逐項在程式碼上驗證分級後修正問題並完成本地commit
- AI 工具／BMad 技能：Claude Code＋bmad-code-review（3 個審查 subagent）
- Prompt 重點：以三個獨立審查者審查骨架實作
- AI 產出摘要：56 項審查發現，逐項驗證分級後修正需要修的項目
- 人工判斷與修正：使用者在審查subagent因5小時額度上限三度中斷後下令「繼續」讓其接續執行；並重申「不要push，我自己來」
- 採用程度：小幅修改
- 截圖／檔案：docs/ai-evidence/20261105-mintguesss-502997a0/turn-02.png、docs/ai-evidence/20261105-mintguesss-502997a0/turn-03.png、docs/ai-evidence/20261105-mintguesss-502997a0/turn-04.png、docs/ai-evidence/20261105-mintguesss-502997a0/turn-05.png、docs/ai-evidence/20261105-mintguesss-502997a0/turn-06.png、docs/ai-evidence/20261105-mintguesss-502997a0/turn-07.png、docs/ai-evidence/20261105-mintguesss-502997a0/turn-08.png、docs/ai-evidence/20261105-mintguesss-502997a0/turn-09.png、docs/ai-evidence/20261105-mintguesss-502997a0/transcript.md
- 對應文件章節：C（架構）
- 狀態：已確認

## 5

- 日期：2026-11-05
- 成員：黃予岑
- 軟工活動：審查
- 具體工作：以bmad-walkthrough技能請AI逐步解說ledger_sqlalchemy.py、db.py、test_concurrency.py三個檔案的鎖定機制設計
- AI 工具／BMad 技能：Claude Code＋bmad-walkthrough
- Prompt 重點：逐段講解 ledger_sqlalchemy.py、db.py、test_concurrency.py 的列鎖設計
- AI 產出摘要：三個檔案的鎖定機制與併發測試解說
- 人工判斷與修正：本人要求逐段講解列鎖與併發測試，確保能自己說明防超領的做法後才 push
- 採用程度：僅參考
- 截圖／檔案：docs/ai-evidence/20261105-mintguesss-502997a0/turn-10.png、docs/ai-evidence/20261105-mintguesss-502997a0/turn-11.png、docs/ai-evidence/20261105-mintguesss-502997a0/transcript.md
- 對應文件章節：D（物件設計）
- 狀態：已確認

## 6

- 日期：2026-11-05
- 成員：黃予岑
- 軟工活動：設計
- 具體工作：為新增Idempotency-Key解析驗證與測試用FakeUnitOfWork兩個共用工具撰寫實作規格，並就AD-8適用範圍與重送比對功能範疇提出決策請裁示
- AI 工具／BMad 技能：Claude Code＋bmad-build
- Prompt 重點：在骨架補上共用的 Idempotency-Key 解析與 FakeUnitOfWork
- AI 產出摘要：`spec-shared-idempotency-and-fake-uow.md` 與兩個決策提問
- 人工判斷與修正：使用者對確認入庫是否收Idempotency-Key、是否一併提供重送比對兩個問題都選擇AI建議選項
- 採用程度：直接採用
- 截圖／檔案：docs/ai-evidence/20261105-mintguesss-502997a0/turn-12.png、docs/ai-evidence/20261105-mintguesss-502997a0/transcript.md
- 對應文件章節：D（物件設計）
- 狀態：已確認

## 7

- 日期：2026-11-05
- 成員：黃予岑
- 軟工活動：程式
- 具體工作：實作core/idempotency.py重送比對純函式、dependencies.py的標頭解析依賴、tests/fakes/fake_uow.py的FakeUnitOfWork並撰寫對應測試
- AI 工具／BMad 技能：Claude Code＋bmad-build
- Prompt 重點：依 spec 實作兩個共用工具並附測試
- AI 產出摘要：`core/idempotency.py`、`get_idempotency_key`、`tests/fakes/fake_uow.py` 與真實／fake UnitOfWork 契約測試
- 人工判斷與修正：本人判斷 Idempotency-Key 解析與 FakeUnitOfWork 若由各模組負責人各寫一份會不一致，要求在骨架統一提供
- 採用程度：直接採用
- 截圖／檔案：docs/ai-evidence/20261105-mintguesss-502997a0/turn-12.png、docs/ai-evidence/20261105-mintguesss-502997a0/transcript.md
- 對應文件章節：D（物件設計）
- 狀態：已確認

## 8

- 日期：2026-11-05
- 成員：黃予岑
- 軟工活動：測試
- 具體工作：執行pytest、ruff、lint-imports驗證新增的idempotency與FakeUnitOfWork程式碼無迴歸
- AI 工具／BMad 技能：Claude Code
- Prompt 重點：驗證新增程式沒有造成迴歸
- AI 產出摘要：pytest、ruff、lint-imports 全部通過
- 人工判斷與修正：本人檢閱驗證結果後未再修改
- 採用程度：直接採用
- 截圖／檔案：docs/ai-evidence/20261105-mintguesss-502997a0/turn-12.png、docs/ai-evidence/20261105-mintguesss-502997a0/transcript.md
- 對應文件章節：F（測試報告）
- 狀態：已確認

## 9

- 日期：2026-11-05
- 成員：黃予岑
- 軟工活動：審查
- 具體工作：以三個獨立審查subagent審查新增的idempotency/FakeUnitOfWork實作，逐項驗證分級後完成本地commit並更新docs/ai-log.md
- AI 工具／BMad 技能：Claude Code＋bmad-code-review（3 個審查 subagent）
- Prompt 重點：審查共用工具的實作
- AI 產出摘要：審查發現分級，保留 2 項修正、其餘駁回並記錄理由
- 人工判斷與修正：本人檢閱審查分級結果後未再修改
- 採用程度：小幅修改
- 截圖／檔案：docs/ai-evidence/20261105-mintguesss-502997a0/turn-12.png、docs/ai-evidence/20261105-mintguesss-502997a0/turn-13.png、docs/ai-evidence/20261105-mintguesss-502997a0/transcript.md
- 對應文件章節：D（物件設計）
- 狀態：已確認
