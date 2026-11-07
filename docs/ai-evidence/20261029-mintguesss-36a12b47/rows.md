# AI 使用紀錄草稿：/bmad-agent-analyst

> AI 依對話紀錄自動起草。**請本人檢查每一列**，特別是「人工判斷與修正」與「採用程度」；確認後把「狀態」改成「已確認」。
> 「軟工活動」只能填：需求、設計、程式、測試、除錯、審查、文件、管理；「採用程度」只能填：直接採用、小幅修改、大幅修改、僅參考、不採用。不需要的列整段刪掉。

## 1

- 日期：2026-10-29
- 成員：黃予岑
- 軟工活動：需求
- 具體工作：透過 bmad-prd 技能進行 brain dump 訪談，依食材庫存管理提案產出食序 FoodFlow PRD 初稿（願景、使用情境、FR-1~27、NFR-1~7、待決問題）
- AI 工具／BMad 技能：Claude Code＋bmad-agent-pm／bmad-prd
- Prompt 重點：使用者貼上食材庫存與效期預警系統提案，表示要先理清需求與功能再寫 Use Case；選擇快速模式，並對裝置、庫存扣除方式、通知管道、角色等問題全部回答「都要」
- AI 產出摘要：prd.md、addendum.md 草稿：8 模組 FR-1~27、UJ-1~5、NFR-1~7、名詞定義與假設彙整；因無真實 POS，以 FR-15「銷售登錄」模擬自動扣料
- 人工判斷與修正：使用者澄清此為軟體工程專案「不會真的有 POS」，促使 AI 改用銷售登錄模擬取代真實 POS 串接；對 AI 提出「全都要」會使難度從中變高的風險警示，使用者仍維持原選擇並補充情境為課程專案
- 採用程度：小幅修改
- 截圖／檔案：docs/ai-evidence/20261029-mintguesss-36a12b47/turn-03.png、docs/ai-evidence/20261029-mintguesss-36a12b47/turn-04.png、docs/ai-evidence/20261029-mintguesss-36a12b47/turn-05.png、docs/ai-evidence/20261029-mintguesss-36a12b47/turn-06.png、docs/ai-evidence/20261029-mintguesss-36a12b47/transcript.md
- 對應文件章節：B 需求分析
- 狀態：已確認

## 2

- 日期：2026-10-29
- 成員：黃予岑
- 軟工活動：需求
- 具體工作：修正 PRD 目標客群範圍為「不限規模的單一門市獨立餐廳」（排除連鎖／跨店），並將產品正式命名為「食序 FoodFlow」
- AI 工具／BMad 技能：Claude Code＋bmad-prd
- Prompt 重點：使用者指出大餐廳也適用且更有需求，但跨店／連鎖可先排除；另外補上產品名稱「食序 FoodFlow」
- AI 產出摘要：修改 prd.md 願景、非目標使用者、NFR-5 效能指標（上調至 1000 種食材/20000 批次/30 人同時使用）；addendum.md 同步改名；移除 prd.md 開頭的 BOM 字元
- 人工判斷與修正：使用者否決「僅限小型餐廳」的範圍限制，明確要求納入不限規模的單一門市獨立餐廳、排除連鎖，並將產品命名為「食序 FoodFlow」
- 採用程度：小幅修改
- 截圖／檔案：docs/ai-evidence/20261029-mintguesss-36a12b47/turn-07.png、docs/ai-evidence/20261029-mintguesss-36a12b47/turn-08.png、docs/ai-evidence/20261029-mintguesss-36a12b47/transcript.md
- 對應文件章節：B 需求分析
- 狀態：已確認

## 3

- 日期：2026-10-29
- 成員：黃予岑
- 軟工活動：管理
- 具體工作：依課程大綱評估期中時程（11/18 需交付可運行系統＋三份文件）對 PRD 範圍的風險，記入 PRD 待決問題並建立課程專案背景記憶檔
- AI 工具／BMad 技能：Claude Code＋bmad-prd（搭配課程大綱內容）
- Prompt 重點：使用者貼出課程大綱要求，詢問下一步是否可以寫 Use Case
- AI 產出摘要：指出 4 人 3 週內完成 27 條 FR 偏緊，建議將 FR 分「期中必做」與「期末補齊」兩層；確認資料表數量已達課程最低要求；指出 AI 使用紀錄可作為(g)項 30% 評分證據；將專案背景存入記憶檔
- 人工判斷與修正：本人後來在 SRS v3.0 採用分層：首版（期中）必做與期末延伸分開，並刪減食譜、銷售扣料、Email
- 採用程度：僅參考
- 截圖／檔案：docs/ai-evidence/20261029-mintguesss-36a12b47/turn-09.png、docs/ai-evidence/20261029-mintguesss-36a12b47/transcript.md
- 對應文件章節：A 專案管理
- 狀態：已確認

