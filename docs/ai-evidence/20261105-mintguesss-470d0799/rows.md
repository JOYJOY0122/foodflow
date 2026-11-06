# AI 使用紀錄草稿：<pasted_content id="e69a">

> AI 依對話紀錄自動起草。**請本人檢查每一列**，特別是「人工判斷與修正」與「採用程度」；確認後把「狀態」改成「已確認」。
> 「軟工活動」只能填：需求、設計、程式、測試、除錯、審查、文件、管理；「採用程度」只能填：直接採用、小幅修改、大幅修改、僅參考、不採用。不需要的列整段刪掉。

## 1

- 日期：2026-11-05
- 成員：黃予岑
- 軟工活動：程式
- 具體工作：在 app/cli.py 新增 seed-demo 指令，灌入涵蓋各種庫存預警情境的示範餐廳資料並補測試與 README
- AI 工具／BMad 技能：Claude Code＋bmad-agent-dev（bmad-build）
- Prompt 重點：新增 seed-demo 指令：涵蓋各預警情境、日期依 Clock 相對計算、verify-stock 須通過、--reset 才清空重灌
- AI 產出摘要：`app/cli.py` 的 seed-demo、`tests/integration/test_seed_demo.py`、README 使用說明
- 人工判斷與修正：本人訂定需求：示範資料要涵蓋已過期、今日到期、即期、正常、低庫存各情境，日期以 Clock 相對計算，灌完 verify-stock 必須通過，加 --reset 才清空重灌
- 採用程度：直接採用
- 截圖／檔案：docs/ai-evidence/20261105-mintguesss-470d0799/turn-02.png、docs/ai-evidence/20261105-mintguesss-470d0799/transcript.md
- 對應文件章節：D（Seed資料與CLI設計）
- 狀態：已確認

## 2

- 日期：2026-11-05
- 成員：黃予岑
- 軟工活動：審查
- 具體工作：對 seed-demo 變更執行 Blind Hunter 程式碼審查並依分類結果修正問題（含密碼雜湊存儲錯誤）
- AI 工具／BMad 技能：Claude Code＋bmad-code-review
- Prompt 重點：審查 seed-demo 的改動
- AI 產出摘要：審查發現分級與修正：停用帳號改存真正的 Argon2 雜湊、補情境對照測試
- 人工判斷與修正：本人檢閱審查結果後採用修正：停用帳號原本用假字串當密碼雜湊，改為真正的 Argon2 雜湊
- 採用程度：大幅修改
- 截圖／檔案：docs/ai-evidence/20261105-mintguesss-470d0799/turn-02.png、docs/ai-evidence/20261105-mintguesss-470d0799/transcript.md
- 對應文件章節：D（實作審查）
- 狀態：已確認

## 3

- 日期：2026-11-05
- 成員：黃予岑
- 軟工活動：需求
- 具體工作：依 PRD、架構主幹與 team-tasks.md 將首版範圍拆分為 9 個 epics、28 個 user stories，並標註對應 FR/AD 與驗收條件
- AI 工具／BMad 技能：Claude Code＋bmad-agent-pm（bmad-create-epics-and-stories）
- Prompt 重點：依 SRS v3.0 與架構主幹拆 epics 與 user stories，epic 依分工表模組切分並標負責人，story 附驗收條件與對應 FR、AD，只拆首版範圍
- AI 產出摘要：`_bmad-output/planning-artifacts/epics.md`：9 個 epic、28 個 story，最終驗證全部通過
- 人工判斷與修正：使用者對 AI 提出的兩個衝突點做出決定：1A 確認 FR-16 編號對照改以盤點調整為準、交易更正不拆；2A 確認帳號權限（FR-01、FR-02）已在 main 完成不重開 story；並核可 epic 切分結構後才讓 AI 繼續寫入各 story 細節
- 採用程度：小幅修改
- 截圖／檔案：docs/ai-evidence/20261105-mintguesss-470d0799/turn-04.png、docs/ai-evidence/20261105-mintguesss-470d0799/turn-05.png、docs/ai-evidence/20261105-mintguesss-470d0799/turn-06.png、docs/ai-evidence/20261105-mintguesss-470d0799/turn-07.png、docs/ai-evidence/20261105-mintguesss-470d0799/turn-08.png、docs/ai-evidence/20261105-mintguesss-470d0799/transcript.md
- 對應文件章節：B（需求分析）
- 狀態：已確認

## 4

- 日期：2026-11-06
- 成員：黃予岑
- 軟工活動：管理
- 具體工作：執行 sprint planning：先做實作準備度檢查（判定 CONCERNS，列出 3 個缺口），再產生 sprint-status.yaml 追蹤 9 個 epic、28 個 story 的進度
- AI 工具／BMad 技能：Claude Code＋bmad-sprint-planning
- Prompt 重點：在同一對話直接啟動 sprint planning，產生進度追蹤檔
- AI 產出摘要：準備度檢查指出 3 個缺口（頁面框架尚未合併、預警設定頁沒有落點、AI 自訂的錯誤碼待組內確認）；`_bmad-output/implementation-artifacts/sprint-status.yaml`
- 人工判斷與修正：本人選擇先照常產生追蹤檔，缺口另外處理：先合併頁面框架 PR 再通知組員從 main 開工，並把規劃文件另開 docs/epics 分支提交，不混進 UI 的 PR
- 採用程度：直接採用
- 截圖／檔案：docs/ai-evidence/20261105-mintguesss-470d0799/turn-12.png、docs/ai-evidence/20261105-mintguesss-470d0799/turn-13.png、docs/ai-evidence/20261105-mintguesss-470d0799/transcript.md
- 對應文件章節：A（專案管理）
- 狀態：已確認
