import { buildSnapshot } from "../lib/buildSnapshot";
import type { FidelityRow } from "../lib/types";

function row(overrides: Partial<FidelityRow>): FidelityRow {
  return {
    accountName: "X12345",
    symbol: "",
    description: "",
    quantity: 0,
    lastPrice: 0,
    currentValue: 0,
    costBasisTotal: 0,
    totalGainLossDollar: 0,
    percentOfAccount: 0,
    ...overrides,
  };
}

describe("buildSnapshot (baseline behavior)", () => {
  it("computes total value from all rows including pending", () => {
    const rows: FidelityRow[] = [
      row({ symbol: "QQQM", description: "INVESCO NASDAQ 100 ETF", quantity: 100, currentValue: 25000 }),
      row({ symbol: "SPAXX", description: "FIDELITY GOVERNMENT", quantity: 5000, currentValue: 5000 }),
      row({ symbol: "Pending activity", description: "PENDING", quantity: 0, currentValue: 100 }),
    ];
    const snap = buildSnapshot(rows, "test.csv", null);
    expect(snap.totalValue).toBeCloseTo(30100);
  });

  it("creates three buckets in order: safe-side, cash, options", () => {
    const rows: FidelityRow[] = [
      row({ symbol: "QQQM", description: "INVESCO NASDAQ 100 ETF", quantity: 100, currentValue: 25000 }),
    ];
    const snap = buildSnapshot(rows, "test.csv", null);
    expect(snap.buckets.map((b) => b.key)).toEqual(["safe-side", "cash", "options"]);
  });

  it("cash bucket is capped at target value (post-split behavior)", () => {
    // totalValue=60000, age=38+income → cash target=5% → target value=3000
    // totalCash=10000 → cash bucket=3000 (capped), excess=7000
    const rows: FidelityRow[] = [
      row({ symbol: "QQQM", description: "INVESCO NASDAQ 100 ETF", quantity: 100, currentValue: 50000 }),
      row({ symbol: "SPAXX", description: "FIDELITY GOVERNMENT", quantity: 10000, currentValue: 10000 }),
    ];
    const snap = buildSnapshot(rows, "test.csv", null);
    const cash = snap.buckets.find((b) => b.key === "cash")!;
    expect(cash.totalValue).toBeCloseTo(3000);
  });
});

describe("buildSnapshot — cash split (new behavior)", () => {
  it("cash < target: cash bucket gets all cash, options gets no excess", () => {
    // totalValue=100000, age=38+income → cash target=5% → target value=5000
    // totalCash=3000 → bucket=3000, options excess=0
    const rows: FidelityRow[] = [
      row({ symbol: "QQQM", description: "INVESCO NASDAQ 100 ETF", quantity: 100, currentValue: 97000 }),
      row({ symbol: "SPAXX", description: "FIDELITY GOVERNMENT", quantity: 3000, currentValue: 3000 }),
    ];
    const snap = buildSnapshot(rows, "test.csv", null);
    const cash = snap.buckets.find((b) => b.key === "cash")!;
    const options = snap.buckets.find((b) => b.key === "options")!;
    const cashItem = options.items.find((i) => i.label === "现金")!;

    expect(cash.totalValue).toBeCloseTo(3000);
    expect(cashItem.value).toBeCloseTo(0);
  });

  it("cash > target: cash bucket capped, excess goes to options 现金 item", () => {
    // totalValue=100000, target=5%=5000
    // totalCash=7000 → bucket=5000, options 现金=2000
    const rows: FidelityRow[] = [
      row({ symbol: "QQQM", description: "INVESCO NASDAQ 100 ETF", quantity: 100, currentValue: 93000 }),
      row({ symbol: "SPAXX", description: "FIDELITY GOVERNMENT", quantity: 7000, currentValue: 7000 }),
    ];
    const snap = buildSnapshot(rows, "test.csv", null);
    const cash = snap.buckets.find((b) => b.key === "cash")!;
    const options = snap.buckets.find((b) => b.key === "options")!;
    const cashItem = options.items.find((i) => i.label === "现金")!;

    expect(cash.totalValue).toBeCloseTo(5000);
    expect(cashItem.value).toBeCloseTo(2000);
  });

  it("options bucket value includes excess cash", () => {
    // totalValue=100000, target=5%=5000
    // totalCash=7000 → options excess=2000
    // No option positions → options.totalValue=0+2000=2000
    const rows: FidelityRow[] = [
      row({ symbol: "QQQM", description: "INVESCO NASDAQ 100 ETF", quantity: 100, currentValue: 93000 }),
      row({ symbol: "SPAXX", description: "FIDELITY GOVERNMENT", quantity: 7000, currentValue: 7000 }),
    ];
    const snap = buildSnapshot(rows, "test.csv", null);
    const options = snap.buckets.find((b) => b.key === "options")!;
    expect(options.totalValue).toBeCloseTo(2000);
  });

  it("invariant: safeSide + cash + options ≈ totalValue (no short positions)", () => {
    const rows: FidelityRow[] = [
      row({ symbol: "QQQM", description: "INVESCO NASDAQ 100 ETF", quantity: 100, currentValue: 60000 }),
      row({ symbol: "SPAXX", description: "FIDELITY GOVERNMENT", quantity: 8000, currentValue: 8000 }),
      row({
        symbol: "AAPL300118C00100000",
        description: "AAPL JAN 18 2030 $100 CALL",
        quantity: 1,
        currentValue: 4500,
      }),
    ];
    const snap = buildSnapshot(rows, "test.csv", null);
    const sum = snap.buckets.reduce((s, b) => s + b.totalValue, 0);
    expect(sum).toBeCloseTo(snap.totalValue, 0);
  });

  it("with short options, bucket sum exceeds totalValue by 2× short mark (Math.abs side effect)", () => {
    // Short put at -500: totalValue includes -500, options bucket adds abs(500).
    // Sum overshoots by 1000 = 2 × 500. Tracking this as a known invariant under Math.abs semantics.
    const rows: FidelityRow[] = [
      row({ symbol: "QQQM", description: "INVESCO NASDAQ 100 ETF", quantity: 100, currentValue: 60000 }),
      row({ symbol: "SPAXX", description: "FIDELITY GOVERNMENT", quantity: 8000, currentValue: 8000 }),
      row({
        symbol: "-AAPL",
        description: "AAPL JAN 16 2026 $150 PUT",
        quantity: -1,
        currentValue: -500,
      }),
    ];
    const snap = buildSnapshot(rows, "test.csv", null);
    const sum = snap.buckets.reduce((s, b) => s + b.totalValue, 0);
    expect(sum - snap.totalValue).toBeCloseTo(1000, 0);
  });

  it("options 现金 item has target 0%", () => {
    const rows: FidelityRow[] = [
      row({ symbol: "SPAXX", description: "FIDELITY GOVERNMENT", quantity: 7000, currentValue: 7000 }),
    ];
    const snap = buildSnapshot(rows, "test.csv", null);
    const options = snap.buckets.find((b) => b.key === "options")!;
    const cashItem = options.items.find((i) => i.label === "现金")!;
    expect(cashItem.targetPctOfBucket).toBe(0);
  });
});
