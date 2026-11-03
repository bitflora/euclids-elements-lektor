// The Chinese works read beside Euclid: the Zhou bi suan jing 周髀算經 and the Jiuzhang
// suanshu 九章算術. Each is the Chinese text (classic and commentary) extracted by
// scripts/extract-zhoubi.mjs or scripts/extract-jiuzhang.mjs, with this edition's
// translation and notes from src/content/zhoubi/*.yaml and src/content/jiuzhang/*.yaml.
//
// As with Euclid, the Chinese shown is always the source's: a step names its voice
// (the classic or a commentator) and, when it splits a long passage, quotes the Chinese
// it covers; the aligner checks both against the source, so a translation can never
// drift onto the wrong passage.

import { parse } from "yaml";
import zbData from "../data/zhoubi/zhoubi.json";
import jzData from "../data/jiuzhang/jiuzhang.json";
import { JZ_PARTS, ZB_PARTS } from "../content/books";
import type {
  ItemId,
  Voice,
  WorkAnnotation,
  WorkKey,
  WorkParallel,
  WorkPartInfo,
  WorkPassage,
  WorkSection,
  WorkSource,
  WorkStep,
} from "../types";

export interface VoiceInfo {
  /** "Zhao Shuang's commentary" */
  label: string;
  /** "趙爽注" */
  zh: string;
}

export interface Work {
  key: WorkKey;
  /** Id prefix: "ZB", "JZ". */
  prefix: string;
  /** "Zhou bi suan jing" */
  title: string;
  zh: string;
  /** "Zhou bi", in labels and references. */
  short: string;
  /** "The Gnomon of the Zhou" */
  english: string;
  parts: WorkPartInfo[];
  /** The part the preface is read with. */
  prefacePart: number;
  prefaceLabel: string;
  /** The commentators' voices, in the order they speak. */
  commentary: Partial<Record<Voice, VoiceInfo>>;
  source: WorkSource;
  sections: Map<string, WorkSection>;
  /** Reading order per part; the first part opens with the preface. */
  sequence: Map<number, string[]>;
}

const zbFiles = import.meta.glob("../content/zhoubi/*.yaml", { query: "?raw", import: "default", eager: true }) as Record<string, string>;
const jzFiles = import.meta.glob("../content/jiuzhang/*.yaml", { query: "?raw", import: "default", eager: true }) as Record<string, string>;

export const workErrors: string[] = [];

function annotations(files: Record<string, string>) {
  const anns = new Map<string, WorkAnnotation>();
  for (const [file, raw] of Object.entries(files)) {
    try {
      const a = parse(raw) as WorkAnnotation;
      if (a?.id) anns.set(a.id, a);
    } catch (e) {
      workErrors.push(`${file}: ${(e as Error).message}`);
    }
  }
  return anns;
}

