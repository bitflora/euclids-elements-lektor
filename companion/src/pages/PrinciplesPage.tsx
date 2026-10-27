import { Fragment, useEffect, useRef } from "react";
import { getItem, sequence } from "../lib/corpus";
import { navigate, hrefFor, type SectionKind } from "../lib/router";
import { peek, usePeek } from "../lib/peek";
import { bookOf } from "../content/books";
import type { Item } from "../types";
import { Diagram } from "../components/Diagram";
import { Heath, Joyce, Rich } from "../components/Rich";
import { PeekCard, RefGroups } from "../components/Refs";
import { PanelShell } from "../components/Layout";

// The four sections of a book, in Euclid's order. Each is read the same way:
// Euclid's text on the left, the notes for the selected item on the right.
export const KINDS: Record<SectionKind, { test: (id: string) => boolean; title: string }> = {
  definitions: { test: (id) => id.includes(".Def."), title: "Definitions" },
  postulates: { test: (id) => id.includes(".Post."), title: "Postulates" },
  "common-notions": { test: (id) => id.includes(".CN."), title: "Common Notions" },
  propositions: { test: (id) => /^[IVX]+\.\d+$/.test(id), title: "Propositions" },
};

/** Breadcrumbs, the book's section tabs and the section title, above Euclid's text. */
export function SectionHead({ book, kind }: { book: string; kind: SectionKind }) {
  return (
    <>
      <nav className="item-nav">
        <span className="crumbs">
          <a href="#/">Contents</a> › Book {book}
        </span>
      </nav>
      <nav className="section-tabs" aria-label={`Sections of Book ${book}`}>
        {(Object.keys(KINDS) as SectionKind[])
          // Books II–XIII have no postulates or common notions of their own.
          .filter((k) => (sequence.get(bookOf(book)) ?? []).some(KINDS[k].test))
          .map((k) => (
            <a key={k} href={`#/${book}/${k}`} className={k === kind ? "on" : ""} aria-current={k === kind ? "page" : undefined}>
              {KINDS[k].title}
            </a>
          ))}
      </nav>
      <header className="item-head">
        <p className="kicker">Book {book}</p>
        <h1 className="principles-title">{KINDS[kind].title}</h1>
      </header>
    </>
  );
}

export function PrinciplesPage({ book, kind, select }: { book: string; kind: Exclude<SectionKind, "propositions">; select?: string }) {
  const K = KINDS[kind];
  const ids = (sequence.get(bookOf(book)) ?? []).filter(K.test);
  const list = ids.map((id) => getItem(id)!);
  const selected = getItem(select);
  const stack = usePeek();
  const mainRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const on = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).closest("input, textarea, select")) return;
      const i = select ? ids.indexOf(select) : -1;
      if (e.key === "j") navigate(hrefFor(ids[Math.min(ids.length - 1, i + 1)]), true);
      if (e.key === "k") navigate(hrefFor(ids[Math.max(0, i - 1)]), true);
      if (e.key === "Escape") stack.length ? peek.back() : navigate(`#/${book}/${kind}`, true);
    };
    window.addEventListener("keydown", on);
    return () => window.removeEventListener("keydown", on);
  });

  const pick = (id: string) => (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest(".xref, a")) return;
    if (window.getSelection()?.toString()) return; // reader is selecting text
    peek.clear();
    navigate(id === select ? `#/${book}/${kind}` : hrefFor(id), true);
  };

  const fig = selected?.principle?.figure;
  const joyceFig = !fig ? selected?.joyce?.figures[0] : undefined;

  return (
    <div className="reading">
      <main className="text-col" ref={mainRef}>
        <SectionHead book={book} kind={kind} />
        <section className="euclid" aria-label={`Euclid's ${K.title.toLowerCase()}, in Heath's translation`}>
          <p className="voice-tag">
            Euclid <span>· translated by T. L. Heath, 1908</span>
          </p>
          {list[0]?.intro && <p className="principle-intro heath">{list[0].intro}</p>}
          {principleSets(list).map(([set, group]) => (
              <Fragment key={set}>
                {set && (
                  <h2 className="principle-set">
                    Definitions {set}
                    <span className="small muted"> · {SET_NOTE[set]}</span>
                  </h2>
                )}
                <ol className="principles">
                  {group.map((it) => (
                    <li
                      key={it.id}
                      data-id={it.id}
                      className={`principle step${it.id === select ? " selected" : ""}`}
                      onClick={pick(it.id)}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => e.key === "Enter" && pick(it.id)(e as unknown as React.MouseEvent)}
                    >
                      <span className="step-num">{it.n}.</span>
                      <Heath src={it.text} as="span" />
                    </li>
                  ))}
                </ol>
              </Fragment>
            ))}
          {kind === "common-notions" && (
            <p className="small muted text-note">
              Heath's numbering. In Heiberg's Greek text, which Heath translates, these are 1, 2, 3, 7 and 8: Heiberg's 4–6
              and 9 are found in some manuscripts but are rejected as later additions.
            </p>
          )}
        </section>
        {kind === "definitions" && book === "I" && <DefinitionsNote />}
      </main>

      <PanelShell
        figure={
          fig ? (
            <figure className="svg-figure" dangerouslySetInnerHTML={{ __html: fig }} />
          ) : joyceFig ? (
            <Diagram joyceConfig={joyceFig.config} width={joyceFig.width} height={joyceFig.height} label={`Figure for ${selected!.label}`} compact />
          ) : null
        }
        caption={selected?.principle?.figureCaption}
        open={!!selected || stack.length > 0}
        onCloseSheet={() => navigate(`#/${book}/${kind}`, true)}
      >
        {stack.length > 0 ? (
          <PeekCard id={stack[stack.length - 1]} depth={stack.length} onBack={() => peek.back()} />
        ) : selected ? (
          <PrincipleNotes item={selected} />
        ) : (
          <div className="overview">
            <p className="how small">
              <strong>Read Euclid's list first.</strong> Click any item for a modern paraphrase, an explanation, examples,
              and the propositions that use it.
            </p>
          </div>
        )}
      </PanelShell>
    </div>
  );
}

