import type { BookInfo } from "../types";

// Adding a book: extract Heath's text (`node scripts/extract-heath.mjs N`),
// register its JSON in corpus.ts, add N to the lektor plugin's `books` in
// vite.config.ts, drop annotations under src/content/bookN/, and flip
// `available` here. Nothing in the UI is specific to Book I.
export const BOOKS: BookInfo[] = [
  { n: 1, roman: "I", title: "Book I", subject: "Plane geometry: triangles, parallels, and the Pythagorean theorem", available: true },
  { n: 2, roman: "II", title: "Book II", subject: "Geometric algebra", available: true },
  { n: 3, roman: "III", title: "Book III", subject: "Circles", available: true },
  { n: 4, roman: "IV", title: "Book IV", subject: "Inscribed and circumscribed regular polygons", available: true },
  { n: 5, roman: "V", title: "Book V", subject: "The theory of proportion", available: true },
  { n: 6, roman: "VI", title: "Book VI", subject: "Similar figures", available: true },
  { n: 7, roman: "VII", title: "Book VII", subject: "Number theory", available: true },
  { n: 8, roman: "VIII", title: "Book VIII", subject: "Number theory: continued proportions", available: true },
  { n: 9, roman: "IX", title: "Book IX", subject: "Number theory: primes and perfect numbers", available: true },
  { n: 10, roman: "X", title: "Book X", subject: "Incommensurable magnitudes", available: true },
  { n: 11, roman: "XI", title: "Book XI", subject: "Solid geometry", available: true },
  { n: 12, roman: "XII", title: "Book XII", subject: "Areas and volumes: the method of exhaustion", available: true },
  { n: 13, roman: "XIII", title: "Book XIII", subject: "The regular solids", available: true },
];

/** "Book I", "Books I–II", … — for "not available yet" messages. */
export function availableBooks(): string {
  const r = BOOKS.filter((b) => b.available).map((b) => b.roman);
  return r.length === 1 ? `Book ${r[0]}` : `Books ${r[0]}–${r[r.length - 1]}`;
}

export const ROMAN = ["", "I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X", "XI", "XII", "XIII"];

export const bookOf = (roman: string) => ROMAN.indexOf(roman);
