#!/usr/bin/env node
// Extract one book of T. L. Heath's translation (Cambridge, 1908) from the
// Perseus Digital Library TEI edition into the JSON the companion reads.
//
//   node scripts/extract-heath.mjs            # all configured books
//   node scripts/extract-heath.mjs 1          # Book I only
//
// The XML is fetched once from a pinned commit of PerseusDL/canonical-greekLit
// and cached in sources/ (git-ignored). The output in src/data/heath/ is
// committed, so building the app never needs the network.
//
// Nothing here rewrites Heath. The conversion is purely structural:
//   <emph>AB</emph>                 → {AB}            (lettered objects)
//   [<ref target="elem.1.post.3">…</ref>] → [[I.Post.3|Post. 3]]  (Heath's marginal refs)
//   <term>point</term>              → _point_         (Heath's italic defined term)
//   line/page breaks, empty <figure>s, align() wrappers → dropped
// plus the short list of OCR repairs in CORRECTIONS below, each of which is
// reported in the output so the app can disclose it.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..");

const PERSEUS_SHA = "70427323b61267cdcd0256b9b02009c23392de07";
const PERSEUS_URL =
  `https://raw.githubusercontent.com/PerseusDL/canonical-greekLit/${PERSEUS_SHA}` +
  "/data/tlg1799/tlg001/tlg1799.tlg001.perseus-eng2.xml";
const CACHE = path.join(root, "sources", "heath-perseus-eng2.xml");

const ROMAN = ["", "I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X", "XI", "XII", "XIII"];

