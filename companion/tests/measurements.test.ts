import { describe, expect, it } from "vitest";
import { measurementNotes } from "../src/lib/measurements";

describe("passage measurement conversions", () => {
  it("converts actual distances, including thousands separators", () => {
    expect(measurementNotes("1000 *li* and 20,000 *li*", "千里二萬里")).toEqual([
      "1000 *li* ≈ 414 km.", "20,000 *li* ≈ 8,280 km.",
    ]);
  });
  it("converts quantities written as words", () => {
    expect(measurementNotes("one *cun* per thousand *li*; two thousand *li*", "寸里")).toEqual([
      "one *cun* ≈ 2.3 cm.", "thousand *li* ≈ 414 km.", "two thousand *li* ≈ 828 km.",
    ]);
  });
  it("converts every dimension and field area", () => {
    expect(measurementNotes("15 *bu* wide, 16 *bu* long; 1 *mu*", "十五步十六步一畝")).toEqual([
      "15 *bu* ≈ 20.7 m.", "16 *bu* ≈ 22.08 m.", "1 *mu* ≈ 457.1 m².",
    ]);
  });
  it("handles fractions and mixed numbers", () => {
    expect(measurementNotes("12/35 *jin*; 1 1/2 *chi*; 26,632 and 1/2 *li*", "斤尺里")).toEqual([
      "12/35 *jin* ≈ 85.71 g.", "1 1/2 *chi* ≈ 34.5 cm.", "26,632 and 1/2 *li* ≈ 11,030 km.",
    ]);
  });
  it("distinguishes homonyms using the source", () => {
    expect(measurementNotes("6 *li*", "六釐")).toEqual(["6 *li* ≈ 1.38 mm."]);
    expect(measurementNotes("1 *hu*", "一忽")).toEqual(["1 *hu* ≈ 0.00023 mm."]);
    expect(measurementNotes("1 *hu*", "一斛")).toEqual(["1 *hu* ≈ 20 L."]);
    expect(measurementNotes("*shi* is the dividend; 3 *fen*", "實三分")).toEqual([]);
  });
  it("converts explicit and implicit areas and volumes", () => {
    expect(measurementNotes("240 [square] *bu*; volume 1000 *chi*; 2 cubic *cun*", "步尺寸")).toEqual([
      "240 [square] *bu* ≈ 457.1 m².", "1000 *chi* ≈ 12,170 L.", "2 cubic *cun* ≈ 24.33 mL.",
    ]);
  });
  it("converts capacity, weight, time and math fractions", () => {
    expect(measurementNotes("3 *dou*, 2 *jin*, 25 *ke*, $\\tfrac{1}{2}$ *chi*", "斗斤刻尺")).toEqual([
      "3 *dou* ≈ 6 L.", "2 *jin* ≈ 500 g.", "25 *ke* ≈ 360 minutes.", "1/2 *chi* ≈ 11.5 cm.",
    ]);
  });
});
