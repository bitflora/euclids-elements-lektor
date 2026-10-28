// Integrity checks for the reading corpus. These are the accuracy guarantees:
// if any of them fails, the app would be showing something it should not.
import { describe, expect, it } from "vitest";
import heath1 from "../src/data/heath/book1.json";
import heath2 from "../src/data/heath/book2.json";
import heath3 from "../src/data/heath/book3.json";
import heath4 from "../src/data/heath/book4.json";
import heath5 from "../src/data/heath/book5.json";
import heath6 from "../src/data/heath/book6.json";
import heath7 from "../src/data/heath/book7.json";
import heath8 from "../src/data/heath/book8.json";
import heath9 from "../src/data/heath/book9.json";
import heath10 from "../src/data/heath/book10.json";
import heath11 from "../src/data/heath/book11.json";
import heath12 from "../src/data/heath/book12.json";
import heath13 from "../src/data/heath/book13.json";
import { errors, items } from "../src/lib/corpus";
import { normalize } from "../src/lib/align";
import type { HeathBook } from "../src/types";

const HEATH = [
  heath1, heath2, heath3, heath4, heath5, heath6, heath7,
  heath8, heath9, heath10, heath11, heath12, heath13,
] as HeathBook[];
const annotated = [...items.values()].filter((i) => i.prop?.annotation);

describe("corpus", () => {
  it("assembles without errors", () => {
    expect(errors).toEqual([]);
  });

  it("has all of Book I", () => {
    const count = (k: string) => [...items.values()].filter((i) => i.kind === k && i.book === 1).length;
    expect(count("definition")).toBe(23);
    expect(count("postulate")).toBe(5);
    expect(count("commonNotion")).toBe(5);
    expect(count("proposition")).toBe(48);
  });

  it("annotates Definitions 1–23, Postulates 1–5, Common Notions 1–5, Propositions I.1–I.48", () => {
    const want = [
      ...Array.from({ length: 23 }, (_, i) => `I.Def.${i + 1}`),
      ...Array.from({ length: 5 }, (_, i) => `I.Post.${i + 1}`),
      ...Array.from({ length: 5 }, (_, i) => `I.CN.${i + 1}`),
    ];
    for (const id of want) expect(items.get(id)?.principle, id).toBeTruthy();
    for (let n = 1; n <= 48; n++) expect(items.get(`I.${n}`)?.prop?.annotation, `I.${n}`).toBeTruthy();
  });

  it("has all of Book II, annotated", () => {
    const count = (k: string) => [...items.values()].filter((i) => i.kind === k && i.book === 2).length;
    expect(count("definition")).toBe(2);
    expect(count("proposition")).toBe(14);
    for (const id of ["II.Def.1", "II.Def.2"]) expect(items.get(id)?.principle, id).toBeTruthy();
    for (let n = 1; n <= 14; n++) expect(items.get(`II.${n}`)?.prop?.annotation, `II.${n}`).toBeTruthy();
  });

  it.each([
    [3, "III", 11, 37],
    [4, "IV", 7, 16],
    [5, "V", 18, 25],
    [6, "VI", 5, 33],
    [7, "VII", 22, 39],
    [8, "VIII", 0, 27],
    [9, "IX", 0, 36],
    [11, "XI", 28, 39],
    [12, "XII", 0, 18],
    [13, "XIII", 0, 18],
  ])("has all of Book %s, annotated", (book, R, defs, props) => {
    const count = (k: string) => [...items.values()].filter((i) => i.kind === k && i.book === book).length;
    expect(count("definition")).toBe(defs);
    expect(count("proposition")).toBe(props);
    for (let n = 1; n <= defs; n++) expect(items.get(`${R}.Def.${n}`)?.principle, `${R}.Def.${n}`).toBeTruthy();
    for (let n = 1; n <= props; n++) expect(items.get(`${R}.${n}`)?.prop?.annotation, `${R}.${n}`).toBeTruthy();
  });

  it("has all of Book X, annotated (three sets of definitions)", () => {
    const defs = [...items.values()].filter((i) => i.kind === "definition" && i.book === 10);
    expect(defs.map((d) => d.id)).toEqual([
      ...[1, 2, 3, 4].map((n) => `X.Def.${n}`),
      ...[1, 2, 3, 4, 5, 6].map((n) => `X.Def.II.${n}`),
      ...[1, 2, 3, 4, 5, 6].map((n) => `X.Def.III.${n}`),
    ]);
    for (const d of defs) expect(d.principle, d.id).toBeTruthy();
    for (let n = 1; n <= 115; n++) expect(items.get(`X.${n}`)?.prop?.annotation, `X.${n}`).toBeTruthy();
  });
});