## 4

- 日期：2026-10-29
- 成員：黃予岑
- 軟工活動：需求
- 具體工作：依 Kung《Object-Oriented Software Engineering》方法，由 PRD 的 27 條 FR 推導出 19 個 Use Case（含參與者、追溯矩陣、PlantUML 圖、Expanded 表）
- AI 工具／BMad 技能：Claude Code（依 Kung 課本格式撰寫，非特定 bmad skill）
- Prompt 重點：使用者簡短回覆 AI 先前提出的兩個待確認問題（「暫時沒有」「不用」），請 AI 照課本格式撰寫涵蓋全部 FR 的 Use Case
- AI 產出摘要：use-cases.md：4 類參與者（店主、店長、採購人員、廚房人員）、19 個 Use Case 分 6 子系統、FR 追溯矩陣與 3 迭代開發順序建議、PlantUML Use Case 圖、Expanded 雙欄表、7 項 PRD 不清楚之處回饋
- 人工判斷與修正：本人未採用此版 use case（以舊版 PRD FR-1～27 推導），在檔案開頭標註已作廢、僅保留作紀錄，use case 改由負責 B 文件的組員依 SRS v3.0 重做
- 採用程度：僅參考
- 截圖／檔案：docs/ai-evidence/20261029-mintguesss-36a12b47/turn-09.png、docs/ai-evidence/20261029-mintguesss-36a12b47/turn-10.png、docs/ai-evidence/20261029-mintguesss-36a12b47/transcript.md
- 對應文件章節：B 需求分析
- 狀態：已確認

## 5

- 日期：2026-11-05
- 成員：黃予岑
- 軟工活動：設計
- 具體工作：以 PRD／SRS v3.0 為需求來源，指定完整技術棧、分層規則與設計模式，產出架構主幹文件 ARCHITECTURE-SPINE.md，並經三個子代理（需求對照、技術查證、對抗式攻擊）審查後修正
- AI 工具／BMad 技能：Claude Code＋bmad-agent-architect／bmad-architecture（含 3 個審查子代理）
- Prompt 重點：使用者指定只以 prd.md 與 docs/srs.md 為需求來源（排除舊版 prds/、use-cases/），給出前後端技術棧（React+Vite+Mantine+TanStack Query／FastAPI+SQLAlchemy2+Alembic+Pydantic／PostgreSQL）、API-Service-Repository 分層、建構子注入、Strategy/Factory/Adapter 設計模式、可注入 Clock、交易與列鎖防超領／防重送規則，並要求附 C1~C5 變更情境分析
- AI 產出摘要：ARCHITECTURE-SPINE.md 初稿與定稿前修正版：補上 AD-6（UnitOfWork 寫法）、AD-7（for_update 鎖定順序）、AD-15（Clock 驗證 JWT exp）、AD-20（StockLedger 方法介面）等架構決策；三份審查報告（0 critical、6 項 high）
- 人工判斷與修正：使用者明確否決審查者「從需求來源移除 prd.md」的建議，理由是 prd.md 內容與 srs.md 相同且使用者已明確列為來源，審查者只是未讀到該檔案
- 採用程度：小幅修改
- 截圖／檔案：docs/ai-evidence/20261029-mintguesss-36a12b47/turn-11.png、docs/ai-evidence/20261029-mintguesss-36a12b47/turn-12.png、docs/ai-evidence/20261029-mintguesss-36a12b47/turn-13.png、docs/ai-evidence/20261029-mintguesss-36a12b47/turn-14.png、docs/ai-evidence/20261029-mintguesss-36a12b47/turn-15.png、docs/ai-evidence/20261029-mintguesss-36a12b47/transcript.md
- 對應文件章節：C 軟體設計（架構）
- 狀態：已確認

## 6

- 日期：2026-11-05
- 成員：黃予岑
- 軟工活動：設計
- 具體工作：定稿架構主幹決策，更新分工表移除排程角色，並產出 C 軟體設計文件草稿與 README 開發環境需求
- AI 工具／BMad 技能：Claude Code＋bmad-agent-architect
- Prompt 重點：使用者就 4 項暫定方案逐一裁決（移除每日預警排程、報廢分析限管理者、停用食材不提醒低庫存、NFR-07 負載測試延後至期末），要求 AD-3 寫明設計層次 4「領域物件綁 ORM」為已知取捨並附原因，同時更新 team-tasks.md、產出 docs/c-software-design.md、把環境版本寫入 README，明確要求不要 commit
- AI 產出摘要：架構主幹 status 改為 final；team-tasks.md 移除「系統排程」角色描述；新建 docs/c-software-design.md（動機、架構圖、分層職責、子系統切割、C1~C5、技術選型）；新建 README.md 列出 Python 3.13、Node 24、Docker、uv
- 人工判斷與修正：使用者逐條裁決 4 項待決設計方案，並額外要求 AD-3 補充設計取捨的原因說明；明確指示不要 commit，由自己檢查後再 commit
- 採用程度：直接採用
- 截圖／檔案：docs/ai-evidence/20261029-mintguesss-36a12b47/turn-16.png、docs/ai-evidence/20261029-mintguesss-36a12b47/transcript.md
- 對應文件章節：C 軟體設計
- 狀態：已確認

