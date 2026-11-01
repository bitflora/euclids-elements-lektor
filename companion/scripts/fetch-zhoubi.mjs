#!/usr/bin/env node
// Fetch the Chinese sources of the Zhou Bi Suan Jing into sources/ (git-ignored):
//
//   sources/zhoubi-gutenberg.txt   Project Gutenberg #12408: the classic text, unannotated.
//   sources/zhoubi-sbck.json       Wikisource transcription of the Sibu Congkan (四部叢刊)
//                                  photo-reprint of a Ming copy of the 1213 Southern Song
//                                  edition: the classic with Zhao Shuang's commentary,
//                                  Zhen Luan's and Li Chunfeng's sub-commentary. One entry
//                                  per scanned page.
//   sources/zhoubi-skqs.json       Wikisource transcription of the Siku Quanshu (四庫全書)
//                                  edition, a second witness for the commentary.
//
// Run once; scripts/extract-zhoubi.mjs reads only the cache.

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

if (!cached("zhoubi-gutenberg.txt")) {
const pg = await fetch("https://www.gutenberg.org/cache/epub/12408/pg12408.txt", { headers: { "User-Agent": UA } });
fs.writeFileSync(path.join(SRC, "zhoubi-gutenberg.txt"), await pg.text());
}

const V1 = "Sibu Congkan0388-趙爽-周髀算經-2-1.djvu";
const V2 = "Sibu Congkan0389-趙爽-周髀算經-2-2.djvu";
if (!cached("zhoubi-sbck.json")) {
const sbck = [
  ...(await pages(V1, 4, 13)).map((p) => ({ ...p, part: "序" })),
  ...(await pages(V1, 14, 155)).map((p) => ({ ...p, part: "卷上" })),
  ...(await pages(V2, 2, 113)).map((p) => ({ ...p, part: "卷下" })),
];
fs.writeFileSync(path.join(SRC, "zhoubi-sbck.json"), JSON.stringify(sbck, null, 1));
}

if (!cached("zhoubi-skqs.json")) {
const skqs = [];
for (const p of ["卷上之1", "卷上之2", "卷上之3", "卷下之1", "卷下之2", "卷下之3"]) {
  const j = await api({ action: "parse", prop: "wikitext", page: `周髀算經 (四庫全書本)/${p}` });
  skqs.push({ part: p, text: j.parse.wikitext });
  await sleep(5000);
}
fs.writeFileSync(path.join(SRC, "zhoubi-skqs.json"), JSON.stringify(skqs, null, 1));
}

console.log("sources cached in", SRC);
