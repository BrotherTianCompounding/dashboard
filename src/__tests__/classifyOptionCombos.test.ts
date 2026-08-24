import { classifyOptionCombos } from "../lib/classifyOptionCombos";
import type { ClassifiedHolding } from "../lib/types";

function opt(overrides: Partial<ClassifiedHolding>): ClassifiedHolding {
  return {
    symbol: "",
    description: "",
    quantity: 0,
    currentValue: 0,
    costBasisTotal: 0,
    totalGainLossDollar: 0,
    category: "wheel",
    ...overrides,
  };
}

const NOW = new Date(2026, 6, 10); // Jul 10 2026, fixed for DTE assertions

function val(groups: ReturnType<typeof classifyOptionCombos>, label: string) {
  return groups.find((g) => g.label === label)?.value ?? 0;
}

describe("classifyOptionCombos", () => {
  it("detects a synthetic long (long call + short put, same expiry + strike)", () => {
    const h: ClassifiedHolding[] = [
      opt({ description: "APP JUN 17 2027 $370 CALL", quantity: 1, currentValue: 20540 }),
      opt({ description: "APP JUN 17 2027 $370 PUT", quantity: -1, currentValue: -6600 }),
    ];
    const g = classifyOptionCombos(h, NOW);
    expect(val(g, "Synthetic Long")).toBeCloseTo(27140);
    expect(val(g, "LEAPS Call")).toBe(0);
    expect(val(g, "Sell Put")).toBe(0);
  });

  it("treats a long+short call vertical as a call spread", () => {
    const h: ClassifiedHolding[] = [
      opt({ description: "NFLX JAN 15 2027 $75 CALL", quantity: 2, currentValue: 1750 }),
      opt({ description: "NFLX JAN 15 2027 $78 CALL", quantity: -2, currentValue: -1580 }),
    ];
    const g = classifyOptionCombos(h, NOW);
    expect(val(g, "Call Spread")).toBeCloseTo(3330);
  });

  it("does NOT treat same-direction same-expiry calls as a spread (both long → LEAPS)", () => {
    const h: ClassifiedHolding[] = [
      opt({ description: "QQQ JUN 17 2027 $540 CALL", quantity: 1, currentValue: 22003 }),
      opt({ description: "QQQ JUN 17 2027 $630 CALL", quantity: 1, currentValue: 14872 }),
    ];
    const g = classifyOptionCombos(h, NOW);
    expect(val(g, "Call Spread")).toBe(0);
    expect(val(g, "LEAPS Call")).toBeCloseTo(36875);
  });

  it("detects a long+short put vertical as a put spread", () => {
    const h: ClassifiedHolding[] = [
      opt({ description: "SOXL JUL 31 2026 $195 PUT", quantity: 1, currentValue: 4660 }),
      opt({ description: "SOXL JUL 31 2026 $210 PUT", quantity: -1, currentValue: -5635 }),
    ];
    const g = classifyOptionCombos(h, NOW);
    expect(val(g, "Put Spread")).toBeCloseTo(10295);
  });

  it("does NOT treat two short puts (same expiry, diff strike) as a spread", () => {
    const h: ClassifiedHolding[] = [
      opt({ description: "AAOX AUG 21 2026 $35 PUT", quantity: -2, currentValue: -4080 }),
      opt({ description: "AAOX AUG 21 2026 $40 PUT", quantity: -2, currentValue: -4760 }),
    ];
    const g = classifyOptionCombos(h, NOW);
    expect(val(g, "Put Spread")).toBe(0);
    expect(val(g, "Sell Put")).toBeCloseTo(8840);
  });

  it("gives synthetic long priority over a call spread on the shared leg", () => {
    // TSLA Jan21'28: C250 long, C360 long, P360 short.
    // C360+P360 (same strike) → synthetic; C250 left alone → LEAPS (no spread).
    const h: ClassifiedHolding[] = [
      opt({ description: "TSLA JAN 21 2028 $250 CALL", quantity: 1, currentValue: 19715 }),
      opt({ description: "TSLA JAN 21 2028 $360 CALL", quantity: 1, currentValue: 13265 }),
      opt({ description: "TSLA JAN 21 2028 $360 PUT", quantity: -1, currentValue: -6260 }),
    ];
    const g = classifyOptionCombos(h, NOW);
    expect(val(g, "Synthetic Long")).toBeCloseTo(13265 + 6260);
    expect(val(g, "LEAPS Call")).toBeCloseTo(19715);
    expect(val(g, "Call Spread")).toBe(0);
  });

  it("carries per-leg detail (strike/expiry/DTE/contracts/cost) for LEAPS Call", () => {
    const h: ClassifiedHolding[] = [
      opt({ description: "PLTR JAN 21 2028 $110 CALL", quantity: 1, currentValue: 4660, costBasisTotal: 5342.67 }),
    ];
    const g = classifyOptionCombos(h, NOW);
    const leaps = g.find((x) => x.label === "LEAPS Call")!;
    expect(leaps.legs).toHaveLength(1);
    expect(leaps.legs[0]).toMatchObject({
      underlying: "PLTR",
      right: "C",
      strike: 110,
      expiry: "2028-01-21",
      contracts: 1,
      value: 4660,
      cost: 5342.67,
    });
    // Jan 21 2028 is well over a year from Jul 10 2026
    expect(leaps.legs[0].daysToExpiry).toBeGreaterThan(500);
  });

  it("routes a lone long put to Other", () => {
    const h: ClassifiedHolding[] = [
      opt({ description: "TSLA AUG 21 2026 $380 PUT", quantity: 1, currentValue: 1280 }),
    ];
    const g = classifyOptionCombos(h, NOW);
    expect(val(g, "Other")).toBeCloseTo(1280);
  });

  it("parses decimal strikes", () => {
    const h: ClassifiedHolding[] = [
      opt({ description: "NVDL AUG 21 2026 $32.33 PUT", quantity: -3, currentValue: -990 }),
    ];
    const g = classifyOptionCombos(h, NOW);
    const sellPut = g.find((x) => x.label === "Sell Put")!;
    expect(sellPut.legs[0].strike).toBeCloseTo(32.33);
  });
});
