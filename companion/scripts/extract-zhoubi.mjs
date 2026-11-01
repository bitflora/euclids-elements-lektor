#!/usr/bin/env node
// Build src/data/zhoubi/zhoubi.json from the cached sources (scripts/fetch-zhoubi.mjs).
//
// The classic text is Project Gutenberg #12408, line for line: each line there is
// one lemma, the unit the commentators annotate. Zhao Shuang's commentary comes from
// the Wikisource transcription of the Sibu Congkan reprint (SBCK), where the classic
// is set flush and the commentary indented. The transcription's indentation is not
// reliable, so a line counts as classic only if it matches the Gutenberg text at the
// current position (allowing the usual variant characters); everything else is
// commentary. Zhen Luan's and Li Chunfeng's sub-commentary (臣鸞曰, 臣淳風等謹按, and
// their 注云 quotations of Zhao) and the Ming editors' marginal notes are dropped.
//
//   node scripts/extract-zhoubi.mjs           # writes JSON, prints an alignment report

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..");
const SRC = path.join(root, "sources");
const OUT = path.join(root, "src", "data", "zhoubi", "zhoubi.json");

// ─── SKchar placeholders: rare characters the transcription draws as images. ──
// Resolved from Wikisource's Module:SKchar and, where it gives only a description,
// from context (noted).
const SKCHAR = {
  "4359": "髀", "2959": "弦", "2716": "南", "3892": "類", "3769": "卯" /* 丁卯, 卯酉 */,
  "3695": "賾" /* 探賾索隱 */, "3664": "說", "3722": "軌", "3688": "負", "2669": "仙",
  "3141": "樹", "3809": "陵", "2840": "姬", "2708": "勢", "2818": "殊", "3768": "邊",
  "2660": "偃", "3905": "殊", "2951": "迴", "3739": "迴", "3716": "躔", "3767": "邈",
  "3800": "開", "1974": "候", "2973": "衍", "3475": "算", "1699": "雨", "3089": "□",
  "3425": "□", "2692": "□", "48": "喜",
};
const SKCHAR2 = { "32": "直" /* 徑，直；隅，角也 */ };

// ─── Gutenberg transcription slips: [part, wrong, right, why] ──────────────
const CORRECTIONS = [
  [1, "丹黃為堙D以", "丹黃為裏．以", "character garbled in the Gutenberg encoding (裏 and the stop)"],
];

// Variant forms treated as the same character when aligning the two witnesses.
const VARIANTS = [
  "句勾", "于於", "為爲", "歷曆厤", "啇商", "既旣", "即卽", "回迴", "圜圓", "裏裡", "并並併",
  "脩修", "邪耶", "眾衆", "與与", "徧遍", "閒間", "游遊", "衝衡", "蓋盖葢", "床牀", "減减",
  "強彊", "况況", "竒奇", "耦偶", "隂陰", "陽昜", "䂓規", "臥卧", "嚮向", "逺遠", "髙高",
  "類𩔖", "兩两", "寧甯", "濳潛", "啓啟", "徳德", "冡冢", "乗乘", "増增", "邉邊", "晝昼",
  "黃黄", "說説", "强強", "惟唯", "叅參", "疎疏", "畧略", "筭算", "陳陈", "冬冬", "窮竆",
  "凖準", "幾㡬", "厯曆", "皐皋", "亷廉", "纖纎", "微㣲", "步歩", "舍舎", "母毋", "穀榖",
  "協恊", "初𥘉", "往徃", "發𤼵", "斂歛", "游遊", "啟啓", "歲歳", "閏閠", "減减", "達逹",
];
const VMAP = new Map();
for (const set of VARIANTS) for (const ch of [...set]) VMAP.set(ch, [...set][0]);

const PUNCT = /[．。，、：；？！「」『』（）()\s　□·•.,:;?!]/gu;
const norm = (s) => [...s.replace(PUNCT, "")].map((c) => VMAP.get(c) ?? c).join("");

