import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { getItem } from "./lib/corpus";
import { diagramBus } from "./lib/diagramBus";
import { peek } from "./lib/peek";
import { navigate, useRoute, type Route } from "./lib/router";
import { lastPosition, loadScroll, savePosition, saveScroll, useSettings } from "./lib/store";
import { TopBar, Toc } from "./components/Layout";
import { PropositionPage } from "./pages/PropositionPage";
import { PrinciplesPage } from "./pages/PrinciplesPage";
import { GraphPage } from "./pages/GraphPage";
import { AboutPage, HomePage, NotFound, SearchPage } from "./pages/Pages";

const pageKey = (r: Route) =>
  r.page === "item" ? r.id : r.page === "principles" ? `${r.book}/${r.kind}` : r.page;

export default function App() {
  const route = useRoute();
  const settings = useSettings();
  const [toc, setToc] = useState(false);
  const restored = useRef(false);

  // First visit of the session with no address: return to where the reader left off.
  useLayoutEffect(() => {
    if (restored.current) return;
    restored.current = true;
    if (!location.hash || location.hash === "#/") {
      const pos = lastPosition();
      if (pos && pos.hash !== "#/" && !location.hash) navigate(pos.hash, true);
    }
  }, []);

  // Theme
  useEffect(() => {
    const root = document.documentElement;
    if (settings.theme === "auto") root.removeAttribute("data-theme");
    else root.setAttribute("data-theme", settings.theme);
  }, [settings.theme]);

  // Reading pages open references in the side panel; other pages navigate.
  const reading = route.page === "item" || route.page === "principles";
  useEffect(() => {
    peek.setEnabled(reading);
    peek.clear();
  }, [reading, pageKey(route)]);

  // Remember the reading position, and the scroll offset of each page.
  const key = pageKey(route);
  useEffect(() => {
    if (route.page === "item" || route.page === "principles") {
      const id = route.page === "item" ? route.id : route.select;
      const it = getItem(id);
      const stepNo = route.page === "item" && route.step != null ? it?.prop?.steps[route.step]?.number : null;
      const label = it ? `${it.label}${stepNo != null ? `, step ${stepNo}` : ""}` : route.page === "principles" ? route.kind : route.id;
      savePosition(location.hash, label);
    }
  }, [location.hash]); // eslint-disable-line react-hooks/exhaustive-deps

  useLayoutEffect(() => {
    const y = loadScroll(key);
    window.scrollTo(0, y ?? 0);
    let t: number | undefined;
    const on = () => {
      clearTimeout(t);
      t = window.setTimeout(() => saveScroll(key, window.scrollY), 150);
    };
    window.addEventListener("scroll", on, { passive: true });
    return () => {
      clearTimeout(t);
      saveScroll(key, window.scrollY);
      window.removeEventListener("scroll", on);
    };
  }, [key]);

  // One set of listeners for every lettered name and every reference on the page.
  const onOver = (e: React.MouseEvent | React.FocusEvent) => {
    const el = (e.target as HTMLElement).closest<HTMLElement>(".el");
    if (el) diagramBus.hover(el.dataset.el ?? null);
  };
  const onOut = (e: React.MouseEvent | React.FocusEvent) => {
    if ((e.target as HTMLElement).closest(".el")) diagramBus.hover(null);
  };
  const onClick = (e: React.MouseEvent) => {
    const a = (e.target as HTMLElement).closest<HTMLAnchorElement>("a.xref");
    if (!a || e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
    if (!peek.enabled) return; // ordinary navigation
    e.preventDefault();
    e.stopPropagation();
    peek.open(a.dataset.ref!);
  };

  let page: React.ReactNode;
  switch (route.page) {
    case "home":
      page = <HomePage />;
      break;
    case "principles":
      page = <PrinciplesPage book={route.book} kind={route.kind} select={route.select} />;
      break;
    case "item": {
      const it = getItem(route.id);
      page = it?.prop ? <PropositionPage key={it.id} item={it} stepIndex={route.step} /> : <NotFound what={route.id} />;
      break;
    }
    case "graph":
      page = <GraphPage focus={route.focus} />;
      break;
    case "search":
      page = <SearchPage q={route.q} />;
      break;
    case "about":
      page = <AboutPage />;
      break;
    default:
      page = <NotFound what={route.path} />;
  }

  const current = route.page === "item" ? route.id : route.page === "principles" ? route.select : undefined;

  return (
    <div className="app" onMouseOver={onOver} onMouseOut={onOut} onFocus={onOver} onBlur={onOut} onClickCapture={onClick}>
      <a className="skip" href="#main-text" onClick={(e) => (e.preventDefault(), document.querySelector<HTMLElement>(".text-col, .page")?.focus())}>
        Skip to text
      </a>
      <TopBar route={route} onToc={() => setToc(true)} />
      <Toc open={toc} onClose={() => setToc(false)} current={current} />
      {page}
    </div>
  );
}
