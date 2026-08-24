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

type Groups = ReturnType<typeof classifyOptionCombos>;
const group = (g: Groups, label: string) => g.find((x) => x.label === label);
const ticker = (g: Groups, label: string, u: string) =>
  group(g, label)?.tickers.find((t) => t.underlying === u);

describe("classifyOptionCombos", () => {
  it("only returns the three shown categories (combos are excluded, not shown)", () => {
    const h: ClassifiedHolding[] = [
      // synthetic long — excluded entirely
      opt({ description: "APP JUN 17 2027 $370 CALL", quantity: 1, currentValue: 20540 }),
      opt({ description: "APP JUN 17 2027 $370 PUT", quantity: -1, currentValue: -6600 }),
    ];
    const g = classifyOptionCombos(h);
    expect(g).toEqual([]); // both legs absorbed by synthetic long → nothing to show
  });

  it("aggregates lone long calls into LEAPS Call by underlying with contract counts", () => {
    // QQQ: 6 long calls across strikes/expiries but no matching shorts → all LEAPS
    const h: ClassifiedHolding[] = [
      opt({ description: "QQQ JAN 15 2027 $600 CALL", quantity: 1, currentValue: 15045 }),
      opt({ description: "QQQ JUN 17 2027 $540 CALL", quantity: 1, currentValue: 22003 }),
      opt({ description: "QQQ JUN 17 2027 $630 CALL", quantity: 1, currentValue: 14872 }),
      opt({ description: "QQQ JUN 17 2027 $675 CALL", quantity: 1, currentValue: 11703 }),
      opt({ description: "QQQ SEP 17 2027 $635 CALL", quantity: 1, currentValue: 15586 }),
      opt({ description: "QQQ SEP 17 2027 $660 CALL", quantity: 1, currentValue: 13851 }),
      opt({ description: "NOK JAN 21 2028 $12 CALL", quantity: 2, currentValue: 880 }),
    ];
    const g = classifyOptionCombos(h);
    expect(ticker(g, "LEAPS Call", "QQQ")).toMatchObject({ contracts: 6 });
    expect(ticker(g, "LEAPS Call", "NOK")).toMatchObject({ contracts: 2 });
    // sorted by contracts desc → QQQ before NOK
    expect(group(g, "LEAPS Call")!.tickers.map((t) => t.underlying)).toEqual(["QQQ", "NOK"]);
    expect(group(g, "LEAPS Call")!.contracts).toBe(8);
  });

  it("a long+short call vertical is excluded (spread), not shown as LEAPS", () => {
    const h: ClassifiedHolding[] = [
      opt({ description: "NFLX JAN 15 2027 $75 CALL", quantity: 2, currentValue: 1750 }),
      opt({ description: "NFLX JAN 15 2027 $78 CALL", quantity: -2, currentValue: -1580 }),
    ];
    const g = classifyOptionCombos(h);
    expect(g).toEqual([]);
  });

  it("two short puts (same expiry, diff strike) are NOT a spread → Sell Put", () => {
    const h: ClassifiedHolding[] = [
      opt({ description: "AAOX AUG 21 2026 $35 PUT", quantity: -2, currentValue: -4080 }),
      opt({ description: "AAOX AUG 21 2026 $40 PUT", quantity: -2, currentValue: -4760 }),
    ];
    const g = classifyOptionCombos(h);
    expect(ticker(g, "Sell Put", "AAOX")).toMatchObject({ contracts: 4, value: 8840 });
  });

  it("gives synthetic long priority over a call spread on the shared leg", () => {
    // TSLA Jan21'28: C250 long, C360 long, P360 short.
    // C360+P360 → synthetic (excluded); C250 left alone → LEAPS Call.
    const h: ClassifiedHolding[] = [
      opt({ description: "TSLA JAN 21 2028 $250 CALL", quantity: 1, currentValue: 19715 }),
      opt({ description: "TSLA JAN 21 2028 $360 CALL", quantity: 1, currentValue: 13265 }),
      opt({ description: "TSLA JAN 21 2028 $360 PUT", quantity: -1, currentValue: -6260 }),
    ];
    const g = classifyOptionCombos(h);
    expect(ticker(g, "LEAPS Call", "TSLA")).toMatchObject({ contracts: 1 });
    // no synthetic/spread label appears in output at all
    expect(g.map((x) => x.label).sort()).toEqual(["LEAPS Call"]);
  });

  it("tallies sell puts and sell calls per underlying", () => {
    const h: ClassifiedHolding[] = [
      opt({ description: "RKLB AUG 21 2026 $90 PUT", quantity: -1, currentValue: -1605 }),
      opt({ description: "MRVL SEP 18 2026 $270 PUT", quantity: -1, currentValue: -6020 }),
      opt({ description: "NVDL AUG 21 2026 $32.33 PUT", quantity: -3, currentValue: -990 }),
      opt({ description: "NVDA AUG 07 2026 $220 CALL", quantity: -1, currentValue: -545 }),
    ];
    const g = classifyOptionCombos(h);
    expect(ticker(g, "Sell Put", "NVDL")).toMatchObject({ contracts: 3 }); // decimal strike parsed
    expect(ticker(g, "Sell Put", "RKLB")).toMatchObject({ contracts: 1 });
    expect(ticker(g, "Sell Call", "NVDA")).toMatchObject({ contracts: 1 });
  });

  it("excludes a lone long put (not one of the shown categories)", () => {
    const h: ClassifiedHolding[] = [
      opt({ description: "TSLA AUG 21 2026 $380 PUT", quantity: 1, currentValue: 1280 }),
    ];
    const g = classifyOptionCombos(h);
    expect(g).toEqual([]);
  });
});
