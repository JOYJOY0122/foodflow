# 食序 FoodFlow 協作規則

第 17 組軟體工程期末專案。

## 1. 分支與合併

- `main` 不直接 push，一律透過 PR 合併。
- 每個 PR 至少需要 1 人 approve。
- 合併方式一律使用 **Squash and merge**。
- 分支命名：`feat/`、`fix/`、`docs/`、`chore/` 加上 `<模組>-<簡述>`，例如 `feat/inventory-batch-receipt`。

## 2. 工作流程

1. 在 Projects 看板認領 Issue（每個 FR 一張）。
2. 開分支。
3. 用 BMAD 產出，並自己確認內容。
4. 開 PR，指定 reviewer。
5. 合併後把 Issue 拉到 Done。

## 3. Commit 格式

```text
<類型>(<模組>): <中文描述>
```

類型：`feat`、`fix`、`docs`、`test`、`refactor`、`chore`。

例子：

```text
feat(inventory): 新增批次入庫功能
fix(goods-receipt): 修正進貨明細數量計算錯誤
docs(srs): 更新庫存預警需求說明
test(inventory): 新增批次報廢測試
```

## 4. 模組負責人

待組內決定後補上。

## 5. AI 使用規則

- 使用 BMAD skill。
- 每個 workflow 開新對話。
- 每次用 AI 都要記錄到 `docs/ai-log.md`，尤其是 AI 錯在哪裡。
- 看不懂的 AI 程式碼不准 commit。
- `_bmad-output` 要 commit。

## 6. 命名對照

以 SRS v2.0 名詞為準，架構定稿時再確認。

| 中文 | 英文 |
| --- | --- |
| 員工 | Employee |
| 食材分類 | IngredientCategory |
| 食材 | Ingredient |
| 供應商 | Supplier |
| 儲存位置 | StorageLocation |
| 進貨單 | GoodsReceipt |
| 進貨明細 | GoodsReceiptItem |
| 庫存批次 | InventoryBatch |
| 庫存異動 | InventoryTransaction |
| 報廢紀錄 | WasteRecord |
| 位置變更紀錄 | BatchLocationChange |
| 預警設定 | AlertSetting |

## 7. 不能 commit 的東西

- `.env`
- 密碼
- API key
- `node_modules`
- 建置產物

不小心 commit 密碼時，要立刻換掉該密碼。

## 8. 文件位置

| 內容 | 位置 |
| --- | --- |
| BMAD 產出 | `_bmad-output/` |
| 課程文件 | `docs/` |
| AI 紀錄 | `docs/ai-log.md` |
| 圖檔 | `docs/diagrams/` |

## 9. AI 不能出現在 Contributors

GitHub Contributors 只能出現組員本人，所以設有三層防護：

1. **Claude Code 設定**：`.claude/settings.json` 關閉 AI 署名。
2. **commit-msg hook**：`.githooks/commit-msg` 在 commit 時自動刪除 AI 的 `Co-authored-by` 與產生標記，真人的 `Co-authored-by` 會保留。
3. **GitHub Actions 檢查**：`.github/workflows/no-ai-contributors.yml` 檢查每個 commit 的作者、提交者與 `Co-authored-by`，發現 AI 署名就讓檢查失敗。

每個人 clone 後都要執行一次（hook 不會自動啟用）：

```bash
git config core.hooksPath .githooks
```

不准讓 AI 以 bot 身分 push 或開 PR，例如 Copilot coding agent、Claude GitHub App、Codex 雲端任務等。AI 只在本機改檔，由本人 commit 與 push。

被檢查擋下時，先移除署名：

```bash
git commit --amend
```

如果署名不在最新一筆 commit，改用：

```bash
git rebase -i main
```

移除後再推上去：

```bash
git push --force-with-lease
```
