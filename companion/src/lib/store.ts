// Reader settings and reading position. Everything here is per-reader
// convenience, kept in localStorage; the app works identically without it.
import { useSyncExternalStore } from "react";

export interface Settings {
  /** Show the figure as it stands at the selected step. */
  buildFigure: boolean;
  /** "steps": one block per step with Proclus's part labels; "prose": Heath's paragraphs. */
  view: "steps" | "prose";
  /** Show Heath's bracketed marginal references in Euclid's text. */
  heathRefs: boolean;
  theme: "auto" | "light" | "dark";
}

const DEFAULTS: Settings = { buildFigure: true, view: "steps", heathRefs: true, theme: "auto" };
const KEY = "euclid-companion:settings";

function read<T>(key: string, fallback: T): T {
  try {
    const s = localStorage.getItem(key);
    return s ? { ...fallback, ...JSON.parse(s) } : fallback;
  } catch {
    return fallback;
  }
}
function write(key: string, v: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(v));
  } catch {
    /* storage unavailable: settings last for this visit only */
  }
}

let settings: Settings = read(KEY, DEFAULTS);
const listeners = new Set<() => void>();

export function setSettings(patch: Partial<Settings>) {
  settings = { ...settings, ...patch };
  write(KEY, settings);
  listeners.forEach((l) => l());
}

export function useSettings(): Settings {
  return useSyncExternalStore(
    (l) => (listeners.add(l), () => listeners.delete(l)),
    () => settings,
  );
}

// ─── Reading position ──────────────────────────────────────────────────────
const POS = "euclid-companion:position";
export interface Position {
  hash: string;
  label: string;
  at: number;
}

export function savePosition(hash: string, label: string) {
  write(POS, { hash, label, at: Date.now() } satisfies Position);
}
export function lastPosition(): Position | null {
  try {
    const s = localStorage.getItem(POS);
    return s ? (JSON.parse(s) as Position) : null;
  } catch {
    return null;
  }
}

const SCROLL = "euclid-companion:scroll";
export function saveScroll(key: string, y: number) {
  const all = read<Record<string, number>>(SCROLL, {});
  all[key] = Math.round(y);
  write(SCROLL, all);
}
export function loadScroll(key: string): number | undefined {
  return read<Record<string, number>>(SCROLL, {})[key];
}
