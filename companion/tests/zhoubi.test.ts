// Integrity checks for the Zhou bi: the Chinese shown is the source's, every
// passage is translated exactly once, figures name only what they draw, and every
// cross-reference to Euclid points at a real proposition.
import { describe, expect, it } from "vitest";
import { items } from "../src/lib/corpus";
import { allParallels, parallelsOf, zbErrors, zbSections, zbSource, zhPlain } from "../src/lib/zhoubi";
import type { DiagramSpec, ZbSection } from "../src/types";

const sections = [...zbSections.values()];
const annotated = sections.filter((s) => s.annotation);

describe("zhou bi", () => {
  it("assembles without errors", () => {
    expect(zbErrors).toEqual([]);
  });

  it("has Zhao's preface and all six parts", () => {
    expect(zbSections.has("ZB.Pref")).toBe(true);
    expect(zbSource.parts.map((p) => p.n)).toEqual([1, 2, 3, 4, 5, 6]);
    expect(sections.length).toBe(46);
  });

  it("translates and annotates every section", () => {
    expect(sections.filter((s) => !s.annotation).map((s) => s.id)).toEqual([]);
  });

  it("indexes parallels both ways, to real Euclid items", () => {
    for (const [eid, list] of allParallels()) {
      expect(items.has(eid), `parallel to unknown Euclid item ${eid}`).toBe(true);
      for (const p of list) expect(zbSections.get(p.zb)!.annotation!.parallels!.some((q) => q.id === eid)).toBe(true);
    }
    expect(parallelsOf("I.47").length).toBeGreaterThan(0);
  });
});

const figuresOf = (s: ZbSection): DiagramSpec[] => [
  ...(s.annotation!.diagram ? [s.annotation!.diagram] : []),
  ...(s.annotation!.figures ?? []),
];
const names = (d: DiagramSpec) => {
  const n = new Set(d.elements.map((e) => e.split(";")[0]));
  for (const a of Object.keys(d.aliases ?? {})) n.add(a);
  return n;
};

describe.each(annotated.map((s) => [s.id, s] as const))("%s", (id, s) => {
  const ann = s.annotation!;

  it("translates every passage, in order, and shows exactly the source's Chinese", () => {
    expect(s.steps.length).toBe(ann.steps.length);
    const whole = zhPlain(s.passages.map((p) => p.zh).join(""));
    expect(zhPlain(s.steps.map((x) => x.source).join(""))).toBe(whole);
    for (const st of s.steps) expect((st.classic ?? st.zhao)?.trim(), `${id} step ${st.index + 1} is untranslated`).toBeTruthy();
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
    const refs = [...prose.matchAll(/\{(?:[^{}|"]+\|)?([A-Z][A-Za-z0-9']*)\}/g)].map((m) => m[1]);
    for (const r of refs) expect(all.has(r), `${id}: prose refers to {${r}}`).toBe(true);
  });

  it("cites only Euclid items and Zhou bi sections that exist", () => {
    const prose = JSON.stringify(ann);
    for (const m of prose.matchAll(/\[\[([^|\]"]+)(?:\|[^\]]+)?\]\]/g)) {
      const ref = m[1].trim();
      expect(items.has(ref) || zbSections.has(ref), `${id}: unknown reference [[${ref}]]`).toBe(true);
    }
    for (const st of ann.steps) for (const c of st.cites ?? []) expect(items.has(c) || zbSections.has(c), `${id}: cites ${c}`).toBe(true);
  });
});
