/** Approximate Han scales, rather than modern Chinese market measures.
 * Base scales: https://www.sciengine.com/doi/pdf/1BF271281C954C2DBBBC75A73A65D8E6
 * Smaller units and exceptional capacity ratios follow the passages themselves.
 */
const units = [
  ["zhang", "丈"],
  ["chi", "尺"],
  ["cun", "寸"],
  ["bu", "步"],
  ["li", "里"],
  ["mu", "畝"],
  ["qing", "頃"],
  ["fen", "分"],
  ["li", "釐厘"],
  ["hao", "毫"],
  ["miao", "秒"],
  ["hu", "忽"],
  ["hu", "斛"],
  ["dou", "斗"],
  ["sheng", "升"],
  ["ge", "合"],
  ["yue", "龠"],
  ["ou", "區甌"],
  ["fu", "鬴釜"],
  ["zhong", "鍾鐘"],
  ["jin", "斤"],
  ["liang", "兩"],
  ["zhu", "銖"],
  ["jun", "鈞"],
  ["shi", "石"],
  ["ke", "刻"],
] as const;

const scales: Record<string, number> = {
  zhang: 2.3, chi: 0.23, cun: 0.023, bu: 1.38, "li:里": 414,
  fen: 0.0023, "li:釐": 0.00023, hao: 0.000023, miao: 0.0000023, "hu:忽": 0.00000023,
  mu: 240 * 1.38 ** 2, qing: 100 * 240 * 1.38 ** 2,
  "hu:斛": 20, dou: 2, sheng: 0.2, ge: 0.02, yue: 0.01,
  ou: 3.2, fu: 12.8, zhong: 128,
  jin: 0.25, liang: 0.25 / 16, zhu: 0.25 / 16 / 24, jun: 7.5, shi: 30, ke: 864,
};
const lengths = new Set(["zhang", "chi", "cun", "bu", "li:里", "li:釐", "fen", "hao", "miao", "hu:忽"]);
const capacities = new Set(["hu:斛", "dou", "sheng", "ge", "yue", "ou", "fu", "zhong"]);
const wordValues: Record<string, number> = {
  one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9,
  ten: 10, hundred: 100, thousand: 1000, half: 0.5,
};
const words = `(?:(?:a|one|two|three|four|five|six|seven|eight|nine|ten)\\s+)?(?:hundred|thousand)|${Object.keys(wordValues).join("|")}`;
const number = String.raw`(?:\d[\d,]*(?:\.\d+)?(?:\/\d[\d,]*|\s+(?:and\s+)?\d[\d,]*\/\d[\d,]*)?|[½¼¾])`;
const quantity = new RegExp(`(?<![\\w/])(${number}|${words})\\s*(?:(\\[?square\\]?|\\[?cubic\\]?)\\s+)?\\*(${units.map(([n]) => n).join("|")})\\*`, "gi");

function valueOf(raw: string): number {
  raw = raw.toLowerCase();
  if (raw in wordValues) return wordValues[raw];
  if (/^[a-z]/.test(raw)) {
    const [count, magnitude] = raw.split(/\s+/);
    return (count === "a" ? 1 : wordValues[count]) * wordValues[magnitude];
  }
  const vulgar: Record<string, number> = { "½": 0.5, "¼": 0.25, "¾": 0.75 };
  if (raw in vulgar) return vulgar[raw];
  return raw.replaceAll(",", "").split(/\s+(?:and\s+)?/).reduce((sum, part) => {
    const [a, b] = part.split("/").map(Number);
    return sum + (b === undefined ? a : a / b);
  }, 0);
}

function metric(value: number, dimension: string): string {
  let unit = dimension;
  if (dimension === "m") {
    if (value >= 1000) { value /= 1000; unit = "km"; }
    else if (value < 0.01) { value *= 1000; unit = "mm"; }
    else if (value < 1) { value *= 100; unit = "cm"; }
  } else if (dimension === "m²" && value >= 10000) { value /= 10000; unit = "ha"; }
  else if (dimension === "L" && value < 1) { value *= 1000; unit = "mL"; }
  else if (dimension === "kg" && value < 1) { value *= 1000; unit = "g"; }
  else if (dimension === "s" && value >= 60) { value /= 60; unit = "minutes"; }
  return `${Number(value.toPrecision(4)).toLocaleString("en-US", { maximumSignificantDigits: 4 })} ${unit}`;
}

/** Convert each written quantity, keeping homonymous units tied to the Chinese. */
export function measurementNotes(translation: string, source: string): string[] {
  // Fractions in prose and in inline mathematics share the same conversion path.
  translation = translation.replace(/\\(?:tfrac|frac)\s*\{(\d+)\}\s*\{(\d+)\}/g, "$1/$2")
    .replace(/\$(\d+)\s*([0-9]+\/[0-9]+)\$/g, "$1 $2")
    .replace(/\$([0-9]+\/[0-9]+)\$/g, "$1");
  const notes: string[] = [];
  for (const match of translation.matchAll(quantity)) {
    const [, raw, power, originalName] = match;
    const name = originalName.toLowerCase();
    const candidates = units.filter(([n, chars]) => n === name && [...chars].some((c) => source.includes(c)));
    for (const [, chars] of candidates) {
      const key = name === "li" || name === "hu" ? `${name}:${chars[0]}` : name;
      let scale = scales[key];
      let dimension = capacities.has(key) ? "L" : name === "ke" ? "s" : ["mu", "qing"].includes(name) ? "m²" : "kg";
      if (lengths.has(key)) {
        // Explicit powers take priority. Older translations also omit the power in
        // phrases such as “volume 1000 chi” or “an area of 240 bu”.
        const before = translation.slice(0, match.index).split(/[.;!?\n]/).at(-1) ?? "";
        const context = before.slice(-80);
        const exponent = power?.includes("cubic") ? 3 : power?.includes("square") ? 2
          : /(?:volume|cubic content|solid content)[^,;]*$/i.test(context) ? 3
          : /(?:area|square units)[^,;]*$/i.test(context) ? 2 : 1;
        scale **= exponent;
        dimension = exponent === 3 ? "L" : exponent === 2 ? "m²" : "m";
        if (exponent === 3) scale *= 1000;
        // Fen without a length context means a fraction, not a measurement.
        if (name === "fen" && !/[尺寸釐厘毫秒忽]/.test(source)) continue;
      }
      if (name === "shi" && /(?:grain|capacity|holds)/i.test(translation)) { scale = 20; dimension = "L"; }
      if (name === "dou" && /four\s+\*sheng\*\s+make\s+a\s+\*dou\*/i.test(translation)) scale = 0.8;
      const qualifier = candidates.length > 1 ? ` (${chars[0]})` : "";
      notes.push(`${match[0]}${qualifier} ≈ ${metric(valueOf(raw) * scale, dimension)}.`);
    }
  }
  return [...new Set(notes)];
}
