# Euclid's *Elements* — a reading companion

A local web app for reading Euclid in T. L. Heath's translation with explanations on
demand. Euclid's text fills the left two-thirds of the page; clicking any sentence of a
proof lights the objects it is about in an interactive figure and opens a short hint on
the right, which can be deepened to a full explanation, modern notation and a modern
reconstruction.

```sh
cd companion
npm install
npm run dev          # http://localhost:5199
```

`npm run build` writes a static site to `dist/` (open it with `npm run preview`, or serve the
folder with any static server). `npm test` runs the integrity checks.

The app reads Joyce's figures from this repository's Lektor tree (`../content/`), so run it
from inside the checkout.

## What is here

| Book | Heath's text | This edition's notes | Interactive figures |
|---|---|---|---|
| I | 23 definitions, 5 postulates, 5 common notions, 48 propositions | all of them | I.1–I.5 this edition's; I.6–I.48 adapted from Joyce's |
| II | 2 definitions, 14 propositions | all of them | adapted from Joyce's |
| III | 11 definitions, 37 propositions | all of them | adapted from Joyce's |
| IV | 7 definitions, 16 propositions | all of them | adapted from Joyce's |
| V | 18 definitions, 25 propositions | all of them | adapted from Joyce's |
| VI | 5 definitions (Def. 5 has no text in Heath), 33 propositions | all of them | adapted from Joyce's |
| VII | 22 definitions, 39 propositions | all of them | adapted from Joyce's |
| VIII | 27 propositions | all of them | adapted from Joyce's |
| IX | 36 propositions | all of them | adapted from Joyce's |
| X | 16 definitions (three sets: I.1–4, II.1–6, III.1–6), 115 propositions | all of them | adapted from Joyce's |
| XI | 28 definitions, 39 propositions | all of them | adapted from Joyce's |
| XII | 18 propositions | all of them | adapted from Joyce's |
| XIII | 18 propositions | all of them | adapted from Joyce's |

Every item also links to Joyce's guide and translation on euclids-elements.org, and has Heath's
textual notes where he has them. Figures
follow Heath's lettering. All thirteen books are annotated.

## Reading

- **Read a whole book**: each book's *Propositions* page gives Euclid's complete text, every proposition
  in full and laid out step by step, to read straight through. The figure and notes on the right follow
  the proposition you are reading. A proposition's own address (`#/I.47`, `#/I.47/10`) opens this page
  at that proposition or step.
- **Click a sentence** to open its notes. <kbd>j</kbd>/<kbd>k</kbd> step through,
  <kbd>Esc</kbd> closes.
- **Point at a lettered name** — *AB*, *ABC*, "the angle *BAC*" — anywhere, in Euclid or in a note,
  to light it in the figure.
- **Click a reference** (`Post. 3`, `I.4`) to see it in the side panel without leaving your
  place; ⌘/Ctrl-click to go there.
- **Depth**: *Hint* (level 1, the default), *Explain* (level 2: what Euclid does, the fact used,
  its justification, why it follows, what is left implicit), *Modern* (level 3: the relevant lines
  of a modern reconstruction). Set the default with the switch in the panel or the **Aa** menu.
