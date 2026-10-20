import { useEffect, useRef, useState } from "react";
import { initialTutor, respond, type TutorState } from "../lib/tutor";
import type { Item } from "../types";
import { Rich } from "./Rich";

// Conversations survive switching tabs or pages during a visit.
const sessions = new Map<string, TutorState>();

export function Tutor({
  item,
  seed,
  onFocusStep,
}: {
  item: Item;
  /** A question to ask on open (e.g. from "Ask the tutor about step 5"). */
  seed?: { text: string; nonce: number } | null;
  onFocusStep: (index: number | null) => void;
}) {
  const [state, setState] = useState<TutorState>(() => sessions.get(item.id) ?? initialTutor());
  const [input, setInput] = useState("");
  const logRef = useRef<HTMLDivElement>(null);
  const seen = useRef<number | null>(null);

  useEffect(() => setState(sessions.get(item.id) ?? initialTutor()), [item.id]);

  const latest = useRef(state);
  latest.current = state;

  const ask = (text: string) => {
    if (!text.trim()) return;
    const next = respond(item, latest.current, text);
    latest.current = next;
    sessions.set(item.id, next);
    setState(next);
    if (next.focus != null) onFocusStep(next.focus);
    setInput("");
  };

  useEffect(() => {
    if (seed && seed.nonce !== seen.current) {
      seen.current = seed.nonce;
      ask(seed.text);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seed]);

  useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight, behavior: "smooth" });
  }, [state.log.length]);

  const annotated = !!item.prop?.annotation;
  const chips = state.focus == null ? ["Overview", "I don't understand step 1", "Show the whole proof"] : ["Why?", "Next step", "Show the whole proof"];

  return (
    <div className="tutor">
      <p className="tutor-disclaimer small muted">
        A scripted tutor, not an AI model. It answers from this edition's notes, one step at a time, and goes a level
        deeper each time you ask “why?”.
      </p>
      <div className="tutor-log" ref={logRef} aria-live="polite">
        {state.log.length === 0 && (
          <div className="tutor-msg tutor">
            <Rich
              md={
                annotated
                  ? "Which step is confusing you? Type *I don't understand step 5*, or click a sentence of Euclid and press **Still confused?**"
                  : "Notes for this proposition haven't been written yet, so I can't help much here."
              }
            />
          </div>
        )}
        {state.log.map((m, i) => (
          <div key={i} className={`tutor-msg ${m.from}`}>
            {m.from === "reader" ? <p>{m.md}</p> : <Rich md={m.md} />}
          </div>
        ))}
      </div>
      <div className="tutor-chips">
        {chips.map((c) => (
          <button key={c} type="button" className="chip-btn" onClick={() => ask(c)}>
            {c}
          </button>
        ))}
      </div>
      <form
        className="tutor-input"
        onSubmit={(e) => {
          e.preventDefault();
          ask(input);
        }}
      >
        <input value={input} onChange={(e) => setInput(e.target.value)} placeholder="Ask about a step…" aria-label="Ask the tutor" />
        <button type="submit" className="btn">
          Ask
        </button>
      </form>
    </div>
  );
}
