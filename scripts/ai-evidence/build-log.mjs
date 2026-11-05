#!/usr/bin/env node
// 把全組的 AI 使用紀錄彙整成一份 Excel：docs/G-AI使用紀錄.xlsx
// 來源：docs/ai-evidence/*/rows.md（自動起草、本人確認）＋ docs/ai-log.md（早期手寫紀錄）
// 用法（專案根目錄）：node scripts/ai-evidence/build-log.mjs

import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { ACTIVITIES, ADOPTION, ROW_FIELDS, parseRowsMd } from "./capture.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(path.join(HERE, "package.json"));
const ExcelJS = require("exceljs");

const root = (() => {
  try {
    return execFileSync("git", ["rev-parse", "--show-toplevel"], { encoding: "utf8" }).trim();
  } catch {
    return process.cwd();
  }
})();
const evidenceDir = path.join(root, "docs", "ai-evidence");
const outFile = path.join(root, "docs", "G-AI使用紀錄.xlsx");

const members = (() => {
  try {
    return [...new Set(Object.values(JSON.parse(fs.readFileSync(path.join(HERE, "members.json"), "utf8"))))];
  } catch {
    return [];
  }
})();

// 早期手寫的 docs/ai-log.md：日期｜成員｜SE activity｜工具｜輸入摘要｜AI 產出｜人工修正與原因
function legacyRows() {
  const file = path.join(root, "docs", "ai-log.md");
  if (!fs.existsSync(file)) return [];
  const map = { 環境建置: "管理", 需求: "需求", 架構設計: "設計", 設計: "設計", 實作: "程式", 程式: "程式", 實作審查: "審查", 審查: "審查", 測試: "測試", 除錯: "除錯", 文件: "文件", 管理: "管理" };
  const names = (() => {
    try {
      return JSON.parse(fs.readFileSync(path.join(HERE, "members.json"), "utf8"));
    } catch {
      return {};
    }
  })();
  const rows = [];
  for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    if (!/^\|\s*\d{4}-\d{2}-\d{2}/.test(line)) continue;
    const c = line.trim().slice(1, -1).split("|").map((x) => x.trim());
    const who = c[1] === "Ken" ? names.mintguesss ?? "Ken" : names[c[1]] ?? c[1];
    rows.push({
      日期: c[0],
      成員: who,
      軟工活動: map[c[2]] ?? c[2],
      具體工作: c[4],
      "AI 工具／BMad 技能": c[3],
      "Prompt 重點": c[4],
      "AI 產出摘要": c[5],
      人工判斷與修正: c[6],
      採用程度: "",
      "截圖／檔案": "",
      對應文件章節: "",
      狀態: "已確認",
      來源: "docs/ai-log.md",
    });
  }
  return rows;
}

function evidenceRows() {
  if (!fs.existsSync(evidenceDir)) return [];
  const rows = [];
  for (const dir of fs.readdirSync(evidenceDir)) {
    const f = path.join(evidenceDir, dir, "rows.md");
    if (!fs.existsSync(f)) continue;
    for (const r of parseRowsMd(fs.readFileSync(f, "utf8"))) rows.push({ ...r, 來源: `docs/ai-evidence/${dir}/rows.md` });
  }
  return rows;
}

const rows = [...legacyRows(), ...evidenceRows()].sort((a, b) => String(a["日期"]).localeCompare(String(b["日期"])));

const wb = new ExcelJS.Workbook();
const font = { name: "Microsoft JhengHei", size: 11 };

// 說明
const help = wb.addWorksheet("說明");
[
  "食序 FoodFlow AI 使用紀錄（文件 G）",
  "",
  "本檔由 scripts/ai-evidence/build-log.mjs 自動彙整，不要直接改這份 Excel，改來源後重新產生。",
  "",
  "一、資料怎麼來",
  "• 每次 Claude Code 對話結束，會自動在 docs/ai-evidence/<日期-成員-編號>/ 產生 transcript.md（文字稿）、turn-NN.png（每一輪對話卡片圖）、rows.md（AI 起草的紀錄列）。",
  "• rows.md 由本人檢查：「人工判斷與修正」「採用程度」一定要自己確認，確認後把「狀態」改成「已確認」。",
  "• 早期手寫在 docs/ai-log.md 的紀錄也會一起彙整。",
  "",
  "二、黃底列＝狀態還是「待確認」，交件前要處理完。",
  "",
  "三、老師看的是「怎麼判斷、修正 AI 的產出」，所以「人工判斷與修正」是最重要的一欄：否決了什麼、改了什麼、為什麼。",
].forEach((t, i) => {
  const cell = help.getCell(`A${i + 1}`);
  cell.value = t;
  cell.font = i === 0 ? { ...font, size: 14, bold: true } : font;
});
help.getColumn(1).width = 120;

