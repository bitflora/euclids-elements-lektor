import { ROMAN, availableBooks } from "../content/books";
import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { hrefFor, navigate } from "../lib/router";
import { peek, usePeek } from "../lib/peek";
import { useSettings } from "../lib/store";
import { refLabel } from "../lib/rich";
import type { Item, Step } from "../types";
import { Diagram } from "../components/Diagram";
import { Heath, Joyce, Rich } from "../components/Rich";
import { PeekCard, RefGroups } from "../components/Refs";
import { LevelSwitch, StepNotes, partLabel } from "../components/StepNotes";
import { Tutor } from "../components/Tutor";
import { ItemNav, PanelShell } from "../components/Layout";

export function PropositionPage({ item, stepIndex }: { item: Item; stepIndex?: number }) {
  const prop = item.prop!;
  const ann = prop.annotation;
  const steps = prop.steps;
  const settings = useSettings();
  const selected = stepIndex != null && stepIndex >= 0 && stepIndex < steps.length ? stepIndex : null;
  const step = selected != null ? steps[selected] : null;
  const [tab, setTab] = useState<"notes" | "tutor">("notes");
  const [seed, setSeed] = useState<{ text: string; nonce: number } | null>(null);
  const stack = usePeek();
  const textRef = useRef<HTMLDivElement>(null);

  const select = (i: number | null, replace = true) => {
    peek.clear();
    navigate(hrefFor(item.id, i), replace);
  };

  // Keyboard: j / k (or ↓ / ↑ with Alt) to walk the steps, Esc to close.
  useEffect(() => {
    const on = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (t.closest("input, textarea, select, [contenteditable]") || e.metaKey || e.ctrlKey) return;
      if (e.key === "j" || (e.altKey && e.key === "ArrowDown")) {
        e.preventDefault();
        select(selected == null ? 0 : Math.min(steps.length - 1, selected + 1));
      } else if (e.key === "k" || (e.altKey && e.key === "ArrowUp")) {
        e.preventDefault();
        select(selected == null ? 0 : Math.max(0, selected - 1));
      } else if (e.key === "Escape") {
        if (stack.length) peek.back();
        else if (selected != null) select(null);
      }
    };
    window.addEventListener("keydown", on);
    return () => window.removeEventListener("keydown", on);
  });

  // Keep the selected step in view.
  useEffect(() => {
    if (selected == null) return;
    const el = textRef.current?.querySelector(`[data-step="${selected}"]`);
    if (el) {
      const r = el.getBoundingClientRect();
      if (r.top < 80 || r.bottom > window.innerHeight - 40) el.scrollIntoView({ block: "center", behavior: "smooth" });
    }
  }, [selected]);

  // The figure as it stands at the selected step.
  const visible = useMemo(() => {
    if (!ann || !settings.buildFigure || selected == null) return null;
    const names = new Set(ann.diagram.given ?? []);
    for (const s of steps.slice(0, selected + 1)) for (const n of s.adds ?? []) names.add(n);
    // Nothing added yet (enunciation): show the finished figure.
    if (!steps.slice(0, selected + 1).some((s) => s.adds?.length)) return null;
    return [...names];
  }, [ann, steps, selected, settings.buildFigure]);

  const joyceFig = !ann ? item.joyce?.figures[0] : undefined;

  const onStepClick = (i: number) => (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest(".xref")) return;
    if (window.getSelection()?.toString()) return; // reader is selecting text
    setTab("notes");
    select(selected === i ? null : i);
  };

  return (
    <div className="reading">
      <main className="text-col" ref={textRef}>
        <ItemNav item={item} />
        <header className="item-head">
          <p className="kicker">
            Book {ROMAN[item.book]} · Proposition {item.n} · {prop.kind === "problem" ? "Problem" : "Theorem"}
          </p>
          {ann && <p className="editor-title" title="An editorial label: Euclid's propositions have no titles">{ann.title}</p>}
        </header>

        <section className="euclid" aria-label="Euclid's text, in Heath's translation">
          <p className="voice-tag">
            Euclid <span>· translated by T. L. Heath, 1908</span>
          </p>

          {settings.view === "steps" ? (
            <StepsView steps={steps} selected={selected} onClick={onStepClick} heathRefs={settings.heathRefs} annotated={!!ann} />
          ) : (
            <ProseView steps={steps} selected={selected} onClick={onStepClick} heathRefs={settings.heathRefs} />
          )}
          {prop.heath.porism && (
            <div className="porism">
              <Heath src={prop.heath.porism} as="p" />
            </div>
          )}
        </section>

        {!ann && (
          <p className="notice">
            Heath's text and Joyce's guide are here, but this edition's step-by-step notes for {item.short} have not been
            written yet. Annotated so far: all of {availableBooks()}.
          </p>
        )}

        <Apparatus item={item} />
        <ItemNav item={item} bottom />
      </main>

      <PanelShell
        figure={
          ann ? (
            <Diagram spec={ann.diagram} highlight={step?.highlight} visible={visible} label={`Figure for ${item.short}`} />
          ) : joyceFig ? (
            <Diagram joyceConfig={joyceFig.config} width={joyceFig.width} height={joyceFig.height} label={`Joyce's figure for ${item.short}`} />
          ) : null
        }
        caption={ann?.diagram.caption}
        tabs={
          <div className="tabs" role="tablist">
            <button role="tab" aria-selected={tab === "notes"} className={tab === "notes" ? "on" : ""} onClick={() => setTab("notes")}>
              Notes
            </button>
            <button role="tab" aria-selected={tab === "tutor"} className={tab === "tutor" ? "on" : ""} onClick={() => setTab("tutor")}>
              Tutor
            </button>
            <span className="tabs-spacer" />
            <LevelSwitch />
          </div>
        }
        open={selected != null || stack.length > 0 || tab === "tutor"}
        onCloseSheet={() => select(null)}
      >
        {stack.length > 0 ? (
          <PeekCard id={stack[stack.length - 1]} depth={stack.length} onBack={() => peek.back()} />
        ) : tab === "tutor" ? (
          <Tutor item={item} seed={seed} onFocusStep={(i) => i != null && navigate(hrefFor(item.id, i), true)} />
        ) : step ? (
          <StepNotes
            item={item}
            step={step}
            onPrev={selected! > 0 ? () => select(selected! - 1) : undefined}
            onNext={selected! < steps.length - 1 ? () => select(selected! + 1) : undefined}
            onClose={() => select(null)}
            onAskTutor={() => {
              setSeed({ text: step.number != null ? `I don't understand step ${step.number}` : "overview", nonce: Date.now() });
              setTab("tutor");
            }}
          />
        ) : (
          <Overview item={item} onStart={() => select(0)} />
        )}
      </PanelShell>
    </div>
  );
}

