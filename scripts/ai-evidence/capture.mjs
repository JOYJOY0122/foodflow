#!/usr/bin/env node
// 把 Claude Code 的對話紀錄自動轉成 G 文件用的佐證：文字稿 transcript.md 與每一輪對話的卡片圖（PNG）。
//
// 用法（在專案根目錄）：
//   node scripts/ai-evidence/capture.mjs --hook        由 Claude Code 的 SessionEnd hook 呼叫：只產文字稿與圖（不起草）
//   node scripts/ai-evidence/capture.mjs --all         commit 前執行：替還沒起草的對話寫 rows.md，圖精簡成有引用的輪次
//   node scripts/ai-evidence/capture.mjs --transcript <檔案.jsonl>   只處理一個紀錄檔
// 其他選項：--png-all（每一輪都產圖，預設只替紀錄列引用的輪次產圖）、--no-png（不產圖）、--no-rows（不請 AI 起草紀錄列）、--force（全部重產）、--out <資料夾>（預設 docs/ai-evidence）
//
// 紀錄列草稿（rows.md）由本機的 `claude -p` 依文字稿起草，「人工判斷與修正」一定要本人確認後把狀態改成「已確認」。
// 已確認的 rows.md 不會再被覆寫。

import { execFileSync, spawn, spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { createHash } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const has = (flag) => args.includes(flag);
const valueOf = (flag) => {
  const i = args.indexOf(flag);
  return i >= 0 ? args[i + 1] : undefined;
};

const MAX_TEXT_IN_IMAGE = 3500; // 圖片中每段文字最多顯示的字數，完整內容在 transcript.md
const MAX_TOOL_INPUT = 160;

// ---------- 找專案與紀錄檔 ----------

function projectRoot(start) {
  try {
    return execFileSync("git", ["rev-parse", "--show-toplevel"], { cwd: start, encoding: "utf8" }).trim();
  } catch {
    return start;
  }
}

function samePath(a, b) {
  const norm = (p) => path.resolve(p).replace(/\\/g, "/").replace(/\/+$/, "").toLowerCase();
  return norm(a) === norm(b) || norm(a).startsWith(norm(b) + "/");
}

function readLines(file) {
  const out = [];
  for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    if (!line.trim()) continue;
    try {
      out.push(JSON.parse(line));
    } catch {
      /* 寫到一半的最後一行，略過 */
    }
  }
  return out;
}

function transcriptCwd(file) {
  for (const entry of readLines(file)) if (entry.cwd) return entry.cwd;
  return null;
}

function findProjectTranscripts(root) {
  const base = path.join(os.homedir(), ".claude", "projects");
  if (!fs.existsSync(base)) return [];
  const found = [];
  for (const dir of fs.readdirSync(base)) {
    const full = path.join(base, dir);
    if (!fs.statSync(full).isDirectory()) continue;
    for (const name of fs.readdirSync(full)) {
      if (!name.endsWith(".jsonl")) continue;
      const file = path.join(full, name);
      const cwd = transcriptCwd(file);
      if (cwd && samePath(cwd, root)) found.push(file);
    }
  }
  return found;
}

// ---------- 解析對話 ----------

