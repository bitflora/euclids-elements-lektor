import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { peek, usePeek } from "../lib/peek";
import { navigate, hrefFor, shouldReveal } from "../lib/router";
import { useSettings } from "../lib/store";
import { getSection, partInfo, workOf, type Work } from "../lib/works";
import type { Voice, WorkSection, WorkStep } from "../types";
import { Diagram } from "../components/Diagram";
import { PanelShell } from "../components/Layout";
import { WorkParallels } from "../components/Parallels";
import { PeekCard, RefChip } from "../components/Refs";
import { Rich } from "../components/Rich";
import { measurementNotes } from "../lib/measurements";

/**
 * One part of a Chinese work, read straight through: the classic with its commentary
 * between the passages, each in translation with the Chinese beside it. Click a
 * passage for its notes; with nothing chosen, the figure and summary on the right
 * follow the section being read.
 */
export function WorkPage({ work, part, select, step }: { work: Work; part: number; select?: string; step?: number }) {
  const ids = work.sequence.get(part) ?? [];
  const list = ids.map((id) => getSection(id)!);
  const selected = getSection(select);
  const steps = selected?.steps ?? [];
  const stepIdx = step != null && step >= 0 && step < steps.length ? step : null;
  const [reading, setReading] = useState<string | null>(null);
  const shown = selected ?? getSection(reading) ?? list[0];
  const ann = shown?.annotation;
  const settings = useSettings();
  const stack = usePeek();
  const mainRef = useRef<HTMLElement>(null);
  const info = partInfo(work, part)!;

  const go = (id: string | null, i: number | null = null) => {
    peek.clear();
    navigate(id ? hrefFor(id, i) : `#/${work.key}/${part}`, true);
  };

  // With the commentary hidden, the keys skip it too.
  const visibleStep = (s: WorkSection, i: number) => settings.commentary || s.steps[i]?.voice === "classic";
  const nextStep = (s: WorkSection, from: number, dir: 1 | -1) => {
    for (let i = from; i >= 0 && i < s.steps.length; i += dir) if (visibleStep(s, i)) return i;
    return null;
  };

  const first = useRef(true);
  useEffect(() => {
    const reveal = shouldReveal(first.current);
    first.current = false;
    if (!select || !reveal) return;
    const sec = mainRef.current?.querySelector(`article[data-id="${select}"]`);
    const el = (stepIdx != null && sec?.querySelector(`[data-step="${stepIdx}"]`)) || sec;
    if (!el) return;
    document.fonts.ready.then(() =>
      requestAnimationFrame(() =>
        window.scrollTo({ top: window.scrollY + el.getBoundingClientRect().top - (el === sec ? 64 : window.innerHeight / 3) }),
      ),
    );
  }, [select, stepIdx]);

  useEffect(() => {
    const on = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (t.closest("input, textarea, select, [contenteditable]") || e.metaKey || e.ctrlKey) return;
      const base = select ?? reading ?? ids[0];
      const p = ids.indexOf(base);
      const sec = getSection(base)!;
      if (e.key === "j" || (e.altKey && e.key === "ArrowDown")) {
        e.preventDefault();
        const n = select !== base || stepIdx == null ? nextStep(sec, 0, 1) : nextStep(sec, stepIdx + 1, 1);
        if (n != null) go(base, n);
        else if (p < ids.length - 1) go(ids[p + 1], nextStep(getSection(ids[p + 1])!, 0, 1) ?? 0);
      } else if (e.key === "k" || (e.altKey && e.key === "ArrowUp")) {
        e.preventDefault();
        const n = select !== base || stepIdx == null ? nextStep(sec, 0, 1) : nextStep(sec, stepIdx - 1, -1);
        if (n != null) go(base, n);
        else if (p > 0) {
          const prev = getSection(ids[p - 1])!;
          go(prev.id, nextStep(prev, prev.steps.length - 1, -1) ?? 0);
        }
      } else if (e.key === "Escape") {
        if (stack.length) peek.back();
        else if (stepIdx != null) go(select!);
        else if (select) go(null);
      }
    };
    window.addEventListener("keydown", on);
    return () => window.removeEventListener("keydown", on);
  });

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
        const top = [...visible.entries()].sort((a, b) => a[1] - b[1])[0];
        if (top) setReading(top[0]);
      },
      { rootMargin: "-80px 0px -55% 0px" },
    );
    root.querySelectorAll("article[data-id]").forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, [part]);

  const onStepClick = (id: string) => (i: number) => (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest(".xref")) return;
    if (window.getSelection()?.toString()) return;
    go(id, i);
  };

  const cur = selected && stepIdx != null ? steps[stepIdx] : null;
  // Several figures: a step shows the one it names, else the last one named before it.
  const figures = ann ? [...(ann.diagram ? [ann.diagram] : []), ...(ann.figures ?? [])] : [];
  const figIdx = cur ? (steps.slice(0, stepIdx! + 1).reverse().find((s) => s.figure != null)?.figure ?? 0) : 0;
  const fig = figures[figIdx];
  const visibleNames = useMemo(() => {
    if (!fig || !settings.buildFigure || !cur) return null;
    const names = new Set(fig.given ?? []);
    const upTo = steps.slice(0, stepIdx! + 1).filter((_, i, a) => (a.slice(0, i + 1).reverse().find((x) => x.figure != null)?.figure ?? 0) === figIdx);
    for (const s of upTo) for (const n of s.adds ?? []) names.add(n);
    // Unlike Euclid's figures, a figure here with a `given` list is built up from the first step.
    if (!fig.given && !upTo.some((s) => s.adds?.length)) return null;
    return [...names];
  }, [fig, figIdx, steps, stepIdx, cur, settings.buildFigure]);

  return (
    <div className={`reading zhoubi work-${work.key}`}>
      <main className="text-col" ref={mainRef}>
        <nav className="item-nav">
          <span className="crumbs">
            <a href="#/">Contents</a> › {work.title} › {info.label}
          </span>
        </nav>
        <nav className="section-tabs" aria-label={`Parts of the ${work.short}`}>
          {work.parts.map((p) => (
            <a key={p.n} href={`#/${work.key}/${p.n}`} className={p.n === part ? "on" : ""} aria-current={p.n === part ? "page" : undefined} title={p.subject}>
              <span lang="zh-Hant">{p.name ?? p.zh}</span>
            </a>
          ))}
        </nav>
        <header className="item-head">
          <p className="kicker">
            {work.zh} · {info.label} ·{" "}
            <span lang="zh-Hant">
              {info.zh}
              {info.name && `　${info.name}`}
            </span>
          </p>
          <h1 className="principles-title">{info.subject}</h1>
        </header>
        <section className="zb-text" aria-label={`The ${work.short}, in translation`}>
          <p className="voice-tag">
            The {work.short}{" "}
            <span>
              · translated for this edition, with {Object.values(work.commentary).map((v) => v!.label).join(" and ")}
            </span>
          </p>
          <div className="book-text">
          {list.map((s) => (
            <SectionText
              key={s.id}
              work={work}
              section={s}
              selected={s.id === select}
              step={s.id === select ? stepIdx : null}
              onHead={() => go(s.id === select ? null : s.id)}
              onStep={onStepClick(s.id)}
            />
          ))}
          </div>
          <PartNav work={work} part={part} />
        </section>
      </main>

      <PanelShell
        figure={
          fig ? (
            <Diagram key={`${shown!.id}-${figIdx}`} spec={fig} highlight={cur?.highlight} visible={visibleNames} label={`Figure for ${shown!.short}`} />
          ) : null
        }
        caption={fig?.caption}
        tabs={
          shown && (
            <div className="tabs" role="tablist">
              <button role="tab" aria-selected className="on">
                Notes
              </button>
            </div>
          )
        }
        open={stepIdx != null || stack.length > 0}
        onCloseSheet={() => (select ? go(select) : undefined)}
      >
        {stack.length > 0 ? (
          <PeekCard id={stack[stack.length - 1]} depth={stack.length} onBack={() => peek.back()} />
        ) : cur ? (
          <WorkStepNotes
            section={selected!}
            step={cur}
            onPrev={nextStep(selected!, stepIdx! - 1, -1) != null ? () => go(select!, nextStep(selected!, stepIdx! - 1, -1)) : undefined}
            onNext={nextStep(selected!, stepIdx! + 1, 1) != null ? () => go(select!, nextStep(selected!, stepIdx! + 1, 1)) : undefined}
            onClose={() => go(select!)}
          />
        ) : shown ? (
          <WorkOverview section={shown} onStart={() => go(shown.id, nextStep(shown, 0, 1) ?? 0)} />
        ) : null}
      </PanelShell>
    </div>
  );
}

