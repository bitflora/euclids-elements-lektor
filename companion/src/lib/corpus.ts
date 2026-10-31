// Assembles the reading corpus: Heath's text + this edition's annotations +
// Joyce's figures, with dependencies and backlinks computed once.

import { parse } from "yaml";
import joyce from "virtual:joyce";
import heath1 from "../data/heath/book1.json";
import heath2 from "../data/heath/book2.json";
import heath3 from "../data/heath/book3.json";
import heath4 from "../data/heath/book4.json";
import heath5 from "../data/heath/book5.json";
import heath6 from "../data/heath/book6.json";
import heath7 from "../data/heath/book7.json";
import heath8 from "../data/heath/book8.json";
import heath9 from "../data/heath/book9.json";
import heath10 from "../data/heath/book10.json";
import heath11 from "../data/heath/book11.json";
import heath12 from "../data/heath/book12.json";
import heath13 from "../data/heath/book13.json";
import { ROMAN } from "../content/books";
import { alignSteps, paragraphSteps, refsIn, AlignError } from "./align";
import type {
  HeathBook,
  Item,
  ItemId,
  ItemKind,
  JoyceEntry,
  PrincipleAnnotation,
  PropositionAnnotation,
} from "../types";

const HEATH: HeathBook[] = [
  heath1, heath2, heath3, heath4, heath5, heath6, heath7,
  heath8, heath9, heath10, heath11, heath12, heath13,
] as HeathBook[];

const annotationFiles = import.meta.glob("../content/book*/*.yaml", {
  query: "?raw",
  import: "default",
  eager: true,
}) as Record<string, string>;

export const errors: string[] = [];

const principleAnns = new Map<ItemId, PrincipleAnnotation>();
const propAnns = new Map<ItemId, PropositionAnnotation>();

for (const [file, raw] of Object.entries(annotationFiles)) {
  let doc: unknown;
  try {
    doc = parse(raw);
  } catch (e) {
    errors.push(`${file}: ${(e as Error).message}`);
    continue;
  }
  const list = Array.isArray(doc) ? doc : (doc as { items?: unknown[] }).items ?? [doc];
  for (const a of list as (PrincipleAnnotation | PropositionAnnotation)[]) {
    if (!a || typeof a !== "object" || !("id" in a)) continue;
    if ("steps" in a) propAnns.set(a.id, a as PropositionAnnotation);
    else principleAnns.set(a.id, a as PrincipleAnnotation);
  }
}

const J = joyce as Record<ItemId, JoyceEntry>;

export const items = new Map<ItemId, Item>();
/** Reading order per book: definitions, postulates, common notions, propositions. */
export const sequence = new Map<number, ItemId[]>();

const KIND_LABEL: Record<ItemKind, [string, string]> = {
  definition: ["Definition", "Def."],
  postulate: ["Postulate", "Post."],
  commonNotion: ["Common Notion", "C.N."],
  proposition: ["Proposition", ""],
};