const SECRET_PATTERNS = [
  [/(password|passwd|secret|token|api[_-]?key)(["']?\s*[:=]\s*["']?)[^\s"'`]+/gi, "$1$2[已遮蔽]"],
  [/postgres(?:ql)?(\+\w+)?:\/\/([^:\s]+):[^@\s]+@/gi, "postgresql$1://$2:[已遮蔽]@"],
  [/\b(gh[pousr]_[A-Za-z0-9]{20,}|sk-[A-Za-z0-9_-]{20,})\b/g, "[已遮蔽]"],
  [/Bearer\s+[A-Za-z0-9._-]{20,}/g, "Bearer [已遮蔽]"],
];

function redact(text) {
  return SECRET_PATTERNS.reduce((s, [re, rep]) => s.replace(re, rep), text);
}

function cleanUserText(text) {
  return text
    .replace(/<system-reminder>[\s\S]*?<\/system-reminder>/g, "")
    .replace(/<(local-command-stdout|command-message|command-args)>[\s\S]*?<\/\1>/g, "")
    .replace(/<command-name>(.*?)<\/command-name>/g, "$1")
    .replace(/^\[Attachment from earlier[^\]]*\]\s*$/gm, "")
    .replace(/^@"[^"]+"(\s+@"[^"]+")*\s*/gm, "")
    .trim();
}

function shortInput(name, input) {
  if (!input || typeof input !== "object") return "";
  const pick = input.command ?? input.description ?? input.file_path ?? input.path ?? input.pattern ?? input.query ?? input.skill ?? input.prompt;
  let s = typeof pick === "string" ? pick : JSON.stringify(input);
  s = s.replace(/\s+/g, " ").trim();
  return s.length > MAX_TOOL_INPUT ? s.slice(0, MAX_TOOL_INPUT) + "…" : s;
}

function resultText(result) {
  if (typeof result === "string") return result;
  if (Array.isArray(result)) return result.map((b) => (typeof b === "string" ? b : b?.text ?? "")).join("\n");
  return JSON.stringify(result ?? "");
}

function askAnswer(result) {
  const text = resultText(result);
  const pairs = [...text.matchAll(/"([^"]+)"="([^"]*)"/g)].map((m) => `${m[1]} → ${m[2]}`);
  if (pairs.length) return pairs.join("\n");
  const m = text.match(/answered[^:]*:\s*([\s\S]*?)(\. You can now|$)/i);
  return m ? m[1].trim() : "";
}

// 一輪＝使用者一次輸入，加上 AI 到下一次輸入前的所有回覆與工具呼叫
function parseTurns(entries) {
  const turns = [];
  let current = null;
  const toolNames = new Map();
  const meta = { sessionId: null, branch: null, started: null, ended: null, cwd: null };

  for (const e of entries) {
    if (e.isSidechain) continue;
    if (e.sessionId && !meta.sessionId) meta.sessionId = e.sessionId;
    if (e.gitBranch && e.gitBranch !== "HEAD") meta.branch = e.gitBranch;
    if (e.cwd && !meta.cwd) meta.cwd = e.cwd;
    if (e.timestamp) {
      meta.started ??= e.timestamp;
      meta.ended = e.timestamp;
    }
    if (e.type !== "user" && e.type !== "assistant") continue;
    const content = typeof e.message?.content === "string" ? [{ type: "text", text: e.message.content }] : e.message?.content ?? [];

    if (e.type === "user") {
      if (e.isMeta) continue;
      const texts = content.filter((b) => b.type === "text").map((b) => cleanUserText(b.text)).filter(Boolean);
      const images = content.filter((b) => b.type === "image").length;
      const results = content.filter((b) => b.type === "tool_result");
      for (const r of results) {
        const name = toolNames.get(r.tool_use_id);
        if (name === "AskUserQuestion" && current) {
          const answer = askAnswer(r.content);
          if (answer) current.items.push({ kind: "answer", text: answer });
        }
      }
      if (texts.length || (images && !results.length)) {
        current = { time: e.timestamp, prompt: texts.join("\n\n") + (images ? `\n\n（附 ${images} 張圖片）` : ""), items: [] };
        turns.push(current);
      }
      continue;
    }

    if (!current) continue;
    for (const b of content) {
      if (b.type === "text" && b.text.trim()) {
        const last = current.items.at(-1);
        if (last?.kind === "text") last.text += "\n\n" + b.text.trim();
        else current.items.push({ kind: "text", text: b.text.trim() });
      } else if (b.type === "tool_use") {
        toolNames.set(b.id, b.name);
        if (b.name === "AskUserQuestion") {
          for (const q of b.input?.questions ?? []) {
            current.items.push({ kind: "question", text: q.question, options: (q.options ?? []).map((o) => o.label) });
          }
        } else if (!/^mcp__(memory|claude_ai)__/.test(b.name)) {
          // 個人記憶等與專案無關的工具不列出
          current.items.push({ kind: "tool", name: b.name, text: shortInput(b.name, b.input) });
        }
      }
    }
  }
  return { meta, turns: turns.filter((t) => t.prompt.trim() || t.items.length) };
}

// ---------- 輸出 ----------

function gitUser(root) {
  try {
    return execFileSync("git", ["config", "user.name"], { cwd: root, encoding: "utf8" }).trim();
  } catch {
    return os.userInfo().username;
  }
}

function slug(s) {
  return s.normalize("NFKD").replace(/[^\w-]+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "").toLowerCase() || "user";
}

function localDate(iso) {
  const d = iso ? new Date(iso) : new Date();
  const p = (n) => String(n).padStart(2, "0");
  return { day: `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}`, text: `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}` };
}

function toMarkdown(info, turns) {
  const lines = [
    `# AI 對話紀錄：${info.title}`,
    "",
    `- 成員：${info.user}`,
    `- 時間：${info.start} ～ ${info.end}`,
    `- 分支：${info.branch ?? "（未記錄）"}`,
    `- Session：${info.sessionId}`,
    "",
    "> 由 `scripts/ai-evidence/capture.mjs` 自動產生，工具呼叫只列摘要，密碼等機密已遮蔽。",
    "",
  ];
  turns.forEach((t, i) => {
    lines.push(`## 第 ${i + 1} 輪（${localDate(t.time).text}）`, "", "### 我們", "", redact(t.prompt) || "（無文字）", "", "### AI", "");
    for (const it of t.items) {
      if (it.kind === "text") lines.push(redact(it.text), "");
      else if (it.kind === "tool") lines.push(`- 🔧 \`${it.name}\`：${redact(it.text)}`);
      else if (it.kind === "question") lines.push("", `> ❓ **AI 提問：**${it.text}`, ...it.options.map((o) => `> - ${o}`), "");
      else if (it.kind === "answer") lines.push(`> ✅ **我們的決定：**${redact(it.text)}`, "");
    }
    lines.push("");
  });
  return lines.join("\n");
}

