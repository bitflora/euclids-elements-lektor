// The tutor. It is scripted, not an AI model: every answer is assembled from
// this edition's annotations, one rung at a time, so that asking "why?" again
// goes one level deeper into a single step instead of dumping the whole proof.

import { getItem, resolveQuery } from "./corpus";
import { refLabel } from "./rich";
import { availableBooks } from "../content/books";
import type { Item, Step } from "../types";

export interface TutorMsg {
  from: "reader" | "tutor";
  md: string;
  /** Step the message is about (index into prop.steps). */
  step?: number;
}

export interface TutorState {
  focus: number | null; // step index
  rung: number;
  log: TutorMsg[];
}

export const initialTutor = (): TutorState => ({ focus: null, rung: 0, log: [] });

const stepName = (s: Step) => (s.number != null ? `step ${s.number}` : s.part === "enunciation" ? "the enunciation" : "the closing formula");

function refStatement(id: string): string {
  const it = getItem(id);
  if (!it) return `- **${refLabel(id)}** (not yet in this companion)`;
  const words = it.text.replace(/\[\[[^\]]*\]\]/g, "").replace(/[{}_]/g, "");
  return `- [[${id}]] — “${words.trim()}”`;
}

/** The ladder of explanations for one step, most basic first. Empty rungs are skipped. */
export function rungs(item: Item, s: Step): string[] {
  const e = s.explain ?? {};
  const refs = [...new Set([...s.heathRefs, ...(s.cites ?? [])])];
  const recon = item.prop?.annotation?.reconstruction.lines.filter((l) => s.number != null && l.steps?.includes(s.number)) ?? [];
  const out = [
    `Let's look at **${stepName(s)}** only — it's highlighted in the text, and the objects it's about are lit in the figure.\n\n${s.hint ?? ""}`,
    [e.did && `**What Euclid does.** ${e.did}`, e.fact && `**The geometric fact.** ${e.fact}`].filter(Boolean).join("\n\n"),
    [
      e.justification && `**What justifies it.** ${e.justification}`,
      refs.length ? `Here is exactly what ${refs.length > 1 ? "those say" : "that says"}:\n\n${refs.map(refStatement).join("\n")}` : "",
    ]
      .filter(Boolean)
      .join("\n\n"),
    [e.follows && `**Why the conclusion follows.** ${e.follows}`, e.implicit && `**What Euclid leaves unsaid.** ${e.implicit}`]
      .filter(Boolean)
      .join("\n\n"),
    s.modern ? `**In modern notation** (a modern rendering, not Euclid's):\n\n${s.modern}` : "",
    [s.gap && `**A gap by modern standards.** ${s.gap}`, s.dispute && `**Where scholars disagree.** ${s.dispute}`].filter(Boolean).join("\n\n"),
    recon.length
      ? `**Modern reconstruction of this step** (not Euclid's argument):\n\n${recon.map((l) => `- ${l.text.trim()}`).join("\n")}`
      : "",
  ];
  return out.filter((r) => r.trim());
}

function findStepByNumber(item: Item, n: number) {
  return item.prop!.steps.findIndex((s) => s.number === n);
}

/** Guess the step a question is about from the lettered names in it. */
function findStepByLetters(item: Item, q: string): number {
  const names = [...q.matchAll(/\b([A-Z]{1,3})\b/g)].map((m) => m[1]).filter((n) => n !== "I");
  if (!names.length) return -1;
  const steps = item.prop!.steps;
  let best = -1;
  let bestScore = 0;
  steps.forEach((s, i) => {
    const words = new Set(s.text.match(/\b[A-Z]{1,3}\b/g) ?? []);
    let score = names.filter((n) => words.has(n) || words.has([...n].reverse().join(""))).length;
    if (/equal|therefore/i.test(s.text)) score += 0.1;
    if (score > bestScore) {
      best = i;
      bestScore = score;
    }
  });
  return bestScore >= Math.min(2, names.length) ? best : -1;
}

function overview(item: Item): string {
  const steps = item.prop!.steps;
  const parts: [string, number[]][] = [];
  for (const s of steps) {
    if (s.number == null) continue;
    const last = parts[parts.length - 1];
    if (last && last[0] === s.part) last[1].push(s.number);
    else parts.push([s.part, [s.number]]);
  }
  const shape = parts
    .map(([p, ns]) => `- **${p[0].toUpperCase() + p.slice(1)}**: step${ns.length > 1 ? `s ${ns[0]}–${ns[ns.length - 1]}` : ` ${ns[0]}`}`)
    .join("\n");
  return `${item.prop!.annotation?.paraphrase ?? ""}\n\nThe proof has this shape:\n\n${shape}\n\nTell me which step is giving you trouble.`;
}