function PartNav({ work, part }: { work: Work; part: number }) {
  const k = work.parts.findIndex((p) => p.n === part);
  const prev = work.parts[k - 1];
  const next = work.parts[k + 1];
  return (
    <nav className="part-nav">
      {prev ? <a href={`#/${work.key}/${prev.n}`}>‹ {prev.label}</a> : <span />}
      {next ? <a href={`#/${work.key}/${next.n}`}>{next.label} ›</a> : <span />}
    </nav>
  );
}

function SectionText({
  work,
  section,
  selected,
  step,
  onHead,
  onStep,
}: {
  work: Work;
  section: WorkSection;
  selected: boolean;
  step: number | null;
  onHead: () => void;
  onStep: (i: number) => (e: React.MouseEvent) => void;
}) {
  const settings = useSettings();
  const ann = section.annotation;
  return (
    <article data-id={section.id} id={section.id} className={`prop-full zb-section${selected ? " selected" : ""}`}>
      <h2 className="prop-full-head" onClick={onHead}>
        <span>{section.label}</span>
        <span className="prop-kind">{section.short}</span>
      </h2>
      {ann && (
        <p className="editor-title" title="An editorial label: the text has no section titles">
          {ann.title}
        </p>
      )}
      {!ann && <p className="muted small">This section has not been translated yet; the Chinese is shown.</p>}
      <div className="steps">
        {section.steps.map((s, i) => {
          if (s.voice !== "classic" && !settings.commentary) return null;
          // A label where a commentator starts to speak. Zhao's separate notes on one lemma are labelled
          // each (they are separate essays, some with headings); Liu Hui's preface, in paragraphs, once.
          const prev = section.steps[i - 1];
          const firstOfPassage = i === 0 || prev.passage !== s.passage;
          const voiceStart =
            s.voice !== "classic" && firstOfPassage && (i === 0 || prev.voice !== s.voice || !!s.heading || work.key === "zhoubi");
          const vi = work.commentary[s.voice];
          return (
            <Fragment key={i}>
              {voiceStart && vi && (
                <p className={`zhao-label voice-${s.voice}`}>
                  <span lang="zh-Hant">{vi.zh}</span> {vi.label}
                  {s.heading && (
                    <>
                      {" · "}
                      <span lang="zh-Hant">{s.heading}</span>
                    </>
                  )}
                </p>
              )}
              <div
                className={`step zb-step ${s.voice}${s.voice !== "classic" ? " commentary" : ""}${selected && step === i ? " selected" : ""}`}
                data-step={i}
                onClick={onStep(i)}
                role="button"
                tabIndex={0}
                aria-pressed={selected && step === i}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && e.target === e.currentTarget) onStep(i)(e as unknown as React.MouseEvent);
                }}
              >
                <span className="step-num" aria-hidden>
                  {s.num}
                </span>
                <div className="zb-body">
                  {s.problem != null && <span className="jz-problem">Problem {s.problem}</span>}
                  {s.en && <Rich md={s.en} className="zb-en" />}
                  {(settings.chinese || !s.en) && (
                    <p className="zb-zh" lang="zh-Hant">
                      {s.source}
                    </p>
                  )}
                </div>
              </div>
            </Fragment>
          );
        })}
      </div>
    </article>
  );
}