const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

function mdToHtml(src) {
  let text = src.length > MAX_TEXT_IN_IMAGE ? src.slice(0, MAX_TEXT_IN_IMAGE) + "\n\n…（以下省略，完整內容見 transcript.md）" : src;
  const blocks = [];
  text = text.replace(/```[\w-]*\n([\s\S]*?)```/g, (_, code) => {
    blocks.push(`<pre>${esc(code.replace(/\n$/, ""))}</pre>`);
    return `\u0000${blocks.length - 1}\u0000`;
  });
  const inline = (s) =>
    esc(s)
      .replace(/`([^`]+)`/g, "<code>$1</code>")
      .replace(/\*\*([^*]+)\*\*/g, "<b>$1</b>")
      .replace(/\[([^\]]+)\]\([^)]+\)/g, "<u>$1</u>");
  const out = [];
  const lines = text.split("\n");
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (/^\u0000\d+\u0000$/.test(line.trim())) {
      out.push(blocks[Number(line.trim().slice(1, -1))]);
    } else if (/^\s*\|.*\|\s*$/.test(line)) {
      const rows = [];
      while (i < lines.length && /^\s*\|.*\|\s*$/.test(lines[i])) rows.push(lines[i++]);
      i--;
      const cells = (r) => r.trim().slice(1, -1).split("|").map((c) => c.trim());
      const body = rows.filter((r) => !/^\s*\|[\s:|-]+\|\s*$/.test(r));
      out.push(
        "<table>" +
          body.map((r, ri) => `<tr>${cells(r).map((c) => (ri === 0 ? `<th>${inline(c)}</th>` : `<td>${inline(c)}</td>`)).join("")}</tr>`).join("") +
          "</table>",
      );
    } else if (/^#{1,6}\s/.test(line)) {
      out.push(`<div class="h">${inline(line.replace(/^#+\s*/, ""))}</div>`);
    } else if (/^\s*([-*]|\d+\.)\s/.test(line)) {
      out.push(`<div class="li">${inline(line.trim())}</div>`);
    } else if (/^>\s?/.test(line)) {
      out.push(`<div class="quote">${inline(line.replace(/^>\s?/, ""))}</div>`);
    } else if (line.trim()) {
      out.push(`<p>${inline(line)}</p>`);
    }
  }
  return out.join("\n").replace(/\u0000(\d+)\u0000/g, (_, n) => blocks[Number(n)]);
}

