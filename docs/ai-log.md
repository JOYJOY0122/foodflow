# AI 使用紀錄

每次使用 AI 都要記錄，尤其是 AI 錯在哪裡、怎麼修正。

| 日期 | 成員 | SE activity | 用的 skill／工具 | 輸入摘要 | AI 產出 | 人工修正與原因 |
| --- | --- | --- | --- | --- | --- | --- |
| 2026-10-29 | Ken | 環境建置 | BMAD v6.12.4、Test Architect、Claude | 安裝 BMAD 與 Test Architect；請 Claude 修正輸出資料夾並設定對話語言 | 覆寫設定：輸出資料夾改回 `_bmad-output`，全組對話語言設為繁體中文 | 安裝時把語言誤填進輸出資料夾，所以用覆寫設定改回 |
| 2026-10-29 | Ken | 需求 | bmad-agent-pm | 請 PM agent 產出 PRD | PRD | 範圍太大（食譜、銷售扣料、Email），改採 SRS v2.0 並刪減 |
| 2026-11-04 | Ken | 需求 | Claude | 兩份 AI 產出的 PRD／SRS（FoodFlow PRD 初稿、SRS v2.0） | 合併為 SRS v3.0（`docs/srs.md`） | 刪減範圍（食譜、銷售扣料、Email 改列延伸或不做）；補低庫存提醒、進貨單價與報廢損失金額、非 FEFO 標記；交易更正延到期末；修正定位為單一門市不限規模 |