// ─── Gutenberg ──────────────────────────────────────────────────────────
const PART_TITLES = ["卷上之一", "卷上之二", "卷上之三", "卷下之一", "卷下之二", "卷下之三"];
function readGutenberg() {
  const raw = fs.readFileSync(path.join(SRC, "zhoubi-gutenberg.txt"), "utf8").replace(/\r/g, "");
  const body = raw.split(/\*\*\* START OF.*\n/)[1].split(/\*\*\* END OF/)[0];
  const parts = [];
  let cur = null;
  for (const line of body.split("\n")) {
    const t = line.trim();
    const h = /^周髀算經(卷[上下]之[一二三])$/.exec(t);
    if (h) {
      cur = { n: parts.length + 1, title: h[1], lemmas: [] };
      parts.push(cur);
    } else if (cur && t) cur.lemmas.push(t);
  }
  const applied = [];
  for (const [p, from, to, why] of CORRECTIONS) {
    const part = parts[p - 1];
    const i = part.lemmas.findIndex((l) => l.includes(from));
    if (i < 0) throw new Error(`correction not found: ${from}`);
    part.lemmas[i] = part.lemmas[i].replace(from, to);
    applied.push({ id: `ZB.${p}`, from, to, reason: why });
  }
  for (const p of parts)
    for (const l of p.lemmas)
      if (/[A-Za-z0-9]/.test(l)) console.warn(`suspect characters in Gutenberg ${p.title}: ${l}`);
  return { parts, corrections: applied };
}

// ─── SBCK ───────────────────────────────────────────────────────────────
function cleanWiki(s) {
  return s
    .replace(/<noinclude>[\s\S]*?<\/noinclude>/g, "")
    .replace(/\{\{雙行註文\|(?:[^{}]|\{\{[^{}]*\}\})*\}\}/g, "") // Ming editors' notes
    .replace(/\{\{SKchar\|(\d+)\}\}/g, (_, n) => SKCHAR[n] ?? "□")
    .replace(/\{\{SKchar2\|(\d+)\}\}/g, (_, n) => SKCHAR2[n] ?? "□")
    .replace(/\{\{YL\|([^}]*)\}\}/g, "$1")
    .replace(/\{\{\?\}\}/g, "□")
    .replace(/\{\{[^{}]*\}\}/g, "");
}
function readSbck() {
  const pages = JSON.parse(fs.readFileSync(path.join(SRC, "zhoubi-sbck.json"), "utf8"));
  const out = { 序: [], 卷上: [], 卷下: [] };
  for (const p of pages) {
    for (const raw of cleanWiki(p.text ?? "").split("\n")) {
      if (!raw.trim()) continue;
      const indent = /^(　*)/.exec(raw)[1].length;
      out[p.part].push({ page: p.n, indent, text: raw.trim().replace(/[\s　]+/g, "") });
    }
  }
  return out;
}

// ─── Alignment ──────────────────────────────────────────────────────────
/** Edit distance counting a swap of adjacent characters as one edit (數從安出 / 數安從出). */
function lev(a, b) {
  const m = a.length, n = b.length;
  const d = Array.from({ length: m + 1 }, (_, i) => [i, ...new Array(n).fill(0)]);
  for (let j = 0; j <= n; j++) d[0][j] = j;
  for (let i = 1; i <= m; i++)
    for (let j = 1; j <= n; j++) {
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
    }
  return d[m][n];
}

/** Gutenberg as one normalised stream, each character traced to its line and offset. */
function flatten(parts) {
  const chars = [];
  const lines = [];
  for (const p of parts)
    p.lemmas.forEach((text, i) => {
      const li = lines.length;
      lines.push({ part: p.n, i, text, used: new Array([...text].length).fill(false) });
      [...text].forEach((c, off) => {
        const n = norm(c);
        if (n) chars.push({ c: n, li, off });
      });
    });
  const G = chars.map((x) => x.c).join("");
  const grams = new Map();
  for (let i = 0; i + 3 <= chars.length; i++) {
    const k = G.slice(i, i + 3);
    if (!grams.has(k)) grams.set(k, []);
    grams.get(k).push(i);
  }
  return { chars, lines, G, grams };
}

/** Fraction of L's characters covered by trigrams that occur in the Gutenberg text. */
function overlap(L, F) {
  if (L.length < 3) return F.G.includes(L) ? 1 : 0;
  const cov = new Array(L.length).fill(0);
  for (let i = 0; i + 3 <= L.length; i++) if (F.grams.has(L.slice(i, i + 3))) cov[i] = cov[i + 1] = cov[i + 2] = 1;
  return cov.reduce((a, b) => a + b, 0) / L.length;
}

/**
 * Locate SBCK classic text L in Gutenberg: { s, e, d } spanning F.G[s, e), or null.
 * Candidates near `expect` (the end of the previous match) are preferred; short
 * strings are only looked for nearby, since they would match anywhere.
 */