// Transcription slips in the Perseus text, checked against the 1908 printing.
// Each entry: [item id, wrong, right, why]. Applied after structural conversion.
const CORRECTIONS = [
  ["I.3", "the-two given", "the two given", "stray hyphen in the Perseus transcription"],
  ["I.Def.21", "acuteangled", "acute-angled", "hyphen lost at a line break in the Perseus transcription"],
  ["I.13", "{DBA}. {ABC}", "{DBA}, {ABC}", "full stop for comma in the Perseus transcription"],
  ["I.15", "{AED} {DEB}", "{AED}, {DEB}", "comma lost in the Perseus transcription"],
  ["I.18", "bejoined", "be joined", "words run together in the Perseus transcription"],
  ["I.33", "griangle", "triangle", "misprint in the Perseus transcription"],
  ["I.34", "{BC}has", "{BC} has", "space lost in the Perseus transcription"],
  ["I.44", "let{FG}", "let {FG}", "space lost in the Perseus transcription"],
  ["I.44", "parallelograms. and", "parallelograms, and", "full stop for comma in the Perseus transcription"],
  ["II.13", "acutc", "acute", "misprint in the Perseus transcription"],
  ["III.3", "bisects it. that is", "bisects it; that is", "full stop for semicolon in the Perseus transcription"],
  ["III.8", "{DC}.; but", "{DC}; but", "stray full stop in the Perseus transcription"],
  ["III.10", "namely {B}, {C}, {F}, {H}", "namely {B}, {G}, {F}, {H}", "C for G in the Perseus transcription (the proof and figure use G)"],
  ["III.25", "{AB}. be joined", "{AB} be joined", "stray full stop in the Perseus transcription"],
  ["III.34", "{BAC}. has been cut off", "{BAC} has been cut off", "stray full stop in the Perseus transcription"],
  ["IV.7", "parailel", "parallel", "misprint in the Perseus transcription"],
  ["IV.15", "onethird", "one-third", "hyphen lost at a line break in the Perseus transcription"],
  ["IV.16", "fifteenangled", "fifteen-angled", "hyphen lost at a line break in the Perseus transcription"],
  ["IV.13", "touch them. but cuts", "touch them, but cuts", "full stop for comma in the Perseus transcription"],
  ["V.Def.10", "ltcontinuouslygt", "⟨continuously⟩", "Heath's angle brackets (words he supplies) flattened to “lt…gt” in the Perseus transcription"],
  ["V.8", "greather", "greater", "misprint in the Perseus transcription"],
  ["V.15", "{AG}. {GH}, {HB}", "{AG}, {GH}, {HB}", "full stop for comma in the Perseus transcription"],
  ["V.22", "ltthat is, as {A} is to {C}, so is {D} to {F}gt", "⟨that is, as {A} is to {C}, so is {D} to {F}⟩", "Heath's angle brackets (words he supplies) flattened to “lt…gt” in the Perseus transcription"],
  ["VI.3", "bisected by the straight line A.D.", "bisected by the straight line {AD}.", "the letters AD encoded as an abbreviation “A.D” in the Perseus transcription"],
  ["VI.26", "diameter lt of {ABCD} gt,", "diameter ⟨of {ABCD}⟩,", "Heath's angle brackets (words he supplies) flattened to “lt…gt” in the Perseus transcription"],
  ["VI.20", "consequents; [[[V.12|V. 12]] therefore", "consequents; [[V.12|V. 12]] therefore", "closing bracket of Heath's reference lost in the Perseus transcription"],
  ["VII.34", "so is {F} {E}.", "so is {F} to {E}.", "“to” lost in the Perseus transcription"],
  ["VIII.13", "make {M}. {N} respectively", "make {M}, {N} respectively", "full stop for comma in the Perseus transcription"],
  ["VIII.13", "ex acquali", "ex aequali", "misprint in the Perseus transcription"],
  ["IX.10", "unit ltand those which leave out onegt.", "unit ⟨and those which leave out one⟩.", "Heath's angle brackets (words he supplies) flattened to “lt…gt” in the Perseus transcription"],
  ["IX.32", "are eventimes even only", "are even-times even only", "hyphen lost at a line break in the Perseus transcription"],
  ["IX.34", "it is both eventimes even", "it is both even-times even", "hyphen lost at a line break in the Perseus transcription"],
  ["IX.35", "so are {EL}, {LK}. {KH} to", "so are {EL}, {LK}, {KH} to", "full stop for comma in the Perseus transcription"],
  ["X.Def.3", "incommensurable with **it irrational**", "incommensurable with it **irrational**", "bold type misplaced in the Perseus transcription"],
  ["X.18", "with {FD}. so that", "with {FD}, so that", "full stop for comma in the Perseus transcription"],
  ["X.26", "4 medial area does not exceed", "A medial area does not exceed", "“A” misread as “4” in the Perseus transcription"],
  ["X.30", "the greater is greater is greater than", "the greater is greater than", "words repeated in the Perseus transcription"],
  ["X.48", "a square number. neither, therefore,", "a square number, neither, therefore,", "full stop for comma in the Perseus transcription"],
  ["X.50", "the numbers {BA}. {AC}", "the numbers {BA}, {AC}", "full stop for comma in the Perseus transcription"],
  ["X.61", "commensurable is length", "commensurable in length", "misprint in the Perseus transcription"],
  ["X.71", "Let. {AB} be rational", "Let {AB} be rational", "stray full stop in the Perseus transcription"],
  ["X.80", "by a rational area. which is impossible", "by a rational area: which is impossible", "full stop for colon in the Perseus transcription"],
  ["X.85", "Now since. as {ED}", "Now since, as {ED}", "full stop for comma in the Perseus transcription"],
  ["X.97", "the squares on {AG}, {GB},. therefore", "the squares on {AG}, {GB}, therefore", "stray full stop in the Perseus transcription"],
  ["X.98", "the annex to {AB};. therefore", "the annex to {AB}; therefore", "stray full stop in the Perseus transcription"],
  ["X.113", "produces as, breadth", "produces as breadth", "stray comma in the Perseus transcription"],
  ["XI.33", "be ltcontinuouslygt proportional", "be ⟨continuously⟩ proportional", "Heath's angle brackets (words he supplies) flattened to “lt…gt” in the Perseus transcription"],
  ["XI.33", "is equal ltand similargt to", "is equal ⟨and similar⟩ to", "Heath's angle brackets (words he supplies) flattened to “lt…gt” in the Perseus transcription"],
  ["XI.35", "to the plane through. {BA}, {AC}", "to the plane through {BA}, {AC}", "stray full stop in the Perseus transcription"],
  ["XIII.16", "and {VW} double of; therefore", "and {VW} double of {VA'}; therefore", "letters VA′ lost in the Perseus transcription (VW is bisected at A′)"],
  ["XIII.18", "is fourthirds of", "is four-thirds of", "hyphen lost at a line break in the Perseus transcription"],
  ["X.1", "greater than. {AB}", "greater than {AB}", "stray full stop in the Perseus transcription"],
  ["IX.13", "{G};lt therefore", "{G}; therefore", "stray “lt” in the Perseus transcription"],
  ["XI.4", "taken at random lton {EF}gt.", "taken at random ⟨on {EF}⟩.", "Heath's angle brackets (words he supplies) flattened to “lt…gt” in the Perseus transcription"],
];

