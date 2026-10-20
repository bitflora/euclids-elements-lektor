import { Fragment, useEffect, useRef, useState, type ReactNode } from "react";
import { BOOKS, ROMAN } from "../content/books";
import { getItem, isAnnotated, items, neighbours, resolveQuery, sequence } from "../lib/corpus";
import { refLabel } from "../lib/rich";
import { hrefFor, navigate, type Route } from "../lib/router";
import { setSettings, useSettings } from "../lib/store";
import type { Item } from "../types";
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
  return (
    <aside className={`panel${isOpen ? " sheet-open" : ""}`} aria-label="Figure and explanations">
      <button
        type="button"
        className="sheet-handle"
        onClick={() => {
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

// ─── Previous / next ──────────────────────────────────────────────────────
export function ItemNav({ item, bottom }: { item: Item; bottom?: boolean }) {
  const { prev, next } = neighbours(item.id);
  const p = getItem(prev);
  const n = getItem(next);
  return (
    <nav className={`item-nav${bottom ? " bottom" : ""}`} aria-label="Previous and next">
      {!bottom && (
        <span className="crumbs">
          <a href="#/">Contents</a> › <a href={`#/${ROMAN[item.book]}/definitions`}>Book {ROMAN[item.book]}</a> ›{" "}
          {item.kind === "proposition" ? (
            <a href={`#/${ROMAN[item.book]}/propositions?select=${encodeURIComponent(item.id)}`}>Propositions</a>
          ) : (
            <span>{item.label}</span>
          )}
        </span>
      )}
      <span className="item-nav-links">
        {p ? (
          <a href={hrefFor(p.id)} rel="prev" title={p.label}>
            ← {refLabel(p.id)}
          </a>
        ) : (
          <span />
        )}
        {n ? (
          <a href={hrefFor(n.id)} rel="next" title={n.label}>
            {refLabel(n.id)} →
          </a>
        ) : (
          <span />
        )}
      </span>
    </nav>
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

  return (
    <header className="topbar">
      <button type="button" className="btn-quiet toc-btn" onClick={onToc} aria-label="Table of contents">
        ☰ <span className="hide-sm">Contents</span>
      </button>
      <a className="brand" href="#/">
        Euclid's <i>Elements</i>
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
              <label>
                <span>Explanations open at</span>
                <select value={settings.level} onChange={(e) => setSettings({ level: Number(e.target.value) as 1 })}>
                  <option value={1}>Level 1 — hint</option>
                  <option value={2}>Level 2 — explanation</option>
                  <option value={3}>Level 3 — modern reconstruction</option>
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
  const [openBook, setOpenBook] = useState(1);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (open) ref.current?.querySelector<HTMLElement>(".current")?.scrollIntoView({ block: "center" });
  }, [open]);
  return (
    <>
      <div className={`scrim${open ? " on" : ""}`} onClick={onClose} />
      <nav className={`toc${open ? " open" : ""}`} aria-label="Table of contents" ref={ref} onClick={(e) => (e.target as HTMLElement).closest("a") && onClose()}>
        <div className="toc-head">
          <strong>Contents</strong>
          <button type="button" className="btn-icon" onClick={onClose} aria-label="Close contents">
            ×
          </button>
        </div>
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
      </nav>
    </>
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
        <span className="dot" /> annotated · others have Heath's text and Joyce's guide
      </p>
    </div>
  );
}