function StepsView({
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

function ProseView({
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

function Overview({ item, onStart }: { item: Item; onStart: () => void }) {
  const ann = item.prop?.annotation;
  return (
    <div className="overview">
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
        <p className="muted small">Point at a lettered name in the text to find it in Joyce's figure.</p>
      )}
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
    </div>
  );
}

function Apparatus({ item }: { item: Item }) {
  const ann = item.prop?.annotation;
  const j = item.joyce;
  return (
    <div className="apparatus">
      <h2 className="apparatus-title">Notes and commentary</h2>
      {ann && (
        <details className="app-sec">
          <summary>
            Modern reconstruction <span className="tag tag-modern">Level 3 · not Euclid</span>
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
      {(j?.guide || j?.groupGuide) && (
        <details className="app-sec">
          <summary>
            Joyce's guide <span className="tag">D. E. Joyce</span>
          </summary>
          <Joyce md={j.guide ?? j.groupGuide} figures={j.figures} />
        </details>
      )}
      {j?.statement && (
        <details className="app-sec">
          <summary>
            Another translation <span className="tag">D. E. Joyce</span>
          </summary>
          <p className="small muted">Joyce's own translation, for comparison with Heath's.</p>
          <Joyce md={`**${j.statement}**\n\n${(j.proof ?? "").replace(/<div class="joyce-fig"[^>]*><\/div>/g, "")}`} figures={[]} />
        </details>
      )}
    </div>
  );
}
