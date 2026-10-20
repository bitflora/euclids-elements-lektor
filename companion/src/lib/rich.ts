// Three small renderers, one per voice:
//   heathHtml  — Euclid (Heath). Only structural markup; no Markdown.
//   richHtml   — this edition's annotations: Markdown + $KaTeX$ + tokens.
//   joyceHtml  — Joyce's guides from the Lektor tree.
// All three emit the same two interactive hooks, handled by event delegation:
//   <span class="el" data-el="AB">  — lights element AB in the diagram
//   <a class="xref" data-ref="I.4"> — opens a peek at I.4 without navigating

import katex from "katex";
import { Marked } from "marked";

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export function refLabel(id: string): string {
  let m;
  if ((m = /^([IVX]+)\.Def\.((?:[IVX]+\.)?\d+)$/.exec(id))) return m[1] === "I" ? `Def. ${m[2]}` : `${m[1]}.Def.${m[2]}`;
  if ((m = /^([IVX]+)\.Post\.(\d+)$/.exec(id))) return `Post. ${m[2]}`;
  if ((m = /^([IVX]+)\.CN\.(\d+)$/.exec(id))) return `C.N. ${m[2]}`;
  return id;
}

export const routeOf = (id: string) => `#/${id}`;

const xref = (id: string, label?: string, cls = "xref") =>
  `<a class="${cls}" data-ref="${esc(id)}" href="${routeOf(id)}">${esc(label ?? refLabel(id))}</a>`;

const el = (display: string, name: string) =>
  `<span class="el" data-el="${esc(name)}" tabindex="0">${esc(display)}</span>`;

/**
 * One bracketed reference of Heath's may cite several items ("[VII. 5, 6]",
 * "[VII. 13 and Def. 20]"): link each piece of the label to its item when the
 * pieces and the ids pair up, else the whole label to the first.
 */
function heathRefLinks(ids: string[], label: string): string {
  const cls = "xref xref-heath";
  if (ids.length > 1) {
    const parts = label.split(/([,;]\s(?!Por\.)|\sand\s)/);
    const pieces = parts.filter((_, i) => i % 2 === 0);
    if (pieces.length === ids.length)
      return parts.map((p, i) => (i % 2 ? esc(p) : xref(ids[i / 2], p, cls))).join("");
  }
  return xref(ids[0], label, cls);
}

/** Euclid's text as Heath printed it: lettered objects in italics, marginal refs in brackets. */
export function heathHtml(src: string, opts: { refs?: "inline" | "hide" } = {}): string {
  let s = esc(src);
  s = s.replace(/\[\[([^|\]]+)\|([^\]]+)\]\]/g, (_, ids: string, label: string) =>
    opts.refs === "hide" ? "" : `<span class="heath-ref">[${heathRefLinks(ids.split(" "), label.replace(/&amp;/g, "&"))}]</span>`,
  );
  // "the angle {BAC}" names an angle, not the triangle BAC: bind it to the
  // diagram's angle marker angBAC (the diagram falls back to BAC if absent).
  s = s.replace(/(angles? (?:under |at )?)\{([A-Z]{3})\}/g, (_, pre, n) => pre + el(n, `ang${n}`));
  s = s.replace(/\{([A-Za-z][A-Za-z']*)\}/g, (_, n) => el(n, n));
  s = s.replace(/\*\*(.+?)\*\*/g, "<b>$1</b>");
  s = s.replace(/(^|[\s(“])_(.+?)_(?=[\s,.;:)”]|$)/g, "$1<i>$2</i>");
  return s.replace(/\s+$/, "");
}

// ─── Annotations ──────────────────────────────────────────────────────────
const md = new Marked({ gfm: true, breaks: false });

function protectMath(src: string, stash: string[]): string {
  const put = (html: string) => `\uE000${stash.push(html) - 1}\uE001`;
  return src
    .replace(/\$\$([\s\S]+?)\$\$/g, (_, tex) => put(katexHtml(tex, true)))
    // Inline math may wrap onto the next line of a YAML block, but not across a blank line.
    .replace(/(^|[^\\$])\$((?:[^$\n]|\n(?!\s*\n))+?)\$/g, (_, pre, tex) => pre + put(katexHtml(tex.replace(/\s*\n\s*/g, " "), false)));
}

export function katexHtml(tex: string, display: boolean): string {
  try {
    return katex.renderToString(tex, { displayMode: display, throwOnError: false, strict: "ignore" });
  } catch {
    return `<code>${esc(tex)}</code>`;
  }
}

function tokens(src: string, stash: string[]): string {
  const put = (html: string) => `\uE000${stash.push(html) - 1}\uE001`;
  return src
    .replace(/\[\[([^|\]]+)(?:\|([^\]]+))?\]\]/g, (_, id, label) => put(xref(id.trim(), label?.trim())))
    .replace(/\{([^{}|]+)\|([A-Za-z0-9_']+)\}/g, (_, disp, name) => put(el(disp, name)))
    .replace(/\{([A-Z][A-Z']*)\}/g, (_, n) => put(el(n, n)));
}

const restore = (html: string, stash: string[]) =>
  html.replace(/\uE000(\d+)\uE001/g, (_, i) => stash[Number(i)]);

export function richHtml(src: string | undefined | null, inline = false): string {
  if (!src) return "";
  const stash: string[] = [];
  let s = protectMath(src, stash);
  s = tokens(s, stash);
  const html = inline ? (md.parseInline(s) as string) : (md.parse(s) as string);
  return restore(html, stash);
}

// ─── Joyce ────────────────────────────────────────────────────────────────
const CITE = /@((?:[IVX]+)\.(?:Def\.(?:[IVX]+\.)?|Post\.)?\d+|C\.N\.\d+)/g;

export function joyceHtml(src: string | undefined): string {
  if (!src) return "";
  const stash: string[] = [];
  const put = (html: string) => `\uE000${stash.push(html) - 1}\uE001`;
  let s = src
    .replace(/\[!just [^\]]*\]/g, "")
    .replace(/\[!(qef|qed)\]/g, "")
    .replace(/<div class="joyce-fig"[^>]*><\/div>/g, (m) => put(m))
    .replace(CITE, (_, tok: string) => {
      const id = /^C\.N\.(\d+)$/.test(tok) ? `I.CN.${tok.slice(4)}` : tok.replace(/^X\.Def\.I\./, "X.Def.");
      return put(xref(id, tok));
    })
    .replace(/\{([^{}|]+)\|([A-Za-z0-9_']+)\}/g, (_, disp, name) => put(el(disp, name)))
    .replace(/\{([A-Za-z][A-Za-z0-9']*)\}/g, (_, n) => put(el(n, n)));
  s = protectMath(s, stash);
  return restore(md.parse(s) as string, stash);
}

/** Plain text for search indexing and tutor quoting. */
export function plainText(src: string | undefined): string {
  if (!src) return "";
  return src
    .replace(/\[\[([^|\]]+)\|([^\]]+)\]\]/g, "[$2]")
    .replace(/\[\[([^\]]+)\]\]/g, (_, id) => refLabel(id))
    .replace(/\{([^{}|]+)\|[^}]+\}/g, "$1")
    .replace(/[{}]/g, "")
    .replace(/\$([^$]+)\$/g, "$1")
    .replace(/[_*#>`]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}
