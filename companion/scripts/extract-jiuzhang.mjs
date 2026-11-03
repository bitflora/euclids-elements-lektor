#!/usr/bin/env node
// Build src/data/jiuzhang/jiuzhang.json from the cached sources (scripts/fetch-jiuzhang.mjs).
//
// The classic is the punctuated Wikisource edition 九章算術, line for line; its problem
// numbers 〔一〕〔二〕… become `problem` on the passage. The commentary comes from the
// Wikisource transcription of the Sibu Congkan reprint of the Weiboxie edition (SBCK),
// where the classic is set in large characters and the commentary in double lines of small
// ones ({{雙行註文|…|…}}). The SBCK's large characters are aligned with the Wikisource
// classic, character by character, to find where each note falls; the Wikisource lines are
// cut there. A note is Liu Hui's (263 CE) unless it opens 臣淳風等謹按, which marks Li
// Chunfeng's sub-commentary (656 CE); Li's notes are kept, as a third voice, because they
// carry Zu Geng's proof of the volume of the sphere (ch. 4). Dai Zhen's errata (訂訛補圖)
// at the end of each chapter are dropped.
//
// This edition covers chapters 1, 4, 5 and 9, the geometrical ones, and Liu Hui's preface.
//
//   node scripts/extract-jiuzhang.mjs        # writes JSON, prints an alignment report

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..");
const SRC = path.join(root, "sources");
const OUT = path.join(root, "src", "data", "jiuzhang", "jiuzhang.json");

const CHAPTERS = [1, 4, 5, 9];
const CH_ZH = { 1: "卷第一", 4: "卷第四", 5: "卷第五", 9: "卷第九" };
// Each chapter's title is glossed by a line saying what it is for (the SBCK prints all four).
const SUBTITLE = { 1: "以御田疇界域", 4: "以御積冪方圓", 5: "以御功程積實", 9: "以御高深廣遠" };

// ─── SKchar placeholders, from Wikisource's Module:SKchar (and context). ──────
const SKCHAR = {
  "2959": "弦", "2918": "冪", "2604": "面", "2721": "卿", "3522": "纏", "3681": "𫎇",
  "3484": "簡", "2682": "宜", "3505": "紙", "2872": "竄", "3892": "類",
};
const SKCHAR2 = { "32": "直" };

// Commentary misreadings in the SBCK transcription (an unproofread OCR), corrected by
// context: [chapter, wrong, right, why]. Each must occur in the commentary exactly once
// unless `all` is given.
const CORRECTIONS = [
  [9, "短面日句長面日股相與結角日弦", "短面曰句長面曰股相與結角曰弦", "曰 misread as 日 (three times)"],
  [4, "祖暅之開立圓術日", "祖暅之開立圓術曰", "曰 misread as 日"],
];

// Variant forms treated as the same character when aligning the two witnesses.
const VARIANTS = [
  "為爲", "即卽", "既旣", "冪羃幂", "算筭", "句勾", "荅答", "圓圜", "邪衺斜", "脩修", "鱉鼈", "羨羡",
  "塹壍", "隄堤", "卻郤却", "參叅", "并並併", "內内", "減减", "青靑", "眾衆", "毎每", "橫横", "黃黄",
  "兩两", "徧遍", "乘乗", "微㣲", "陰隂", "增増", "說説", "類𩔖", "於于", "曆歷", "協恊", "暨曁",
  "犧羲", "庖包", "異异", "啟啓", "叡睿", "強彊", "閒間", "游遊", "回迴", "與与", "蓋盖", "徑逕",
  "强強", "黜黷", "竒奇", "猶犹", "嘗甞", "冥㝠", "攷考", "效効", "裏裡", "總緫摠", "簡𥳑",
];
const VMAP = new Map();
for (const set of VARIANTS) for (const ch of [...set]) VMAP.set(ch, [...set][0]);

const PUNCT = /[．。，、：；？！︰「」『』《》〈〉（）()\s　□·•.,:;?!‧]/u;
const nc = (c) => (PUNCT.test(c) ? "" : VMAP.get(c) ?? c);
const norm = (s) => [...s].map(nc).join("");

// ─── Wikisource: the classic ─────────────────────────────────────────────
const NUM = { 〇: 0, 一: 1, 二: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9 };
const cnum = (s) => Number([...s].map((c) => NUM[c]).join(""));

