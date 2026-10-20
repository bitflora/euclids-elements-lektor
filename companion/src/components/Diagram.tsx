// An interactive figure drawn by geomlib (the TypeScript port of Joyce's
// Geometry Applet). Points marked orange or red can be dragged; everything
// constructed from them follows, so the figure stays a valid instance of
// Euclid's construction.
//
// Two independent highlight channels:
//   `highlight` — the objects the selected step is about (geomlib's gold
//                  `shouldHighlight`)
//   hover        — whatever lettered name the reader is pointing at, in any
//                  text on the page (geomlib's bold `emphasized`)

import { useEffect, useId, useRef, useState } from "react";
import type { DiagramSpec } from "../types";
import { diagramBus } from "../lib/diagramBus";

interface Props {
  spec?: DiagramSpec;
  /** Alternatively, the object literal Joyce passed to geomlib.init(). */
  joyceConfig?: string;
  width?: number;
  height?: number;
  highlight?: string[];
  /** When set, only these named elements are drawn. */
  visible?: string[] | null;
  label?: string;
  compact?: boolean;
}

type Slate = {
  canvas: HTMLCanvasElement;
  elements: { name: string | null; shouldHighlight: boolean; emphasized: boolean; visible: boolean }[];
  lookupElement(n: string): Slate["elements"][number] | null;
  setVisibleNames(n: string[]): void;
  clearVisibility(): void;
  reset(): void;
  update(): void;
};

function evalJoyceConfig(script: string): Record<string, unknown> | null {
  // Joyce's figures are trusted source from the parent repository. Run the
  // figure's script with geomlib.init intercepted, to capture its config.
  let captured: Record<string, unknown> | null = null;
  const shim = { ...window.geomlib, init: (cfg: Record<string, unknown>) => void (captured = cfg) };
  try {
    // eslint-disable-next-line no-new-func
    new Function("geomlib", "window", script)(shim, { eucrefs: {} });
  } catch (e) {
    console.warn("Could not evaluate Joyce figure", e);
  }
  return captured;
}

export function Diagram({ spec, joyceConfig, width, height, highlight, visible, label, compact }: Props) {
  const host = useRef<HTMLDivElement>(null);
  const slate = useRef<Slate | null>(null);
  const uid = useId().replace(/[^a-zA-Z0-9]/g, "");
  const [failed, setFailed] = useState(false);
  const [generation, setGeneration] = useState(0);
  const hovered = useRef<string | null>(null);

  const w = spec?.width ?? width ?? 340;
  const h = spec?.height ?? height ?? 260;

  // Build the slate.
  useEffect(() => {
    const g = window.geomlib;
    const el = host.current;
    if (!g || !el) {
      setFailed(true);
      return;
    }
    const canvas = document.createElement("canvas");
    canvas.id = `fig-${uid}-${generation}`;
    canvas.width = w;
    canvas.height = h;
    canvas.setAttribute("aria-label", label ?? "Interactive diagram");
    el.appendChild(canvas);

    let config: Record<string, unknown> | null;
    if (spec) {
      config = {
        title: label ?? "",
        background: spec.background ?? "#fbf8f1",
        pivot: spec.pivot,
        elements: spec.elements,
        aliases: spec.aliases ?? {},
      };
    } else if (joyceConfig) {
      config = evalJoyceConfig(joyceConfig);
      if (config) config.resolveJustification = () => null;
    } else config = null;

    if (!config) {
      setFailed(true);
      return;
    }
    config.canvasid = canvas.id;
    try {
      g.init(config);
      slate.current = g.slates[g.slates.length - 1] as Slate;
      setFailed(false);
    } catch (e) {
      console.warn("geomlib.init failed", e);
      setFailed(true);
    }
    const mine = slate.current;
    return () => {
      const i = g.slates.indexOf(mine);
      if (i >= 0) g.slates.splice(i, 1);
      slate.current = null;
      el.innerHTML = "";
    };
  }, [spec, joyceConfig, w, h, uid, label, generation]);

  // Apply the step's visible set and highlight.
  useEffect(() => {
    const s = slate.current;
    if (!s) return;
    if (visible) s.setVisibleNames(visible);
    else s.clearVisibility();
    const lit = new Set((highlight ?? []).map((n) => s.lookupElement(n)).filter(Boolean));
    for (const e of s.elements) if (e.name != null) e.shouldHighlight = lit.has(e);
    s.update();
  }, [highlight, visible, generation, spec, joyceConfig]);

  // Hover highlighting from any text on the page.
  useEffect(
    () =>
      diagramBus.subscribe((name) => {
        const s = slate.current;
        if (!s) return;
        if (hovered.current) {
          const prev = s.lookupElement(hovered.current);
          if (prev) prev.emphasized = false;
        }
        const e = name ? s.lookupElement(name) ?? (name.startsWith("ang") ? s.lookupElement(name.slice(3)) : null) : null;
        if (e) e.emphasized = true;
        hovered.current = e ? (e.name ?? name) : null;
        s.update();
      }),
    [],
  );

  const reset = () => {
    // A fresh slate restores every point to its initial position.
    setGeneration((g) => g + 1);
  };

  return (
    <figure className={`diagram${compact ? " compact" : ""}`}>
      <div className="diagram-canvas" ref={host} style={{ aspectRatio: `${w} / ${h}`, maxWidth: w }} />
      {failed && <p className="diagram-failed">The diagram library did not load.</p>}
      <div className="diagram-tools">
        <button type="button" className="btn-quiet" onClick={reset} title="Put every point back where it started">
          ↺ Reset diagram
        </button>
      </div>
    </figure>
  );
}
