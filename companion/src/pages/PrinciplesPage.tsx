import { Fragment, useEffect, useRef, useState } from "react";
import { getItem, isAnnotated, sequence } from "../lib/corpus";
import { useSettings } from "../lib/store";
import { navigate, hrefFor, type SectionKind } from "../lib/router";
import { peek, usePeek } from "../lib/peek";
import { bookOf } from "../content/books";
import type { Item } from "../types";
import { Diagram } from "../components/Diagram";
import { Heath, Joyce, Rich } from "../components/Rich";
import { PeekCard, RefGroups } from "../components/Refs";
import { PanelShell } from "../components/Layout";

// The four sections of a book, in Euclid's order. Each is read the same way:
// Euclid's list on the left, the notes for the selected item on the right.
const KINDS: Record<SectionKind, { test: (id: string) => boolean; title: string }> = {
  definitions: { test: (id) => id.includes(".Def."), title: "Definitions" },
  postulates: { test: (id) => id.includes(".Post."), title: "Postulates" },
  "common-notions": { test: (id) => id.includes(".CN."), title: "Common Notions" },
  propositions: { test: (id) => /^[IVX]+\.\d+$/.test(id), title: "Propositions" },
};

export function PrinciplesPage({ book, kind, select }: { book: string; kind: SectionKind; select?: string }) {
  const K = KINDS[kind];
  const ids = (sequence.get(bookOf(book)) ?? []).filter(K.test);
  // Definitions etc. are addressed by their own id; a proposition's own
  // address is its full reading page, so in this list it is selected by query.
  const selectHref = (id: string) =>
    kind === "propositions" ? `#/${book}/propositions?select=${encodeURIComponent(id)}` : hrefFor(id);
  const list = ids.map((id) => getItem(id)!);
  const selected = getItem(select);
  // On the propositions page Euclid's text runs on in full; the panel follows the
  // proposition being read unless one has been clicked.
  const [reading, setReading] = useState<string | null>(null);
  const shown = selected ?? (kind === "propositions" ? getItem(reading) : undefined);
  const stack = usePeek();
  const mainRef = useRef<HTMLElement>(null);

  const arrived = useRef(false);
  useEffect(() => {
    const t = setTimeout(() => (arrived.current = true), 600);
    return () => clearTimeout(t);
  }, [book, kind]);

  useEffect(() => {
    if (!select) return;
    const el = mainRef.current?.querySelector(`[data-id="${select}"]`);
    if (!el) return;
    if (kind === "propositions") {
      // Scroll the window only (scrollIntoView would also shift the app's other containers).
      // On arrival jump at once, once fonts have settled the layout; afterwards glide.
      const go = (behavior: ScrollBehavior) => {
        const t = el.getBoundingClientRect().top;
        if (t < 60 || t > window.innerHeight * 0.6) window.scrollTo({ top: window.scrollY + t - 64, behavior });
      };
      if (arrived.current) go("smooth");
      else document.fonts.ready.then(() => requestAnimationFrame(() => go("auto")));
      return;
    }
    const r = el.getBoundingClientRect();
    if (r.top < 80 || r.bottom > window.innerHeight - 40) el.scrollIntoView({ block: "center", behavior: "smooth" });
  }, [select]);

  useEffect(() => {
    const on = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).closest("input, textarea, select")) return;
      const i = select ? ids.indexOf(select) : -1;
      if (e.key === "j") navigate(selectHref(ids[Math.min(ids.length - 1, i + 1)]), true);
      if (e.key === "k") navigate(selectHref(ids[Math.max(0, i - 1)]), true);
      if (e.key === "Enter" && kind === "propositions" && select && e.target === document.body) navigate(hrefFor(select));
      if (e.key === "Escape") stack.length ? peek.back() : navigate(`#/${book}/${kind}`, true);
    };
    window.addEventListener("keydown", on);
    return () => window.removeEventListener("keydown", on);
  });

  const pick = (id: string) => (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest(".xref, a")) return;
    if (window.getSelection()?.toString()) return; // reader is selecting text
    peek.clear();
    // While reading the propositions straight through, a second click keeps the selection.
    if (kind === "propositions" && id === select) return;
    navigate(id === select ? `#/${book}/${kind}` : selectHref(id), true);
  };

  // Track the proposition at the top of the reading column.
  useEffect(() => {
    if (kind !== "propositions") return;
    const root = mainRef.current;
    if (!root) return;
    const visible = new Map<string, number>();
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          const id = (e.target as HTMLElement).dataset.id!;
          if (e.isIntersecting) visible.set(id, e.boundingClientRect.top);
          else visible.delete(id);
        }
        const first = [...visible.entries()].sort((a, b) => a[1] - b[1])[0];
        if (first) setReading(first[0]);
      },
      { rootMargin: "-80px 0px -55% 0px" },
    );
    root.querySelectorAll("[data-id]").forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, [kind, book]);

  const fig = shown?.principle?.figure;
  const propDiagram = shown?.prop?.annotation?.diagram;
  const joyceFig = !fig && !propDiagram ? shown?.joyce?.figures[0] : undefined;

  return (
    <div className="reading">
      <main className="text-col" ref={mainRef}>
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
          <h1 className="principles-title">{K.title}</h1>
        </header>
        <section className="euclid" aria-label={`Euclid's ${K.title.toLowerCase()}, in Heath's translation`}>
          <p className="voice-tag">
            Euclid <span>· translated by T. L. Heath, 1908</span>
          </p>
          {list[0]?.intro && <p className="principle-intro heath">{list[0].intro}</p>}
          {kind === "propositions" ? (
            <BookText list={list} select={select} onPick={pick} />
          ) : (
            principleSets(list).map(([set, group]) => (
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
            ))
          )}
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
          ) : propDiagram ? (
            <Diagram spec={propDiagram} label={`Figure for ${shown!.short}`} />
          ) : joyceFig ? (
            <Diagram joyceConfig={joyceFig.config} width={joyceFig.width} height={joyceFig.height} label={`Figure for ${shown!.label}`} compact />
          ) : null
        }
        caption={shown?.principle?.figureCaption ?? propDiagram?.caption}
        open={!!selected || stack.length > 0}
        onCloseSheet={() => navigate(`#/${book}/${kind}`, true)}
      >
        {stack.length > 0 ? (
          <PeekCard id={stack[stack.length - 1]} depth={stack.length} onBack={() => peek.back()} />
        ) : shown?.prop ? (
          <PropositionNotes item={shown} />
        ) : selected ? (
          <PrincipleNotes item={selected} />
        ) : (
          <div className="overview">
            <p className="how small">
              <strong>Read Euclid's list first.</strong>{" "}
              {kind === "propositions"
                ? "Euclid's text runs on in full on the left. The figure and notes here follow the proposition you are reading; click one to keep it here, or open it for notes step by step."
                : "Click any item for a modern paraphrase, an explanation, examples, and the propositions that use it."}
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

/** Every proposition of the book in full — enunciation, proof and Q.E.D. — to be read straight through. */
function BookText({ list, select, onPick }: { list: Item[]; select?: string; onPick: (id: string) => (e: React.MouseEvent) => void }) {
  const settings = useSettings();
  const refs = settings.heathRefs ? "inline" : "hide";
  return (
    <div className="book-text prose">
      {list.map((it) => {
        const h = it.prop!.heath;
        return (
          <article
            key={it.id}
            data-id={it.id}
            id={it.id}
            className={`prop-full${it.id === select ? " selected" : ""}`}
            onClick={onPick(it.id)}
          >
            <h2 className="prop-full-head">
              <span>{it.label}</span>
              <a className="btn-quiet small" href={hrefFor(it.id)}>
                {isAnnotated(it.id) ? "Step by step, with notes →" : "Open →"}
              </a>
            </h2>
            <p className="enunciation">
              <Heath src={h.enunciation} refs={refs} />
            </p>
            {h.proof.map((para, i) => (
              <p key={i}>
                <Heath src={para} refs={refs} />
              </p>
            ))}
            {h.porism && (
              <p className="porism">
                <Heath src={h.porism} refs={refs} />
              </p>
            )}
            {h.qed && (
              <p className="qed">
                <Heath src={h.qed} refs={refs} />
              </p>
            )}
          </article>
        );
      })}
    </div>
  );
}

function PropositionNotes({ item }: { item: Item }) {
  const ann = item.prop!.annotation;
  return (
    <div className="step-notes">
      <div className="panel-head">
        <span className="kicker">
          {item.label} · {item.prop!.kind === "problem" ? "Problem" : "Theorem"}
        </span>
      </div>
      {ann ? (
        <>
          <section className="voice-note">
            <span className="voice-label">In modern terms</span>
            <Rich md={ann.paraphrase} />
          </section>
          {ann.commentary && (
            <section className="voice-note">
              <span className="voice-label">Explanation</span>
              <Rich md={ann.commentary} />
            </section>
          )}
        </>
      ) : (
        <p className="muted small">This edition's notes for {item.short} have not been written yet; Joyce's guide is on its page.</p>
      )}
      <a className="btn" href={hrefFor(item.id)}>
        Read the proof{ann ? ", step by step" : ""} →
      </a>
      <section className="deps">
        <h4>Uses</h4>
        <RefGroups ids={item.uses} heath={item.usesHeath} />
        <h4>Used by</h4>
        <RefGroups ids={item.usedBy} />
      </section>
    </div>
  );
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
