// Aligns an annotation's steps with Heath's text.
//
// Authors quote Heath in plain words ("Let AB be the given finite straight
// line."). The aligner walks Heath's paragraphs and requires every step to be
// the next run of Heath's words — nothing skipped, nothing added, nothing
// reworded. The displayed text of each step is then cut from the *source*, so
// what the reader sees as Euclid can only ever be Heath's own words.

import type { HeathProposition, ItemId, Step, StepAnnotation } from "../types";

const REF = /\[\[([^|\]]+)\|([^\]]+)\]\]/y;

interface Plain {
  plain: string;
  /** rawAt[i] = index in raw of plain[i]; rawAt[plain.length] = raw.length */
  rawAt: number[];
}

/** Strip {AB}, _term_, **x** and [[ref|label]] markup, collapsing whitespace. */
export function toPlain(raw: string): Plain {
  let plain = "";
  const rawAt: number[] = [];
  let i = 0;
  let lastSpace = true;
  while (i < raw.length) {
    REF.lastIndex = i;
    const m = REF.exec(raw);
    if (m) {
      i += m[0].length;
      // "bisected at E [[I.10|I. 10]], and" reads "bisected at E, and".
      if (plain.endsWith(" ") && /^[,;.:]/.test(raw.slice(i))) {
        plain = plain.slice(0, -1);
        rawAt.pop();
        lastSpace = false;
      }
      continue;
    }
    const c = raw[i];
    if (c === "{" || c === "}" || c === "_" || c === "*") {
      i++;
      continue;
    }
    if (/\s/.test(c)) {
      if (!lastSpace) {
        plain += " ";
        rawAt.push(i);
        lastSpace = true;
      }
      i++;
      continue;
    }
    plain += c;
    rawAt.push(i);
    lastSpace = false;
    i++;
  }
  if (plain.endsWith(" ")) {
    plain = plain.slice(0, -1);
    rawAt.pop();
  }
  rawAt.push(raw.length);
  return { plain, rawAt };
}

export const normalize = (s: string) => toPlain(s).plain;

export function refsIn(raw: string): ItemId[] {
  return [...raw.matchAll(/\[\[([^|\]]+)\|/g)].flatMap((m) => m[1].split(" "));
}

export class AlignError extends Error {}

export function alignSteps(heath: HeathProposition, anns: StepAnnotation[]): Step[] {
  const paras = [heath.enunciation, ...heath.proof, ...(heath.qed ? [heath.qed] : [])];
  const plains = paras.map(toPlain);
  const steps: Step[] = [];
  let p = 0;
  let off = 0; // offset into plains[p].plain
  let number = 0;

  anns.forEach((a, index) => {
    const want = normalize(a.text);
    if (p >= paras.length) throw new AlignError(`${heath.id}: step ${index + 1} ("${want.slice(0, 40)}…") runs past the end of Heath's text`);
    const { plain, rawAt } = plains[p];
    if (plain[off] === " ") off++;
    if (!plain.startsWith(want, off)) {
      const got = plain.slice(off, off + want.length + 20);
      throw new AlignError(
        `${heath.id}: step ${index + 1} does not match Heath's text.\n  step:  "${want}"\n  heath: "${got}"`,
      );
    }
    const start = off;
    const end = off + want.length;
    const atParaEnd = end >= plain.length;
    // The raw span runs to the start of the next step's first character, so
    // Heath's trailing [[refs]] belong to the claim they justify.
    const raw = paras[p];
    const boundary = (k: number) => {
      if (k === 0) return 0;
      let q = rawAt[k];
      while (q > 0 && "{_*".includes(raw[q - 1])) q--;
      return q;
    };
    const rawStart = boundary(start);
    const rawEnd = atParaEnd ? raw.length : boundary(plain[end] === " " ? end + 1 : end);
    const source = raw.slice(rawStart, rawEnd).trim();
    const isEnun = p === 0;
    const isQed = !!heath.qed && p === paras.length - 1;
    steps.push({
      ...a,
      index,
      number: isEnun || isQed ? null : ++number,
      source,
      para: p,
      heathRefs: refsIn(source),
      isQed,
    });
    if (atParaEnd) {
      p++;
      off = 0;
    } else {
      off = end;
    }
  });

  if (p < paras.length) {
    const rest = plains[p].plain.slice(off, off + 60);
    throw new AlignError(`${heath.id}: Heath's text continues after the last step: "${rest}…"`);
  }
  return steps;
}

/** Steps for a proposition without annotations: one per Heath paragraph. */
export function paragraphSteps(heath: HeathProposition): Step[] {
  const paras = [heath.enunciation, ...heath.proof, ...(heath.qed ? [heath.qed] : [])];
  let number = 0;
  return paras.map((source, i) => {
    const isEnun = i === 0;
    const isQed = !!heath.qed && i === paras.length - 1;
    return {
      part: isEnun ? "enunciation" : isQed ? "conclusion" : "proof",
      text: normalize(source),
      index: i,
      number: isEnun || isQed ? null : ++number,
      source,
      para: i,
      heathRefs: refsIn(source),
      isQed,
    } satisfies Step;
  });
}
