# AI 使用佐證自動化（文件 G）

每次 Claude Code 對話結束，會自動在背景把這段對話整理成文件 G 的佐證，不用自己截圖。commit 前再跑一行指令，AI 會替你起草紀錄列。

## 流程

| 時機 | 誰做 | 產生什麼 |
| --- | --- | --- |
| 對話結束（`/clear` 或關掉 Claude 分頁） | 自動 | `transcript.md` 完整文字稿、每一輪的 `turn-NN.png` 對話圖 |
| commit 前 | 你跑一行 `node scripts/ai-evidence/capture.mjs --all` | `rows.md` 紀錄列草稿，圖精簡成紀錄列有引用的輪次 |
| commit 前 | 你 | 檢查 `rows.md`，補人工判斷、改成「已確認」 |
| 交件前 | 郭明儒 | `node scripts/ai-evidence/build-log.mjs` 彙整成 Excel |

產出在 `docs/ai-evidence/<日期>-<成員>-<編號>/`，`docs/ai-evidence/README.md` 是索引。密碼、token 等機密會自動遮蔽，個人記憶工具的呼叫不列出，只有一句的簡短對話（例如測試用的「嗨」）會略過。

注意：**按「開新對話」不會觸發**，要用 `/clear` 或關掉 Claude 分頁。忘了也沒關係，`--all` 會把漏掉的對話一起補上。

起草不放在對話結束時自動做，是因為 Windows 結束對話時會中斷 Claude Code 底下的程序，起草會被打斷。

## 用 Codex 的人

- **紀錄一樣會抓**：Codex 的對話存在 `~/.codex/sessions/`，`--all` 會自動找出在本專案資料夾裡進行的對話，文字稿、對話圖、`rows.md` 都跟 Claude Code 一樣。
- **但不會在對話結束時自動觸發**（Codex 沒有這種 hook），所以 commit 前一定要跑 `node scripts/ai-evidence/capture.mjs --all`。
- 起草紀錄列會優先用你本機的 `codex exec`（唯讀、不留紀錄），沒有的話改用 `claude -p`；也可以用 `--drafter codex` 指定。
- 在 Codex 裡叫 BMAD 用 `$bmad-agent-dev` 這種寫法，skill 放在 `.agents/skills/`。

## 第一次設定（每人一次）

```powershell
cd scripts/ai-evidence
npm install
```

- 圖片用電腦裡的 Microsoft Edge 或 Chrome 產生，不用另外下載瀏覽器。
- 紀錄列草稿是呼叫你本機的 `claude -p` 起草，會用到一點你的 Claude 額度。
- 確認 `members.json` 裡有你的 `git config user.name`，對應到中文姓名。

設定好之後，在專案裡用 Claude Code 就會自動運作（hook 設定在 `.claude/settings.json`）。處理紀錄寫在 `docs/ai-evidence/.capture.log`。

## 你要做的事：確認 rows.md

AI 只寫得出對話裡看得到的事。每次 commit 前，打開自己新產生的 `rows.md`：

1. **人工判斷與修正**：最重要的一欄。AI 寫「（待本人補充）」的地方要自己補：否決了什麼、改了什麼、為什麼
2. **採用程度**：直接採用、小幅修改、大幅修改、僅參考、不採用
3. 不需要的列整段刪掉
4. 確認後把 **狀態** 改成「已確認」，之後就不會被覆寫

然後跟程式一起 commit。

## 常用指令（專案根目錄）

```powershell
node scripts/ai-evidence/capture.mjs --all          # commit 前執行：起草紀錄列、補抓漏掉的對話（已處理過的會略過）
node scripts/ai-evidence/capture.mjs --all --force  # 全部重產（已確認的 rows.md 不會被覆寫）
node scripts/ai-evidence/build-log.mjs              # 彙整全組紀錄成 docs/G-AI使用紀錄.xlsx
```

`--png-all` 每一輪都產圖；`--no-rows` 不起草紀錄列；`--no-png` 不產圖。

## 彙整成 Excel

`build-log.mjs` 會把所有 `rows.md` 加上早期手寫的 `docs/ai-log.md`，整理成 `docs/G-AI使用紀錄.xlsx`：

- **紀錄表**：軟工活動、採用程度、成員、狀態有下拉選單；還沒確認的列是黃底；「截圖預覽」欄嵌入第一張對話圖的縮圖，點連結開原圖
- **統計**：各軟工活動 × 採用程度的次數、每位成員的紀錄數，報告可直接引用

不要直接改 Excel，改來源後重新產生。

## 注意

- `turn-NN.png` 是**依對話紀錄重新排版的對話圖**，內容與當時對話一字不差，但不是螢幕截圖。放進 G 文件時圖說請寫「依 Claude Code 對話紀錄自動產生」。關鍵時刻（例如 AI 跳出選擇題）可以另外手動截真圖，放進同一個資料夾，在 `rows.md` 的「截圖／檔案」欄加上檔名。
- hook 是在對話開始時載入，第一次 `git pull` 拿到這套設定後，要開新對話才會生效。

- 對話紀錄會 commit 到公開 repo，跟專案無關的私事不要在專案的 Claude Code 對話裡講。
- 在 claude.ai 網頁或手機上的對話不會自動抓，需要的話自己截圖放進對應資料夾，並在 `rows.md` 補一列。
