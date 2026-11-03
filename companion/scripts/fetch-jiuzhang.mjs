#!/usr/bin/env node
// Fetch the Chinese sources of the Jiuzhang suanshu 九章算術 into sources/ (git-ignored):
//
//   sources/jiuzhang-ws.txt     The Wikisource edition 九章算術: the classic, punctuated, its
//                               problems numbered 〔一〕〔二〕…; the base text of the classic.
//   sources/jiuzhang-sbck.json  Wikisource transcription of the Sibu Congkan (四部叢刊) photo-
//                               reprint of the Weiboxie (微波榭) edition: the classic with Liu
//                               Hui's commentary (263 CE) and Li Chunfeng's sub-commentary
//                               (656 CE) in double-line small characters. One entry per
//                               scanned page.
//
// Run once; scripts/extract-jiuzhang.mjs reads only the cache.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const SRC = path.resolve(here, "..", "sources");
const UA = "euclid-companion/0.1 (source fetch for a study edition)";
const API = "https://zh.wikisource.org/w/api.php";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function api(params) {
  const url = `${API}?${new URLSearchParams({ format: "json", formatversion: "2", ...params })}`;
  for (let attempt = 0; ; attempt++) {
    const res = await fetch(url, { headers: { "User-Agent": UA } });
    const text = await res.text();
    if (res.ok && text.startsWith("{")) return JSON.parse(text);
    if (attempt >= 6) throw new Error(`${res.status} for ${url}: ${text.slice(0, 200)}`);
    const wait = Number(res.headers.get("retry-after")) || 10 * (attempt + 1);
    await sleep(wait * 1000);
  }
}

async function pages(index, from, to) {
  const out = [];
  for (let start = from; start <= to; start += 40) {
    const titles = [];
    for (let n = start; n <= Math.min(to, start + 39); n++) titles.push(`Page:${index}/${n}`);
    const j = await api({ action: "query", prop: "revisions", rvprop: "content", rvslots: "main", titles: titles.join("|") });
    for (const p of j.query.pages) {
      const n = Number(p.title.split("/").pop());
      out.push({ index, n, text: p.missing ? null : p.revisions[0].slots.main.content });
    }
    await sleep(1000);
  }
  return out.sort((a, b) => a.n - b.n);
}

fs.mkdirSync(SRC, { recursive: true });
const cached = (f) => fs.existsSync(path.join(SRC, f));

if (!cached("jiuzhang-ws.txt")) {
  const j = await api({ action: "parse", prop: "wikitext", page: "九章算術" });
  fs.writeFileSync(path.join(SRC, "jiuzhang-ws.txt"), j.parse.wikitext);
}

// The three volumes of the SBCK reprint, and the scanned pages of each chapter.
const V1 = "Sibu Congkan0390-劉徽-九章算術-3-1.djvu";
const V2 = "Sibu Congkan0391-劉徽-九章算術-3-2.djvu";
const V3 = "Sibu Congkan0392-劉徽-九章算術-3-3.djvu";
const CHAPTERS = [
  ["序", V1, 4, 7],
  [1, V1, 10, 53],
  [2, V1, 54, 87],
  [3, V1, 88, 115],
  [4, V1, 116, 155],
  [5, V2, 2, 43],
  [6, V2, 44, 101],
  [7, V2, 102, 137],
  [8, V3, 2, 53],
  [9, V3, 54, 107],
];
if (!cached("jiuzhang-sbck.json")) {
  const sbck = [];
  for (const [chapter, index, from, to] of CHAPTERS) sbck.push(...(await pages(index, from, to)).map((p) => ({ ...p, chapter })));
  fs.writeFileSync(path.join(SRC, "jiuzhang-sbck.json"), JSON.stringify(sbck, null, 1));
}

console.log("sources cached in", SRC);
