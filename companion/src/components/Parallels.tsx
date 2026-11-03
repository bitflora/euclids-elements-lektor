// Cross-references between the Chinese works and Euclid, where they prove (or rely
// on) the same proposition. Declared once, in a section's `parallels`; shown on both
// sides.

import { getItem } from "../lib/corpus";
import { refLabel } from "../lib/rich";
import { hrefFor } from "../lib/router";
import { WORKS, getSection, parallelsOf, partInfo, workOf } from "../lib/works";
import type { ItemId, WorkSection } from "../types";
import { Rich } from "./Rich";

const RELATION = {
  same: ["same proposition", "Both texts prove or use this very result."],
  related: ["related", "A close relative: a special case, a generalisation, or the same idea put to another use."],
} as const;

function Badge({ relation }: { relation: "same" | "related" }) {
  const [label, title] = RELATION[relation];
  return (
    <span className={`par-badge par-${relation}`} title={title}>
      {label}
    </span>
  );
}

/** On a Euclid proposition: where the Chinese works have it too, one list per work. */
export function EuclidParallels({ id, callout }: { id: ItemId; callout?: boolean }) {
  return (
    <>
      {WORKS.map((w) => {
        const list = parallelsOf(id, w.key);
        if (!list.length) return null;
        return (
          <section key={w.key} className={`parallels${callout ? " parallels-callout" : ""}`}>
            <h4>
              {callout ? "Also in " : "In "}the <i>{w.title}</i> <span lang="zh-Hant">{w.zh}</span>
            </h4>
            <ul>
              {list.map((p) => {
                const s = getSection(p.section);
                return (
                  <li key={p.section}>
                    <a className="xref chip" data-ref={p.section} href={hrefFor(p.section)}>
                      {refLabel(p.section)}
                    </a>{" "}
                    <Badge relation={p.relation} /> <span className="par-title">{s?.annotation?.title}</span>
                    <Rich md={p.note} className="small" />
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}
    </>
  );
}

/** On a section of a Chinese work: the Euclid propositions it parallels. */
export function WorkParallels({ section }: { section: WorkSection }) {
  const list = section.annotation?.parallels ?? [];
  if (!list.length) return null;
  return (
    <section className="parallels">
      <h4>In Euclid's Elements</h4>
      <ul>
        {list.map((p) => (
          <li key={p.id}>
            <a className="xref chip" data-ref={p.id} href={hrefFor(p.id)}>
              {refLabel(p.id)}
            </a>{" "}
            <Badge relation={p.relation} /> <span className="par-title">{getItem(p.id)?.prop?.annotation?.title}</span>
            <Rich md={p.note} className="small" />
          </li>
        ))}
      </ul>
    </section>
  );
}

/** A section of a Chinese work, as shown in a peek. */
export function WorkPeek({ id }: { id: string }) {
  const s = getSection(id);
  const w = workOf(id);
  if (!s || !w) return <p className="muted">There is no section {id}.</p>;
  const ann = s.annotation;
  const first = s.steps.find((x) => x.voice === "classic") ?? s.steps[0];
  return (
    <>
      <p className="kicker">
        {w.short} · {partInfo(w, s.part)?.label} · {s.label}
      </p>
      {ann && <p className="editor-title">{ann.title}</p>}
      {first && (
        <div className="voice-euclid">
          <span className="voice-label">The {w.short}</span>
          {first.en && <Rich md={first.en} className="zb-en" />}
          <p className="zb-zh" lang="zh-Hant">
            {first.source}
          </p>
        </div>
      )}
      {ann?.paraphrase && (
        <div className="voice-note">
          <span className="voice-label">In brief</span>
          <Rich md={ann.paraphrase} />
        </div>
      )}
      <WorkParallels section={s} />
    </>
  );
}
