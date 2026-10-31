import type { Item, Step } from "../types";
import { JoyceLink, Rich } from "./Rich";
import { RefChip } from "./Refs";

const PART_LABEL: Record<Step["part"], string> = {
  enunciation: "Enunciation",
  "setting-out": "Setting-out",
  specification: "Specification",
  construction: "Construction",
  proof: "Proof",
  conclusion: "Conclusion",
  porism: "Porism",
  lemma: "Lemma",
};

export const partLabel = (p: Step["part"]) => PART_LABEL[p];

export function StepNotes({
  item,
  step,
  onPrev,
  onNext,
  onClose,
}: {
  item: Item;
  step: Step;
  onPrev?: () => void;
  onNext?: () => void;
  onClose: () => void;
}) {
  const ann = item.prop?.annotation;
  const e = step.explain ?? {};
  const refs = [...new Set([...step.heathRefs, ...(step.cites ?? [])])];
  const recon = ann?.reconstruction.lines.filter((l) => step.number != null && l.steps?.includes(step.number)) ?? [];
  const hasMore = !!(e.did || e.fact || e.justification || e.follows || e.implicit);

  return (
    <div className="step-notes">
      <div className="panel-head">
        <span className="kicker">
          {step.number != null ? `Step ${step.number} · ` : ""}
          {partLabel(step.part)}
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

      {!ann ? (
        <div className="voice-note">
          <p className="muted">
            Step-by-step notes for {item.short} have not been written yet. Hover the lettered names to find them in the
            figure.
          </p>
        </div>
      ) : (
        <>
          <section className="voice-note level-1">
            <span className="voice-label">Why?</span>
            <Rich md={step.hint} />
          </section>

          {hasMore && (
            <section className="voice-note level-2">
              <span className="voice-label">Explanation</span>
              <dl className="explain">
                {e.did && (
                  <>
                    <dt>What Euclid does</dt>
                    <dd><Rich md={e.did} /></dd>
                  </>
                )}
                {e.fact && (
                  <>
                    <dt>The geometric fact</dt>
                    <dd><Rich md={e.fact} /></dd>
                  </>
                )}
                {e.justification && (
                  <>
                    <dt>What justifies it</dt>
                    <dd><Rich md={e.justification} /></dd>
                  </>
                )}
                {e.follows && (
                  <>
                    <dt>Why it follows</dt>
                    <dd><Rich md={e.follows} /></dd>
                  </>
                )}
                {e.implicit && (
                  <>
                    <dt>Left implicit</dt>
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

          {step.gap && (
            <details className="flag flag-gap" key={`g-${step.index}`}>
              <summary>A gap by modern standards</summary>
              <Rich md={step.gap} />
            </details>
          )}
          {step.dispute && (
            <details className="flag flag-dispute" key={`d-${step.index}`}>
              <summary>Scholars disagree</summary>
              <Rich md={step.dispute} />
            </details>
          )}

          {refs.length > 0 && (
            <div className="relies">
              <span className="small muted">Relies on</span>{" "}
              {refs.map((r) => (
                <RefChip key={r} id={r} heath={step.heathRefs.includes(r)} />
              ))}
            </div>
          )}

          {recon.length > 0 && (
            <section className="voice-modern">
              <span className="voice-label">Modern reconstruction — not Euclid's argument</span>
              {recon.map((l, i) => (
                <Rich key={i} md={l.text} />
              ))}
            </section>
          )}
        </>
      )}

      <JoyceLink item={item} />
    </div>
  );
}
