import { Fragment } from "react";
import { refLabel } from "../lib/rich";
import type { Item, Step } from "../types";
import { Heath, JoyceLink, Rich } from "./Rich";
import { RefGroups } from "./Refs";
import { partLabel } from "./StepNotes";

export function StepsView({
  steps,
  selected,
  onClick,
  heathRefs,
  annotated,
}: {
  steps: Step[];
  selected: number | null;
  onClick: (i: number) => (e: React.MouseEvent) => void;
  heathRefs: boolean;
  annotated: boolean;
}) {
  return (
    <div className="steps">
      {steps.map((s, i) => {
        const newPart = i === 0 || steps[i - 1].part !== s.part;
        const isEnun = s.part === "enunciation";
        return (
          <Fragment key={i}>
            {newPart && !isEnun && annotated && !s.isQed && (
              <h3 className="part-label" title={PART_TITLES[s.part]}>
                {partLabel(s.part)}
              </h3>
            )}
            <div
              className={`step${isEnun ? " enunciation" : ""}${s.isQed ? " qed" : ""}${selected === i ? " selected" : ""}`}
              data-step={i}
              onClick={onClick(i)}
              role="button"
              tabIndex={0}
              aria-pressed={selected === i}
              onKeyDown={(e) => {
                if (e.key === "Enter" && e.target === e.currentTarget) onClick(i)(e as unknown as React.MouseEvent);
              }}
            >
              <span className="step-num" aria-hidden>
                {s.number ?? ""}
              </span>
              <Heath src={s.source} refs={heathRefs ? "inline" : "hide"} as="span" />
            </div>
          </Fragment>
        );
      })}
    </div>
  );
}

export function ProseView({
  steps,
  selected,
  onClick,
  heathRefs,
}: {
  steps: Step[];
  selected: number | null;
  onClick: (i: number) => (e: React.MouseEvent) => void;
  heathRefs: boolean;
}) {
  const paras: Step[][] = [];
  for (const s of steps) (paras[s.para] ??= []).push(s);
  return (
    <div className="prose">
      {paras.map((ps, p) => (
        <p key={p} className={p === 0 ? "enunciation" : ps[0].isQed ? "qed" : ""}>
          {ps.map((s) => (
            <Fragment key={s.index}>
              <span className={`step-inline${selected === s.index ? " selected" : ""}`} data-step={s.index} onClick={onClick(s.index)} role="button" tabIndex={0}>
                {s.number != null && <sup className="step-sup">{s.number}</sup>}
                <Heath src={s.source} refs={heathRefs ? "inline" : "hide"} />
              </span>{" "}
            </Fragment>
          ))}
        </p>
      ))}
    </div>
  );
}

const PART_TITLES: Record<Step["part"], string> = {
  enunciation: "πρότασις — the general statement",
  "setting-out": "ἔκθεσις — the data, lettered",
  specification: "διορισμός — what is to be done or proved, for the lettered figure",
  construction: "κατασκευή — what must be added to the figure",
  proof: "ἀπόδειξις — the reasoning",
  conclusion: "συμπέρασμα — the enunciation reasserted",
  porism: "πόρισμα — a corollary, got for free from the proof",
  lemma: "λῆμμα — an auxiliary result proved on the spot",
};

/** A proposition's summary, in the panel while no step is chosen. */
export function Overview({ item, onStart }: { item: Item; onStart: () => void }) {
  const ann = item.prop?.annotation;
  return (
    <div className="overview">
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
          <p className="how small">
            <strong>Read Euclid first.</strong> When a sentence puzzles you, click it for an
            explanation here. Point at any lettered name to find it in the figure. Keys: <kbd>j</kbd>/<kbd>k</kbd> step,{" "}
            <kbd>Esc</kbd> close.
          </p>
          <button type="button" className="btn" onClick={onStart}>
            Start with the enunciation
          </button>
        </>
      ) : (
        <p className="muted small">Point at a lettered name in the text to find it in the figure.</p>
      )}
      <JoyceLink item={item} />
      <section className="deps">
        <h4>Uses</h4>
        <RefGroups ids={item.uses} heath={item.usesHeath} />
        <p className="small muted legend">
          <span className="chip chip-heath">solid</span> cited by Heath · <span className="chip">outline</span> used, per this edition
        </p>
        <h4>Used by</h4>
        <RefGroups ids={item.usedBy} />
        <p className="small">
          <a href={`#/graph?focus=${encodeURIComponent(item.id)}`}>See {refLabel(item.id)} in the dependency graph →</a>
        </p>
      </section>
      <Apparatus item={item} />
    </div>
  );
}

export function Apparatus({ item }: { item: Item }) {
  const ann = item.prop?.annotation;
  return (
    <div className="apparatus">
      <h2 className="apparatus-title">Notes and commentary</h2>
      {ann && (
        <details className="app-sec">
          <summary>
            Modern reconstruction <span className="tag tag-modern">not Euclid</span>
          </summary>
          <Rich md={ann.reconstruction.preamble} />
          <ol className="recon">
            {ann.reconstruction.lines.map((l, i) => (
              <li key={i}>
                <Rich md={l.text} />
                {l.steps?.length ? <span className="recon-steps">Euclid, step{l.steps.length > 1 ? "s" : ""} {l.steps.join(", ")}</span> : null}
              </li>
            ))}
          </ol>
          <Rich md={ann.reconstruction.closing} />
        </details>
      )}
      {ann?.gaps && (
        <details className="app-sec">
          <summary>Logical gaps by modern standards</summary>
          <Rich md={ann.gaps} />
        </details>
      )}
      {ann?.interpretations && (
        <details className="app-sec">
          <summary>Where interpretations differ</summary>
          <Rich md={ann.interpretations} />
        </details>
      )}
      {ann?.commentary && (
        <details className="app-sec">
          <summary>Commentary</summary>
          <Rich md={ann.commentary} />
        </details>
      )}
      {ann?.historical && (
        <details className="app-sec">
          <summary>Historical notes</summary>
          <Rich md={ann.historical} />
        </details>
      )}
      {item.heathNotes.length > 0 && (
        <details className="app-sec">
          <summary>
            Heath's notes <span className="tag">T. L. Heath, 1908</span>
          </summary>
          <p className="small muted">
            Heath's textual notes on the Greek. The numbers are line numbers of the Greek text, not steps.
          </p>
          {item.heathNotes.map((n, i) => (
            <div key={i} className="heath-note">
              <p className="lemma">{n.lemma}</p>
              <Heath src={n.text} as="p" />
            </div>
          ))}
        </details>
      )}
    </div>
  );
}
