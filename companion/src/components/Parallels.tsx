// Cross-references between the Zhou bi and Euclid, where the two prove (or rely
// on) the same proposition. Declared once, in a Zhou bi section's `parallels`;
// shown on both sides.

import { getItem } from "../lib/corpus";
import { refLabel } from "../lib/rich";
import { hrefFor } from "../lib/router";
import { getZb, parallelsOf, zbPartInfo } from "../lib/zhoubi";
import type { ItemId, ZbSection } from "../types";
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

/** On a Euclid proposition: where the Zhou bi has it too. */
export function EuclidParallels({ id, callout }: { id: ItemId; callout?: boolean }) {
  const list = parallelsOf(id);
  if (!list.length) return null;
  return (
    <section className={`parallels${callout ? " parallels-callout" : ""}`}>
      <h4>
        {callout ? "Also in " : "In "}the Zhou bi suan jing <span lang="zh-Hant">周髀算經</span>
      </h4>
      <ul>
        {list.map((p) => {
          const s = getZb(p.zb);
          return (
            <li key={p.zb}>
              <a className="xref chip" data-ref={p.zb} href={hrefFor(p.zb)}>
                {refLabel(p.zb)}
              </a>{" "}
              <Badge relation={p.relation} /> <span className="par-title">{s?.annotation?.title}</span>
              <Rich md={p.note} className="small" />
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/** On a Zhou bi section: the Euclid propositions it parallels. */
export function ZbParallels({ section }: { section: ZbSection }) {
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

/** A Zhou bi section, as shown in a peek. */
export function ZbPeek({ id }: { id: string }) {
  const s = getZb(id);
  if (!s) return <p className="muted">There is no section {id} in the Zhou bi.</p>;
  const ann = s.annotation;
  const firstClassic = s.steps.find((x) => x.voice === "classic");
  return (
    <>
      <p className="kicker">
        Zhou bi · {zbPartInfo(s.part)?.label} · {s.label}
      </p>
      {ann && <p className="editor-title">{ann.title}</p>}
      {firstClassic && (
        <div className="voice-euclid">
          <span className="voice-label">The Zhou bi</span>
          {firstClassic.classic && <Rich md={firstClassic.classic} className="zb-en" />}
          <p className="zb-zh" lang="zh-Hant">
            {firstClassic.source}
          </p>
        </div>
      )}
      {ann?.paraphrase && (
        <div className="voice-note">
          <span className="voice-label">In brief</span>
          <Rich md={ann.paraphrase} />
        </div>
      )}
      <ZbParallels section={s} />
    </>
  );
}