async function loadXml() {
  if (!fs.existsSync(CACHE)) {
    process.stderr.write(`fetching ${PERSEUS_URL}\n`);
    const res = await fetch(PERSEUS_URL);
    if (!res.ok) throw new Error(`fetch failed: ${res.status}`);
    fs.mkdirSync(path.dirname(CACHE), { recursive: true });
    fs.writeFileSync(CACHE, await res.text());
  }
  return fs.readFileSync(CACHE, "utf8");
}

function refId(target, book) {
  // elem.1.post.3 / elem.1.def.15 / elem.1.c.n.1 / elem.1.4
  // Book X has three sets of definitions: elem.10.def.3 is X. Def. 3 (first
  // set), elem.10.def.2.1 is X. Deff. II. 1 → X.Def.II.1.
  // Porisms (elem.7.2.p.1) and lemmas (elem.10.16.l.1) are printed inside a
  // proposition, so they resolve to it. Several targets ("elem.7.5 elem.7.6",
  // Heath's "[VII. 5, 6]") give several ids, space-separated.
  const ids = target.split(/\s+/).map((t) => refId1(t)).filter(Boolean);
  return ids.length ? [...new Set(ids)].join(" ") : null;
}

function refId1(target) {
  const m = /^elem\.(\d+)\.(.*)$/.exec(target);
  if (!m) return null;
  const b = ROMAN[Number(m[1])] ?? m[1];
  const rest = m[2];
  let r;
  if ((r = /^post\.(\d+)$/.exec(rest))) return `${b}.Post.${r[1]}`;
  if ((r = /^def\.(\d+)$/.exec(rest))) return `${b}.Def.${r[1]}`;
  if ((r = /^def\.([23])\.(\d+)$/.exec(rest))) return `${b}.Def.${ROMAN[Number(r[1])]}.${r[2]}`;
  if ((r = /^c\.n\.(\d+)$/.exec(rest))) return `${b}.CN.${r[1]}`;
  if ((r = /^(\d+)(?:\.[pl]\.\d+)?$/.exec(rest))) return `${b}.${r[1]}`;
  return null;
}

/** "V. 12, V. 16" → [V.12, V.16]; "VII. 13 and Def. 20" → [VII.13, VII.Def.20]; else null. */
function labelIds(label, book) {
  let b = ROMAN[book];
  const ids = [];
  for (const piece of label.split(/,\s|\sand\s/)) {
    if (/^Por\.$/.test(piece)) continue;
    const m = /^(?:([IVX]+)\.\s)?(?:(Def)\.\s)?(\d+)(?:,?\s?Por\.)?$/.exec(piece.trim());
    if (!m) return null;
    if (m[1]) b = m[1];
    ids.push(m[2] ? `${b}.Def.${m[3]}` : `${b}.${m[3]}`);
  }
  return ids;
}

const decode = (s) =>
  s.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&amp;/g, "&");

