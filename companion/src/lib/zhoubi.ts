// Assembles the Zhou bi suan jing 周髀算經: the Chinese text (classic and Zhao
// Shuang's commentary) extracted by scripts/extract-zhoubi.mjs, with this
// edition's translation and notes from src/content/zhoubi/*.yaml.
//
// As with Euclid, the Chinese shown is always the source's: a step names its voice
// (classic or commentary) and, when it splits a long passage, quotes the Chinese it
// covers; the aligner checks both against the source, so a translation can never
// drift onto the wrong passage.

import { parse } from "yaml";
import data from "../data/zhoubi/zhoubi.json";
import { ZB_PARTS } from "../content/books";
import type { ItemId, ZbAnnotation, ZbParallel, ZbPassage, ZbSection, ZbSource, ZbStep } from "../types";

export const zbSource = data as ZbSource;

const files = import.meta.glob("../content/zhoubi/*.yaml", { query: "?raw", import: "default", eager: true }) as Record<string, string>;

export const zbErrors: string[] = [];
const anns = new Map<string, ZbAnnotation>();
for (const [file, raw] of Object.entries(files)) {
  try {
    const a = parse(raw) as ZbAnnotation;
    if (a?.id) anns.set(a.id, a);
  } catch (e) {
    zbErrors.push(`${file}: ${(e as Error).message}`);
  }
}

// ─── Alignment ────────────────────────────────────────────────────────────
const PUNCT = /[．。，、：；？！「」『』《》〈〉（）()・·…\s　.,:;?!"'“”‘’-]/u;

/** The passage without punctuation, with a map back to the printed text. */
function plain(raw: string) {
  const chars = [...raw];
  let text = "";
  const at: number[] = []; // at[i] = index in chars of text's i-th character
  chars.forEach((c, i) => {
    if (!PUNCT.test(c)) {
      text += c;
      at.push(i);
    }
  });
  at.push(chars.length);
  return { chars, text: [...text], at };
}
export const zhPlain = (s: string) => [...s].filter((c) => !PUNCT.test(c)).join("");

export class ZbAlignError extends Error {}

export function alignPassages(id: string, passages: ZbPassage[], ann: ZbAnnotation): ZbStep[] {
  const steps: ZbStep[] = [];
  let p = 0;
  let off = 0;
  ann.steps.forEach((a, index) => {
    const voice = a.classic != null ? "classic" : a.zhao != null ? "zhao" : null;
    const where = `${id}: step ${index + 1}`;
    if (!voice || (a.classic != null && a.zhao != null)) throw new ZbAlignError(`${where} needs exactly one of "classic" or "zhao"`);
    const pass = passages[p];
    if (!pass) throw new ZbAlignError(`${where} runs past the end of the text`);
    if (pass.voice !== voice)
      throw new ZbAlignError(`${where} is marked ${voice}, but the next passage is ${pass.voice === "zhao" ? "Zhao's commentary" : "the classic"}: "${pass.zh.slice(0, 24)}…"`);
    const P = plain(pass.zh);
    let end = P.text.length;
    if (a.zh != null) {
      const want = [...zhPlain(a.zh)];
      const got = P.text.slice(off, off + want.length).join("");
      if (got !== want.join("")) throw new ZbAlignError(`${where} does not match the Chinese.\n  step:   "${want.join("")}"\n  source: "${P.text.slice(off, off + want.length + 8).join("")}"`);
      end = off + want.length;
    }
    if (end <= off) throw new ZbAlignError(`${where} covers no text`);
    const last = end >= P.text.length;
    const from = off === 0 ? 0 : P.at[off];
    const to = last ? P.chars.length : P.at[end];
    steps.push({
      ...a,
      index,
      voice,
      source: P.chars.slice(from, to).join(""),
      passage: p,
      heading: off === 0 ? pass.heading : undefined,
      sbck: last ? pass.sbck : undefined,
      sbckOnly: last ? pass.sbckOnly : undefined,
    });
    if (last) {
      p++;
      off = 0;
    } else off = end;
  });
  if (p < passages.length) throw new ZbAlignError(`${id}: the text continues after the last step: "${passages[p].zh.slice(0, 30)}…"`);
  return steps;
}

/** Steps for a section not yet translated: one per passage. */
const passageSteps = (passages: ZbPassage[]): ZbStep[] =>
  passages.map((pass, i) => ({
    index: i,
    voice: pass.voice,
    source: pass.zh,
    passage: i,
    heading: pass.heading,
    sbck: pass.sbck,
    sbckOnly: pass.sbckOnly,
  }));

// ─── Sections ─────────────────────────────────────────────────────────────
export const zbSections = new Map<string, ZbSection>();
/** Reading order per part; part 1 opens with Zhao's preface. */
export const zbSequence = new Map<number, string[]>();

function add(part: number, n: number, src: { id: string; passages: ZbPassage[] }) {
  const ann = anns.get(src.id);
  let steps: ZbStep[];
  try {
    steps = ann ? alignPassages(src.id, src.passages, ann) : passageSteps(src.passages);
  } catch (e) {
    if (!(e instanceof ZbAlignError)) throw e;
    zbErrors.push(e.message);
    steps = passageSteps(src.passages);
  }
  const pref = src.id === "ZB.Pref";
  zbSections.set(src.id, {
    id: src.id,
    part,
    n,
    label: pref ? "Zhao Shuang's preface" : `Section ${n}`,
    short: pref ? "ZB preface" : `ZB ${part}.${n}`,
    passages: src.passages,
    annotation: ann,
    steps,
  });
  (zbSequence.get(part) ?? zbSequence.set(part, []).get(part)!).push(src.id);
}

add(1, 0, zbSource.preface);
for (const part of zbSource.parts) for (const s of part.sections) add(part.n, s.n!, s);

for (const id of anns.keys()) if (!zbSections.has(id)) zbErrors.push(`annotation for unknown section ${id}`);

export const getZb = (id: string | null | undefined) => (id ? zbSections.get(id) : undefined);
export const isZbId = (id: string) => /^ZB\./.test(id);
export const zbPartOf = (id: string) => getZb(id)?.part;
export const zbPartInfo = (n: number) => ZB_PARTS.find((p) => p.n === n);

// ─── Parallels with Euclid, indexed both ways ──────────────────────────────
const byEuclid = new Map<ItemId, (ZbParallel & { zb: string })[]>();
for (const s of zbSections.values())
  for (const par of s.annotation?.parallels ?? []) {
    const list = byEuclid.get(par.id) ?? byEuclid.set(par.id, []).get(par.id)!;
    list.push({ ...par, zb: s.id });
  }

/** Zhou bi sections that prove or use the same proposition as a Euclid item. */
export const parallelsOf = (euclidId: ItemId) =>
  [...(byEuclid.get(euclidId) ?? [])].sort((a, b) => (a.relation === b.relation ? 0 : a.relation === "same" ? -1 : 1));
export const allParallels = () => [...byEuclid.entries()];

if (zbErrors.length && typeof console !== "undefined") {
  console.warn(`[zhoubi] ${zbErrors.length} problem(s):\n` + zbErrors.join("\n"));
}