function locate(L, F, expect, continuation = false) {
  // A short wrapped tail of the previous classic line: accept only exactly where expected.
  if (L.length < 4) return F.G.startsWith(L, expect) ? { s: expect, e: expect + L.length, d: 0 } : null;
  if (continuation) {
    // The wrapped remainder of a classic line: compare exactly where expected, leniently.
    const tol = Math.floor(L.length * 0.4);
    let best = null;
    for (let de = -2; de <= 2; de++) {
      const e = expect + L.length + de;
      if (e > F.G.length) continue;
      const d = lev(L, F.G.slice(expect, e));
      if (!best || d < best.d) best = { s: expect, e, d };
    }
    if (best && best.d <= tol) return best;
  }
  const near = (s) => s >= expect - 40 && s <= expect + 600;
  const votes = new Map();
  for (let o = 0; o + 3 <= L.length; o++)
    for (const pos of F.grams.get(L.slice(o, o + 3)) ?? []) votes.set(pos - o, (votes.get(pos - o) ?? 0) + 1);
  let cands = [...votes.entries()];
  if (L.length < 10) cands = cands.filter(([s]) => near(s));
  cands = cands
    .sort((a, b) => b[1] + (near(b[0]) ? 2 : 0) - (a[1] + (near(a[0]) ? 2 : 0)) || Math.abs(a[0] - expect) - Math.abs(b[0] - expect))
    .slice(0, 4)
    .map(([s]) => s);
  const tol = Math.max(1, Math.floor(L.length * 0.3));
  let best = null;
  for (const s0 of cands)
    for (let ds = -2; ds <= 2; ds++) {
      const s = s0 + ds;
      if (s < 0) continue;
      for (let de = -Math.min(tol, 4); de <= Math.min(tol, 4); de++) {
        const e = s + L.length + de;
        if (e <= s || e > F.G.length) continue;
        const d = lev(L, F.G.slice(s, e));
        if (!best || d < best.d || (d === best.d && Math.abs(s - expect) < Math.abs(best.s - expect))) best = { s, e, d };
      }
    }
  if (!best || best.d > tol) return null;
  // Far from where we are, only a near-exact match of a long line will do.
  if (!near(best.s) && (L.length < 10 || best.d > Math.floor(L.length * 0.1))) return null;
  return best;
}

// SBCK lines that are classic text although automatic classification says otherwise:
// a heavily variant reading, and a sentence Gutenberg lacks altogether.
const FORCE_CLASSIC = new Set(["旣方之外半其一矩", "即以三百六十五度四分度之一而各置二十", "八宿"]);
// …and SBCK lines that are commentary although they match Gutenberg, "page:text": Gutenberg prints
// the end of Zhao's gloss 此除極至周十萬三千里 as if it were a line of the classic (南十萬三千里).
const FORCE_COMMENTARY = new Set(["100:周十萬三千里", "5:南方日中北方夜半"]);

// A heading of one of Zhao's essays on his diagrams: 勾股方圓圖注, 七衡圖註.
const HEADING = /^[^□]{2,6}圖[注註]$/;

const SUB = /^(臣鸞|臣淳風|釋[^注]{0,8}注$|注云|甄鸞)/;
const PROBE = process.argv.includes("--probe");

