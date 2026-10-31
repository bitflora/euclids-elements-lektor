import { useMemo } from "react";
import { heathHtml, richHtml } from "../lib/rich";
import type { Item } from "../types";

/** This edition's annotation prose. */
export function Rich({ md, inline, className }: { md?: string | null; inline?: boolean; className?: string }) {
  const html = useMemo(() => richHtml(md, inline), [md, inline]);
  if (!md) return null;
  const Tag = inline ? "span" : "div";
  return <Tag className={`rich ${className ?? ""}`} dangerouslySetInnerHTML={{ __html: html }} />;
}

/** Euclid, in Heath's words. */
export function Heath({ src, refs = "inline", as = "span" }: { src: string; refs?: "inline" | "hide"; as?: "span" | "p" | "div" }) {
  const html = useMemo(() => heathHtml(src, { refs }), [src, refs]);
  const Tag = as;
  return <Tag className="heath" dangerouslySetInnerHTML={{ __html: html }} />;
}

/** Joyce's guide and translation live on his site, published there by his permission; link out. */
export function JoyceLink({ item }: { item: Item }) {
  if (!item.joyce?.url) return null;
  return (
    <p className="joyce-link small">
      <a href={item.joyce.url} target="_blank" rel="noopener">
        D. E. Joyce's guide to {item.short} ↗
      </a>
      <span className="muted"> · euclids-elements.org</span>
    </p>
  );
}