function turnHtml(info, turn, index, total) {
  const items = turn.items
    .map((it) => {
      if (it.kind === "text") return `<div class="ai">${mdToHtml(redact(it.text))}</div>`;
      if (it.kind === "tool") return `<div class="tool">🔧 <b>${esc(it.name)}</b>　${esc(redact(it.text))}</div>`;
      if (it.kind === "question")
        return `<div class="ask"><div class="label">AI 提問</div>${esc(it.text)}<ul>${it.options.map((o) => `<li>${esc(o)}</li>`).join("")}</ul></div>`;
      return `<div class="answer"><div class="label">我們的決定</div>${esc(redact(it.text))}</div>`;
    })
    .join("\n");
  return `<!doctype html><html lang="zh-Hant"><head><meta charset="utf-8"><style>
  body{margin:0;background:#eef1f4;font-family:"Microsoft JhengHei","Noto Sans CJK TC","PingFang TC",sans-serif;font-size:15px;line-height:1.6;color:#1f2328}
  .card{width:880px;margin:16px;background:#fff;border-radius:12px;box-shadow:0 1px 4px rgba(0,0,0,.12);overflow:hidden}
  .top{background:#1d4d36;color:#fff;padding:10px 18px;font-size:13px;display:flex;justify-content:space-between}
  .body{padding:16px 18px}
  .who{font-size:12px;font-weight:700;color:#57606a;margin:10px 0 4px}
  .user{background:#e7f3ec;border-radius:10px;padding:10px 14px;white-space:pre-wrap;word-break:break-word}
  .ai p{margin:4px 0}.ai .h{font-weight:700;margin:10px 0 4px}.ai .li{padding-left:14px}.ai .quote{border-left:3px solid #c9d6ce;padding-left:10px;color:#57606a}
  .tool{font-family:Consolas,"Noto Sans Mono CJK TC",monospace;font-size:12px;color:#57606a;background:#f6f8fa;border-radius:6px;padding:4px 10px;margin:4px 0;word-break:break-all}
  .ask,.answer{border-radius:10px;padding:10px 14px;margin:8px 0}.ask{background:#fff8e5;border:1px solid #f0d58a}.answer{background:#e8f1ff;border:1px solid #9fc0f5}
  .label{font-size:12px;font-weight:700;color:#57606a}.ask ul{margin:6px 0 0;padding-left:20px}
  pre{background:#f6f8fa;border-radius:6px;padding:8px 10px;font-size:12px;white-space:pre-wrap;word-break:break-all}
  code{background:#f3f4f6;border-radius:4px;padding:0 4px;font-size:13px}
  table{border-collapse:collapse;margin:6px 0;font-size:13px}th,td{border:1px solid #d0d7de;padding:3px 8px;text-align:left;vertical-align:top}th{background:#f3f6f4}
  </style></head><body><div class="card" id="card">
  <div class="top"><span>${esc(info.title)}　第 ${index} / ${total} 輪</span><span>${esc(info.user)}　${esc(localDate(turn.time).text)}${info.branch ? "　" + esc(info.branch) : ""}</span></div>
  <div class="body"><div class="who">我們</div><div class="user">${esc(redact(turn.prompt) || "（無文字）")}</div>
  <div class="who">Claude</div>${items || '<div class="tool">（無回覆）</div>'}</div></div></body></html>`;
}

async function loadBrowser() {
  // 先找 scripts/ai-evidence/node_modules，再找全域安裝
  const require = createRequire(path.join(HERE, "package.json"));
  let pw;
  for (const name of ["playwright-core", "playwright"]) {
    try {
      pw = require(name);
      break;
    } catch {
      /* 下一個 */
    }
  }
  if (!pw) return null;
  const chromium = pw.chromium ?? pw.default?.chromium;
  for (const options of [{ channel: "msedge" }, { channel: "chrome" }, {}]) {
    try {
      return await chromium.launch(options);
    } catch {
      /* 換下一種瀏覽器 */
    }
  }
  return null;
}

