# AI 使用紀錄草稿：/bmad-help

> AI 依對話紀錄自動起草。**請本人檢查每一列**，特別是「人工判斷與修正」與「採用程度」；確認後把「狀態」改成「已確認」。
> 「軟工活動」只能填：需求、設計、程式、測試、除錯、審查、文件、管理；「採用程度」只能填：直接採用、小幅修改、大幅修改、僅參考、不採用。不需要的列整段刪掉。

## 1

- 日期：2026-10-29
- 成員：黃予岑
- 軟工活動：管理
- 具體工作：修正 BMad 專案設定（輸出資料夾路徑、刪除誤建資料夾）並確認/補上繁體中文語言設定
- AI 工具／BMad 技能：Claude Code＋bmad-help
- Prompt 重點：修正安裝時把語言誤填進輸出資料夾的問題，並讓全組對話語言統一為繁體中文
- AI 產出摘要：`_bmad/custom/config.toml` 團隊覆寫設定：輸出資料夾改回 `_bmad-output`、語言設為繁體中文
- 人工判斷與修正：使用者在第2輪指出原安裝把「語言」誤填進 output_folder，要求修正並刪除該資料夾；第3輪使用者僅下達「加」的簡短指令，要求 AI 補上 communication_language 覆寫設定
- 採用程度：直接採用
- 截圖／檔案：docs/ai-evidence/20261029-mintguesss-17268418/turn-02.png、docs/ai-evidence/20261029-mintguesss-17268418/turn-03.png、docs/ai-evidence/20261029-mintguesss-17268418/transcript.md
- 對應文件章節：A 專案管理
- 狀態：已確認