// Book X has three sets of definitions, printed before X.1, X.48 and X.85.
const SET_NOTE: Record<string, string> = {
  I: "before Proposition 1",
  II: "before Proposition 48",
  III: "before Proposition 85",
};

/** Split a list of principles by definition set ("X.Def.II.1"); one unnamed group elsewhere. */
function principleSets(list: Item[]): [string, Item[]][] {
  const setOf = (id: string) => /^X\.Def\.(?:(II|III)\.)?\d+$/.exec(id)?.[1] ?? (id.startsWith("X.Def.") ? "I" : "");
  const out: [string, Item[]][] = [];
  for (const it of list) {
    const s = setOf(it.id);
    if (!out.length || out[out.length - 1][0] !== s) out.push([s, []]);
    out[out.length - 1][1].push(it);
  }
  return out;
}

function PrincipleNotes({ item }: { item: Item }) {
  const p = item.principle;
  const j = item.joyce;
  return (
    <div className="step-notes">
      <div className="panel-head">
        <span className="kicker">{item.label}</span>
        <a className="btn-quiet small" href={hrefFor(item.id)} onClick={(e) => e.preventDefault()}>
          {item.id}
        </a>
      </div>
      {p ? (
        <>
          <section className="voice-note">
            <span className="voice-label">In modern terms</span>
            <Rich md={p.paraphrase} />
          </section>
          {p.meaning && (
            <section className="voice-note">
              <span className="voice-label">Explanation</span>
              <Rich md={p.meaning} />
            </section>
          )}
          {p.modern && (
            <details className="voice-modern" open>
              <summary>
                <span className="voice-label">Modern formulation</span>
              </summary>
              <Rich md={p.modern} />
            </details>
          )}
          {(p.examples?.length || p.nonExamples?.length) && (
            <div className="examples">
              {p.examples?.length ? (
                <div>
                  <h4>Examples</h4>
                  <ul>
                    {p.examples.map((e, i) => (
                      <li key={i}>
                        <Rich md={e} inline />
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
              {p.nonExamples?.length ? (
                <div>
                  <h4>Non-examples</h4>
                  <ul>
                    {p.nonExamples.map((e, i) => (
                      <li key={i}>
                        <Rich md={e} inline />
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>
          )}
          {p.notes && (
            <details className="app-sec small-sec" open>
              <summary>Notes</summary>
              <Rich md={p.notes} />
            </details>
          )}
          {p.interpretations && (
            <details className="flag flag-dispute">
              <summary>Scholars disagree</summary>
              <Rich md={p.interpretations} />
            </details>
          )}
        </>
      ) : (
        <p className="muted">Notes for this item have not been written yet.</p>
      )}
      <section className="deps">
        <h4>Used in</h4>
        <RefGroups ids={item.usedBy} />
        <p className="small muted">
          Propositions whose text Heath annotates with this reference, or whose steps this edition's notes say rely on it.
        </p>
      </section>
      {(j?.guide || j?.groupGuide) && (
        <details className="app-sec small-sec">
          <summary>
            Joyce's guide <span className="tag">D. E. Joyce</span>
          </summary>
          <Joyce md={j.guide || j.groupGuide} figures={j.figures} />
        </details>
      )}
    </div>
  );
}

function DefinitionsNote() {
  return (
    <div className="apparatus">
      <details className="app-sec">
        <summary>About Euclid's definitions</summary>
        <div className="rich">
          <p>
            Euclid's definitions are not definitions in the modern, eliminable sense. Some (a point, a line, a straight
            line) describe primitive notions that nothing earlier could define; others (the circle, the kinds of triangle)
            fix technical vocabulary for later use. Several (Def. 13–14, "boundary" and "figure") are never cited again.
          </p>
          <p>
            A definition says what a thing <em>would be</em>; it does not assert that such a thing exists. Existence
            comes from the postulates and constructions — see the notes on{" "}
            <a className="xref" data-ref="I.Post.3" href="#/I.Post.3">
              Post. 3
            </a>{" "}
            and{" "}
            <a className="xref" data-ref="I.1" href="#/I.1">
              I.1
            </a>
            .
          </p>
        </div>
      </details>
    </div>
  );
}