function updateIndex(outDir, row) {
  const file = path.join(outDir, "README.md");
  const header = [
    "# AI 使用佐證（自動產生）",
    "",
    "每次 Claude Code 對話結束時自動產生。每個資料夾有 `transcript.md`（完整文字稿）、`rows.md`（AI 起草的紀錄列，要本人確認）與 `turn-NN.png`（紀錄列引用到的對話卡片圖），G 文件直接引用。",
    "",
    "彙整成 Excel：`node scripts/ai-evidence/build-log.mjs` → `docs/G-AI使用紀錄.xlsx`。",
    "",
    "| 日期 | 成員 | 分支 | 主題（第一個指令） | 輪數 | 資料夾 |",
    "| --- | --- | --- | --- | --- | --- |",
  ];
  const rows = fs.existsSync(file) ? fs.readFileSync(file, "utf8").split("\n").filter((l) => l.startsWith("| ") && !l.startsWith("| 日期") && !l.startsWith("| ---")) : [];
  const kept = rows.filter((r) => {
    if (r.includes(`](${row.folder}/)`)) return false;
    const m = r.match(/\]\(([^)]+)\/\)/);
    return !m || fs.existsSync(path.join(outDir, m[1])); // 已刪掉的資料夾不留在索引
  });
  kept.push(`| ${row.date} | ${row.user} | ${row.branch} | ${row.title.replace(/\|/g, "／")} | ${row.turns} | [${row.folder}](${row.folder}/) |`);
  kept.sort();
  fs.writeFileSync(file, [...header, ...kept, ""].join("\n"));
}


// ---------- 紀錄列草稿 ----------

export const ACTIVITIES = ["需求", "設計", "程式", "測試", "除錯", "審查", "文件", "管理"];
export const ADOPTION = ["直接採用", "小幅修改", "大幅修改", "僅參考", "不採用"];
export const ROW_FIELDS = ["日期", "成員", "軟工活動", "具體工作", "AI 工具／BMad 技能", "Prompt 重點", "AI 產出摘要", "人工判斷與修正", "採用程度", "截圖／檔案", "對應文件章節", "狀態"];

export function memberName(root, gitName) {
  try {
    const map = JSON.parse(fs.readFileSync(path.join(HERE, "members.json"), "utf8"));
    return map[gitName] ?? gitName;
  } catch {
    return gitName;
  }
}

function digestForModel(turns) {
  const cut = (s, n) => (s.length > n ? s.slice(0, n) + "…" : s);
  let out = "";
  turns.forEach((t, i) => {
    out += `\n### 第 ${i + 1} 輪\n【使用者】${cut(redact(t.prompt), 1500)}\n`;
    for (const it of t.items) {
      if (it.kind === "text") out += `【AI】${cut(redact(it.text), 700)}\n`;
      else if (it.kind === "tool") out += `【工具】${it.name}：${cut(redact(it.text), 120)}\n`;
      else if (it.kind === "question") out += `【AI 提問】${it.text}（選項：${it.options.join("／")}）\n`;
      else if (it.kind === "answer") out += `【使用者決定】${redact(it.text)}\n`;
    }
  });
  return out.length > 60000 ? out.slice(0, 30000) + "\n…（中段省略）…\n" + out.slice(-30000) : out;
}

