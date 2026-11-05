# AI 使用紀錄草稿：/bmad-agent-dev

> AI 依對話紀錄自動起草。**請本人檢查每一列**，特別是「人工判斷與修正」與「採用程度」；確認後把「狀態」改成「已確認」。
> 「軟工活動」只能填：需求、設計、程式、測試、除錯、審查、文件、管理；「採用程度」只能填：直接採用、小幅修改、大幅修改、僅參考、不採用。不需要的列整段刪掉。

## 1

- 日期：2026-11-05
- 成員：黃予岑
- 軟工活動：程式
- 具體工作：於 chore/seed-demo 分支在 app/cli.py 新增 seed-demo 指令，灌入含 2 儲存位置、3 供應商、4 分類、約 10 種食材與 2 張已確認進貨單的示範資料並完成 commit
- AI 工具／BMad 技能：Claude Code + bmad-build
- Prompt 重點：要求新增可重複執行的 seed-demo 指令，資料需涵蓋已過期/今日到期/即期/正常/低於安全庫存等情境，批次與異動要符合 StockLedger 規則且灌完後 verify-stock 需通過，已有資料時提示、加 --reset 才清空重灌，commit 不加 AI 署名且不 push
- AI 產出摘要：完成 backend/app/cli.py 的 seed-demo 指令、spec-chore-seed-demo.md 規格文件，288 項測試與 ruff/lint-imports 全過，並以子程序對 foodflow_test 實測灌入後 verify-stock 通過，最終 commit 094aba3
- 人工判斷與修正：使用者在需求中明確規定資料情境組合、StockLedger 規則、--reset 行為與 commit 不可有 AI 署名／不 push；另有 4 項行為（production 保護、--reset 範圍、demo-seed 操作者帳號、預警天數為 0 的處理）由 AI 自行決定，是否認可待本人確認（待本人補充）
- 採用程度：直接採用
- 截圖／檔案：docs/ai-evidence/20261105-mintguesss-470d0799/turn-02.png、docs/ai-evidence/20261105-mintguesss-470d0799/transcript.md
- 對應文件章節：D 物件設計
- 狀態：待確認

## 2

- 日期：2026-11-05
- 成員：黃予岑
- 軟工活動：測試
- 具體工作：撰寫 backend/tests/integration/test_seed_demo.py，驗證灌入資料後五種預警情境俱全且 verify-stock 可通過
- AI 工具／BMad 技能：Claude Code + bmad-build
- Prompt 重點：要求附測試，驗證示範資料涵蓋各預警情境，且灌完後 verify-stock 必須通過
- AI 產出摘要：新增 test_seed_demo.py，先產生紅燈測試確認情境缺口，待實作完成後轉綠燈
- 人工判斷與修正：（待本人補充）
- 採用程度：直接採用
- 截圖／檔案：docs/ai-evidence/20261105-mintguesss-470d0799/turn-02.png、docs/ai-evidence/20261105-mintguesss-470d0799/transcript.md
- 對應文件章節：E 測試計畫
- 狀態：待確認

## 3

- 日期：2026-11-05
- 成員：黃予岑
- 軟工活動：審查
- 具體工作：呼叫 Blind Hunter sub-agent 對 seed-demo 改動進行多面向 code review
- AI 工具／BMad 技能：Claude Code + bmad-build（Blind Hunter review sub-agent）
- Prompt 重點：（為 bmad-build 工作流程內建審查步驟自動觸發，非使用者逐字指定）
- AI 產出摘要：列出 11 項審查發現，其中查證密碼雜湊實際未使用真正 Argon2（有 UnknownHashError 風險）等問題
- 人工判斷與修正：（待本人補充）
- 採用程度：小幅修改
- 截圖／檔案：docs/ai-evidence/20261105-mintguesss-470d0799/turn-02.png、docs/ai-evidence/20261105-mintguesss-470d0799/transcript.md
- 對應文件章節：F 測試報告
- 狀態：待確認

## 4

- 日期：2026-11-05
- 成員：黃予岑
- 軟工活動：除錯
- 具體工作：依審查發現修正密碼改存真正的 Argon2 雜湊並補上情境對照測試
- AI 工具／BMad 技能：Claude Code + bmad-build
- Prompt 重點：（源自審查結果的自動修補，非使用者原始 prompt 逐字要求）
- AI 產出摘要：修正密碼雜湊邏輯改用真正 Argon2、補充對照測試，並更新 deferred-work.md 記錄延後與駁回項目
- 人工判斷與修正：（待本人補充）
- 採用程度：直接採用
- 截圖／檔案：docs/ai-evidence/20261105-mintguesss-470d0799/turn-02.png、docs/ai-evidence/20261105-mintguesss-470d0799/transcript.md
- 對應文件章節：D 物件設計
- 狀態：待確認

## 5

- 日期：2026-11-05
- 成員：黃予岑
- 軟工活動：文件
- 具體工作：更新 README 補上 seed-demo 使用方式，並撰寫 spec-chore-seed-demo.md 與 deferred-work.md
- AI 工具／BMad 技能：Claude Code + bmad-build
- Prompt 重點：要求 README 補上使用方式
- AI 產出摘要：更新 README.md 使用說明，新增 spec 文件記錄開發決策（production 保護、--reset 範圍、operator 帳號、預警天數為 0 的行為），並以 deferred-work.md 列出 2 項延後事項
- 人工判斷與修正：（待本人補充）
- 採用程度：直接採用
- 截圖／檔案：docs/ai-evidence/20261105-mintguesss-470d0799/turn-02.png、docs/ai-evidence/20261105-mintguesss-470d0799/transcript.md
- 對應文件章節：A 專案管理
- 狀態：待確認