// ─── Alignment ────────────────────────────────────────────────────────────
const PUNCT = /[．。，、：；？！︰「」『』《》〈〉（）()・·…\s　.,:;?!"'“”‘’-]/u;

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

export class WorkAlignError extends Error {}

const STEP_VOICES: Voice[] = ["classic", "zhao", "liu", "li"];
const VOICE_NAME: Record<Voice, string> = {
  classic: "the classic",
  zhao: "Zhao's commentary",
  liu: "Liu Hui's commentary",
  li: "Li Chunfeng's commentary",
};

export function alignPassages(id: string, passages: WorkPassage[], ann: WorkAnnotation): WorkStep[] {
  const steps: WorkStep[] = [];
  let p = 0;
  let off = 0;
  ann.steps.forEach((a, index) => {
    const where = `${id}: step ${index + 1}`;
    const given = STEP_VOICES.filter((v) => a[v] != null);
    if (given.length !== 1) throw new WorkAlignError(`${where} needs exactly one of ${STEP_VOICES.map((v) => `"${v}"`).join(", ")}`);
    const voice = given[0];
    const pass = passages[p];
    if (!pass) throw new WorkAlignError(`${where} runs past the end of the text`);
    if (pass.voice !== voice)
      throw new WorkAlignError(`${where} is marked ${voice}, but the next passage is ${VOICE_NAME[pass.voice]}: "${pass.zh.slice(0, 24)}…"`);
    const P = plain(pass.zh);
    let end = P.text.length;
    if (a.zh != null) {
      const want = [...zhPlain(a.zh)];
      const got = P.text.slice(off, off + want.length).join("");
      if (got !== want.join("")) throw new WorkAlignError(`${where} does not match the Chinese.\n  step:   "${want.join("")}"\n  source: "${P.text.slice(off, off + want.length + 8).join("")}"`);
      end = off + want.length;
    }
    if (end <= off) throw new WorkAlignError(`${where} covers no text`);
    const last = end >= P.text.length;
    const from = off === 0 ? 0 : P.at[off];
    const to = last ? P.chars.length : P.at[end];
    steps.push({
      num: "",
      ...a,
      index,
      voice,
      en: a[voice],
      source: P.chars.slice(from, to).join(""),
      passage: p,
      problem: off === 0 ? pass.problem : undefined,
      heading: off === 0 ? pass.heading : undefined,
      sbck: last ? pass.sbck : undefined,
      sbckOnly: last ? pass.sbckOnly : undefined,
    });
    if (last) {
      p++;
      off = 0;
    } else off = end;
  });
  if (p < passages.length) throw new WorkAlignError(`${id}: the text continues after the last step: "${passages[p].zh.slice(0, 30)}…"`);
  return steps;
}

/** Steps for a section not yet translated: one per passage. */
const passageSteps = (passages: WorkPassage[]): WorkStep[] =>
  passages.map((pass, i) => ({
    num: "",
    index: i,
    voice: pass.voice,
    source: pass.zh,
    passage: i,
    problem: pass.problem,
    heading: pass.heading,
    sbck: pass.sbck,
    sbckOnly: pass.sbckOnly,
  }));

/** Number the steps: the classic counts 1, 2, 3…; commentary is a sub-number of the classic step before it. */
function numberSteps(steps: WorkStep[]) {
  let classic = 0;
  let sub = 0;
  for (const s of steps) {
    if (s.voice === "classic") {
      classic++;
      sub = 0;
      s.num = `${classic}`;
    } else {
      sub++;
      s.num = classic ? `${classic}.${sub}` : `${sub}`;
    }
  }
}

// ─── The works ────────────────────────────────────────────────────────────
function build(w: Omit<Work, "sections" | "sequence">, files: Record<string, string>): Work {
  const anns = annotations(files);
  const sections = new Map<string, WorkSection>();
  const sequence = new Map<number, string[]>();
  const add = (part: number, n: number, src: { id: string; passages: WorkPassage[] }) => {
    const ann = anns.get(src.id);
    let steps: WorkStep[];
    try {
      steps = ann ? alignPassages(src.id, src.passages, ann) : passageSteps(src.passages);
    } catch (e) {
      if (!(e instanceof WorkAlignError)) throw e;
      workErrors.push(e.message);
      steps = passageSteps(src.passages);
    }
    numberSteps(steps);
    const pref = n === 0;
    sections.set(src.id, {
      id: src.id,
      work: w.key,
      part,
      n,
      label: pref ? w.prefaceLabel : `Section ${n}`,
      short: pref ? `${w.prefix} preface` : `${w.prefix} ${part}.${n}`,
      passages: src.passages,
      annotation: ann,
      steps,
    });
    (sequence.get(part) ?? sequence.set(part, []).get(part)!).push(src.id);
  };
  add(w.prefacePart, 0, w.source.preface);
  for (const part of w.source.parts) for (const s of part.sections) add(part.n, s.n!, s);
  for (const id of anns.keys()) if (!sections.has(id)) workErrors.push(`annotation for unknown section ${id}`);
  return { ...w, sections, sequence };
}

export const zhoubi = build(
  {
    key: "zhoubi",
    prefix: "ZB",
    title: "Zhou bi suan jing",
    zh: "周髀算經",
    short: "Zhou bi",
    english: "The Gnomon of the Zhou",
    parts: ZB_PARTS,
    prefacePart: 1,
    prefaceLabel: "Zhao Shuang's preface",
    commentary: { zhao: { label: "Zhao Shuang's commentary", zh: "趙爽注" } },
    source: zbData as WorkSource,
  },
  zbFiles,
);

export const jiuzhang = build(
  {
    key: "jiuzhang",
    prefix: "JZ",
    title: "Jiuzhang suanshu",
    zh: "九章算術",
    short: "Nine Chapters",
    english: "The Nine Chapters on the Mathematical Art",
    parts: JZ_PARTS,
    prefacePart: 1,
    prefaceLabel: "Liu Hui's preface",
    commentary: {
      liu: { label: "Liu Hui's commentary", zh: "劉徽注" },
      li: { label: "Li Chunfeng's commentary", zh: "李淳風等注釋" },
    },
    source: jzData as WorkSource,
  },
  jzFiles,
);

export const WORKS: Work[] = [zhoubi, jiuzhang];
export const workByKey = (key: WorkKey) => WORKS.find((w) => w.key === key)!;

export const isWorkId = (id: string) => /^(ZB|JZ)\./.test(id);
export const workOf = (id: string) => WORKS.find((w) => id.startsWith(`${w.prefix}.`));
export const getSection = (id: string | null | undefined) => (id ? workOf(id)?.sections.get(id) : undefined);
export const partInfo = (w: Work, n: number) => w.parts.find((p) => p.n === n);
export const allSections = () => WORKS.flatMap((w) => [...w.sections.values()]);

// ─── Parallels with Euclid, indexed both ways ──────────────────────────────
export type IndexedParallel = WorkParallel & { section: string; work: WorkKey };
const byEuclid = new Map<ItemId, IndexedParallel[]>();
for (const w of WORKS)
  for (const s of w.sections.values())
    for (const par of s.annotation?.parallels ?? []) {
      const list = byEuclid.get(par.id) ?? byEuclid.set(par.id, []).get(par.id)!;
      list.push({ ...par, section: s.id, work: w.key });
    }

/** Sections of the Chinese works that prove or use the same proposition as a Euclid item, "same" first. */
export const parallelsOf = (euclidId: ItemId, work?: WorkKey) =>
  [...(byEuclid.get(euclidId) ?? [])]
    .filter((p) => !work || p.work === work)
    .sort((a, b) => (a.relation === b.relation ? 0 : a.relation === "same" ? -1 : 1));
export const allParallels = (work?: WorkKey) =>
  [...byEuclid.entries()]
    .map(([id, list]) => [id, list.filter((p) => !work || p.work === work)] as const)
    .filter(([, list]) => list.length);

if (workErrors.length && typeof console !== "undefined") {
  console.warn(`[works] ${workErrors.length} problem(s):\n` + workErrors.join("\n"));
}
