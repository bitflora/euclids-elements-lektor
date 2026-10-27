import { useEffect, useMemo, useRef, useState } from "react";
import { getItem, sequence } from "../lib/corpus";
import { useSettings } from "../lib/store";
import { navigate, hrefFor } from "../lib/router";
import { peek, usePeek } from "../lib/peek";
import { bookOf } from "../content/books";
import type { Item } from "../types";
import { Diagram } from "../components/Diagram";
import { Heath } from "../components/Rich";
import { PeekCard } from "../components/Refs";
import { PanelShell } from "../components/Layout";
import { LevelSwitch, StepNotes } from "../components/StepNotes";
import { Tutor } from "../components/Tutor";
import { Overview, ProseView, StepsView } from "../components/Proposition";
import { KINDS, SectionHead } from "./PrinciplesPage";

/**
 * A book's propositions in full, read straight through, each laid out step by step.
 * Click a sentence for its notes; with nothing chosen, the figure and summary on the
 * right follow the proposition being read.
 */
export function PropositionsPage({ book, select, step }: { book: string; select?: string; step?: number }) {
  const ids = (sequence.get(bookOf(book)) ?? []).filter(KINDS.propositions.test);
  const list = ids.map((id) => getItem(id)!);
  const selected = getItem(select);
  const steps = selected?.prop?.steps ?? [];
  const stepIdx = step != null && step >= 0 && step < steps.length ? step : null;
  const [reading, setReading] = useState<string | null>(null);
  const shown = selected ?? getItem(reading);
  const ann = shown?.prop?.annotation;
  const settings = useSettings();
  const [tab, setTab] = useState<"notes" | "tutor">("notes");
  const [seed, setSeed] = useState<{ text: string; nonce: number } | null>(null);
  const stack = usePeek();
  const mainRef = useRef<HTMLElement>(null);

  const go = (id: string | null, i: number | null = null) => {
    peek.clear();
    navigate(id ? hrefFor(id, i) : `#/${book}/propositions`, true);
  };

  // Keyboard: j / k (or ↓ / ↑ with Alt) walk the steps, running on into the next
  // proposition; Esc closes a reference, then the step, then the proposition.
  useEffect(() => {
    const on = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (t.closest("input, textarea, select, [contenteditable]") || e.metaKey || e.ctrlKey) return;
      const base = select ?? reading ?? ids[0];
      const p = ids.indexOf(base);
      const n = getItem(base)?.prop?.steps.length ?? 0;
      if (e.key === "j" || (e.altKey && e.key === "ArrowDown")) {
        e.preventDefault();
        if (select !== base || stepIdx == null) go(base, 0);
        else if (stepIdx < n - 1) go(base, stepIdx + 1);
        else if (p < ids.length - 1) go(ids[p + 1], 0);
      } else if (e.key === "k" || (e.altKey && e.key === "ArrowUp")) {
        e.preventDefault();
        if (select !== base || stepIdx == null) go(base, 0);
        else if (stepIdx > 0) go(base, stepIdx - 1);
        else if (p > 0) go(ids[p - 1], getItem(ids[p - 1])!.prop!.steps.length - 1);
      } else if (e.key === "Escape") {
        if (stack.length) peek.back();
        else if (stepIdx != null) go(select!);
        else if (select) go(null);
      }
    };
    window.addEventListener("keydown", on);
    return () => window.removeEventListener("keydown", on);
  });

  // Track the proposition at the top of the reading column.
  useEffect(() => {
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
    root.querySelectorAll("article[data-id]").forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, [book]);

  const onStepClick = (id: string) => (i: number) => (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest(".xref")) return;
    if (window.getSelection()?.toString()) return; // reader is selecting text
    setTab("notes");
    go(id, i);
  };

  // The figure as it stands at the selected step.
  const cur = selected && stepIdx != null ? steps[stepIdx] : null;
  const visibleNames = useMemo(() => {
    if (!ann || !settings.buildFigure || !cur) return null;
    const names = new Set(ann.diagram.given ?? []);
    for (const s of steps.slice(0, stepIdx! + 1)) for (const n of s.adds ?? []) names.add(n);
    // Nothing added yet (enunciation): show the finished figure.
    if (!steps.slice(0, stepIdx! + 1).some((s) => s.adds?.length)) return null;
    return [...names];
  }, [ann, steps, stepIdx, cur, settings.buildFigure]);

  const joyceFig = shown && !ann ? shown.joyce?.figures[0] : undefined;

  return (
    <div className="reading">
      <main className="text-col" ref={mainRef}>
        <SectionHead book={book} kind="propositions" />
        <section className="euclid" aria-label="Euclid's propositions, in Heath's translation">
          <p className="voice-tag">
            Euclid <span>· translated by T. L. Heath, 1908</span>
          </p>
          {list[0]?.intro && <p className="principle-intro heath">{list[0].intro}</p>}
          <div className="book-text">
            {list.map((it) => (
              <PropositionText
                key={it.id}
                item={it}
                selected={it.id === select}
                step={it.id === select ? stepIdx : null}
                onHead={() => go(it.id === select ? null : it.id)}
                onStep={onStepClick(it.id)}
              />
            ))}
          </div>
        </section>
      </main>

      <PanelShell
        figure={
          ann ? (
            <Diagram
              key={shown!.id}
              spec={ann.diagram}
              highlight={cur?.highlight}
              visible={visibleNames}
              label={`Figure for ${shown!.short}`}
            />
          ) : joyceFig ? (
            <Diagram joyceConfig={joyceFig.config} width={joyceFig.width} height={joyceFig.height} label={`Joyce's figure for ${shown!.short}`} />
          ) : null
        }
        caption={ann?.diagram.caption}
        tabs={
          shown && (
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
          )
        }
        open={stepIdx != null || stack.length > 0 || tab === "tutor"}
        onCloseSheet={() => (select ? go(select) : undefined)}
      >
        {stack.length > 0 ? (
          <PeekCard id={stack[stack.length - 1]} depth={stack.length} onBack={() => peek.back()} />
        ) : shown && tab === "tutor" ? (
          <Tutor key={shown.id} item={shown} seed={seed} onFocusStep={(i) => i != null && go(shown.id, i)} />
        ) : cur ? (
          <StepNotes
            item={selected!}
            step={cur}
            onPrev={stepIdx! > 0 ? () => go(select!, stepIdx! - 1) : undefined}
            onNext={stepIdx! < steps.length - 1 ? () => go(select!, stepIdx! + 1) : undefined}
            onClose={() => go(select!)}
            onAskTutor={() => {
              setSeed({ text: cur.number != null ? `I don't understand step ${cur.number}` : "overview", nonce: Date.now() });
              setTab("tutor");
            }}
          />
        ) : shown ? (
          <Overview item={shown} onStart={() => go(shown.id, 0)} />
        ) : (
          <div className="overview">
            <p className="how small">
              <strong>Read Euclid first.</strong> Every proposition of the book runs on in full on the left. The figure and
              notes here follow the proposition you are reading; click any sentence for an explanation of that step.
            </p>
          </div>
        )}
      </PanelShell>
    </div>
  );
}

function PropositionText({
  item,
  selected,
  step,
  onHead,
  onStep,
}: {
  item: Item;
  selected: boolean;
  step: number | null;
  onHead: () => void;
  onStep: (i: number) => (e: React.MouseEvent) => void;
}) {
  const settings = useSettings();
  const prop = item.prop!;
  const ann = prop.annotation;
  return (
    <article data-id={item.id} id={item.id} className={`prop-full${selected ? " selected" : ""}`}>
      <h2 className="prop-full-head" onClick={onHead}>
        <span>{item.label}</span>
        <span className="prop-kind">{prop.kind === "problem" ? "Problem" : "Theorem"}</span>
      </h2>
      {ann && (
        <p className="editor-title" title="An editorial label: Euclid's propositions have no titles">
          {ann.title}
        </p>
      )}
      {settings.view === "steps" ? (
        <StepsView steps={prop.steps} selected={step} onClick={onStep} heathRefs={settings.heathRefs} annotated={!!ann} />
      ) : (
        <ProseView steps={prop.steps} selected={step} onClick={onStep} heathRefs={settings.heathRefs} />
      )}
      {prop.heath.porism && (
        <div className="porism">
          <Heath src={prop.heath.porism} as="p" />
        </div>
      )}
    </article>
  );
}
