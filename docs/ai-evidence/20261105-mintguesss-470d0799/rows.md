# AI 使用紀錄草稿：<pasted_content id="e69a">

> AI 依對話紀錄自動起草。**請本人檢查每一列**，特別是「人工判斷與修正」與「採用程度」；確認後把「狀態」改成「已確認」。
> 「軟工活動」只能填：需求、設計、程式、測試、除錯、審查、文件、管理；「採用程度」只能填：直接採用、小幅修改、大幅修改、僅參考、不採用。不需要的列整段刪掉。

## 1

- 日期：2026-11-05
- 成員：黃予岑
- 軟工活動：程式
- 具體工作：在 app/cli.py 新增 seed-demo 指令，灌入涵蓋各種庫存預警情境的示範餐廳資料並補測試與 README
- AI 工具／BMad 技能：
- Prompt 重點：
- AI 產出摘要：
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
- AI 工具／BMad 技能：
- Prompt 重點：
- AI 產出摘要：
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
- AI 工具／BMad 技能：
- Prompt 重點：
- AI 產出摘要：
- 人工判斷與修正：使用者對 AI 提出的兩個衝突點做出決定：1A 確認 FR-16 編號對照改以盤點調整為準、交易更正不拆；2A 確認帳號權限（FR-01、FR-02）已在 main 完成不重開 story；並核可 epic 切分結構後才讓 AI 繼續寫入各 story 細節
- 採用程度：小幅修改
- 截圖／檔案：docs/ai-evidence/20261105-mintguesss-470d0799/turn-04.png、docs/ai-evidence/20261105-mintguesss-470d0799/turn-05.png、docs/ai-evidence/20261105-mintguesss-470d0799/turn-06.png、docs/ai-evidence/20261105-mintguesss-470d0799/turn-07.png、docs/ai-evidence/20261105-mintguesss-470d0799/turn-08.png、docs/ai-evidence/20261105-mintguesss-470d0799/transcript.md
- 對應文件章節：B（需求分析）
- 狀態：已確認