function readWs() {
  const raw = fs.readFileSync(path.join(SRC, "jiuzhang-ws.txt"), "utf8");
  const parts = raw.split(/\n(?===)/);
  const pref = parts.find((p) => p.startsWith("==九章筭術注序"));
  const preface = pref
    .replace(/^==.*==\n/, "")
    .replace(/（晉劉徽序）/, "")
    .trim()
    .split(/\n+/)
    .map((s) => s.trim())
    .filter(Boolean);
  const chapters = {};
  for (const ch of CHAPTERS) {
    const sec = parts.find((p) => new RegExp(`^==\\s*${CH_ZH[ch]}`).test(p));
    const head = /^==\s*卷第.\s*(\S+?)(?:<sub>(.*?)<\/sub>)?\s*==/.exec(sec);
    const lines = [];
    for (let line of sec.split("\n").slice(1)) {
      line = line
        .replace(/\{\{\*\|(?:[^{}]|\{\{[^{}]*\}\})*\}\}/g, "") // ch. 1 carries some commentary inline
        .replace(/\{\{[^{}]*\}\}|\[\[[^\]]*\]\]/g, "")
        .replace(/'''/g, "")
        .replace(/^:+/, "")
        .trim();
      if (!line) continue;
      const m = /^〔([〇一二三四五六七八九]+)〕/.exec(line);
      const problem = m ? cnum(m[1]) : undefined;
      if (m) line = line.slice(m[0].length);
      lines.push({ text: line, problem, answer: /^[荅答]曰/.test(line) });
    }
    chapters[ch] = { name: head[1], subtitle: head[2], lines };
  }
  return { preface, chapters };
}

// ─── SBCK: classic characters and the notes between them ──────────────────
function cleanWiki(s) {
  return s
    .replace(/<noinclude>[\s\S]*?<\/noinclude>/g, "")
    .replace(/\{\{SKchar\|(\d+)\}\}/g, (_, n) => SKCHAR[n] ?? "□")
    .replace(/\{\{SKchar2\|(\d+)\}\}/g, (_, n) => SKCHAR2[n] ?? "□")
    .replace(/\{\{YL\|([^}]*)\}\}/g, "$1")
    .replace(/\{\{\?\}\}/g, "□");
}

/** One chapter of the SBCK as a token stream: classic characters and notes. */
function readSbck(ch) {
  const pages = JSON.parse(fs.readFileSync(path.join(SRC, "jiuzhang-sbck.json"), "utf8"));
  const tokens = [];
  let started = false;
  let stopped = false;
  // A chapter's pages run from its title page to the next chapter's, or to Dai Zhen's errata.
  for (const p of pages) {
    const t = cleanWiki(p.text ?? "");
    if (!started) {
      if (new RegExp(`^\\s*九章算術卷(第)?${CH_ZH[ch].slice(-1)}\\s`).test(t)) started = true;
      else continue;
    } else if (/^\s*九章算術卷/.test(t)) break;
    if (stopped) break;
    for (let line of t.split("\n")) {
      line = line.trim();
      if (!line) continue;
      // The colophon of the Qing reprint and the Song editors' credits, after chapter 9.
      if (/^大[淸清]乾隆/.test(line)) {
        stopped = true;
        break;
      }
      if (/^九章算術卷/.test(line) || /^魏\s*劉\s*徽\s*注$/.test(line) || /^唐朝議大夫/.test(line)) continue;
      // The chapter's title line: 方田{{雙行註文|以御田|疇界域}}
      if (/^(方田|少廣|商功|句股)\{\{雙行註文\|以御/.test(line)) continue;
      const re = /\{\{雙行註文\|([^{}]*)\}\}/g;
      let last = 0;
      let m;
      const text = (s) => {
        for (const c of s.replace(/[\s　]/g, "")) tokens.push({ c, page: p.n });
      };
      while ((m = re.exec(line))) {
        text(line.slice(last, m.index));
        const zh = m[1].replace(/[|\s　]/g, "");
        const prev = tokens[tokens.length - 1];
        if (prev && prev.note != null) prev.note += zh;
        else tokens.push({ note: zh, page: p.n });
        last = re.lastIndex;
      }
      text(line.slice(last));
    }
  }
  return tokens;
}

// ─── Alignment: SBCK classic characters against the Wikisource classic ─────
/** Global alignment; returns, for each index of a, the matched index of b or -1. */
function alignChars(a, b) {
  const n = a.length, m = b.length;
  const W = m + 1;
  const dir = new Uint8Array((n + 1) * W); // 0 diag, 1 up (skip a), 2 left (skip b)
  let prev = new Int32Array(W);
  let cur = new Int32Array(W);
  for (let j = 0; j <= m; j++) { prev[j] = j; dir[j] = 2; }
  for (let i = 1; i <= n; i++) {
    cur[0] = i;
    dir[i * W] = 1;
    for (let j = 1; j <= m; j++) {
      const d = prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1);
      const u = prev[j] + 1;
      const l = cur[j - 1] + 1;
      if (d <= u && d <= l) { cur[j] = d; dir[i * W + j] = 0; }
      else if (u <= l) { cur[j] = u; dir[i * W + j] = 1; }
      else { cur[j] = l; dir[i * W + j] = 2; }
    }
    [prev, cur] = [cur, prev];
  }
  const map = new Int32Array(n).fill(-1);
  let i = n, j = m;
  const same = new Uint8Array(n);
  while (i > 0 || j > 0) {
    const d = dir[i * W + j];
    if (i > 0 && j > 0 && d === 0) { map[i - 1] = j - 1; same[i - 1] = a[i - 1] === b[j - 1] ? 1 : 0; i--; j--; }
    else if (i > 0 && (j === 0 || d === 1)) i--;
    else j--;
  }
  return { map, same, cost: prev[m] };
}

const report = [];

function buildChapter(ch, ws) {
  const { lines } = ws.chapters[ch];
  // The Wikisource classic as a normalised stream, each character traced to (line, offset).
  const wsChars = [];
  lines.forEach((l, li) => [...l.text].forEach((c, off) => { const n = nc(c); if (n) wsChars.push({ c: n, li, off }); }));
  const tokens = readSbck(ch);
  const sbChars = tokens.filter((t) => t.c != null).map((t) => ({ ...t, n: nc(t.c) })).filter((t) => t.n);
  const { map, same } = alignChars(sbChars.map((t) => t.n), wsChars.map((t) => t.c));

  // Differences between the two witnesses, for the report.
  let run = [];
  const flush = () => {
    if (run.length >= 2) report.push(`ch. ${ch} SBCK differs (p.${run[0].page}): ${run.map((t) => t.c).join("")}`);
    run = [];
  };
  sbChars.forEach((t, k) => (map[k] < 0 || !same[k] ? run.push(t) : flush()));
  flush();
  const matched = new Set([...map].filter((x) => x >= 0));
  let gap = [];
  wsChars.forEach((w, k) => {
    if (!matched.has(k)) gap.push(w);
    else {
      if (gap.length >= 2) report.push(`ch. ${ch} Wikisource only: ${gap.map((x) => lines[x.li].text[x.off] ?? "").join("")} (line ${gap[0].li + 1})`);
      gap = [];
    }
  });

  // Each note's place: just after the Wikisource character matched by the last SBCK character before it.
  const notes = [];
  let k = -1;
  let before = -1;
  for (const t of tokens) {
    if (t.c != null) {
      if (nc(t.c)) {
        k++;
        if (map[k] >= 0) before = map[k];
      }
    } else notes.push({ zh: t.note, after: before, page: t.page });
  }
  for (const [c, from, to, why] of CORRECTIONS) {
    if (c !== ch) continue;
    const hits = notes.filter((n) => n.zh.includes(from));
    if (hits.length !== 1) throw new Error(`correction not found exactly once in ch. ${ch}: ${from}`);
    hits[0].zh = hits[0].zh.replace(from, to);
    corrections.push({ id: `JZ.${ch}`, from, to, reason: why });
  }

  // Cut points per Wikisource line: offsets (in printed characters) after which notes fall.
  const cuts = new Map(); // li -> Map(offsetEnd -> notes[])
  for (const n of notes) {
    if (n.after < 0) {
      report.push(`ch. ${ch} note before any classic text (p.${n.page}): ${n.zh.slice(0, 20)}`);
      continue;
    }
    const w = wsChars[n.after];
    const chars = [...lines[w.li].text];
    let end = w.off + 1;
    while (end < chars.length && !nc(chars[end])) end++; // keep trailing punctuation
    const m = cuts.get(w.li) ?? cuts.set(w.li, new Map()).get(w.li);
    (m.get(end) ?? m.set(end, []).get(end)).push(n.zh);
  }

  // Passages in reading order. A problem and its answer form one passage unless a note falls between.
  const passages = [];
  lines.forEach((l, li) => {
    const chars = [...l.text];
    const m = cuts.get(li) ?? new Map();
    const ends = [...m.keys()].sort((a, b) => a - b);
    let from = 0;
    const pieces = [];
    for (const e of ends) {
      pieces.push({ zh: chars.slice(from, e).join(""), notes: m.get(e) });
      from = e;
    }
    if (from < chars.length) pieces.push({ zh: chars.slice(from).join(""), notes: [] });
    pieces.forEach((pc, i) => {
      const last = passages[passages.length - 1];
      // An answer joins its question when nothing comes between.
      if (i === 0 && l.answer && last?.voice === "classic" && last.mergeable) {
        last.zh += pc.zh;
        last.mergeable = false;
      } else {
        const c = { voice: "classic", zh: pc.zh, line: li + 1 };
        if (i === 0 && l.problem != null) c.problem = l.problem;
        c.mergeable = !pc.notes.length && !l.answer && l.problem != null && i === pieces.length - 1;
        passages.push(c);
      }
      for (const zh of pc.notes) for (const v of splitVoices(zh)) passages.push(v);
      if (pc.notes.length) passages[passages.length - 1].mergeable = false;
    });
  });
  return passages.map(({ mergeable, ...p }) => p);
}

/** A note is Liu Hui's until 臣淳風等謹按 (…謹依, …按), after which it is Li Chunfeng's. */
function splitVoices(zh) {
  const out = [];
  const re = /臣淳風等謹?[按依]/g;
  let last = 0;
  let m;
  while ((m = re.exec(zh))) {
    if (m.index > last) out.push({ voice: last === 0 ? "liu" : "li", zh: zh.slice(last, m.index) });
    last = m.index;
  }
  out.push({ voice: last === 0 && !zh.startsWith("臣淳風") ? "liu" : "li", zh: zh.slice(last) });
  return out.filter((p) => p.zh);
}

// ─── Sections ─────────────────────────────────────────────────────────────
// This edition's division of each chapter: each section starts at a problem (its number) or at
// a classic passage beginning with the given words. A section is a rule with the problems it serves.
const SECTIONS = {
  1: [1, 3, 5, 7, 10, 12, 15, 17, 19, 22, 25, 27, 29, 31, 33, 35, 37],
  4: ["少廣", 5, 12, 17, 19, 23],
  5: [1, "術曰：并上下廣而半之", 5, 8, 10, 12, 14, 15, 16, 17, 18, "芻童、曲池", 23, 26],
  9: [1, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 19, 21, 22],
};

const corrections = [];
const ws = readWs();
const chapters = CHAPTERS.map((ch) => {
  const passages = buildChapter(ch, ws);
  const starts = SECTIONS[ch];
  const sections = [];
  for (const ps of passages) {
    const k =
      ps.voice === "classic" ? starts.findIndex((s) => (typeof s === "number" ? ps.problem === s : ps.zh.startsWith(s))) : -1;
    if (k >= 0) {
      if (sections.some((s) => s.n === k + 1)) throw new Error(`ch. ${ch}: section start "${starts[k]}" matches twice`);
      sections.push({ id: `JZ.${ch}.${k + 1}`, n: k + 1, passages: [] });
    }
    if (!sections.length) throw new Error(`ch. ${ch}: text before the first section: ${ps.zh}`);
    const { line, ...rest } = ps;
    sections[sections.length - 1].passages.push(rest);
  }
  if (sections.length !== starts.length) throw new Error(`ch. ${ch}: section starts not all found`);
  sections.forEach((s, i) => { if (s.n !== i + 1) throw new Error(`ch. ${ch}: sections out of order at ${starts[s.n - 1]}`); });
  return { n: ch, title: CH_ZH[ch], name: ws.chapters[ch].name, subtitle: SUBTITLE[ch], sections };
});

const out = {
  source: {
    title: "九章算術 Jiuzhang suanshu",
    classic: { edition: "Wikisource, 九章算術 (punctuated text)", url: "https://zh.wikisource.org/wiki/九章算術" },
    commentary: {
      edition:
        "Sibu Congkan (四部叢刊) photo-reprint of the Weiboxie (微波榭) edition, with Liu Hui's commentary and Li Chunfeng's sub-commentary, as transcribed on Chinese Wikisource",
      url: "https://zh.wikisource.org/wiki/九章算術_(四部叢刊本)",
    },
  },
  preface: { id: "JZ.Pref", passages: ws.preface.map((zh) => ({ voice: "liu", zh })) },
  parts: chapters,
  corrections,
};
fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, JSON.stringify(out, null, 1) + "\n");

const all = chapters.flatMap((c) => c.sections.flatMap((s) => s.passages));
const count = (v) => all.filter((x) => x.voice === v);
console.log(
  `${chapters.reduce((a, c) => a + c.sections.length, 0)} sections; ${count("classic").length} classic passages ` +
    `(${norm(count("classic").map((x) => x.zh).join("")).length} chars), ${count("liu").length} Liu Hui ` +
    `(${count("liu").reduce((a, x) => a + x.zh.length, 0)} chars), ${count("li").length} Li Chunfeng ` +
    `(${count("li").reduce((a, x) => a + x.zh.length, 0)} chars)`,
);
for (const r of report) console.log("  " + r);