describe.each(annotated.map((i) => [i.id, i] as const))("%s", (id, item) => {
  const prop = item.prop!;
  const ann = prop.annotation!;
  const h = HEATH.flatMap((b) => b.propositions).find((p) => p.id === id)!;

  it("quotes Heath exactly and completely", () => {
    const whole = normalize([h.enunciation, ...h.proof, h.qed ?? ""].join(" "));
    const fromSteps = normalize(prop.steps.map((s) => s.source).join(" "));
    expect(fromSteps).toBe(whole);
    expect(prop.steps.length).toBe(ann.steps.length);
  });

  it("highlights only elements that exist in its diagram", () => {
    const names = new Set(ann.diagram.elements.map((e) => e.split(";")[0]));
    for (const a of Object.keys(ann.diagram.aliases ?? {})) names.add(a);
    const used = [
      ...(ann.diagram.given ?? []),
      ...ann.steps.flatMap((s) => [...(s.highlight ?? []), ...(s.adds ?? [])]),
    ];
    for (const n of used) expect(names.has(n), `${id}: no diagram element "${n}"`).toBe(true);
  });

  it("colours only elements that exist, each in at most one equality class", () => {
    const names = new Set(ann.diagram.elements.map((e) => e.split(";")[0]));
    for (const a of Object.keys(ann.diagram.aliases ?? {})) names.add(a);
    expect((ann.diagram.equal ?? []).length, `${id}: more equality classes than colours`).toBeLessThanOrEqual(6);
    const seen = new Map<string, number>();
    (ann.diagram.equal ?? []).forEach((group, i) => {
      expect(group.length, `${id}: equality class ${i} has one member`).toBeGreaterThan(1);
      for (const n of group) {
        expect(names.has(n), `${id}: no diagram element "${n}"`).toBe(true);
        const target = ann.diagram.aliases?.[n] ?? n;
        expect(seen.has(target), `${id}: "${n}" is in two equality classes`).toBe(false);
        seen.set(target, i);
      }
    });
  });

  it("has aliases that point at real elements and shadow none", () => {
    const names = new Set(ann.diagram.elements.map((e) => e.split(";")[0]));
    for (const [alias, target] of Object.entries(ann.diagram.aliases ?? {})) {
      expect(names.has(alias), `${id}: alias ${alias} shadows an element`).toBe(false);
      expect(names.has(target), `${id}: alias ${alias} → missing ${target}`).toBe(true);
    }
  });

  it("refers in its prose only to diagram elements that exist", () => {
    const names = new Set(ann.diagram.elements.map((e) => e.split(";")[0]));
    for (const a of Object.keys(ann.diagram.aliases ?? {})) names.add(a);
    const prose = JSON.stringify(ann.steps) + (ann.commentary ?? "") + (ann.gaps ?? "") + ann.paraphrase;
    // Strip KaTeX before looking for {X} and {text|X} tokens.
    const noMath = prose.replace(/\$\$[\s\S]*?\$\$|\$[^$]*\$/g, "");
    const refs = [...noMath.matchAll(/\{(?:[^{}|"]+\|)?([A-Za-z][A-Za-z0-9']*)\}/g)].map((m) => m[1]);
    for (const n of refs) expect(names.has(n), `${id}: prose refers to {${n}}`).toBe(true);
  });

  it("gives every numbered step a hint", () => {
    for (const s of prop.steps) expect(s.hint, `${id} step ${s.number ?? s.part}`).toBeTruthy();
  });

  it("cites only items that exist and precede it", () => {
    for (const u of item.uses) {
      const t = items.get(u);
      expect(t, `${id} uses ${u}`).toBeTruthy();
      // Heath's own forward references (X.10 cites X.11; X.10 is thought to be
      // interpolated) are facts about the text; this edition's cites must look back.
      if (t!.kind === "proposition" && !item.usesHeath.includes(u))
        expect(t!.book * 1000 + t!.n, `${id} uses later ${u}`).toBeLessThan(item.book * 1000 + item.n);
    }
  });

  it("reconstruction refers to real step numbers", () => {
    const max = Math.max(...prop.steps.map((s) => s.number ?? 0));
    for (const l of ann.reconstruction.lines)
      for (const n of l.steps ?? []) expect(n >= 1 && n <= max, `${id}: reconstruction step ${n}`).toBe(true);
  });
});

it("prints step numbering for review", () => {
  for (const i of annotated) {
    const lines = i.prop!.steps.map((s) => `${String(s.number ?? "-").padStart(3)} ${s.part.padEnd(13)} ${s.text.slice(0, 70)}`);
    console.log(`\n${i.id}\n${lines.join("\n")}`);
  }
});