function draftPrompt(info, digest) {
  return `你是軟體工程課程的助教。以下是學生「${info.member}」使用 AI 開發「食序 FoodFlow」的一段對話紀錄（${info.start}）。
請整理成課程文件 G「AI 使用紀錄」的紀錄列。一段對話可能包含多個任務；同一任務來回很多次合併成一列；純閒聊、問指令怎麼打這類小事不要列。

每列欄位：
- 日期：YYYY-MM-DD
- 軟工活動：只能是 ${ACTIVITIES.join("、")} 其中之一
- 具體工作：一句話，做了什麼
- AI 工具／BMad 技能：例如 Claude Code＋bmad-architecture
- Prompt 重點：使用者要 AI 做什麼（摘要，不要整段貼）
- AI 產出摘要：AI 產出了什麼（檔案名稱、重點）
- 人工判斷與修正：只能寫對話中「看得到」的人工判斷：使用者否決、修正、追問、做出選擇、指出 AI 錯誤的地方。對話裡看不出來就寫「（待本人補充）」，絕對不可以編造
- 採用程度：只能是 ${ADOPTION.join("、")} 其中之一
- 輪次：這列對應的對話輪次編號，例如 [3, 4]
- 對應文件章節：A 專案管理、B 需求分析、C 軟體設計、D 物件設計、E 測試計畫、F 測試報告、G AI 使用紀錄，寫代號與章節，例如「C（架構）」

只輸出一個 JSON 陣列，不要任何其他文字。欄位名稱用上面的中文。

對話紀錄：
${digest}`;
}

// 從 Claude Code 的 hook 裡呼叫時，拿掉「目前在 Claude Code 裡面」的環境變數，讓 claude -p 當成獨立執行
function childEnv() {
  const env = { ...process.env, FOODFLOW_AI_EVIDENCE_CHILD: "1" };
  for (const key of Object.keys(env)) {
    if (key === "CLAUDECODE" || key === "CLAUDE_PROJECT_DIR" || /^CLAUDE_CODE_(ENTRYPOINT|SSE_PORT|IDE|EXECPATH)/.test(key)) delete env[key];
  }
  return env;
}

function runClaude(prompt) {
  // 用一整串指令交給 shell：Windows 上分開傳參數時，空字串參數（--tools ""）會被吃掉
  const r = spawnSync('claude -p --no-session-persistence --tools ""', {
    input: prompt,
    cwd: os.tmpdir(), // 不在專案目錄執行，避免觸發專案 hook 與寫入專案的對話紀錄
    encoding: "utf8",
    shell: true,
    env: childEnv(),
    timeout: 600000, // 長對話起草可能要好幾分鐘
    maxBuffer: 10 * 1024 * 1024,
  });
  if (r.status !== 0) {
    const why = [r.error?.message, r.signal && `signal ${r.signal}`, `exit ${r.status}`, r.stderr?.trim(), r.stdout?.trim()].filter(Boolean).join("｜");
    throw new Error(`claude -p 失敗：${why.slice(0, 500)}`);
  }
  const m = r.stdout.match(/\[[\s\S]*\]/);
  if (!m) throw new Error("claude -p 沒有回傳 JSON");
  return JSON.parse(m[0]);
}

export function parseRowsMd(text) {
  const rows = [];
  let cur = null;
  for (const line of text.split(/\r?\n/)) {
    if (/^##\s/.test(line)) {
      cur = {};
      rows.push(cur);
      continue;
    }
    const m = line.match(/^-\s*([^：:]+)[：:]\s?(.*)$/);
    if (cur && m && ROW_FIELDS.includes(m[1].trim())) cur[m[1].trim()] = m[2].trim();
  }
  return rows;
}

function rowsToMd(info, rows) {
  const out = [
    `# AI 使用紀錄草稿：${info.title}`,
    "",
    "> AI 依對話紀錄自動起草。**請本人檢查每一列**，特別是「人工判斷與修正」與「採用程度」；確認後把「狀態」改成「已確認」。",
    "> 「軟工活動」只能填：" + ACTIVITIES.join("、") + "；「採用程度」只能填：" + ADOPTION.join("、") + "。不需要的列整段刪掉。",
    "",
  ];
  rows.forEach((r, i) => {
    out.push(`## ${i + 1}`, "");
    for (const f of ROW_FIELDS) out.push(`- ${f}：${String(r[f] ?? "").replace(/\r?\n/g, " ")}`);
    out.push("");
  });
  return out.join("\n");
}

