import { useMemo, useState } from "react";
import { BOOKS, availableBooks } from "../content/books";
import { getItem, heathCorrections, heathSource, items } from "../lib/corpus";
import { plainText, refLabel } from "../lib/rich";
import { hrefFor } from "../lib/router";
import { lastPosition } from "../lib/store";

// ─── Home ─────────────────────────────────────────────────────────────────
export function HomePage() {
  const pos = lastPosition();
  return (
    <main className="page home">
      <header className="home-head">
        <p className="kicker">Euclid · c. 300 BCE</p>
        <h1>
          The <i>Elements</i>
        </h1>
        <p className="lede">
          Euclid's text, in T. L. Heath's translation, with explanations kept out of the way until you ask for them.
        </p>
        {pos && (
          <p>
            <a className="btn" href={pos.hash}>
              Continue reading: {pos.label}
            </a>
          </p>
        )}
      </header>

      <section className="how-to">
        <h2>How to read</h2>
        <ol>
          <li>
            <strong>Read Euclid.</strong> His words fill the left of the page, in serif type.
          </li>
          <li>
            <strong>Click what confuses you.</strong> Each sentence of a proof is a step. Clicking it lights the objects it
            is about in the figure and opens a one-line hint on the right.
          </li>
          <li>
            <strong>Go deeper only if you need to.</strong> <em>Explain more</em> gives the full reasoning;{" "}
            <em>In modern notation</em> and <em>Modern reconstruction</em> translate it into today's mathematics, and say so.
          </li>
          <li>
            <strong>Follow references without losing your place.</strong> Clicking <span className="chip">Post. 3</span>{" "}
            or <span className="chip">I.4</span> shows it beside the text.
          </li>
        </ol>
        <div className="voices">
          <div className="voice-euclid">
            <span className="voice-label">Euclid</span>
            <p className="heath">What the text says, in Heath's 1908 translation. Never paraphrased.</p>
          </div>
          <div className="voice-note">
            <span className="voice-label">Explanation</span>
            <p>What Euclid means, in plain modern English.</p>
          </div>
          <div className="voice-modern">
            <span className="voice-label">Modern interpretation</span>
            <p>Today's notation and axioms. Anachronistic by design, and labelled so.</p>
          </div>
        </div>
      </section>

      <section>
        <h2>The thirteen books</h2>
        <ul className="books">
          {BOOKS.map((b) => (
            <li key={b.n} className={b.available ? "" : "unavailable"}>
              {b.available ? (
                <a href={`#/book/${b.roman}`}>
                  <span className="roman">{b.roman}</span>
                  <span className="subject">{b.subject}</span>
                </a>
              ) : (
                <span>
                  <span className="roman">{b.roman}</span>
                  <span className="subject">{b.subject}</span>
                  <span className="soon">planned</span>
                </span>
              )}
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}

// ─── Search ───────────────────────────────────────────────────────────────
interface Doc {
  id: string;
  field: "Euclid" | "Notes" | "Joyce" | "Heath's notes";
  text: string;
  step?: number;
}

let index: Doc[] | null = null;
function buildIndex(): Doc[] {
  const docs: Doc[] = [];
  for (const it of items.values()) {
    docs.push({ id: it.id, field: "Euclid", text: plainText(it.text) });
    for (const s of it.prop?.steps ?? []) if (s.part !== "enunciation") docs.push({ id: it.id, field: "Euclid", text: plainText(s.source), step: s.index });
    const a = it.prop?.annotation;
    const p = it.principle;
    const notes = [
      a?.paraphrase,
      a?.commentary,
      a?.gaps,
      a?.historical,
      p?.paraphrase,
      p?.meaning,
      p?.notes,
      ...(p?.examples ?? []),
      ...(it.prop?.steps ?? []).flatMap((s) => [s.hint, s.explain?.did, s.explain?.fact, s.explain?.implicit, s.gap, s.dispute]),
    ].filter(Boolean) as string[];
    for (const n of notes) docs.push({ id: it.id, field: "Notes", text: plainText(n) });
    for (const n of it.heathNotes) docs.push({ id: it.id, field: "Heath's notes", text: plainText(n.text) });
    const g = it.joyce?.guide ?? it.joyce?.groupGuide;
    if (g) for (const para of g.split(/\n\n+/)) if (!para.startsWith("<")) docs.push({ id: it.id, field: "Joyce", text: plainText(para.replace(/@/g, "")) });
  }
  return docs;
}

const WEIGHT = { Euclid: 3, Notes: 2, "Heath's notes": 1, Joyce: 1 };

export function SearchPage({ q }: { q: string }) {
  const [query, setQuery] = useState(q);
  const results = useMemo(() => {
    index ??= buildIndex();
    const terms = query.toLowerCase().split(/\s+/).filter((t) => t.length > 1);
    if (!terms.length) return [];
    const byItem = new Map<string, { score: number; hits: Doc[] }>();
    for (const d of index) {
      const t = d.text.toLowerCase();
      if (!terms.every((w) => t.includes(w))) continue;
      const e = byItem.get(d.id) ?? { score: 0, hits: [] };
      e.score += WEIGHT[d.field];
      e.hits.push(d);
      byItem.set(d.id, e);
    }
    return [...byItem.entries()].sort((a, b) => b[1].score - a[1].score).slice(0, 60);
  }, [query]);

  const snippet = (text: string) => {
    const terms = query.toLowerCase().split(/\s+/).filter((t) => t.length > 1);
    const i = Math.max(0, text.toLowerCase().indexOf(terms[0] ?? ""));
    const start = Math.max(0, i - 60);
    const s = (start > 0 ? "…" : "") + text.slice(start, start + 200) + (start + 200 < text.length ? "…" : "");
    const re = new RegExp(`(${terms.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})`, "gi");
    return s.split(re).map((part, k) => (k % 2 ? <mark key={k}>{part}</mark> : part));
  };

  return (
    <main className="page search">
      <h1>Search</h1>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          history.replaceState(null, "", `#/search?q=${encodeURIComponent(query)}`);
        }}
      >
        <input className="search-box" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="isosceles, gnomon, parallel…" autoFocus />
      </form>
      {query && <p className="small muted">{results.length ? `${results.length} items` : "Nothing found."}</p>}
      <ul className="results">
        {results.map(([id, r]) => {
          const it = getItem(id)!;
          const best = [...r.hits].sort((a, b) => WEIGHT[b.field] - WEIGHT[a.field])[0];
          return (
            <li key={id}>
              <a href={hrefFor(id, best.step)}>
                <span className="res-id">{refLabel(id)}</span> <span className="res-label">{it.label}</span>
              </a>
              <p className={best.field === "Euclid" ? "heath" : ""}>
                <span className="res-field">{best.field}</span> {snippet(best.text)}
              </p>
            </li>
          );
        })}
      </ul>
    </main>
  );
}

// ─── About ────────────────────────────────────────────────────────────────
export function AboutPage() {
  return (
    <main className="page about rich">
      <h1>About this edition</h1>
      <h2>The text</h2>
      <p>
        Euclid's words are {heathSource.translator}'s translation, <i>{heathSource.title}</i> ({heathSource.edition}),
        which is in the public domain. The digital text is the {heathSource.transcription}, extracted mechanically by{" "}
        <code>scripts/extract-heath.mjs</code> from{" "}
        <a href={heathSource.url} target="_blank" rel="noreferrer">
          a pinned copy
        </a>
        . The annotation files quote Heath in plain words, and the app checks every quotation against the source: a step
        whose words are not exactly Heath's next words is rejected, so what is shown as Euclid is always Heath's text.
      </p>
      <p>A few slips in the Perseus transcription are corrected against the printed edition:</p>
      <ul>
        {heathCorrections.map((c, i) => (
          <li key={i}>
            <a className="xref" data-ref={c.id} href={hrefFor(c.id)}>
              {refLabel(c.id)}
            </a>
            : “{plainText(c.from)}” → “{plainText(c.to)}” ({c.reason}).
          </li>
        ))}
      </ul>
      <p>
        The bracketed references in the text — <span className="heath">[Post. 3]</span>, <span className="heath">[C.N. 1]</span>{" "}
        — are Heath's, not Euclid's. The Greek text has none. They can be hidden from the <b>Aa</b> menu. Words in
        square brackets that are <em>not</em> references (as in I.4) mark passages Heath, following Heiberg, regards as
        later interpolations.
      </p>

      <h2>Three voices</h2>
      <div className="voices">
        <div className="voice-euclid">
          <span className="voice-label">Euclid</span>
          <p className="heath">Serif type, left column. Heath's words only.</p>
        </div>
        <div className="voice-note">
          <span className="voice-label">Explanation</span>
          <p>This edition's reading of what Euclid means.</p>
        </div>
        <div className="voice-modern">
          <span className="voice-label">Modern interpretation</span>
          <p>Modern notation and reconstructions, which Euclid did not use.</p>
        </div>
      </div>
      <p>
        Two further voices appear under <em>Notes and commentary</em>: Heath's own textual notes (1908) and Dr. David
        E. Joyce's guide from his online edition, read directly from this repository's Lektor content, where it is
        republished by his permission (© D. E. Joyce; see the repository's COPYRIGHT.md).
      </p>

      <h2>Conventions in the modern notation</h2>
      <ul>
        <li>
          <b>AB = CD</b> means the segments have equal length. Euclid compares the lines themselves, as magnitudes; he never
          assigns them numbers.
        </li>
        <li>
          <b>∠ABC</b> is the angle at <i>B</i>. Euclid's angles are always less than two right angles.
        </li>
        <li>
          <b>A : B = C : D</b> means that the four magnitudes are proportional in the sense of Book V, Definition 5:
          every comparison of multiples of <i>A</i> with multiples of <i>B</i> comes out as the same comparison for{" "}
          <i>C</i> and <i>D</i>. Euclid never treats a ratio as a number; where a note writes <i>A</i>/<i>B</i> or
          multiplies ratios, that is modern shorthand.
        </li>
        <li>
          Euclid calls two figures <i>equal</i> when they are equal in size (area). “Equal” triangles need not be congruent;
          where a modern text says ≅, the note says so.
        </li>
        <li>
          Proclus's six parts of a proposition label the steps: <i>enunciation, setting-out, specification, construction,
          proof, conclusion</i>. They are Proclus's analysis, not headings in Euclid.
        </li>
      </ul>

      <h2>Figures</h2>
      <p>
        The interactive figures are drawn by <b>geomlib</b>, Nelson Brown's TypeScript port of Joyce's 1996 Java Geometry
        Applet (MIT licence). Orange and red points can be dragged; everything constructed from them follows. The figures
        follow Heath's lettering; those for I.1–I.5 are this edition's, the rest are adapted from Joyce's figures.
      </p>

      <h2>What is annotated</h2>
      <p>
        All thirteen books: every definition, postulate, common notion and proposition (I: 23 definitions, 5
        postulates, 5 common notions, 48 propositions; II: 2 and 14; III: 11 and 37; IV: 7 and 16; V: 18 and 25;
        VI: 5 and 33; VII: 22 and 39; VIII: 27; IX: 36; X: 16 in three sets and 115; XI: 28 and 39; XII: 18; XIII:
        18). The notes for Books X–XIII are briefer than those for Books I–IX.
      </p>
    </main>
  );
}

export function NotFound({ what }: { what: string }) {
  return (
    <main className="page">
      <h1>Not here yet</h1>
      <p>
        {what} is not in this companion. Only {availableBooks()} {availableBooks().startsWith("Books") ? "are" : "is"} available so far.
      </p>
      <p>
        <a href="#/">Back to the contents</a>
      </p>
    </main>
  );
}