const voiceLabel = (section: WorkSection, v: Voice) => (v === "classic" ? "The classic" : workOf(section.id)!.commentary[v]!.label);

export function WorkStepNotes({
  section,
  step,
  onPrev,
  onNext,
  onClose,
}: {
  section: WorkSection;
  step: WorkStep;
  onPrev?: () => void;
  onNext?: () => void;
  onClose: () => void;
}) {
  const measurements = measurementNotes(step.en ?? "", step.source);
  const e = step.explain ?? {};
  const hasMore = !!(e.did || e.fact || e.justification || e.follows || e.implicit);
  return (
    <div className="step-notes">
      <div className="panel-head">
        <span className="kicker">
          Step {step.num} · {voiceLabel(section, step.voice)}
        </span>
        <span className="panel-head-actions">
          <button type="button" className="btn-icon" onClick={onPrev} disabled={!onPrev} aria-label="Previous step" title="Previous step (k)">
            ‹
          </button>
          <button type="button" className="btn-icon" onClick={onNext} disabled={!onNext} aria-label="Next step" title="Next step (j)">
            ›
          </button>
          <button type="button" className="btn-icon" onClick={onClose} aria-label="Close notes" title="Close (Esc)">
            ×
          </button>
        </span>
      </div>
      {!section.annotation ? (
        <div className="voice-note">
          <p className="muted">Notes for {section.short} have not been written yet.</p>
        </div>
      ) : (
        <>
          {step.hint && (
            <section className="voice-note level-1">
              <span className="voice-label">In brief</span>
              <Rich md={step.hint} />
            </section>
          )}
          {hasMore && (
            <section className="voice-note level-2">
              <span className="voice-label">Explanation</span>
              <dl className="explain">
                {e.did && (
                  <>
                    <dt>What the text does</dt>
                    <dd><Rich md={e.did} /></dd>
                  </>
                )}
                {e.fact && (
                  <>
                    <dt>The mathematics</dt>
                    <dd><Rich md={e.fact} /></dd>
                  </>
                )}
                {e.justification && (
                  <>
                    <dt>What it rests on</dt>
                    <dd><Rich md={e.justification} /></dd>
                  </>
                )}
                {e.follows && (
                  <>
                    <dt>Why it works</dt>
                    <dd><Rich md={e.follows} /></dd>
                  </>
                )}
                {e.implicit && (
                  <>
                    <dt>Left unsaid</dt>
                    <dd><Rich md={e.implicit} /></dd>
                  </>
                )}
              </dl>
            </section>
          )}
          {step.modern && (
            <section className="voice-modern">
              <span className="voice-label">In modern notation</span>
              <Rich md={step.modern} />
            </section>
          )}
          {step.dispute && (
            <details className="flag flag-dispute" key={`d-${step.index}`}>
              <summary>The text or its reading is in doubt</summary>
              <Rich md={step.dispute} />
            </details>
          )}
          {step.cites?.length ? (
            <div className="relies">
              <span className="small muted">Compare</span>{" "}
              {step.cites.map((r) => (
                <RefChip key={r} id={r} />
              ))}
            </div>
          ) : null}
        </>
      )}
      {measurements.length > 0 && (
        <section className="voice-note">
          <span className="voice-label">Metric equivalents</span>
          <Rich md={measurements.map((note) => `- ${note}`).join("\n")} />
          <p className="small muted">
            Approximate Han-era scales; standards varied with period and place. Conversions use the quantities written in this passage.
            {" "}<a href="https://www.sciengine.com/doi/pdf/1BF271281C954C2DBBBC75A73A65D8E6">Source for the base scales</a>.
          </p>
        </section>
      )}
      {(step.sbck || step.sbckOnly) && (
        <p className="small muted text-note">
          {step.sbckOnly ? (
            <>This passage is in the Sibu Congkan edition but not in the Gutenberg text.</>
          ) : (
            <>
              The Sibu Congkan edition reads <span lang="zh-Hant">{step.sbck}</span>.
            </>
          )}
        </p>
      )}
    </div>
  );
}