function draftRows(info, turns, folder, folderRel) {
  const rowsFile = path.join(folder, "rows.md");
  if (fs.existsSync(rowsFile)) {
    const existing = parseRowsMd(fs.readFileSync(rowsFile, "utf8"));
    if (existing.some((r) => r["狀態"] === "已確認")) return { note: "已有本人確認的紀錄列，不覆寫", turns: citedTurns(existing) };
  }
  const raw = runClaude(draftPrompt(info, digestForModel(turns)));
  const rows = raw.map((r) => {
    const shots = (Array.isArray(r["輪次"]) ? r["輪次"] : [])
      .filter((n) => Number.isInteger(n) && n >= 1 && n <= turns.length)
      .map((n) => `${folderRel}/turn-${String(n).padStart(2, "0")}.png`);
    return {
      ...r,
      日期: r["日期"] || info.start.slice(0, 10),
      成員: info.member,
      軟工活動: ACTIVITIES.includes(r["軟工活動"]) ? r["軟工活動"] : "",
      採用程度: ADOPTION.includes(r["採用程度"]) ? r["採用程度"] : "",
      "截圖／檔案": [...shots, `${folderRel}/transcript.md`].join("、"),
      狀態: "待確認",
    };
  });
  fs.writeFileSync(rowsFile, rowsToMd(info, rows));
  return { note: `起草 ${rows.length} 列，待確認`, turns: citedTurns(rows) };
}

function citedTurns(rows) {
  const set = new Set();
  for (const r of rows) for (const m of String(r["截圖／檔案"] ?? "").matchAll(/turn-(\d+)\.png/g)) set.add(Number(m[1]));
  return set;
}

async function processTranscript(file, root, outDir, opts, browser) {
  const entries = readLines(file);
  const { meta, turns } = parseTurns(entries);
  if (!turns.length) return { file, skipped: "沒有對話內容" };
  const toolUsed = turns.some((t) => t.items.some((it) => it.kind !== "text"));
  if (turns.length === 1 && turns[0].prompt.trim().length < 15 && !toolUsed) return { file, skipped: "只有一句簡短對話（測試或閒聊）" };

  const user = gitUser(root);
  const start = localDate(meta.started);
  // 標題用第一句「不是斜線指令」的話，例如 /bmad-agent-dev 之後真正交代的任務
  const lines = turns.flatMap((t) => t.prompt.split("\n").map((l) => l.trim()).filter(Boolean));
  const firstPrompt = redact(lines.find((l) => !l.startsWith("/")) ?? lines[0] ?? "對話");
  const title = firstPrompt.length > 40 ? firstPrompt.slice(0, 40) + "…" : firstPrompt;
  const folderName = `${start.day}-${slug(user)}-${(meta.sessionId ?? path.basename(file, ".jsonl")).slice(0, 8)}`;
  const folder = path.join(outDir, folderName);
  const fingerprint = createHash("sha1").update(fs.readFileSync(file)).digest("hex");
  const metaFile = path.join(folder, ".capture.json");

  if (!opts.force && fs.existsSync(metaFile)) {
    const old = JSON.parse(fs.readFileSync(metaFile, "utf8"));
    if (old.fingerprint === fingerprint && (old.png || !opts.png) && (old.rows || !opts.rows)) return { file, skipped: "已是最新" };
  }

  fs.mkdirSync(folder, { recursive: true });
  const member = memberName(root, user);
  const info = { title, user: member, member, start: start.text, end: localDate(meta.ended).text, branch: meta.branch, sessionId: meta.sessionId };
  fs.writeFileSync(path.join(folder, "transcript.md"), toMarkdown(info, turns));

  // 先請 AI 起草紀錄列，再只替紀錄列引用到的輪次產生圖片（避免 repo 塞滿圖片）
  let rows = false;
  let rowsNote = "";
  let wanted = new Set();
  if (opts.rows) {
    try {
      const r = draftRows(info, turns, folder, path.relative(root, folder).replace(/\\/g, "/"));
      rowsNote = r.note;
      wanted = r.turns;
      rows = true;
    } catch (err) {
      rowsNote = `紀錄列草稿失敗（${err.message.trim()}），改為每一輪都產圖；之後可重跑 --all --force`;
      wanted = new Set(turns.map((_, i) => i + 1));
    }
  }
  if (opts.pngAll) wanted = new Set(turns.map((_, i) => i + 1));

  let png = false;
  if (opts.png && browser) {
    for (const old of fs.readdirSync(folder)) if (/^turn-\d+\.png$/.test(old)) fs.unlinkSync(path.join(folder, old));
    const page = await browser.newPage({ deviceScaleFactor: 1.5 });
    for (const n of [...wanted].sort((a, b) => a - b)) {
      await page.setContent(turnHtml(info, turns[n - 1], n, turns.length), { waitUntil: "load" });
      await page.locator("#card").screenshot({ path: path.join(folder, `turn-${String(n).padStart(2, "0")}.png`) });
    }
    await page.close();
    png = true;
  }

  fs.writeFileSync(metaFile, JSON.stringify({ fingerprint, png, rows, transcript: path.basename(file) }, null, 2));
  updateIndex(outDir, { date: start.text, user: member, branch: meta.branch ?? "", title, turns: turns.length, folder: folderName });
  return { file, folder, turns: turns.length, png, rowsNote };
}

