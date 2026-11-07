# AI 使用紀錄草稿：依 README 的開發環境需求檢查並安裝：用 uv 安裝 Python 3.1…

> AI 依對話紀錄自動起草。**請本人檢查每一列**，特別是「人工判斷與修正」與「採用程度」；確認後把「狀態」改成「已確認」。
> 「軟工活動」只能填：需求、設計、程式、測試、除錯、審查、文件、管理；「採用程度」只能填：直接採用、小幅修改、大幅修改、僅參考、不採用。不需要的列整段刪掉。

## 1

- 日期：2026-11-05
- 成員：黃予岑
- 軟工活動：管理
- 具體工作：依 README 開發環境需求安裝並驗證 Python 3.13（uv）、Node.js 24 LTS（winget）、確認 Docker Desktop 啟動
- AI 工具／BMad 技能：Claude Code
- Prompt 重點：依 README 安裝 Python 3.13（uv）、Node.js 24 LTS（winget），確認 Docker Desktop 啟動並印出各工具版本
- AI 產出摘要：完成安裝與版本清單
- 人工判斷與修正：本人依 README 指定版本（Python 3.13、Node 24、Docker），要求 AI 安裝後印出各工具版本確認
- 採用程度：直接採用
- 截圖／檔案：docs/ai-evidence/20261105-mintguesss-0b97d4d3/turn-01.png、docs/ai-evidence/20261105-mintguesss-0b97d4d3/transcript.md
- 對應文件章節：A 專案管理
- 狀態：已確認

## 2

- 日期：2026-11-05
- 成員：黃予岑
- 軟工活動：管理
- 具體工作：將 Python 版本固定限定於本專案範圍（新增 .python-version），不更動全域 Python 設定
- AI 工具／BMad 技能：Claude Code
- Prompt 重點：回答 AI 提問：是否切換全域 Python 版本
- AI 產出摘要：新增 `.python-version`，只限本專案使用 Python 3.13
- 人工判斷與修正：使用者針對 AI 詢問「是否要切換全域 Python 版本」做出選擇，明確要求只處理本專案範圍，不動全域環境
- 採用程度：直接採用
- 截圖／檔案：docs/ai-evidence/20261105-mintguesss-0b97d4d3/turn-02.png、docs/ai-evidence/20261105-mintguesss-0b97d4d3/transcript.md
- 對應文件章節：A 專案管理
- 狀態：已確認

## 3

- 日期：2026-11-05
- 成員：黃予岑
- 軟工活動：文件
- 具體工作：修改 README 第 17 行的版本檢查指令，改為透過 uv run 執行以正確顯示專案指定的 Python 3.13
- AI 工具／BMad 技能：Claude Code
- Prompt 重點：修正 README 的版本檢查指令
- AI 產出摘要：README 改用 `uv run python --version` 顯示專案指定版本
- 人工判斷與修正：使用者回覆「改」，同意 AI 先前提出的 README 修改建議
- 採用程度：直接採用
- 截圖／檔案：docs/ai-evidence/20261105-mintguesss-0b97d4d3/turn-02.png、docs/ai-evidence/20261105-mintguesss-0b97d4d3/turn-03.png、docs/ai-evidence/20261105-mintguesss-0b97d4d3/transcript.md
- 對應文件章節：A 專案管理
- 狀態：已確認
