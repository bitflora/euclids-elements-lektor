import { useEffect, useState } from "react";

export type SectionKind = "definitions" | "postulates" | "common-notions" | "propositions";

export type Route =
  | { page: "home" }
  | { page: "principles"; book: string; kind: SectionKind; select?: string }
  | { page: "item"; id: string; step?: number }
  | { page: "graph"; focus?: string }
  | { page: "search"; q: string }
  | { page: "about" }
  | { page: "notfound"; path: string };

const PRINCIPLE = /^([IVX]+)\.(Def|Post|CN)\.((?:[IVX]+\.)?\d+)$/;
const KIND_PATH = { Def: "definitions", Post: "postulates", CN: "common-notions" } as const;

export function parseHash(hash: string): Route {
  const h = decodeURIComponent(hash.replace(/^#\/?/, ""));
  const [path, query = ""] = h.split("?");
  const params = new URLSearchParams(query);
  if (!path) return { page: "home" };
  if (path === "graph") return { page: "graph", focus: params.get("focus") ?? undefined };
  if (path === "search") return { page: "search", q: params.get("q") ?? "" };
  if (path === "about") return { page: "about" };
  let m;
  // A book opens where Euclid's text does: at the definitions.
  if ((m = /^book\/([IVX]+)$/.exec(path))) return { page: "principles", book: m[1], kind: "definitions" };
  if ((m = /^([IVX]+)\/(definitions|postulates|common-notions|propositions)$/.exec(path)))
    return { page: "principles", book: m[1], kind: m[2] as SectionKind, select: params.get("select") ?? undefined };
  if ((m = PRINCIPLE.exec(path))) return { page: "principles", book: m[1], kind: KIND_PATH[m[2] as "Def"], select: path };
  if ((m = /^([IVX]+\.\d+)(?:\/(\d+))?$/.exec(path))) return { page: "item", id: m[1], step: m[2] ? Number(m[2]) : undefined };
  return { page: "notfound", path };
}

export function hrefFor(id: string, step?: number | null): string {
  return `#/${id}${step != null ? `/${step}` : ""}`;
}

export function navigate(href: string, replace = false) {
  if (replace) history.replaceState(null, "", href);
  else location.hash = href.replace(/^#/, "");
  if (replace) window.dispatchEvent(new HashChangeEvent("hashchange"));
}

export function useRoute(): Route {
  const [route, setRoute] = useState(() => parseHash(location.hash));
  useEffect(() => {
    const on = () => setRoute(parseHash(location.hash));
    window.addEventListener("hashchange", on);
    return () => window.removeEventListener("hashchange", on);
  }, []);
  return route;
}