function align(gParts, sbck) {
  const F = flatten(gParts);
  const report = [];
  const lemmas = [];
  let expect = 0;
  let curPart = 1;
  for (const vol of ["卷上", "卷下"]) {
    // 1. Classify lines: a candidate is classic only if it can be located in Gutenberg.
    const lines = sbck[vol]
      // The title page's credits: 漢趙君卿注, 北周…甄鸞重述, 唐…李淳風等奉勑注釋, 明趙開美校 / 明毛□挍.
      .filter((l) => !(l.page <= 15 && /^(周髀算經卷|漢趙|北周漢中|唐朝議|明趙開美|明毛)/.test(l.text)))
      .filter((l) => !/^周髀算經卷[上下]$/.test(l.text))
      .map((l) => ({ ...l, L: norm(l.text) }))
      .filter((l) => l.L);
    let prevClassic = false;
    for (const l of lines) {
      const sc = overlap(l.L, F);
      const cand =
        l.indent === 0
          ? (sc >= 0.5 || (l.L.length < 4 && prevClassic)) && !SUB.test(l.text)
          : sc >= 0.95 && l.L.length >= 6 && prevClassic;
      const forced = FORCE_CLASSIC.has(l.text);
      if (FORCE_COMMENTARY.has(`${l.page}:${l.text}`)) {
        l.hit = null;
        l.classic = false;
        prevClassic = false;
        continue;
      }
      l.hit = cand || forced ? locate(l.L, F, expect, forced || (l.indent === 0 && prevClassic)) : null;
      l.classic = !!l.hit || forced;
      if (l.hit) expect = l.hit.e;
      if (PROBE && cand !== l.classic) console.log(`probe ${vol} p.${l.page} rejected: ${l.text}`);
      if (PROBE && l.indent > 0 && l.classic) console.log(`probe ${vol} p.${l.page} indented classic: ${l.text}`);
      prevClassic = l.classic;
    }
    // 2. Runs of contiguous classic lines, each followed by its commentary.
    const runs = [];
    for (const l of lines) {
      const last = runs[runs.length - 1];
      if (l.classic && !l.hit) {
        if (last && !last.comm.length && last.sbckOnly) last.cls.push(l);
        else runs.push({ cls: [l], comm: [], sbckOnly: true });
      } else if (l.classic) {
        if (last && !last.comm.length && !last.sbckOnly && Math.abs(l.hit.s - last.e) <= 3) {
          last.cls.push(l);
          last.e = l.hit.e;
        } else runs.push({ cls: [l], comm: [], s: l.hit.s, e: l.hit.e });
      } else if (last) last.comm.push(l);
      else report.push(`commentary before the first lemma in ${vol}: ${l.text}`);
    }
    // 3. Locate each run in Gutenberg and cut it into Gutenberg's lemmas.
    for (const run of runs) {
      const sb = run.cls.map((l) => l.text).join("");
      const L = norm(sb);
      const hit = run.sbckOnly ? null : { s: run.s, e: run.e, d: run.cls.reduce((a, l) => a + l.hit.d, 0) };
      const pages = [...new Set(run.cls.map((l) => l.page))];
      const zhao = [];
      let sub = 0, inSub = false;
      for (const l of run.comm) {
        const bare = l.text.replace(/^□+/, "");
        if (!inSub && !SUB.test(bare) && l.indent >= 2 && PROBE) console.log(`probe: indent-2 line taken as sub-commentary (p.${l.page}): ${l.text}`);
        if (SUB.test(bare) || (l.indent >= 2 && !HEADING.test(bare))) inSub = true;
        if (/^趙君卿曰/.test(bare) || HEADING.test(bare)) inSub = false;
        if (inSub) sub += l.text.length;
        else zhao.push(l);
      }
      const pieces = [];
      if (!hit) {
        report.push(`SBCK classic absent from Gutenberg (p.${pages.join(",")}): ${sb}`);
        pieces.push({ part: curPart, zh: sb, sbckOnly: true });
      } else {
        // Group the matched characters by Gutenberg line.
        const byLine = new Map();
        for (let k = hit.s; k < hit.e; k++) {
          const { li, off } = F.chars[k];
          if (!byLine.has(li)) byLine.set(li, [off, off]);
          byLine.get(li)[1] = off;
        }
        for (const [li, [a, b]] of byLine) {
          const line = F.lines[li];
          const chars = [...line.text];
          // Extend to the whole line when the match covers its start or end; keep trailing punctuation.
          const whole = norm(chars.slice(0, a).join("")) === "" ? 0 : a;
          let end = norm(chars.slice(b + 1).join("")) === "" ? chars.length : b + 1;
          while (end < chars.length && !norm(chars[end])) end++;
          for (let k = whole; k < end; k++) {
            if (line.used[k] && norm(chars[k])) report.push(`Gutenberg part ${line.part} line ${line.i + 1} used twice (SBCK p.${pages.join(",")}): ${line.text}`);
            line.used[k] = true;
          }
          curPart = line.part;
          pieces.push({ part: line.part, zh: chars.slice(whole, end).join(""), gLine: line.i + 1 });
        }
        if (hit.d > 0) pieces[pieces.length - 1].sbck = sb;
        if (hit.d > 0) pieces[pieces.length - 1].sbckFor = pieces.map((p) => p.zh).join("");
      }
      pieces.forEach((pc, i) => {
        const last = i === pieces.length - 1;
        lemmas.push({
          ...pc,
          pages,
          zhao: last ? zhao : [],
          sub: last ? sub : 0,
        });
      });
    }
  }
  // Gutenberg text that no SBCK classic line accounts for.
  const gOnly = [];
  for (const line of F.lines) {
    const chars = [...line.text];
    let run = "";
    const flush = () => {
      if (norm(run).length >= 2) gOnly.push({ part: line.part, line: line.i + 1, text: run });
      run = "";
    };
    chars.forEach((c, k) => (line.used[k] ? flush() : (run += c)));
    flush();
  }
  return { lemmas, report, gOnly };
}

