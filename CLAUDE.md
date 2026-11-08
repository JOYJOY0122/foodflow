# 食序 FoodFlow：AI agent 工作規則

> 本檔與 `AGENTS.md` 內容相同，改一份就要同步另一份。完整協作規則見 [CONTRIBUTING.md](CONTRIBUTING.md)。

## 前端設計規則

視覺規範是 [docs/design/DESIGN.md](docs/design/DESIGN.md)，跟其他文件衝突時以它為準。

- **顏色只從主題取**：用 Mantine 色票名稱（`forest.8`、`gray.6`、`expired.8`、`chilled` …）或 `--ff-*` CSS 變數（`var(--ff-line)`、`var(--ff-surface-header)` …）。hex、`rgb()`、`rgba()`、`hsl()`、`hsla()` 只能寫在 `frontend/src/app/theme.ts` 與 `frontend/src/app/*.css`。`src/features/**` 有 ESLint 規則擋住寫死的色碼。
- **新 token 先加進主題**：要新顏色、陰影或漸層時，先在 `theme.ts` 的 `tokens`、色票或 `cssVariablesResolver` 加上，再從元件引用。
- **先用共用元件**（`frontend/src/shared/ui/`，每個檔案開頭都有用法註解）：
  - `PageHeader`：每頁一個 h1，可加 `icon`（42px 漸層方塊）；頁面唯一的主要按鈕放在 `actions`。
  - `Toolbar`＋`SearchInput`：主卡片頂部的搜尋與篩選；放在卡片裡時傳 `bleed={卡片內距}`。
  - `DataTable`：表格外框與表頭；列由呼叫端放 `Table.Tr`。
  - `EmptyState`：空狀態與「功能開發中」卡片（`framed`）。
  - `FormModal`：表單與確認對話框，`busy` 時不能關閉。
  - `StatusBadge`：效期與庫存狀態，文字與色票只定義在 `statusBadgeMap.ts`（AD-23）。
  - `ActiveBadge`、`CodeTag`、`StorageTypeIcon`、`icons.tsx`（線條圖示，新圖示照同一規格畫進去）。
- **觸控與無障礙**：可點擊目標至少 44px；狀態一律文字加顏色，不能只靠顏色（NFR-01）；輸入框一定要有 label，不能拿 placeholder 當欄位名稱；純裝飾圖示加 `aria-hidden`，沒有文字的圖示按鈕要有 `aria-label`。
- **主要按鈕每個畫面最多一個**（漸層）；取消、列內操作用 `variant="default"`；刪除、停用的最後確認用 `color="red"`。
- **前端不自己算狀態**：到期狀態、低庫存、數量運算都以後端回傳為準。
- **驗收尺寸**：1024×768 不出現橫向捲動；進貨、領用、報廢、預警四頁另外檢查 1366×768。

## 協作重點（摘自 CONTRIBUTING.md）

- **分支**：`main` 不直接 push，一律開 PR、至少 1 人 approve、Squash and merge。分支命名 `feat/`、`fix/`、`docs/`、`chore/` 加 `<模組>-<簡述>`，例如 `feat/inventory-batch-receipt`。
- **Commit 格式**：`<類型>(<模組>): <中文描述>`，類型有 `feat`、`fix`、`docs`、`test`、`refactor`、`chore`。例如 `feat(inventory): 新增批次入庫功能`。
- **AI 不能出現在 Contributors**：commit 不加 AI 署名（`Co-authored-by` 或產生標記）；AI 只在本機改檔，由組員本人 commit 與 push，不用 bot 身分 push 或開 PR。clone 後執行一次 `git config core.hooksPath .githooks`。
- **PR**：開 PR 時指定 reviewer；合併後把 Issue 拉到 Done。需求編號以 `docs/srs.md` 為準，模組負責人見 `docs/team-tasks.md`。
- **AI 使用紀錄（ai-evidence）**：commit 前執行 `node scripts/ai-evidence/capture.mjs --all` 起草 `docs/ai-evidence/` 的 `rows.md`，補上「人工判斷與修正」與「採用程度」，確認後把狀態改成「已確認」，跟程式一起 commit。說明見 `scripts/ai-evidence/README.md`。`docs/ai-log.md` 是早期紀錄，不再新增也不改寫。
- **看不懂的 AI 程式碼不准 commit。**
- **`_bmad-output/` 要 commit**（BMAD 產出的規格、故事與紀錄）。
- **不能 commit**：`.env`、密碼、API key、`node_modules`、建置產物。

## 常用指令

```bash
cd frontend && npm test            # 單元測試
cd frontend && npm run lint        # ESLint（含色碼守門、AD-17 資料存取規則）
cd frontend && npm run typecheck
cd frontend && npm run build
```