function inline(xml, book) {
  let s = xml;
  s = s.replace(/<lb[^>]*>(<\/lb>)?/g, " ").replace(/<pb[^>]*\/>/g, "");
  s = s.replace(/<figure>\s*<\/figure>/g, "");
  s = s.replace(/<label[^>]*>.*?<\/label>/g, "");
  s = s.replace(/<milestone[^>]*\/>/g, "");
  // Books VII–XIII mark lettered objects with <hi rend="italic"> where I–VI use <emph>.
  s = s.replace(/<hi rend="italic">([\s\S]*?)<\/hi>/g, "<emph>$1</emph>");
  // Heath's bracketed marginal references: "[<ref …>Post. 3</ref>]"
  s = s.replace(/\[\s*<ref target="([^"]+)">([^<]*)<\/ref>\s*\]/g, (_, t, label) => {
    const id = refId(t, book);
    return id ? `[[${id}|${label.trim()}]]` : `[${label}]`;
  });
  s = s.replace(/<ref target="([^"]+)">(.*?)<\/ref>/g, (_, t, label) => {
    const id = refId(t, book);
    return id ? `[[${id}|${label.trim()}]]` : label;
  });
  s = s.replace(/<emph>\s*(.*?)\s*<\/emph>/g, (_, x) => {
    const t = x.replace(/[.,;]$/, "");
    const trail = x.slice(t.length);
    // XI.31's figure runs out of capitals and goes on with a, b, c, d, e (aTb, Oa, eV).
    const lettered = /^[A-Z][A-Z']*$/.test(t) || (book === 11 && /^(?:[a-z]?[A-Z][A-Za-z]?|[a-z])$/.test(t));
    return lettered ? `{${t}}${trail}` : `_${x}_`;
  });
  s = s.replace(/<term>(.*?)<\/term>/g, "_$1_");
  s = s.replace(/<quote>(.*?)<\/quote>/gs, "“$1”");
  s = s.replace(/<foreign[^>]*>(.*?)<\/foreign>/gs, "$1");
  s = s.replace(/<hi rend="bold">(.*?)<\/hi>/gs, "**$1**");
  s = s.replace(/<\/?(hi|title|p|q)[^>]*>/g, "");
  s = s.replace(/<[^>]+>/g, "");
  s = decode(s).replace(/\s+/g, " ").replace(/\s+([,;.:])/g, "$1").trim();
  // A few of Heath's bracketed C.N. references (I.13, I.16) have no <ref>
  // markup in the Perseus file ("[<title>C. N</title>. 2]"). Link them like the rest.
  s = s.replace(/(?<!\[)\[(C\. ?N\. ?(\d+))\](?!\])/g, (_, label, n) => `[[${ROMAN[book] ?? book}.CN.${n}|${label}]]`);
  // A bracket of Heath's holding a reference and more ("[VIII. 26, converse]",
  // "[III. 31, I. 47]", "[XI. 35, Por.]", "[cf. V. 9]") becomes one reference
  // whose label is the whole bracket.
  s = s.replace(/\[\s?((?:(?:cf\.|Converse of|See|deduction from)\s)?(?:\[\[[^|\]]+\|[^\]]+\]\])(?:[^[\]]|\[\[[^|\]]+\|[^\]]+\]\])*)\]/g, (_, inner) => {
    const ids = [...inner.matchAll(/\[\[([^|\]]+)\|/g)].flatMap((m) => m[1].split(" "));
    const label = inner.replace(/\[\[[^|\]]+\|([^\]]+)\]\]/g, "$1").replace(/_/g, "").replace(/([,;])(?=\S)/g, "$1 ").replace(/\s+/g, " ").trim();
    return `[[${[...new Set(ids)].join(" ")}|${label}]]`;
  });
  // The Perseus markup sometimes gives one target for a label citing several
  // items ("V. 12, V. 16"): read the ids from the label when every piece is a
  // plain citation.
  s = s.replace(/\[\[([^|\]]+)\|([^\]]+)\]\]/g, (m, ids, label) => {
    const fromLabel = labelIds(label, book);
    return fromLabel && fromLabel.length > ids.split(" ").length ? `[[${fromLabel.join(" ")}|${label}]]` : m;
  });
  // Heath's references to porisms ("[III. 16, Por.]") have no <ref> markup either.
  s = s.replace(/(?<!\[)\[(([IVX]+)\. (\d+), Por\.)\](?!\])/g, (_, label, b, n) => `[[${b}.${n}|${label}]]`);
  return s;
}

