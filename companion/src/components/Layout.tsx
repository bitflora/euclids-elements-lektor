import { Fragment, useEffect, useRef, useState, type ReactNode } from "react";
import { BOOKS } from "../content/books";
import { byOrder, getItem, isAnnotated, items, resolveQuery, sequence } from "../lib/corpus";
import { WORKS, allParallels, allSections, getSection, workByKey, type IndexedParallel, type Work } from "../lib/works";
import { hrefFor, jump, navigate, type Route } from "../lib/router";
import { setSettings, useSettings } from "../lib/store";
import { refLabel } from "../lib/rich";
import { Rich } from "./Rich";

// ─── Side panel ───────────────────────────────────────────────────────────
export function PanelShell({
  figure,
  caption,
  tabs,
  children,
  open,
  onCloseSheet,
}: {
  figure: ReactNode;
  caption?: string;
  tabs?: ReactNode;
  children: ReactNode;
  /** On narrow screens the panel is a bottom sheet, raised when there is something to show. */
  open: boolean;
  onCloseSheet: () => void;
}) {
  const [figOpen, setFigOpen] = useState(true);
  // On phones the panel is a bottom sheet; the reader can also raise it by hand.
  const [manual, setManual] = useState(false);
  const isOpen = open || manual;
  // Dragging the handle resizes the sheet; null means the default height.
  const [sheetH, setSheetH] = useState<number | null>(null);
  const drag = useRef<{ y: number; h: number; moved: boolean } | null>(null);
  const asideRef = useRef<HTMLElement>(null);
  return (
    <aside
      ref={asideRef}
      className={`panel${isOpen ? " sheet-open" : ""}`}
      style={sheetH != null ? ({ "--sheet-h": `${sheetH}px`, "--sheet-max": "92vh" } as React.CSSProperties) : undefined}
      aria-label="Figure and explanations"
    >
      <button
        type="button"
        className="sheet-handle"
        onPointerDown={(e) => {
          if (!isOpen) return;
          e.currentTarget.setPointerCapture(e.pointerId);
          drag.current = { y: e.clientY, h: asideRef.current!.offsetHeight, moved: false };
        }}
        onPointerMove={(e) => {
          const d = drag.current;
          if (!d) return;
          if (Math.abs(e.clientY - d.y) > 4) d.moved = true;
          if (d.moved) setSheetH(Math.round(Math.min(window.innerHeight * 0.92, Math.max(120, d.h + d.y - e.clientY))));
        }}
        onPointerUp={() => {
          // Keep the click that ends a drag from closing the sheet.
          if (drag.current?.moved) setTimeout(() => (drag.current = null), 0);
          else drag.current = null;
        }}
        onPointerCancel={() => (drag.current = null)}
        onClick={() => {
          if (drag.current?.moved) return;
          if (isOpen) {
            setManual(false);
            onCloseSheet();
          } else setManual(true);
        }}
        aria-label={isOpen ? "Lower the figure and notes" : "Raise the figure and notes"}
      >
        <span className="grip" />
        <span className="sheet-label">{isOpen ? "Close" : "Figure & notes"}</span>
      </button>
      {figure && (
        <div className={`panel-figure${figOpen ? "" : " collapsed"}`}>
          {figOpen && figure}
          {figOpen && caption && <Rich md={caption} className="caption small" />}
          <button type="button" className="btn-quiet fig-toggle" onClick={() => setFigOpen(!figOpen)}>
            {figOpen ? "Hide figure" : "Show figure"}
          </button>
        </div>
      )}
      {tabs}
      <div className="panel-body">{children}</div>
    </aside>
  );
}

