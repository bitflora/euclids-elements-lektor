import type { BookInfo, WorkPartInfo } from "../types";

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

// The Zhou bi suan jing 周髀算經, in the six parts of the received text.
export const ZB_PARTS: WorkPartInfo[] = [
  { n: 1, zh: "卷上之一", label: "Volume 1, part 1", subject: "Shang Gao: the right triangle and the uses of the trysquare" },
  { n: 2, zh: "卷上之二", label: "Volume 1, part 2", subject: "Chenzi: the gnomon, the height of the sun, the sun's paths" },
  { n: 3, zh: "卷上之三", label: "Volume 1, part 3", subject: "The chart of the seven orbits" },
  { n: 4, zh: "卷下之一", label: "Volume 2, part 1", subject: "The shape of heaven; the pole; laying out the lunar lodges" },
  { n: 5, zh: "卷下之二", label: "Volume 2, part 2", subject: "Distances from the pole; the 24 solar terms; the moon's motion" },
  { n: 6, zh: "卷下之三", label: "Volume 2, part 3", subject: "Sunrise and sunset; the calendar cycles" },
];

// The Jiuzhang suanshu 九章算術: this edition has the four geometrical chapters of the nine.
export const JZ_PARTS: WorkPartInfo[] = [
  { n: 1, zh: "卷第一", name: "方田", label: "Chapter 1", subject: "Fang tian, rectangular fields: areas of plane figures; fractions" },
  { n: 4, zh: "卷第四", name: "少廣", label: "Chapter 4", subject: "Shao guang, short width: square and cube roots; the circle and the sphere" },
  { n: 5, zh: "卷第五", name: "商功", label: "Chapter 5", subject: "Shang gong, assessing works: volumes of solids" },
  { n: 9, zh: "卷第九", name: "句股", label: "Chapter 9", subject: "Gou gu, base and altitude: the right triangle" },
];