const paras = (xml) => [...xml.matchAll(/<p>([\s\S]*?)<\/p>/g)].map((m) => m[1]);

function divs(xml, subtype) {
  const re = new RegExp(`<div type="textpart" subtype="${subtype}"[^>]*n="([^"]+)">`, "g");
  const starts = [...xml.matchAll(re)];
  return starts.map((m, i) => {
    const end = i + 1 < starts.length ? starts[i + 1].index : xml.length;
    return { n: m[1], xml: xml.slice(m.index, end) };
  });
}

function notesOf(xml, book) {
  return [...xml.matchAll(/<note type="crit" n="([^"]*)">([\s\S]*?)<\/note>/g)].map((m) => ({
    lemma: decode(m[1]).trim(),
    text: paras(m[2]).map((p) => inline(p, book)).join("\n\n") || inline(m[2], book),
  }));
}

function extractBook(xml, book) {
  const bookRe = new RegExp(`<div type="textpart" subtype="book"[^>]*n="${book}">`);
  const a = xml.search(bookRe);
  const nextRe = new RegExp(`<div type="textpart" subtype="book"[^>]*n="${book + 1}">`);
  let b = xml.search(nextRe);
  if (b < 0) b = xml.length;
  const bx = xml.slice(a, b);
  const R = ROMAN[book];
  const out = { book, source: {}, definitions: [], postulates: [], commonNotions: [], propositions: [], corrections: [] };

  for (const t of divs(bx, "type")) {
    const items = divs(t.xml, "number");
    for (const it of items) {
      const body = it.xml.replace(/<note[\s\S]*?<\/note>/g, "");
      const head = /<head>(.*?)<\/head>/.exec(body)?.[1] ?? it.n;
      const ps = paras(body);
      const notes = notesOf(it.xml, book);
      // Book X: def_1, prop_1, def_2, prop_2, def_3, prop_3.
      const type = t.n.replace(/_\d$/, "");
      const set = /^def_([23])$/.exec(t.n)?.[1];
      if (type === "def" || type === "post" || type === "comm_not") {
        // Heath's printed number is the <head>; Perseus's @n for C.N. 4–5 is
        // Heiberg's 7–8 (C.N. 4–6 of some manuscripts are rejected as
        // interpolations), which also leaks into the text as "[7]", "[8]".
        const n = Number(head);
        let text = ps.map((p) => inline(p, book));
        let intro = null;
        if (t.n === "post" && n === 1 && text.length > 1) intro = text.shift();
        let joined = text.join(" ");
        let heiberg = null;
        const hm = /^\[(\d+)\]\s*/.exec(joined);
        if (hm) { heiberg = Number(hm[1]); joined = joined.slice(hm[0].length); }
        const rec = { id: "", n, text: joined, notes };
        if (intro) rec.intro = intro;
        if (heiberg) rec.heibergNumber = heiberg;
        if (type === "def") {
          rec.id = set ? `${R}.Def.${ROMAN[Number(set)]}.${n}` : `${R}.Def.${n}`;
          if (set) rec.set = ROMAN[Number(set)];
          out.definitions.push(rec);
        }
        if (t.n === "post") { rec.id = `${R}.Post.${n}`; out.postulates.push(rec); }
        if (t.n === "comm_not") { rec.id = `${R}.CN.${n}`; out.commonNotions.push(rec); }
      } else if (type === "prop") {
        const n = Number(it.n);
        let enunciation = null;
        const proof = [];
        let qed = null;
        for (const p of ps) {
          if (/<label[^>]*>Enunciation<\/label>/.test(p)) { enunciation = inline(p, book); continue; }
          const txt = inline(p, book);
          if (!txt) continue;
          if (/^(QED\.)?\s*\(Being\) what it was required to (do|prove)\.?$/.test(txt.replace(/^QED\.\s*/, "")) ||
              /^Q\. ?E\. ?[DF]\.$/.test(txt)) { qed = txt; continue; }
          proof.push(txt);
        }
        // X.42 prints its enunciation as a second <head> (a <title>), not a paragraph.
        const heads = [...body.matchAll(/<head>([\s\S]*?)<\/head>/g)].map((m) => m[1]);
        if (!enunciation && heads.length > 1 && /<title>/.test(heads[1])) enunciation = inline(heads[1], book);
        if (!enunciation && proof.length) enunciation = proof.shift();
        // Heath prints "[Porism. …]" after the Q.E.D. of I.15 and elsewhere.
        let porism = null;
        if (proof.length && /^\[?Porism\./.test(proof[proof.length - 1])) porism = proof.pop();
        // V.19 prints "Therefore etc. [Porism. …] Q. E. D.": the bracket opens at
        // the end of the last proof paragraph and closes in a trailer paragraph.
        const trailer = /<p n="trailer">([\s\S]*?)<\/p>/.exec(body)?.[1].trim();
        if (porism && proof.length && /\s\[$/.test(proof[proof.length - 1]) && trailer?.startsWith("]")) {
          proof[proof.length - 1] = proof[proof.length - 1].replace(/\s\[$/, "");
          porism = `[${porism}${trailer}`;
        }
        // Some proofs end "… Q. E. D." inside the last paragraph.
        if (!qed && proof.length) {
          const last = proof[proof.length - 1];
          const m = /\s*(Q\. ?E\. ?[DF]\.)(\]?)$/.exec(last);
          if (m) {
            proof[proof.length - 1] = last.slice(0, m.index) + m[2];
            qed = m[1];
          }
        }
        const rec = { id: `${R}.${n}`, n, enunciation, proof, qed, notes };
        if (porism) rec.porism = porism;
        out.propositions.push(rec);
      }
    }
  }

  const all = [...out.definitions, ...out.postulates, ...out.commonNotions, ...out.propositions];
  for (const [id, wrong, right, why] of CORRECTIONS) {
    const rec = all.find((r) => r.id === id);
    if (!rec) continue;
    const fields = ["text", "enunciation", "porism"];
    let hit = false;
    for (const f of fields) if (rec[f]?.includes(wrong)) { rec[f] = rec[f].replace(wrong, right); hit = true; }
    if (rec.proof) rec.proof = rec.proof.map((p) => { if (p.includes(wrong)) { hit = true; return p.replace(wrong, right); } return p; });
    if (!hit) throw new Error(`correction for ${id} did not apply: ${wrong}`);
    out.corrections.push({ id, from: wrong, to: right, reason: why });
  }

  out.source = {
    translator: "Thomas Little Heath",
    title: "The Thirteen Books of Euclid's Elements",
    edition: "Cambridge University Press, 1908",
    transcription: "Perseus Digital Library, Tufts University (CC BY-SA 4.0 encoding of the public-domain text)",
    url: PERSEUS_URL,
  };
  return out;
}

const xml = await loadXml();
const books = process.argv.slice(2).map(Number);
for (const b of books.length ? books : [1]) {
  const data = extractBook(xml, b);
  const file = path.join(root, "src", "data", "heath", `book${b}.json`);
  fs.writeFileSync(file, JSON.stringify(data, null, 1) + "\n");
  console.log(
    `Book ${ROMAN[b]}: ${data.definitions.length} defs, ${data.postulates.length} posts, ` +
      `${data.commonNotions.length} C.N., ${data.propositions.length} props, ${data.corrections.length} corrections → ${path.relative(root, file)}`,
  );
}