async function main() {
  if (process.env.FOODFLOW_AI_EVIDENCE_CHILD) return; // 起草用的 claude -p 自己結束時不要再觸發

  if (has("--hook")) {
    // Claude Code 結束時呼叫：讀事件後在背景處理，立刻返回，不拖慢關閉
    let event = {};
    try {
      event = JSON.parse(fs.readFileSync(0, "utf8") || "{}");
    } catch {
      /* 沒有事件內容 */
    }
    if (!event.transcript_path) return;
    const root = projectRoot(event.cwd ?? process.env.CLAUDE_PROJECT_DIR ?? process.cwd());
    const outDir = path.resolve(root, "docs/ai-evidence");
    fs.mkdirSync(outDir, { recursive: true });
    const log = fs.openSync(path.join(outDir, ".capture.log"), "a");
    // Windows 結束對話時會中斷 Claude Code 底下的程序，所以這裡不呼叫 claude 起草，只產文字稿與圖；
    // 起草留給 commit 前手動執行的 --all
    const child = spawn(process.execPath, [fileURLToPath(import.meta.url), "--transcript", event.transcript_path, "--root", root, "--no-rows", "--png-all"], {
      cwd: root,
      detached: true,
      stdio: ["ignore", log, log],
      windowsHide: true,
    });
    child.unref();
    return;
  }

  const root = projectRoot(valueOf("--root") ?? process.env.CLAUDE_PROJECT_DIR ?? process.cwd());
  const outDir = path.resolve(root, valueOf("--out") ?? "docs/ai-evidence");
  const opts = { png: !has("--no-png"), pngAll: has("--png-all"), rows: !has("--no-rows"), force: has("--force") };

  let files;
  if (valueOf("--transcript")) files = [valueOf("--transcript")];
  else if (has("--all")) files = findProjectTranscripts(root);
  else {
    console.log("用法：--all（補抓本專案全部對話）、--transcript <檔案>、--hook（給 Claude Code 呼叫）");
    return;
  }

  const browser = opts.png ? await loadBrowser() : null;
  if (opts.png && !browser) console.error("找不到可用的瀏覽器或 playwright-core，只產生文字稿。請在 scripts/ai-evidence 執行 npm install。");
  try {
    for (const file of files) {
      if (!fs.existsSync(file)) continue;
      const r = await processTranscript(file, root, outDir, { ...opts, png: opts.png && !!browser }, browser);
      console.log(
        `[${new Date().toISOString()}] ` +
          (r.skipped ? `略過 ${path.basename(file)}：${r.skipped}` : `完成 ${path.relative(root, r.folder)}（${r.turns} 輪${r.png ? "，含圖片" : ""}${r.rowsNote ? "；" + r.rowsNote : ""}）`),
      );
    }
  } finally {
    await browser?.close();
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((err) => {
    console.error("ai-evidence 失敗：", err.message);
    process.exit(has("--hook") ? 0 : 1); // hook 失敗不要擋住 Claude Code
  });
}