// 紀錄表
const sheet = wb.addWorksheet("紀錄表", { views: [{ state: "frozen", ySplit: 1 }] });
const columns = [...ROW_FIELDS.slice(0, 9), "截圖預覽", ...ROW_FIELDS.slice(9), "來源"];
const widths = { 日期: 12, 成員: 10, 軟工活動: 10, 具體工作: 30, "AI 工具／BMad 技能": 22, "Prompt 重點": 40, "AI 產出摘要": 40, 人工判斷與修正: 50, 採用程度: 11, "截圖／檔案": 36, 對應文件章節: 16, 狀態: 9, 來源: 30, 截圖預覽: 34 };
sheet.columns = columns.map((h) => ({ header: h, key: h, width: widths[h] ?? 16 }));
sheet.getRow(1).font = { ...font, bold: true, color: { argb: "FFFFFFFF" } };
sheet.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1D4D36" } };
// 讀 PNG 的寬高（檔頭第 16～24 位元組）
function pngSize(file) {
  const buf = Buffer.alloc(24);
  const fd = fs.openSync(file, "r");
  fs.readSync(fd, buf, 0, 24, 0);
  fs.closeSync(fd);
  return { w: buf.readUInt32BE(16), h: buf.readUInt32BE(20) };
}

const PREVIEW_W = 240; // 預覽圖寬度（像素）
const PREVIEW_MAX_H = 420; // 太長的圖只顯示到這個高度，完整圖點連結開啟
const previewCol = columns.indexOf("截圖預覽");
let images = 0;
for (const r of rows) {
  const row = sheet.addRow(columns.map((h) => (h === "截圖預覽" ? "" : r[h] ?? "")));
  row.font = font;
  row.alignment = { vertical: "top", wrapText: true };
  if (r["狀態"] !== "已確認") row.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFF4C2" } };

  const shots = String(r["截圖／檔案"] ?? "")
    .split(/[、,，\s]+/)
    .filter((f) => /\.(png|jpe?g)$/i.test(f))
    .map((f) => path.join(root, f))
    .filter((f) => fs.existsSync(f));
  if (!shots.length) continue;
  const first = shots[0];
  const { w, h } = /\.png$/i.test(first) ? pngSize(first) : { w: 4, h: 3 };
  const height = Math.min(Math.round((PREVIEW_W * h) / w), PREVIEW_MAX_H);
  const id = wb.addImage({ filename: first, extension: /\.png$/i.test(first) ? "png" : "jpeg" });
  sheet.addImage(id, { tl: { col: previewCol + 0.05, row: row.number - 1 + 0.05 }, ext: { width: PREVIEW_W, height }, editAs: "oneCell" });
  row.height = Math.max(row.height ?? 15, height * 0.75 + 24); // 圖下方留一行放連結
  const cell = row.getCell(previewCol + 1);
  cell.value = { text: shots.length > 1 ? `共 ${shots.length} 張，點此開第 1 張` : "點此開原圖", hyperlink: path.relative(path.dirname(outFile), first).replace(/\\/g, "/") };
  cell.font = { ...font, color: { argb: "FF0563C1" }, underline: true };
  cell.alignment = { vertical: "bottom" };
  images++;
}
const last = Math.max(rows.length + 50, 200);
const colLetter = (name) => sheet.getColumn(name).letter;
const list = (sheetCol) => ({ type: "list", allowBlank: true, formulae: [sheetCol] });

// 選項
const opt = wb.addWorksheet("選項");
opt.getRow(1).values = ["軟工活動", "採用程度", "成員", "狀態"];
const lists = [ACTIVITIES, ADOPTION, members, ["待確認", "已確認"]];
lists.forEach((vals, ci) => vals.forEach((v, ri) => (opt.getCell(ri + 2, ci + 1).value = v)));
opt.getRow(1).font = { ...font, bold: true };

for (let i = 2; i <= last; i++) {
  sheet.getCell(`${colLetter("軟工活動")}${i}`).dataValidation = list(`選項!$A$2:$A$${ACTIVITIES.length + 1}`);
  sheet.getCell(`${colLetter("採用程度")}${i}`).dataValidation = list(`選項!$B$2:$B$${ADOPTION.length + 1}`);
  if (members.length) sheet.getCell(`${colLetter("成員")}${i}`).dataValidation = list(`選項!$C$2:$C$${members.length + 1}`);
  sheet.getCell(`${colLetter("狀態")}${i}`).dataValidation = list(`選項!$D$2:$D$3`);
}

// 統計：活動 × 採用程度，報告時可直接引用
const stat = wb.addWorksheet("統計");
stat.getRow(1).values = ["軟工活動", ...ADOPTION, "未填", "合計"];
stat.getRow(1).font = { ...font, bold: true };
ACTIVITIES.forEach((act, i) => {
  const mine = rows.filter((r) => r["軟工活動"] === act);
  const counts = ADOPTION.map((a) => mine.filter((r) => r["採用程度"] === a).length);
  stat.getRow(i + 2).values = [act, ...counts, mine.length - counts.reduce((x, y) => x + y, 0), mine.length];
});
const byMember = [...new Set(rows.map((r) => r["成員"]))];
stat.getRow(ACTIVITIES.length + 4).values = ["成員", "紀錄列數", "已確認", "待確認"];
stat.getRow(ACTIVITIES.length + 4).font = { ...font, bold: true };
byMember.forEach((m, i) => {
  const mine = rows.filter((r) => r["成員"] === m);
  const ok = mine.filter((r) => r["狀態"] === "已確認").length;
  stat.getRow(ACTIVITIES.length + 5 + i).values = [m, mine.length, ok, mine.length - ok];
});
stat.columns.forEach((c) => (c.width = 12));

await wb.xlsx.writeFile(outFile);
const pending = rows.filter((r) => r["狀態"] !== "已確認").length;
console.log(`已產生 ${path.relative(root, outFile)}：共 ${rows.length} 列（含 ${images} 張預覽圖），待確認 ${pending} 列`);
