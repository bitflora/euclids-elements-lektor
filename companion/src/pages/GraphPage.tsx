// The available books as a dependency graph. Columns are depths: a proposition sits one
// column to the right of the deepest result it uses, so reading left to right
// follows the order in which the book could have been proved.

import { useMemo, useState } from "react";
import { getItem, items, sequence } from "../lib/corpus";
import { refLabel } from "../lib/rich";
import { hrefFor, navigate } from "../lib/router";
import { Heath } from "../components/Rich";
import { BOOKS, availableBooks } from "../content/books";

const NODE_W = 58;
const NODE_H = 22;
const COL_GAP = 46;
const ROW_GAP = 8;
const PAD = 24;

export function GraphPage({ focus }: { focus?: string }) {
  const [hover, setHover] = useState<string | null>(focus ?? null);
  const [showPrinciples, setShowPrinciples] = useState(false);

  const layout = useMemo(() => {
    const ids = BOOKS.filter((b) => b.available).flatMap((b) => sequence.get(b.n) ?? []).filter((id) => {
      const it = getItem(id)!;
      if (it.kind === "proposition") return true;
      return showPrinciples && it.usedBy.length > 0;
    });
    const keep = new Set(ids);
    const depth = new Map<string, number>();
    const d = (id: string): number => {
      if (depth.has(id)) return depth.get(id)!;
      const it = getItem(id)!;
      const deps = it.uses.filter((u) => keep.has(u));
      const v = it.kind !== "proposition" ? 0 : deps.length ? 1 + Math.max(...deps.map(d)) : showPrinciples ? 1 : 0;
      depth.set(id, v);
      return v;
    };
    ids.forEach(d);
    const cols: string[][] = [];
    for (const id of ids) (cols[depth.get(id)!] ??= []).push(id);
    const pos = new Map<string, { x: number; y: number }>();
    cols.forEach((col, c) =>
      col.forEach((id, r) => pos.set(id, { x: PAD + c * (NODE_W + COL_GAP), y: PAD + 18 + r * (NODE_H + ROW_GAP) })),
    );
    const edges: [string, string][] = [];
    for (const id of ids) for (const u of getItem(id)!.uses) if (keep.has(u)) edges.push([u, id]);
    const width = PAD * 2 + cols.length * (NODE_W + COL_GAP);
    const height = PAD * 2 + 18 + Math.max(...cols.map((c) => c.length)) * (NODE_H + ROW_GAP);
    return { ids, pos, edges, width, height, cols: cols.length };
  }, [showPrinciples]);

  const { up, down } = useMemo(() => {
    const up = new Set<string>();
    const down = new Set<string>();
    if (!hover) return { up, down };
    const walk = (id: string, next: (id: string) => string[], into: Set<string>) => {
      for (const n of next(id)) if (!into.has(n)) (into.add(n), walk(n, next, into));
    };
    walk(hover, (id) => getItem(id)?.uses ?? [], up);
    walk(hover, (id) => getItem(id)?.usedBy ?? [], down);
    return { up, down };
  }, [hover]);

  const cls = (id: string) =>
    !hover ? "" : id === hover ? "focus" : up.has(id) ? "up" : down.has(id) ? "down" : "dim";

  const h = getItem(hover);
  return (
    <main className="page graph-page">
      <h1>{availableBooks()}: what depends on what</h1>
      <p className="lede small">
        Each proposition stands one column to the right of the deepest result it uses. Point at a proposition to see
        everything it rests on <span className="key key-up">before it</span> and everything that rests on it{" "}
        <span className="key key-down">after it</span>. Click to open. Edges come from Heath's bracketed references and
        from this edition's notes, which record many uses Heath leaves unbracketed (I.6, for instance, uses I.3 and
        I.4 without a bracket).
      </p>
      <label className="check small">
        <input type="checkbox" checked={showPrinciples} onChange={(e) => setShowPrinciples(e.target.checked)} /> Include
        definitions, postulates and common notions
      </label>
      <div className="graph-wrap">
        <svg width={layout.width} height={layout.height} className="graph" role="img" aria-label={`Dependency graph of ${availableBooks()}`}>
          {Array.from({ length: layout.cols }, (_, c) => (
            <text key={c} x={PAD + c * (NODE_W + COL_GAP) + NODE_W / 2} y={PAD} className="col-label" textAnchor="middle">
              {c === 0 && showPrinciples ? "first principles" : `depth ${showPrinciples ? c : c + 1}`}
            </text>
          ))}
          {layout.edges.map(([a, b]) => {
            const p = layout.pos.get(a)!;
            const q = layout.pos.get(b)!;
            const x1 = p.x + NODE_W;
            const y1 = p.y + NODE_H / 2;
            const x2 = q.x;
            const y2 = q.y + NODE_H / 2;
            const mx = (x1 + x2) / 2;
            const inUp = (x: string) => x === hover || up.has(x);
            const inDown = (x: string) => x === hover || down.has(x);
            const kind = !hover ? "" : up.has(a) && inUp(b) ? "up" : down.has(b) && inDown(a) ? "down" : "dim";
            return <path key={`${a}-${b}`} d={`M${x1},${y1} C${mx},${y1} ${mx},${y2} ${x2},${y2}`} className={`edge ${kind}`} />;
          })}
          {layout.ids.map((id) => {
            const p = layout.pos.get(id)!;
            const it = items.get(id)!;
            return (
              <g
                key={id}
                transform={`translate(${p.x},${p.y})`}
                className={`node ${it.kind} ${cls(id)}${it.prop?.annotation || it.principle ? " annotated" : ""}`}
                onMouseEnter={() => setHover(id)}
                onFocus={() => setHover(id)}
                onClick={() => navigate(hrefFor(id))}
                tabIndex={0}
                role="link"
                aria-label={it.label}
              >
                <rect width={NODE_W} height={NODE_H} rx={4} />
                <text x={NODE_W / 2} y={NODE_H / 2 + 4} textAnchor="middle">
                  {refLabel(id)}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
      {h && (
        <div className="graph-detail">
          <p>
            <a href={hrefFor(h.id)}>
              <strong>{h.label}</strong>
            </a>{" "}
            — uses {up.size} earlier result{up.size === 1 ? "" : "s"} (directly or not); {down.size} later result
            {down.size === 1 ? " uses" : "s use"} it.
          </p>
          <Heath src={h.text} refs="hide" as="p" />
        </div>
      )}
    </main>
  );
}
