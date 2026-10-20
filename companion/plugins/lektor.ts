// Reads Dr. Joyce's commentary straight out of the Lektor content tree
// (../content/elements/books/bookN/…/contents.lr) at build time and exposes it
// as the virtual module `virtual:joyce`. Nothing is copied into this app's
// source: the Lektor tree stays the single home of Joyce's text.
//
// Joyce's text is © David E. Joyce, republished in the parent repository by
// his permission (see ../COPYRIGHT.md). This companion is a local reading
// tool over that checkout; it does not redistribute the text on its own.

import fs from "node:fs";
import path from "node:path";
import type { Plugin } from "vite";

export interface JoyceFigure {
  width: number;
  height: number;
  /** The figure's whole <script>; it calls geomlib.init(...) once. */
  config: string;
}

export interface JoyceEntry {
  statement?: string;
  proof?: string;
  guide?: string;
  groupGuide?: string;
  group?: string;
  figures: JoyceFigure[];
}

const ROMAN = ["", "I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X", "XI", "XII", "XIII"];

/** Parse a Lektor .lr record into its top-level fields (and flow-block fields, flattened). */
export function parseLr(src: string): Record<string, string> {
  const out: Record<string, string> = {};
  // Field separators: a line of exactly --- (record) or ---- (flow block).
  const chunks = src.split(/^-{3,4}\s*$/m);
  for (const chunk of chunks) {
    const lines = chunk.replace(/^\n+/, "").split("\n");
    // A flow-block header (#### prop_section ####) may precede the field.
    while (lines.length && /^(#### .* ####|\s*)$/.test(lines[0])) lines.shift();
    const m = /^([a-z_]+):\s?(.*)$/.exec(lines[0] ?? "");
    if (!m) continue;
    const [, key, first] = m;
    const rest = lines.slice(1).join("\n");
    const value = (first + "\n" + rest).replace(/#### [a-z_]+ ####\s*$/m, "").trim();
    if (key === "sections" || key === "kind") continue;
    out[key] = value;
  }
  return out;
}

/** Find the balanced `geomlib.init( … )` argument in a script. */
function initArg(script: string): string | null {
  const i = script.indexOf("geomlib.init(");
  if (i < 0) return null;
  let depth = 0;
  let inStr: string | null = null;
  const start = i + "geomlib.init(".length;
  for (let j = start; j < script.length; j++) {
    const c = script[j];
    if (inStr) {
      if (c === "\\") { j++; continue; }
      if (c === inStr) inStr = null;
      continue;
    }
    if (c === '"' || c === "'" || c === "`") { inStr = c; continue; }
    if (c === "/" && script[j + 1] === "/") { j = script.indexOf("\n", j); if (j < 0) break; continue; }
    if (c === "(" || c === "{" || c === "[") depth++;
    if (c === ")" || c === "}" || c === "]") {
      if (depth === 0) return script.slice(start, j).trim();
      depth--;
    }
  }
  return null;
}

/**
 * Replace each <figure>…geomlib.init(…)…</figure> with a placeholder
 * <div class="joyce-fig" data-fig="N"> and collect the configs.
 */
export function extractFigures(md: string, figures: JoyceFigure[]): string {
  return md.replace(/<figure[\s\S]*?<\/figure>/g, (fig) => {
    const script = /<script[^>]*>([\s\S]*?)<\/script>/.exec(fig)?.[1];
    const canvas = /<canvas[^>]*width="(\d+)"[^>]*height="(\d+)"/.exec(fig);
    if (!script || !initArg(script)) return ""; // static-image figures: the images are not part of this app
    figures.push({ width: Number(canvas?.[1] ?? 340), height: Number(canvas?.[2] ?? 260), config: script });
    return `<div class="joyce-fig" data-fig="${figures.length - 1}"></div>`;
  });
}

function readBook(contentRoot: string, book: number): Record<string, JoyceEntry> {
  const R = ROMAN[book];
  const dir = path.join(contentRoot, "elements", "books", `book${R}`);
  const out: Record<string, JoyceEntry> = {};
  if (!fs.existsSync(dir)) return out;

  const sections: [string, (slug: string) => string | null][] = [
    ["definitions", (s) => {
      // defVII12, and Book X's three sets: defX.I.1 → X.Def.1, defX.II.1 → X.Def.II.1
      const x = new RegExp(`^def${R}\\.(I{1,3})\\.(\\d+)$`).exec(s);
      if (x) return x[1] === "I" ? `${R}.Def.${x[2]}` : `${R}.Def.${x[1]}.${x[2]}`;
      return new RegExp(`^def${R}(\\d+)$`).exec(s) ? `${R}.Def.${/(\d+)$/.exec(s)![1]}` : null;
    }],
    ["postulates", (s) => (/^post(\d+)$/.exec(s) ? `${R}.Post.${/(\d+)$/.exec(s)![1]}` : null)],
    ["commonnotions", (s) => (/^cn(\d+)$/.exec(s) ? `${R}.CN.${/(\d+)$/.exec(s)![1]}` : null)],
    ["propositions", (s) => (new RegExp(`^prop${R}(\\d+)$`).exec(s) ? `${R}.${/(\d+)$/.exec(s)![1]}` : null)],
  ];

  for (const [sec, idOf] of sections) {
    const sdir = path.join(dir, sec);
    if (!fs.existsSync(sdir)) continue;
    const groups: Record<string, string> = {};
    const groupFigs: Record<string, JoyceFigure[]> = {};
    for (const slug of fs.readdirSync(sdir)) {
      const file = path.join(sdir, slug, "contents.lr");
      if (!fs.existsSync(file)) continue;
      const f = parseLr(fs.readFileSync(file, "utf8"));
      if (f._model?.endsWith("_group")) {
        const figs: JoyceFigure[] = [];
        groups[slug] = extractFigures(f.guide ?? f.body ?? "", figs);
        groupFigs[slug] = figs;
        continue;
      }
      const id = idOf(slug);
      if (!id) continue;
      const figures: JoyceFigure[] = [];
      const e: JoyceEntry = { figures };
      if (f.statement) e.statement = f.statement;
      if (f.proof) e.proof = extractFigures(f.proof, figures);
      const g = f.guide ?? f.body;
      if (g) e.guide = extractFigures(g, figures);
      if (f.group) e.group = f.group;
      out[id] = e;
    }
    // Bundled definitions / common notions share one guide.
    for (const e of Object.values(out)) {
      if (e.group && groups[e.group] !== undefined && e.groupGuide === undefined) {
        // Figures of the group guide are appended after the entry's own.
        const offset = e.figures.length;
        e.groupGuide = groups[e.group].replace(/data-fig="(\d+)"/g, (_, n) => `data-fig="${Number(n) + offset}"`);
        e.figures.push(...groupFigs[e.group]);
      }
    }
  }
  return out;
}

export default function lektorContent(opts: { contentRoot: string; books: number[] }): Plugin {
  const VID = "virtual:joyce";
  const RID = "\0" + VID;
  return {
    name: "lektor-joyce-content",
    resolveId(id) {
      return id === VID ? RID : null;
    },
    load(id) {
      if (id !== RID) return null;
      const all: Record<string, JoyceEntry> = {};
      for (const b of opts.books) Object.assign(all, readBook(opts.contentRoot, b));
      return `export default ${JSON.stringify(all)};`;
    },
    configureServer(server) {
      server.watcher.add(path.join(opts.contentRoot, "elements", "books"));
      server.watcher.on("change", (file) => {
        if (!file.endsWith("contents.lr")) return;
        const mod = server.moduleGraph.getModuleById(RID);
        if (mod) {
          server.moduleGraph.invalidateModule(mod);
          server.ws.send({ type: "full-reload" });
        }
      });
    },
  };
}

export { readBook };