function WorkOverview({ section, onStart }: { section: WorkSection; onStart: () => void }) {
  const ann = section.annotation;
  const work = workOf(section.id)!;
  return (
    <div className="overview">
      <div className="panel-head">
        <span className="kicker">
          {work.short} · {partInfo(work, section.part)?.label} · {section.label}
        </span>
      </div>
      {ann ? (
        <>
          <section className="voice-note">
            <span className="voice-label">In brief</span>
            <Rich md={ann.paraphrase} />
          </section>
          <p className="how small">
            <strong>Read the text first.</strong> Click a passage for its notes here. The commentary, set in from the
            margin, can be hidden from the <b>Aa</b> menu. Keys: <kbd>j</kbd>/<kbd>k</kbd> step, <kbd>Esc</kbd> close.
          </p>
          <button type="button" className="btn" onClick={onStart}>
            Start with the first passage
          </button>
          <WorkParallels section={section} />
          <div className="apparatus">
            {ann.commentary && (
              <details className="app-sec">
                <summary>Commentary</summary>
                <Rich md={ann.commentary} />
              </details>
            )}
            {ann.historical && (
              <details className="app-sec">
                <summary>Historical notes</summary>
                <Rich md={ann.historical} />
              </details>
            )}
          </div>
        </>
      ) : (
        <p className="muted small">This section has not been translated yet.</p>
      )}
    </div>
  );
}

