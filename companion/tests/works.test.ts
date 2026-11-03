// Integrity checks for the Chinese works (the Zhou bi and the Nine Chapters): the
// Chinese shown is the source's, every passage is translated exactly once, figures
// name only what they draw, and every cross-reference to Euclid points at a real
// proposition.
import { describe, expect, it } from "vitest";
import { items } from "../src/lib/corpus";
import { WORKS, allParallels, getSection, jiuzhang, parallelsOf, workErrors, zhoubi, zhPlain } from "../src/lib/works";
import type { DiagramSpec, WorkSection } from "../src/types";

describe("the works", () => {
  it("assemble without errors", () => {
    expect(workErrors).toEqual([]);
  });

  it("Zhou bi: Zhao's preface and all six parts", () => {
    expect(zhoubi.sections.has("ZB.Pref")).toBe(true);
    expect(zhoubi.source.parts.map((p) => p.n)).toEqual([1, 2, 3, 4, 5, 6]);
    expect(zhoubi.sections.size).toBe(46);
  });

  it("Nine Chapters: Liu Hui's preface and chapters 1, 4, 5, 9", () => {
    expect(jiuzhang.sections.has("JZ.Pref")).toBe(true);
    expect(jiuzhang.source.parts.map((p) => p.n)).toEqual([1, 4, 5, 9]);
    expect(jiuzhang.sections.size).toBe(56);
    // Every problem of the four chapters, in order: 38, 24, 28, 24.
    for (const [ch, n] of [[1, 38], [4, 24], [5, 28], [9, 24]]) {
      const probs = jiuzhang.source.parts.find((p) => p.n === ch)!.sections.flatMap((s) => s.passages.filter((x) => x.problem != null).map((x) => x.problem));
      expect(probs).toEqual(Array.from({ length: n }, (_, i) => i + 1));
    }
  });

  it("translate and annotate every section", () => {
    for (const w of WORKS) expect([...w.sections.values()].filter((s) => !s.annotation).map((s) => s.id)).toEqual([]);
  });

  it("index parallels both ways, to real Euclid items", () => {
    for (const [eid, list] of allParallels()) {
      expect(items.has(eid), `parallel to unknown Euclid item ${eid}`).toBe(true);
      for (const p of list) expect(getSection(p.section)!.annotation!.parallels!.some((q) => q.id === eid)).toBe(true);
    }
    expect(parallelsOf("I.47", "zhoubi").length).toBeGreaterThan(0);
    expect(parallelsOf("I.47", "jiuzhang").length).toBeGreaterThan(0);
  });
});

const figuresOf = (s: WorkSection): DiagramSpec[] => [
  ...(s.annotation!.diagram ? [s.annotation!.diagram] : []),
  ...(s.annotation!.figures ?? []),
];
const names = (d: DiagramSpec) => {
  const n = new Set(d.elements.map((e) => e.split(";")[0]));
  for (const a of Object.keys(d.aliases ?? {})) n.add(a);
  return n;
};

const annotated = WORKS.flatMap((w) => [...w.sections.values()]).filter((s) => s.annotation);

describe.each(annotated.map((s) => [s.id, s] as const))("%s", (id, s) => {
  const ann = s.annotation!;

  it("translates every passage, in order, and shows exactly the source's Chinese", () => {
    expect(s.steps.length).toBe(ann.steps.length);
    const whole = zhPlain(s.passages.map((p) => p.zh).join(""));
    expect(zhPlain(s.steps.map((x) => x.source).join(""))).toBe(whole);
    for (const st of s.steps) expect(st.en?.trim(), `${id} step ${st.index + 1} is untranslated`).toBeTruthy();
  });

  it("names only elements its figures draw", () => {
    const figs = figuresOf(s);
    ann.steps.forEach((st, i) => {
      const used = [...(st.highlight ?? []), ...(st.adds ?? [])];
      if (!used.length && st.figure == null) return;
      const k = st.figure ?? [...ann.steps.slice(0, i)].reverse().find((x) => x.figure != null)?.figure ?? 0;
      const fig = figs[k];
      expect(fig, `${id} step ${i + 1}: no figure ${k}`).toBeTruthy();
      const n = names(fig);
      for (const u of used) expect(n.has(u), `${id} step ${i + 1}: no element "${u}" in figure ${k}`).toBe(true);
    });
    for (const fig of figs) {
      const n = names(fig);
      for (const g of fig.given ?? []) expect(n.has(g), `${id}: given "${g}" missing`).toBe(true);
      // Every element refers only to elements defined before it.
      const seen = new Set<string>();
      for (const e of fig.elements) {
        const [name, type, , params] = e.split(";");
        if (type !== "point" || !/fixed|free/.test(e.split(";")[2]))
          for (const p of params.split(",")) if (/^[A-Za-z]/.test(p)) expect(seen.has(p), `${id}: ${name} uses ${p} before it is defined`).toBe(true);
        seen.add(name);
      }
      const seenEq = new Set<string>();
      for (const group of fig.equal ?? []) for (const m of group) {
        expect(n.has(m), `${id}: equal names missing "${m}"`).toBe(true);
        expect(seenEq.has(m), `${id}: "${m}" in two equality classes`).toBe(false);
        seenEq.add(m);
      }
    }
  });

  it("refers in its prose only to elements its figures draw", () => {
    const all = new Set(figuresOf(s).flatMap((f) => [...names(f)]));
    const prose = (JSON.stringify(ann.steps) + (ann.commentary ?? "") + ann.paraphrase + (ann.historical ?? "")).replace(/\$\$[\s\S]*?\$\$|\$[^$]*\$/g, "");
    // Every {…} must be one the renderer links (src/lib/rich.ts): {words|name}, or a bare name of capitals.
    for (const m of prose.matchAll(/\{([^{}"]+)\}/g)) {
      const bar = m[1].lastIndexOf("|");
      const name = bar >= 0 ? m[1].slice(bar + 1) : m[1];
      if (bar < 0) expect(/^[A-Z][A-Z']*$/.test(name), `${id}: {${name}} will not render; write {words|${name}}`).toBe(true);
      expect(all.has(name), `${id}: prose refers to {${m[1]}}`).toBe(true);
    }
  });

  it("cites only Euclid items and sections that exist", () => {
    const prose = JSON.stringify(ann);
    for (const m of prose.matchAll(/\[\[([^|\]"]+)(?:\|[^\]]+)?\]\]/g)) {
      const ref = m[1].trim();
      expect(items.has(ref) || !!getSection(ref), `${id}: unknown reference [[${ref}]]`).toBe(true);
    }
    for (const st of ann.steps) for (const c of st.cites ?? []) expect(items.has(c) || !!getSection(c), `${id}: cites ${c}`).toBe(true);
  });
});