export function respond(item: Item, state: TutorState, input: string): TutorState {
  const q = input.trim();
  const log: TutorMsg[] = [...state.log, { from: "reader", md: q }];
  const say = (md: string, focus = state.focus, rung = state.rung): TutorState => ({
    focus,
    rung,
    log: [...log, { from: "tutor", md, step: focus ?? undefined }],
  });
  const prop = item.prop;
  if (!prop?.annotation) {
    return say(`I only have notes for the annotated propositions so far (${availableBooks()}). Joyce's guide below may help with this one.`);
  }
  const steps = prop.steps;
  const lower = q.toLowerCase();

  const ladderFrom = (idx: number, rung: number): TutorState => {
    const r = rungs(item, steps[idx]);
    if (rung >= r.length) {
      const s = steps[idx];
      const earlier = s.number && s.number > 1 ? ` You could ask about step ${s.number - 1}, which this one builds on,` : "";
      return say(
        `That is everything I have on ${stepName(s)}.${earlier} or ask for **the whole proof** to see the modern reconstruction in full.`,
        idx,
        rung,
      );
    }
    return say(r[rung], idx, rung);
  };

  // "step 5", "5", "#5"
  let m = /(?:^|\bstep\s*|#)(\d{1,2})\b/i.exec(q);
  if (m && (/step|#/i.test(q) || /^\d{1,2}$/.test(q))) {
    const idx = findStepByNumber(item, Number(m[1]));
    if (idx < 0) return say(`This proof has steps 1–${Math.max(...steps.map((s) => s.number ?? 0))}.`);
    return ladderFrom(idx, 0);
  }

  if (/\b(whole|entire|full|complete)\b.*\b(proof|argument|reconstruction)\b|^(show|give) (me )?the proof/i.test(q)) {
    const r = prop.annotation.reconstruction;
    const body = r.lines.map((l) => `${l.steps?.length ? `*(step${l.steps.length > 1 ? "s" : ""} ${l.steps.join(", ")})*` : ""} ${l.text.trim()}`).join("\n\n");
    return say(`Here is the whole argument as a **modern reconstruction** — not Euclid's own proof.\n\n${r.preamble ?? ""}\n\n${body}\n\n${r.closing ?? ""}`);
  }

  if (/\b(overview|summary|what is this|what's this|what does this|big picture|outline)\b/i.test(q)) return say(overview(item), null, 0);

  if (/\b(next)\b/.test(lower) && state.focus != null) return ladderFrom(Math.min(steps.length - 1, state.focus + 1), 0);
  if (/\b(previous|prev|back)\b/.test(lower) && state.focus != null) return ladderFrom(Math.max(0, state.focus - 1), 0);

  // A named result: "what is I.4", "post 3", "definition 15", "common notion 1"
  m = /\b((?:[IVX]+|\d+)\.\d+|(?:def(?:inition)?|post(?:ulate)?|c\.?\s?n\.?|common notion)\s*\.?\s*\d+)\b/i.exec(q);
  if (m) {
    const id = resolveQuery(m[1]);
    const it = getItem(id);
    if (it && id !== item.id) {
      const para = it.principle?.paraphrase ?? it.prop?.annotation?.paraphrase ?? "";
      const where = steps.filter((s) => s.heathRefs.includes(id!) || s.cites?.includes(id!)).map((s) => s.number).filter(Boolean);
      return say(
        `${refStatement(id!)}\n\n${para}${it.principle?.meaning ? `\n\n${it.principle.meaning}` : ""}${
          where.length ? `\n\nIn this proof it is used at step${where.length > 1 ? "s" : ""} ${where.join(", ")}.` : ""
        }`,
      );
    }
  }

  if (/^(why|how|huh|what|i (still )?(don'?t|do not)|more|explain|go on|and\??|so\??|\?+|i'?m (lost|confused)|confused|lost)/i.test(q) || q.endsWith("?")) {
    const guess = findStepByLetters(item, q);
    if (guess >= 0 && guess !== state.focus) {
      return ladderFrom(guess, 0);
    }
    if (state.focus == null) {
      return say("Which step? Click a sentence of Euclid's text, or type something like *step 5*.");
    }
    return ladderFrom(state.focus, state.rung + 1);
  }

  const guess = findStepByLetters(item, q);
  if (guess >= 0) return ladderFrom(guess, 0);

  return say(
    "I can help one step at a time. Try:\n\n- *I don't understand step 5*\n- *why?* (again and again, for more detail)\n- *what is I.4?* or *what does Post. 3 say?*\n- *overview*\n- *show the whole proof*",
  );
}