- **Joyce's guide**: every panel links to the item's page on
  [euclids-elements.org](https://www.euclids-elements.org/elements/), where D. E. Joyce's guide
  and translation are published by his permission. His text is not included in this app.
- **Aa** menu: numbered steps or Heath's continuous prose; build the figure step by step; hide
  Heath's bracketed references; light/dark theme.
- Your place (page, step, scroll position) is remembered in the browser.

## How accuracy is enforced

- **Euclid is Heath, verbatim.** `scripts/extract-heath.mjs` extracts the text mechanically from
  the Perseus TEI edition (pinned commit). Annotation files quote Heath in plain words, and
  `src/lib/align.ts` requires every step to be exactly the next words of Heath's text — nothing
  skipped, added or reworded. The words displayed as Euclid are cut from the source, not from the
  annotation. A few Perseus transcription slips (punctuation, spacing, misprints) are corrected and listed on
  the About page.
- **Tests** (`tests/corpus.test.ts`) check that every annotated proof covers Heath's text
  completely, that every highlighted or mentioned figure element exists in the figure, that every
  cited item exists and precedes the proposition, and that reconstruction lines point at real
  steps.
- **Voices are kept apart**: *Euclid* (serif, rubric rule), *Explanation* (blue), *Modern
  interpretation* (green), plus flagged *gaps by modern standards* and *scholars disagree* notes.
  Heath's bracketed references are shown as his, and his interpolation brackets (I.4) are kept.

## Adding annotations

Each proposition is one YAML file in `src/content/bookN/` — see `prop-01.yaml`, the model for the
rest. In outline:

```yaml
id: I.6
kind: theorem                 # or problem
title: …                      # an editorial label; Euclid's propositions have no titles
paraphrase: |                 # the enunciation in modern words
diagram:
  width: 340
  height: 260
  elements: ["A;point;free;100,200", …]   # geomlib element strings
  aliases: { BA: AB }
  given: [A, B, C]            # drawn before any construction step
  equal: [[AB, AC], [angABC, angACB]]   # classes of equal lines/angles, each drawn in its own colour (max 6)
steps:
  - part: setting-out         # enunciation | setting-out | specification | construction | proof | conclusion
    text: "Let ABC be a triangle …"   # Heath's words, plain
    highlight: [ABC]          # figure elements lit when the step is selected
    adds: [D]                 # elements first drawn at this step
    hint: |                   # level 1
    explain: { did, fact, justification, follows, implicit }   # level 2
    modern: |                 # "In modern notation" (KaTeX in $…$)
    gap: |                    # a gap by modern standards
    dispute: |                # genuine scholarly disagreement
    cites: [I.4]              # results used that Heath does not bracket
reconstruction: { preamble, lines: [{ steps: [1, 2], text }], closing }
commentary: | …
gaps: | …
historical: | …
```

In any prose field: `{AB}` lights *AB*; `{the side AB|AB}` shows other words; `[[I.4]]` links a
reference; `$…$` / `$$…$$` is KaTeX. After editing, `python3 scripts/blockify-yaml.py FILE` turns
one-line prose fields into YAML block scalars (prose is full of colons), then `npm test`.

Definitions, postulates and common notions live in `definitions.yaml`, `postulates.yaml` and
`common-notions.yaml` (`paraphrase`, `meaning`, `modern`, `examples`, `nonExamples`, inline SVG
`figure`, `notes`, `interpretations`). "Used in" lists are computed from Heath's references and the
notes' `cites`.

## Adding a book

1. `node scripts/extract-heath.mjs N` → `src/data/heath/bookN.json`.
2. Import it in `src/lib/corpus.ts` (the `HEATH` list) and add `N` to `books` in `vite.config.ts`.
3. Flip `available` in `src/content/books.ts`; put annotations in `src/content/bookN/`.

Nothing in the interface is specific to Book I; unannotated propositions show Heath's text,
Joyce's figure and a link to Joyce's guide.

## Layout

```
companion/
  scripts/extract-heath.mjs   Heath (Perseus TEI) → src/data/heath/bookN.json
  scripts/blockify-yaml.py    prose fields → YAML block scalars
  scripts/screenshot.mjs      Playwright screenshots / console-error smoke test
  plugins/lektor.ts           Vite plugin: Joyce's figures + site links (.lr) → virtual:joyce
  src/lib/align.ts            quotation check and step alignment
  src/lib/corpus.ts           Heath + annotations + Joyce's figures, dependencies, backlinks
  src/lib/rich.ts             renderers for the three voices
  src/components/, src/pages/ React UI
  src/content/                this edition's annotations (YAML)
  tests/corpus.test.ts        integrity checks
```

## Sources and licences

- **Heath**: *The Thirteen Books of Euclid's Elements*, Cambridge, 1908 — public domain. Digital
  text: Perseus Digital Library, Tufts University, CC BY-SA 4.0
  (`tlg1799.tlg001.perseus-eng2.xml`, commit `70427323`).
- **Joyce**: guides, translation and figures © David E. Joyce, republished in this repository by
  permission (see `../COPYRIGHT.md`). His guides and translation are not part of this app; it links to
  them on euclids-elements.org. Fallback figures are read from `../content/` at build time. The `diagram` blocks of `src/content/book1/prop-06.yaml` … `prop-48.yaml`
  and of every `src/content/book2/` … `book13/` `prop-*.yaml` are adapted from his figures there (the geomlib element lists, relettered and extended); they stay
  under his terms, not the MIT licence below.
- **geomlib** (MIT), Nelson Brown's TypeScript port of Joyce's Geometry Applet, draws the figures.
- This edition's annotations (apart from the adapted figures above) and code: MIT, like the rest of
  the repository's own code.
