import { availableBooks } from "../content/books";
import { getItem, isAnnotated } from "../lib/corpus";
import { refLabel } from "../lib/rich";
import { hrefFor } from "../lib/router";
import type { ItemId } from "../types";
import { Heath, Rich } from "./Rich";

/** A reference that opens a peek (click) or navigates (⌘/Ctrl-click). */
export function RefChip({ id, heath }: { id: ItemId; heath?: boolean }) {
  const it = getItem(id);
  return (
    <a
      className={`xref chip${heath ? " chip-heath" : ""}${it ? "" : " chip-missing"}`}
      data-ref={id}
      href={hrefFor(id)}
      title={it ? `${it.label}${heath ? " — cited by Heath" : ""}` : "Not yet in this companion"}
    >
      {refLabel(id)}
    </a>
  );
}

const GROUPS: [string, (id: string) => boolean][] = [
  ["Definitions", (id) => id.includes(".Def.")],
  ["Postulates", (id) => id.includes(".Post.")],
  ["Common notions", (id) => id.includes(".CN.")],
  ["Propositions", (id) => /^[IVX]+\.\d+$/.test(id)],
];

export function RefGroups({ ids, heath = [] }: { ids: ItemId[]; heath?: ItemId[] }) {
  if (!ids.length) return <p className="muted">None.</p>;
  return (
    <dl className="ref-groups">
      {GROUPS.map(([label, test]) => {
        const g = ids.filter(test);
        if (!g.length) return null;
        return (
          <div key={label}>
            <dt>{label}</dt>
            <dd>
              {g.map((id) => (
                <RefChip key={id} id={id} heath={heath.includes(id)} />
              ))}
            </dd>
          </div>
        );
      })}
    </dl>
  );
}

/** What a reference says, shown in the panel without leaving the page. */
export function PeekCard({ id, onBack, depth }: { id: ItemId; onBack: () => void; depth: number }) {
  const it = getItem(id);
  return (
    <div className="peek">
      <div className="panel-head">
        <button type="button" className="btn-quiet" onClick={onBack}>
          ← {depth > 1 ? "Back" : "Back to your place"}
        </button>
        {it && (
          <a className="btn-quiet" href={hrefFor(id)}>
            Open {refLabel(id)} →
          </a>
        )}
      </div>
      {!it ? (
        <p className="muted">
          <strong>{id}</strong> is not in this companion yet. Only {availableBooks()} {availableBooks().startsWith("Books") ? "are" : "is"} available so far.
        </p>
      ) : (
        <>
          <p className="kicker">
            Book {it.id.split(".")[0]} · {it.label}
          </p>
          <div className="voice-euclid">
            <span className="voice-label">Euclid</span>
            <Heath src={it.text} as="p" />
          </div>
          {(it.principle?.paraphrase || it.prop?.annotation?.paraphrase) && (
            <div className="voice-note">
              <span className="voice-label">In modern terms</span>
              <Rich md={it.principle?.paraphrase ?? it.prop?.annotation?.paraphrase} />
            </div>
          )}
          {it.principle?.meaning && (
            <div className="voice-note">
              <span className="voice-label">Explanation</span>
              <Rich md={it.principle.meaning} />
            </div>
          )}
          {it.principle?.modern && (
            <div className="voice-modern">
              <span className="voice-label">Modern formulation</span>
              <Rich md={it.principle.modern} />
            </div>
          )}
          {!isAnnotated(id) && <p className="muted small">Annotations for {refLabel(id)} have not been written yet.</p>}
        </>
      )}
    </div>
  );
}
