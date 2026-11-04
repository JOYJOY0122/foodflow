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