// ─── Top bar ──────────────────────────────────────────────────────────────
export function TopBar({ route, onToc }: { route: Route; onToc: () => void }) {
  const [q, setQ] = useState("");
  const [menu, setMenu] = useState(false);
  const settings = useSettings();
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const on = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (t.closest("input, textarea")) return;
      if (e.key === "/" || (e.key === "k" && (e.metaKey || e.ctrlKey))) {
        e.preventDefault();
        input.current?.focus();
      }
    };
    window.addEventListener("keydown", on);
    return () => window.removeEventListener("keydown", on);
  }, []);

  const go = (e: React.FormEvent) => {
    e.preventDefault();
    const id = resolveQuery(q);
    if (id) navigate(hrefFor(id));
    else if (q.trim()) navigate(`#/search?q=${encodeURIComponent(q.trim())}`);
    setQ("");
    input.current?.blur();
  };

  const work = route.page === "work" ? workByKey(route.work) : undefined;
  return (
    <header className="topbar">
      <button type="button" className="btn-quiet toc-btn" onClick={onToc} aria-label="Table of contents">
        ☰ <span className="hide-sm">Contents</span>
      </button>
      <a className="brand" href="#/">
        {work ? (
          <>
            <i>{work.title}</i>{" "}
            <span lang="zh-Hant" className="hide-sm">
              {work.zh}
            </span>
          </>
        ) : (
          <>
            Euclid's <i>Elements</i>
          </>
        )}
        <span className="brand-sub hide-sm"> · a reading companion</span>
      </a>
      <form className="jump" onSubmit={go} role="search">
        <input
          ref={input}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Go to I.47, def 15… or search"
          aria-label="Jump to a proposition, or search"
          list="jump-list"
        />
        <datalist id="jump-list">
          {[...items.values()].map((i) => (
            <option key={i.id} value={i.id}>
              {i.label}
            </option>
          ))}
          {allSections().map((s) => (
            <option key={s.id} value={s.id}>
              {s.annotation?.title ?? s.label}
            </option>
          ))}
        </datalist>
      </form>
      <nav className="top-links">
        <a href="#/graph" className={route.page === "graph" ? "on" : ""}>
          Graph
        </a>
        <a href="#/about" className={`hide-sm${route.page === "about" ? " on" : ""}`}>
          About
        </a>
        <div className="menu-wrap">
          <button type="button" className="btn-quiet" aria-expanded={menu} onClick={() => setMenu(!menu)} aria-label="Reading settings">
            Aa
          </button>
          {menu && (
            <div className="menu" onMouseLeave={() => setMenu(false)}>
              <label>
                <span>Text layout</span>
                <select value={settings.view} onChange={(e) => setSettings({ view: e.target.value as "steps" })}>
                  <option value="steps">Numbered steps</option>
                  <option value="prose">Continuous prose</option>
                </select>
              </label>
              <label className="check">
                <input type="checkbox" checked={settings.buildFigure} onChange={(e) => setSettings({ buildFigure: e.target.checked })} />
                <span>Build the figure step by step</span>
              </label>
              <label className="check">
                <input type="checkbox" checked={settings.heathRefs} onChange={(e) => setSettings({ heathRefs: e.target.checked })} />
                <span>Show Heath's bracketed references</span>
              </label>
              <label className="check">
                <input type="checkbox" checked={settings.commentary} onChange={(e) => setSettings({ commentary: e.target.checked })} />
                <span>Chinese texts: show the commentary</span>
              </label>
              <label className="check">
                <input type="checkbox" checked={settings.chinese} onChange={(e) => setSettings({ chinese: e.target.checked })} />
                <span>Chinese texts: show the Chinese</span>
              </label>
              <label>
                <span>Theme</span>
                <select value={settings.theme} onChange={(e) => setSettings({ theme: e.target.value as "auto" })}>
                  <option value="auto">Match system</option>
                  <option value="light">Light</option>
                  <option value="dark">Dark</option>
                </select>
              </label>
            </div>
          )}
        </div>
      </nav>
    </header>
  );
}

// ─── Table of contents drawer ─────────────────────────────────────────────
export function Toc({ open, onClose, current }: { open: boolean; onClose: () => void; current?: string }) {
  // Open the book or part being read: Euclid's books are 1–13, a work's parts 100·(k+1) + n.
  const tocKey = (w: Work, part: number) => 100 * (WORKS.indexOf(w) + 1) + part;
  const [openBook, setOpenBook] = useState(() => {
    const s = getSection(current);
    return s ? tocKey(workByKey(s.work), s.part) : 1;
  });
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (open) ref.current?.querySelector<HTMLElement>(".current")?.scrollIntoView({ block: "center" });
  }, [open]);
  return (
    <>
      <div className={`scrim${open ? " on" : ""}`} onClick={onClose} />
      <nav className={`toc${open ? " open" : ""}`} aria-label="Table of contents" ref={ref} onClick={(e) => {
        if (!(e.target as HTMLElement).closest("a")) return;
        jump.pending = true;
        onClose();
      }}>
        <div className="toc-head">
          <strong>Contents</strong>
          <button type="button" className="btn-icon" onClick={onClose} aria-label="Close contents">
            ×
          </button>
        </div>
        <p className="toc-work">Euclid's <i>Elements</i></p>
        <ul className="toc-books">
          {BOOKS.map((b) => (
            <li key={b.n} className={b.available ? "" : "unavailable"}>
              <button type="button" className="toc-book" onClick={() => b.available && setOpenBook(openBook === b.n ? 0 : b.n)} disabled={!b.available}>
                <span className="roman">{b.roman}</span>
                <span className="subject">{b.subject}</span>
                {!b.available && <span className="soon">planned</span>}
              </button>
              {b.available && openBook === b.n && <BookToc book={b.n} current={current} />}
            </li>
          ))}
        </ul>
        {WORKS.map((w) => (
          <Fragment key={w.key}>
            <p className="toc-work">
              <i>{w.title}</i> <span lang="zh-Hant">{w.zh}</span>
            </p>
            <ul className="toc-books">
              {w.parts.map((p) => {
                const k = tocKey(w, p.n);
                return (
                  <li key={p.n}>
                    <button type="button" className="toc-book" onClick={() => setOpenBook(openBook === k ? 0 : k)}>
                      <span className="roman" lang="zh-Hant">
                        {p.name ?? p.zh}
                      </span>
                      <span className="subject">{p.subject}</span>
                    </button>
                    {openBook === k && <WorkPartToc work={w} part={p.n} current={current} />}
                  </li>
                );
              })}
            </ul>
          </Fragment>
        ))}
        <p className="toc-work">Proved in more than one work</p>
        <ul className="toc-books toc-shared-books">
          {SHARED.map(([id, list], i) => {
            const k = SHARED_KEY + i;
            return (
              <li key={id}>
                <button type="button" className="toc-book" onClick={() => setOpenBook(openBook === k ? 0 : k)}>
                  <span className="roman">{id}</span>
                  <span className="subject">{getItem(id)?.prop?.annotation?.title ?? getItem(id)?.label}</span>
                </button>
                {openBook === k && <SharedToc id={id} list={list} current={current} />}
              </li>
            );
          })}
        </ul>
      </nav>
    </>
  );
}