// Zhao's commentary on one lemma. The transcription often loses the indent of a
// wrapped commentary line, so lines are concatenated; a new block starts only at
// a heading such as 勾股方圓圖注 (Zhao's essay on the hypotenuse diagram).
// Runs of □ are figure captions the transcriber could not read; they are dropped.
function joinZhao(lines) {
  const blocks = [];
  let cur = null;
  for (const l of lines) {
    if (HEADING.test(l.text)) {
      if (cur) blocks.push(cur);
      cur = { heading: l.text, zh: "" };
      continue;
    }
    if (/^趙君卿曰/.test(l.text) && cur && cur.zh) {
      blocks.push(cur);
      cur = { zh: "" };
    }
    cur ??= { zh: "" };
    cur.zh += l.text;
  }
  if (cur) blocks.push(cur);
  return blocks
    .map((b) => ({ ...b, zh: b.zh.replace(/勾?□{3,}/g, "") }))
    .filter((b) => b.zh);
}

// ─── Sections ───────────────────────────────────────────────────────────
// This edition's division of each part into sections, by Gutenberg line number of
// the first lemma. [n, k] starts at the k-th commentary block on lemma n.
const SECTIONS = {
  1: [1, 5, 8, [15, 1], 16, 21, 25],
  2: [1, 18, 37, 44, 47, 50, [51, 0], 52, 58, 67, 75, 86, 89, 93, [100, 1]],
  3: [1, 3, 10, 14, 21, 26],
  4: [1, 9, 17, 25, 34, 44, 52, 62],
  5: [1, 20, 45, 51, 53, 60, 72],
  6: [1, 9, 18, 25, 38],
};

const g = readGutenberg();
const sbck = readSbck();
const { lemmas, report, gOnly } = align(g.parts, sbck);

const parts = g.parts.map((p) => {
  // Passages in reading order, each tagged with where a section may start.
  const passages = [];
  const mine = lemmas.filter((l) => l.part === p.n);
  mine.forEach((l, i) => {
    const n = i + 1;
    const c = { voice: "classic", zh: l.zh, lemma: n, start: `${n}` };
    if (l.sbckOnly) c.sbckOnly = true;
    if (l.sbck) c.sbck = l.sbck;
    passages.push(c);
    joinZhao(l.zhao).forEach((z, k) => passages.push({ voice: "zhao", ...z, lemma: n, start: `${n}:${k}` }));
  });
  const starts = SECTIONS[p.n].map((x) => (Array.isArray(x) ? `${x[0]}:${x[1]}` : `${x}`));
  const sections = [];
  for (const ps of passages) {
    const k = starts.indexOf(ps.start);
    if (k >= 0) sections.push({ id: `ZB.${p.n}.${k + 1}`, n: k + 1, passages: [] });
    const { start, ...rest } = ps;
    sections[sections.length - 1].passages.push(rest);
  }
  if (sections.length !== starts.length) throw new Error(`part ${p.n}: section starts not all found`);
  return { n: p.n, title: p.title, sections };
});

// Zhao Shuang's preface (序), SBCK pages 8–9; the other prefaces are by later editors.
const preface = sbck.序.filter((l) => l.page >= 8 && l.page <= 9).map((l) => l.text).join("").replace(/^周髀算經序/, "");

const out = {
  source: {
    title: "周髀算經 Zhou bi suan jing",
    classic: { edition: "Project Gutenberg eBook #12408", url: "https://www.gutenberg.org/ebooks/12408" },
    commentary: {
      edition:
        "Sibu Congkan (四部叢刊) photo-reprint of a Ming copy of the 1213 Southern Song edition, as transcribed on Chinese Wikisource",
      url: "https://zh.wikisource.org/wiki/周髀算經_(四部叢刊本)",
    },
  },
  preface: { id: "ZB.Pref", passages: [{ voice: "zhao", zh: preface }] },
  parts,
  gutenbergOnly: gOnly,
  corrections: g.corrections,
};
fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, JSON.stringify(out, null, 1) + "\n");

const all = parts.flatMap((p) => p.sections.flatMap((s) => s.passages));
console.log(
  `${parts.reduce((a, p) => a + p.sections.length, 0)} sections; ${all.filter((x) => x.voice === "classic").length} classic passages, ` +
    `${all.filter((x) => x.voice === "zhao").length} commentary passages; ${all.filter((x) => x.sbck).length} SBCK variants; ` +
    `${gOnly.length} Gutenberg-only spans`,
);
for (const r of report) console.log("  " + r);
for (const x of gOnly) console.log(`  Gutenberg only, part ${x.part} line ${x.line}: ${x.text}`);
