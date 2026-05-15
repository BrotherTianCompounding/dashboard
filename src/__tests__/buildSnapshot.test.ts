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
    const snap = buildSnapshot(rows, "test.csv", null, 38, true);
    expect(snap.totalValue).toBeCloseTo(30100);
  });

  it("creates three buckets in order: safe-side, cash, options", () => {
    const rows: FidelityRow[] = [
      row({ symbol: "QQQM", description: "INVESCO NASDAQ 100 ETF", quantity: 100, currentValue: 25000 }),
    ];
    const snap = buildSnapshot(rows, "test.csv", null, 38, true);
    expect(snap.buckets.map((b) => b.key)).toEqual(["safe-side", "cash", "options"]);
  });

  it("cash bucket equals sum of all cash holdings (uncapped)", () => {
    // totalValue=60000, cash target 5% would be 3000 — but cash is NOT capped
    const rows: FidelityRow[] = [
      row({ symbol: "QQQM", description: "INVESCO NASDAQ 100 ETF", quantity: 100, currentValue: 50000 }),
      row({ symbol: "SPAXX", description: "FIDELITY GOVERNMENT", quantity: 10000, currentValue: 10000 }),
    ];
    const snap = buildSnapshot(rows, "test.csv", null, 38, true);
    const cash = snap.buckets.find((b) => b.key === "cash")!;
    expect(cash.totalValue).toBeCloseTo(10000);
  });
});

describe("buildSnapshot — ETF grouping in DCA bar", () => {
  it("merges qqqm-family tickers (QQQM/QQQ/QLD/VGT) into a single QQQM row", () => {
    const rows: FidelityRow[] = [
      row({ symbol: "QQQM", description: "INVESCO NASDAQ 100 ETF", quantity: 100, currentValue: 10000 }),
      row({ symbol: "QQQ", description: "INVESCO QQQ TRUST", quantity: 50, currentValue: 8000 }),
      row({ symbol: "QLD", description: "PROSHARES ULTRA QQQ", quantity: 20, currentValue: 4000 }),
      row({ symbol: "VGT", description: "VANGUARD INFO TECH ETF", quantity: 10, currentValue: 3000 }),
    ];
    const snap = buildSnapshot(rows, "test.csv", null, 38, true);
    const dca = snap.buckets.find((b) => b.key === "safe-side")!;
    const qqqmItems = dca.items.filter((i) => i.label === "QQQM");
    expect(qqqmItems).toHaveLength(1);
    expect(qqqmItems[0].value).toBeCloseTo(25000);
  });

  it("merges voo-family tickers (VOO/SPY/FXAIX) into a single VOO row", () => {
    const rows: FidelityRow[] = [
      row({ symbol: "VOO", description: "VANGUARD S&P 500 ETF", quantity: 10, currentValue: 5000 }),
      row({ symbol: "SPY", description: "SPDR S&P 500 ETF TRUST", quantity: 5, currentValue: 3000 }),
      row({ symbol: "FXAIX", description: "FIDELITY 500 INDEX FUND", quantity: 100, currentValue: 2000 }),
    ];
    const snap = buildSnapshot(rows, "test.csv", null, 38, true);
    const dca = snap.buckets.find((b) => b.key === "safe-side")!;
    const vooItems = dca.items.filter((i) => i.label === "VOO");
    expect(vooItems).toHaveLength(1);
    expect(vooItems[0].value).toBeCloseTo(10000);
  });

  it("keeps individual stocks under their own symbol", () => {
    const rows: FidelityRow[] = [
      row({ symbol: "NVDA", description: "NVIDIA CORP", quantity: 10, currentValue: 5000 }),
      row({ symbol: "AAPL", description: "APPLE INC", quantity: 20, currentValue: 4000 }),
    ];
    const snap = buildSnapshot(rows, "test.csv", null, 38, true);
    const dca = snap.buckets.find((b) => b.key === "safe-side")!;
    const labels = dca.items.map((i) => i.label).sort();
    expect(labels).toEqual(["AAPL", "NVDA"]);
  });

  it("assigns 30% target to ETF groups, 10% to individual stocks", () => {
    const rows: FidelityRow[] = [
      row({ symbol: "QQQM", description: "INVESCO NASDAQ 100 ETF", quantity: 100, currentValue: 10000 }),
      row({ symbol: "NVDA", description: "NVIDIA CORP", quantity: 10, currentValue: 5000 }),
    ];
    const snap = buildSnapshot(rows, "test.csv", null, 38, true);
    const dca = snap.buckets.find((b) => b.key === "safe-side")!;
    expect(dca.items.find((i) => i.label === "QQQM")!.targetPctOfBucket).toBe(30);
    expect(dca.items.find((i) => i.label === "NVDA")!.targetPctOfBucket).toBe(10);
  });
});