// Euclid's theorems that a Chinese work also proves (a "same" parallel), in Euclid's order.
const bookOf = (id: string) => BOOKS.findIndex((b) => id.startsWith(`${b.roman}.`));
const SHARED: (readonly [string, IndexedParallel[]])[] = allParallels()
  .filter(([id]) => /^[IVX]+\.\d+$/.test(id))
  .map(([id, list]) => [id, list.filter((p) => p.relation === "same")] as const)
  .filter(([, list]) => list.length)
  .sort(([a], [b]) => bookOf(a) - bookOf(b) || byOrder(a, b));
// Drawer keys for these, clear of Euclid's books (1–13) and the works' parts (100·k + n).
const SHARED_KEY = 10_000;

function SharedToc({ id, list, current }: { id: string; list: IndexedParallel[]; current?: string }) {
  const link = (to: string, where: string, title?: string) => (
    <li key={to}>
      <a href={hrefFor(to)} className={`annotated${to === current ? " current" : ""}`}>
        <span className="toc-where">{where}</span>
        <span>{title}</span>
      </a>
    </li>
  );
  return (
    <div className="toc-book-body">
      <ol className="toc-list toc-shared">
        {link(id, `Elements ${id}`, getItem(id)?.prop?.annotation?.title ?? getItem(id)?.label)}
        {list.map((p) => {
          const s = getSection(p.section);
          return link(p.section, refLabel(p.section), s?.annotation?.title ?? s?.label);
        })}
      </ol>
    </div>
  );
}

function WorkPartToc({ work, part, current }: { work: Work; part: number; current?: string }) {
  const ids = work.sequence.get(part) ?? [];
  return (
    <div className="toc-book-body">
      <ol className="toc-list">
        {ids.map((id) => {
          const s = getSection(id)!;
          return (
            <li key={id}>
              <a href={`#/${id}`} className={`${id === current ? "current" : ""}${s.annotation ? " annotated" : ""}`}>
                <span className="toc-n">{s.n || "·"}</span> {s.annotation?.title ?? s.label}
              </a>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

function BookToc({ book, current }: { book: number; current?: string }) {
  const ids = sequence.get(book) ?? [];
  const R = BOOKS[book - 1].roman;
  const group = (test: (id: string) => boolean) => ids.filter(test);
  const defs = group((i) => i.includes(".Def."));
  const posts = group((i) => i.includes(".Post."));
  const cns = group((i) => i.includes(".CN."));
  const props = group((i) => /^[IVX]+\.\d+$/.test(i));
  const link = (id: string, label: string) => (
    <a key={id} href={hrefFor(id)} className={`${id === current ? "current" : ""}${isAnnotated(id) ? " annotated" : ""}`} title={getItem(id)?.label}>
      {label}
    </a>
  );
  return (
    <div className="toc-book-body">
      {(
        [
          ["definitions", "Definitions", defs],
          ["postulates", "Postulates", posts],
          ["common-notions", "Common notions", cns],
          ["propositions", "Propositions", props],
        ] as const
      )
        .filter(([, , list]) => list.length)
        .map(([path, title, list]) => (
          <Fragment key={path}>
            <p className="toc-sec">
              <a href={`#/${R}/${path}`}>{title}</a>
            </p>
            <div className="toc-grid">{list.map((id) => link(id, id.split(".").pop()!))}</div>
          </Fragment>
        ))}
      <p className="small muted toc-legend">
        <span className="dot" /> annotated · others have Heath's text
      </p>
    </div>
  );
}
