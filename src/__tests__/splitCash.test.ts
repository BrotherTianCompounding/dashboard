import { splitCash } from "../lib/splitCash";

describe("splitCash", () => {
  it("returns 0 cash bucket and 0 excess when total cash is 0", () => {
    const result = splitCash({ totalCash: 0, totalValue: 100000, cashTargetPct: 5 });
    expect(result.cashBucket).toBe(0);
    expect(result.optionsExcessCash).toBe(0);
  });

  it("returns full cash in bucket when below target (3% < 5%)", () => {
    // totalValue=100000, target=5% → target value=5000
    // totalCash=3000 < 5000 → bucket=3000, excess=0
    const result = splitCash({ totalCash: 3000, totalValue: 100000, cashTargetPct: 5 });
    expect(result.cashBucket).toBe(3000);
    expect(result.optionsExcessCash).toBe(0);
  });

  it("caps bucket at target value when exactly at target (5% = 5%)", () => {
    const result = splitCash({ totalCash: 5000, totalValue: 100000, cashTargetPct: 5 });
    expect(result.cashBucket).toBe(5000);
    expect(result.optionsExcessCash).toBe(0);
  });

  it("caps bucket at target and puts excess into options (7% > 5%)", () => {
    // totalCash=7000, target=5000 → bucket=5000, excess=2000
    const result = splitCash({ totalCash: 7000, totalValue: 100000, cashTargetPct: 5 });
    expect(result.cashBucket).toBe(5000);
    expect(result.optionsExcessCash).toBe(2000);
  });

  it("handles 10% cash target (no income scenario)", () => {
    // totalCash=15000, totalValue=100000, target=10% → target value=10000
    // bucket=10000, excess=5000
    const result = splitCash({ totalCash: 15000, totalValue: 100000, cashTargetPct: 10 });
    expect(result.cashBucket).toBe(10000);
    expect(result.optionsExcessCash).toBe(5000);
  });

  it("handles totalValue=0 edge case without dividing by zero", () => {
    const result = splitCash({ totalCash: 0, totalValue: 0, cashTargetPct: 5 });
    expect(result.cashBucket).toBe(0);
    expect(result.optionsExcessCash).toBe(0);
  });

  it("invariant: cashBucket + optionsExcessCash === totalCash", () => {
    const cases = [
      { totalCash: 3000, totalValue: 100000, cashTargetPct: 5 },
      { totalCash: 7000, totalValue: 100000, cashTargetPct: 5 },
      { totalCash: 12345, totalValue: 234567, cashTargetPct: 10 },
    ];
    for (const c of cases) {
      const r = splitCash(c);
      expect(r.cashBucket + r.optionsExcessCash).toBeCloseTo(c.totalCash);
    }
  });
});