describe("buildSnapshot — options bucket (no cash)", () => {
  it("options bucket has exactly 3 items: Sell Put, Sell Call, LEAPS Call", () => {
    const rows: FidelityRow[] = [
      row({ symbol: "SPAXX", description: "FIDELITY GOVERNMENT", quantity: 7000, currentValue: 7000 }),
    ];
    const snap = buildSnapshot(rows, "test.csv", null, 38, true);
    const options = snap.buckets.find((b) => b.key === "options")!;
    expect(options.items.map((i) => i.label)).toEqual([
      "Sell Put",
      "Sell Call",
      "LEAPS Call",
    ]);
  });

  it("options bucket value is the sum of absolute position values", () => {
    const rows: FidelityRow[] = [
      row({ symbol: "-AAPL", description: "AAPL JAN 16 2026 $150 PUT", quantity: -1, currentValue: -500 }),
      row({ symbol: "AAPL300118C00100000", description: "AAPL JAN 18 2030 $100 CALL", quantity: 1, currentValue: 4500 }),
    ];
    const snap = buildSnapshot(rows, "test.csv", null, 38, true);
    const options = snap.buckets.find((b) => b.key === "options")!;
    expect(options.totalValue).toBeCloseTo(5000);
  });
});

describe("buildSnapshot — invariants", () => {
  it("safeSide + cash + options ≈ totalValue (no short positions)", () => {
    const rows: FidelityRow[] = [
      row({ symbol: "QQQM", description: "INVESCO NASDAQ 100 ETF", quantity: 100, currentValue: 60000 }),
      row({ symbol: "SPAXX", description: "FIDELITY GOVERNMENT", quantity: 8000, currentValue: 8000 }),
      row({ symbol: "AAPL300118C00100000", description: "AAPL JAN 18 2030 $100 CALL", quantity: 1, currentValue: 4500 }),
    ];
    const snap = buildSnapshot(rows, "test.csv", null, 38, true);
    const sum = snap.buckets.reduce((s, b) => s + b.totalValue, 0);
    expect(sum).toBeCloseTo(snap.totalValue, 0);
  });

  it("with short options, bucket sum exceeds totalValue by 2× short mark (Math.abs side effect)", () => {
    // Short put at -500: totalValue includes -500, options bucket adds abs(500).
    // Sum overshoots by 1000 = 2 × 500. Documented known behavior under Math.abs semantics.
    const rows: FidelityRow[] = [
      row({ symbol: "QQQM", description: "INVESCO NASDAQ 100 ETF", quantity: 100, currentValue: 60000 }),
      row({ symbol: "SPAXX", description: "FIDELITY GOVERNMENT", quantity: 8000, currentValue: 8000 }),
      row({ symbol: "-AAPL", description: "AAPL JAN 16 2026 $150 PUT", quantity: -1, currentValue: -500 }),
    ];
    const snap = buildSnapshot(rows, "test.csv", null, 38, true);
    const sum = snap.buckets.reduce((s, b) => s + b.totalValue, 0);
    expect(sum - snap.totalValue).toBeCloseTo(1000, 0);
  });
});

describe("buildSnapshot — age/income drive targets", () => {
  it("age 25 → safeSide target 45%", () => {
    const rows: FidelityRow[] = [
      row({ symbol: "QQQM", description: "INVESCO NASDAQ 100 ETF", quantity: 100, currentValue: 50000 }),
    ];
    const snap = buildSnapshot(rows, "test.csv", null, 25, true);
    const dca = snap.buckets.find((b) => b.key === "safe-side")!;
    expect(dca.targetPctOfTotal).toBe(45);
  });

  it("age 38 → safeSide target 58%", () => {
    const rows: FidelityRow[] = [
      row({ symbol: "QQQM", description: "INVESCO NASDAQ 100 ETF", quantity: 100, currentValue: 50000 }),
    ];
    const snap = buildSnapshot(rows, "test.csv", null, 38, true);
    const dca = snap.buckets.find((b) => b.key === "safe-side")!;
    expect(dca.targetPctOfTotal).toBe(58);
  });

  it("hasIncome=true → cash target 5%", () => {
    const rows: FidelityRow[] = [
      row({ symbol: "SPAXX", description: "FIDELITY GOVERNMENT", quantity: 5000, currentValue: 5000 }),
    ];
    const snap = buildSnapshot(rows, "test.csv", null, 25, true);
    const cash = snap.buckets.find((b) => b.key === "cash")!;
    expect(cash.targetPctOfTotal).toBe(5);
  });

  it("hasIncome=false → cash target 10%", () => {
    const rows: FidelityRow[] = [
      row({ symbol: "SPAXX", description: "FIDELITY GOVERNMENT", quantity: 5000, currentValue: 5000 }),
    ];
    const snap = buildSnapshot(rows, "test.csv", null, 25, false);
    const cash = snap.buckets.find((b) => b.key === "cash")!;
    expect(cash.targetPctOfTotal).toBe(10);
  });
});