## 7

- 日期：2026-11-05
- 成員：黃予岑
- 軟工活動：文件
- 具體工作：安裝 PlantUML／Graphviz 工具鏈，將 docs/diagrams 的架構圖與子系統依賴圖轉成 PNG 並嵌入 C 軟體設計文件
- AI 工具／BMad 技能：Claude Code（PowerShell／Bash 工具操作，非特定 bmad skill）
- Prompt 重點：使用者要求檢查並安裝 Java／Graphviz、下載 plantuml.jar（加入 .gitignore、不 commit jar 檔）、將 .puml 轉為中文正常顯示的 PNG、有語法錯誤就修正至成功、並把 C 文件中的程式碼區塊換成圖片連結，不要 commit
- AI 產出摘要：以 winget 安裝 Graphviz 16.1.0，核對 plantuml.jar SHA-256，產出 c-system-architecture.png、c-subsystem-dependency.png，並更新 c-software-design.md 的圖片連結與 ai-log.md 紀錄
- 人工判斷與修正：本人逐張檢查圖檔：中文顯示、箭頭方向，並確認沒有首版不做的排程與 Email
- 採用程度：小幅修改
- 截圖／檔案：docs/ai-evidence/20261029-mintguesss-36a12b47/turn-17.png、docs/ai-evidence/20261029-mintguesss-36a12b47/transcript.md
- 對應文件章節：C 軟體設計／G AI 使用紀錄
- 狀態：已確認

## 8

- 日期：2026-11-05
- 成員：黃予岑
- 軟工活動：需求
- 具體工作：依架構定稿決議同步修改 docs/srs.md 第 4.1 節權限表與第 7.1 節，並同步到 prd.md、於 10.3 差異表補列一筆紀錄
- AI 工具／BMad 技能：Claude Code＋bmad-agent-architect
- Prompt 重點：使用者要求修改 srs.md 第 4.1 節權限表與第 7.1 節以符合架構定稿決議，同步到 prd.md，並在 10.3 差異表補一列
- AI 產出摘要：權限表拆分「異動查詢、期初期末統計」（雙角色）與「報廢分布與損失金額」（限管理者）兩列；7.1 節補充 NFR-07 負載測試延至期末；10.3 節新增 2026-11-05 架構定稿調整列；同步 prd.md 並將架構主幹「已確認決策」更新為「SRS 已同步」
- 人工判斷與修正：本人決定需求文件必須與架構定稿一致，要求修改 SRS 並同步 prd.md、在差異表補列；版本號維持 3.0
- 採用程度：小幅修改
- 截圖／檔案：docs/ai-evidence/20261029-mintguesss-36a12b47/turn-18.png、docs/ai-evidence/20261029-mintguesss-36a12b47/transcript.md
- 對應文件章節：B 需求分析
- 狀態：已確認

## 9

- 日期：2026-11-05
- 成員：黃予岑
- 軟工活動：文件
- 具體工作：將系統架構圖 c-system-architecture.puml 由左右排版改為上下直式排版，以符合 A4 文件排版需求
- AI 工具／BMad 技能：Claude Code（PlantUML／Graphviz 操作）
- Prompt 重點：使用者要求改為 top to bottom 方向、使用者在最上、PostgreSQL 在最下，寬度控制在約 1000 像素以內，元件名稱與箭頭關係不可更動，重新轉 PNG 並回報新尺寸，不要 commit
- AI 產出摘要：多次嘗試排版（左右排寬 1185px 超標；隱藏連線版本順序錯亂不可用），最終改為上下排列，輸出 791×782px 的新 c-system-architecture.png
- 人工判斷與修正：本人發現架構圖寬約 2000 像素，放進 A4 文件字會太小，要求改為直式版面並把寬度控制在約 1000 像素內
- 採用程度：小幅修改
- 截圖／檔案：docs/ai-evidence/20261029-mintguesss-36a12b47/turn-19.png、docs/ai-evidence/20261029-mintguesss-36a12b47/transcript.md
- 對應文件章節：C 軟體設計
- 狀態：已確認