for (const hb of HEATH) {
  const R = ROMAN[hb.book];
  const seq: ItemId[] = [];
  const principle = (kind: ItemKind, list: HeathBook["definitions"]) => {
    for (const h of list) {
      const [label, abbr] = KIND_LABEL[kind];
      const num = h.set ? `${h.set}.${h.n}` : `${h.n}`;
      items.set(h.id, {
        id: h.id,
        kind,
        book: hb.book,
        n: h.n,
        label: `${label} ${num}`,
        short: `${abbr} ${num}`,
        text: h.text,
        intro: h.intro,
        heathNotes: h.notes,
        joyce: J[h.id],
        principle: principleAnns.get(h.id),
        uses: [],
        usesHeath: [],
        usedBy: [],
      });
      seq.push(h.id);
    }
  };
  principle("definition", hb.definitions);
  principle("postulate", hb.postulates);
  principle("commonNotion", hb.commonNotions);

  for (const h of hb.propositions) {
    const ann = propAnns.get(h.id);
    let steps;
    try {
      steps = ann ? alignSteps(h, ann.steps) : paragraphSteps(h);
    } catch (e) {
      if (!(e instanceof AlignError)) throw e;
      errors.push(e.message);
      steps = paragraphSteps(h);
    }
    const kind = ann?.kind ?? (/Q\. ?E\. ?F\.|required to do/.test(h.qed ?? "") ? "problem" : "theorem");
    const heathRefs = [...new Set([h.enunciation, ...h.proof, h.porism ?? ""].flatMap(refsIn))];
    const cites = ann ? ann.steps.flatMap((s) => s.cites ?? []) : [];
    items.set(h.id, {
      id: h.id,
      kind: "proposition",
      book: hb.book,
      n: h.n,
      label: `Proposition ${h.n}`,
      short: `${R}.${h.n}`,
      text: h.enunciation,
      heathNotes: h.notes,
      joyce: J[h.id],
      prop: { heath: h, annotation: ann ? { ...ann } : undefined, steps, kind },
      uses: [...new Set([...heathRefs, ...cites])].filter((x) => x !== h.id),
      usesHeath: heathRefs,
      usedBy: [],
    });
    seq.push(h.id);
  }
  sequence.set(hb.book, seq);
}

// Sort by reading order, then compute backlinks.
const order = new Map<ItemId, number>();
for (const seq of sequence.values()) seq.forEach((id, i) => order.set(id, i));
export const byOrder = (a: ItemId, b: ItemId) => (order.get(a) ?? 1e9) - (order.get(b) ?? 1e9);

for (const it of items.values()) {
  for (const u of it.uses) {
    const target = items.get(u);
    if (!target) {
      errors.push(`${it.id} refers to unknown item ${u}`);
      continue;
    }
    target.usedBy.push(it.id);
  }
}
for (const it of items.values()) {
  it.uses.sort(byOrder);
  it.usedBy.sort(byOrder);
}

for (const id of [...principleAnns.keys(), ...propAnns.keys()]) {
  if (!items.has(id)) errors.push(`annotation for unknown item ${id}`);
}

export const heathSource = HEATH[0].source;
export const heathCorrections = HEATH.flatMap((b) => b.corrections);

export function getItem(id: ItemId | undefined | null): Item | undefined {
  return id ? items.get(id) : undefined;
}

export function isAnnotated(id: ItemId) {
  const it = items.get(id);
  return !!(it?.prop?.annotation || it?.principle);
}

/**
 * Accepts "I.47", "1.47", "47", "prop 5", "def 15", "I.Def.15", "post 3",
 * "cn 1", "C.N. 1", "common notion 2" … and returns an item id.
 */
export function resolveQuery(q: string, book = 1): ItemId | undefined {
  const s = q.trim().replace(/\s+/g, " ");
  if (items.has(s)) return s;
  const m = /^(?:book )?([IVX]+|\d+)?[. ]?\s*(def(?:inition)?|post(?:ulate)?|c\.? ?n\.?|common notion|prop(?:osition)?)?\.?\s*(\d+)$/i.exec(s);
  if (!m) return undefined;
  let b = book;
  if (m[1]) b = /^\d+$/.test(m[1]) ? Number(m[1]) : ROMAN.indexOf(m[1].toUpperCase());
  const R = ROMAN[b];
  const n = m[3];
  const kind = (m[2] ?? "").toLowerCase();
  let id: string;
  if (kind.startsWith("def")) id = `${R}.Def.${n}`;
  else if (kind.startsWith("post")) id = `${R}.Post.${n}`;
  else if (kind.startsWith("c") && !kind.startsWith("prop")) id = `${R}.CN.${n}`;
  else id = `${R}.${n}`;
  return items.has(id) ? id : undefined;
}

if (errors.length && typeof console !== "undefined") {
  console.warn(`[corpus] ${errors.length} problem(s):\n` + errors.join("\n"));
}
