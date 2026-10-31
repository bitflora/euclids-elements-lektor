// ─── Identifiers ──────────────────────────────────────────────────────────
// "I.1", "I.Def.15", "I.Post.3", "I.CN.1" — Roman book, kind, number.
// Book X's later definitions carry their set: "X.Def.II.1", "X.Def.III.6".
export type ItemId = string;
export type ItemKind = "definition" | "postulate" | "commonNotion" | "proposition";

// ─── Heath's text, as extracted by scripts/extract-heath.mjs ─────────────
export interface HeathNote {
  lemma: string;
  text: string;
}
export interface HeathPrinciple {
  id: ItemId;
  n: number;
  text: string;
  intro?: string;
  heibergNumber?: number;
  /** Book X's second and third sets of definitions: "II", "III". */
  set?: string;
  notes: HeathNote[];
}
export interface HeathProposition {
  id: ItemId;
  n: number;
  enunciation: string;
  proof: string[];
  qed: string | null;
  porism?: string;
  notes: HeathNote[];
}
export interface HeathBook {
  book: number;
  source: { translator: string; title: string; edition: string; transcription: string; url: string };
  definitions: HeathPrinciple[];
  postulates: HeathPrinciple[];
  commonNotions: HeathPrinciple[];
  propositions: HeathProposition[];
  corrections: { id: ItemId; from: string; to: string; reason: string }[];
}

// ─── Joyce's figures and site links, from the Lektor tree (virtual:joyce) ─
export interface JoyceFigure {
  width: number;
  height: number;
  config: string;
}
export interface JoyceEntry {
  /** The item's page on euclids-elements.org (Joyce's guide and translation). */
  url: string;
  group?: string;
  figures: JoyceFigure[];
}

// ─── This edition's annotations (src/content/**.yaml) ────────────────────
/** Rich text: Markdown + $KaTeX$ + {AB} diagram refs + [[I.4]] item refs. */
export type Rich = string;

/** Proclus's six parts of a proposition (Heath, vol. 1, p. 129). */
export type Part =
  | "enunciation"
  | "setting-out"
  | "specification"
  | "construction"
  | "proof"
  | "conclusion"
  // Heath prints some porisms and lemmas inside a proposition's text (X.4, X.16, XII.2 …).
  | "porism"
  | "lemma";

export interface Explanation {
  /** 1. What Euclid just did. */
  did?: Rich;
  /** 2. What geometric fact he is using. */
  fact?: Rich;
  /** 3. Which earlier result justifies it. */
  justification?: Rich;
  /** 4. Why the conclusion follows. */
  follows?: Rich;
  /** 5. What he leaves implicit. */
  implicit?: Rich;
}

export interface StepAnnotation {
  part: Part;
  /** Heath's words, plain (no {} or [[ ]] markup). Must match the source exactly. */
  text: string;
  /** Level 1 */
  hint?: Rich;
  /** Level 2 */
  explain?: Explanation;
  /** "In modern notation" */
  modern?: Rich;
  /** A gap by modern standards. */
  gap?: Rich;
  /** Genuine scholarly disagreement about the reading. */
  dispute?: Rich;
  /** Results used here that Heath does not cite in brackets. */
  cites?: ItemId[];
  /** Diagram elements to highlight. */
  highlight?: string[];
  /** Diagram elements first drawn at this step. */
  adds?: string[];
}

export interface DiagramSpec {
  width: number;
  height: number;
  pivot?: string;
  background?: string;
  /** geomlib element strings: "Name;type;construction;params;colors…" */
  elements: string[];
  aliases?: Record<string, string>;
  /** Elements drawn before any construction step (the givens). */
  given?: string[];
  /** Classes of parts the proposition declares equal; each class is drawn in its own colour. */
  equal?: string[][];
  caption?: Rich;
}

export interface ReconstructionLine {
  /** 1-based step numbers of Euclid's proof that this line reconstructs. */
  steps?: number[];
  text: Rich;
}

export interface PropositionAnnotation {
  id: ItemId;
  kind: "problem" | "theorem";
  title: string;
  paraphrase: Rich;
  diagram: DiagramSpec;
  steps: StepAnnotation[];
  reconstruction: { preamble?: Rich; lines: ReconstructionLine[]; closing?: Rich };
  commentary?: Rich;
  gaps?: Rich;
  interpretations?: Rich;
  historical?: Rich;
}

export interface PrincipleAnnotation {
  id: ItemId;
  title: string;
  paraphrase: Rich;
  meaning?: Rich;
  modern?: Rich;
  examples?: Rich[];
  nonExamples?: Rich[];
  /** Inline SVG (uses currentColor + CSS classes) */
  figure?: string;
  figureCaption?: Rich;
  notes?: Rich;
  interpretations?: Rich;
}

// ─── The assembled corpus the UI reads ───────────────────────────────────
export interface Step extends StepAnnotation {
  index: number; // 0-based in the stream
  number: number | null; // 1-based for setting-out..conclusion; null for enunciation / QED
  /** Heath's text for this span, with {AB} and [[id|label]] markup, from the source. */
  source: string;
  /** Index of Heath's paragraph (0 = enunciation, last = Q.E.D.) */
  para: number;
  /** Heath's own bracketed references in this span. */
  heathRefs: ItemId[];
  isQed?: boolean;
}

export interface Item {
  id: ItemId;
  kind: ItemKind;
  book: number;
  n: number;
  label: string; // "Proposition 1", "Definition 15"
  short: string; // "I.1", "Def. 15"
  /** Heath's text (principles) or enunciation (propositions), with markup. */
  text: string;
  /** Heath's lead-in, e.g. "Let the following be postulated:" before Post. 1 */
  intro?: string;
  heathNotes: HeathNote[];
  joyce?: JoyceEntry;
  principle?: PrincipleAnnotation;
  prop?: {
    heath: HeathProposition;
    annotation?: PropositionAnnotation;
    steps: Step[];
    kind: "problem" | "theorem";
  };
  /** Everything this item draws on (Heath's refs ∪ annotation cites), sorted. */
  uses: ItemId[];
  /** Which of `uses` Heath himself cites. */
  usesHeath: ItemId[];
  /** Items that use this one. */
  usedBy: ItemId[];
}

export interface BookInfo {
  n: number;
  roman: string;
  title: string;
  subject: string;
  available: boolean;
}
