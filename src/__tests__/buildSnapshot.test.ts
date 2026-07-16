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

describe("buildSnapshot — 正股定投仓 (family merge + 其他)", () => {
  it("sums the same symbol split across cash + margin into one row", () => {
    const rows: FidelityRow[] = [
      row({ symbol: "NVDA", description: "NVIDIA CORP", quantity: 20, currentValue: 6000 }),
      row({ symbol: "NVDA", description: "NVIDIA CORP", quantity: 2, currentValue: 500 }),
    ];
    const snap = buildSnapshot(rows, "test.csv", null, 38, true);
    const dca = snap.buckets.find((b) => b.key === "safe-side")!;
    const nvda = dca.items.filter((i) => i.label === "NVDA");
    expect(nvda).toHaveLength(1);
    expect(nvda[0].value).toBeCloseTo(6500);
  });

  it("merges QQQ + QQQM into a single 'QQQ' row", () => {
    const rows: FidelityRow[] = [
      row({ symbol: "QQQ", description: "INVESCO QQQ TRUST", quantity: 50, currentValue: 8000 }),
      row({ symbol: "QQQM", description: "INVESCO NASDAQ 100 ETF", quantity: 100, currentValue: 2000 }),
    ];
    const snap = buildSnapshot(rows, "test.csv", null, 38, true);
    const dca = snap.buckets.find((b) => b.key === "safe-side")!;
    expect(dca.items.map((i) => i.label)).toEqual(["QQQ"]);
    expect(dca.items[0].value).toBeCloseTo(10000);
  });

  it("merges VOO + SPY + FXAIX into a single 'VOO' row", () => {
    const rows: FidelityRow[] = [
      row({ symbol: "VOO", description: "VANGUARD S&P 500 ETF", quantity: 10, currentValue: 5000 }),
      row({ symbol: "SPY", description: "SPDR S&P 500 ETF TRUST", quantity: 5, currentValue: 3000 }),
      row({ symbol: "FXAIX", description: "FIDELITY 500 INDEX FUND", quantity: 100, currentValue: 2000 }),
    ];
    const snap = buildSnapshot(rows, "test.csv", null, 38, true);
    const dca = snap.buckets.find((b) => b.key === "safe-side")!;
    expect(dca.items.map((i) => i.label)).toEqual(["VOO"]);
    expect(dca.items[0].value).toBeCloseTo(10000);
  });

  it("folds holdings ≤1% of the stock bucket into '其他' (placed last)", () => {
    const rows: FidelityRow[] = [
      row({ symbol: "NVDA", description: "NVIDIA CORP", quantity: 10, currentValue: 9800 }),
      // two tiny holdings, each < 1% of the ~9950 bucket → 其他
      row({ symbol: "INTC", description: "INTEL CORP", quantity: 1, currentValue: 90 }),
      row({ symbol: "NOW", description: "SERVICENOW INC", quantity: 1, currentValue: 60 }),
    ];
    const snap = buildSnapshot(rows, "test.csv", null, 38, true);
    const dca = snap.buckets.find((b) => b.key === "safe-side")!;
    expect(dca.items.map((i) => i.label)).toEqual(["NVDA", "其他"]);
    expect(dca.items.find((i) => i.label === "其他")!.value).toBeCloseTo(150);
  });

  it("shows no 其他 row when every holding is above 1%", () => {
    const rows: FidelityRow[] = [
      row({ symbol: "NVDA", description: "NVIDIA CORP", quantity: 10, currentValue: 6000 }),
      row({ symbol: "AAPL", description: "APPLE INC", quantity: 20, currentValue: 4000 }),
    ];
    const snap = buildSnapshot(rows, "test.csv", null, 38, true);
    const dca = snap.buckets.find((b) => b.key === "safe-side")!;
    expect(dca.items.map((i) => i.label)).toEqual(["NVDA", "AAPL"]);
    expect(dca.items.some((i) => i.label === "其他")).toBe(false);
  });

  it("currentPctOfBucket is the ticker's share of the stock bucket", () => {
    const rows: FidelityRow[] = [
      row({ symbol: "NVDA", description: "NVIDIA CORP", quantity: 10, currentValue: 7500 }),
      row({ symbol: "AAPL", description: "APPLE INC", quantity: 20, currentValue: 2500 }),
    ];
    const snap = buildSnapshot(rows, "test.csv", null, 38, true);
    const dca = snap.buckets.find((b) => b.key === "safe-side")!;
    expect(dca.items.find((i) => i.label === "NVDA")!.currentPctOfBucket).toBeCloseTo(75);
    expect(dca.items.find((i) => i.label === "AAPL")!.currentPctOfBucket).toBeCloseTo(25);
  });
});

describe("buildSnapshot — margin used", () => {
  it("margin = stocks + cash + options(abs) − account total", () => {
    // stocks 60000 + cash 8000 + short put abs 500 = 68500;
    // account total = 60000 + 8000 − 500 = 67500; margin = 1000.
    const rows: FidelityRow[] = [
      row({ symbol: "QQQM", description: "INVESCO NASDAQ 100 ETF", quantity: 100, currentValue: 60000 }),
      row({ symbol: "SPAXX", description: "FIDELITY GOVERNMENT", quantity: 8000, currentValue: 8000 }),
      row({ symbol: "-AAPL", description: "AAPL JAN 16 2026 $150 PUT", quantity: -1, currentValue: -500 }),
    ];
    const snap = buildSnapshot(rows, "test.csv", null, 38, true);
    expect(snap.marginUsed).toBeCloseTo(1000);
  });

  it("clamps to 0 when the three blocks do not exceed the account total", () => {
    const rows: FidelityRow[] = [
      row({ symbol: "QQQM", description: "INVESCO NASDAQ 100 ETF", quantity: 100, currentValue: 50000 }),
      row({ symbol: "SPAXX", description: "FIDELITY GOVERNMENT", quantity: 5000, currentValue: 5000 }),
    ];
    const snap = buildSnapshot(rows, "test.csv", null, 38, true);
    expect(snap.marginUsed).toBe(0);
  });
});

describe("buildSnapshot — options bucket (4-leg split)", () => {
  it("options bucket has exactly 4 items: Sell Put, Sell Call, Buy Call, Buy Put", () => {
    const rows: FidelityRow[] = [
      row({ symbol: "SPAXX", description: "FIDELITY GOVERNMENT", quantity: 7000, currentValue: 7000 }),
    ];
    const snap = buildSnapshot(rows, "test.csv", null, 38, true);
    const options = snap.buckets.find((b) => b.key === "options")!;
    expect(options.items.map((i) => i.label)).toEqual([
      "Sell Put",
      "Sell Call",
      "Buy Call",
      "Buy Put",
    ]);
  });

  it("splits legs by direction × right, using absolute market value", () => {
    const rows: FidelityRow[] = [
      row({ symbol: "-NVDA260807P100", description: "NVDA AUG 07 2026 $100 PUT", quantity: -2, currentValue: -600 }),
      row({ symbol: "-NVDA260807C220", description: "NVDA AUG 07 2026 $220 CALL", quantity: -1, currentValue: -545 }),
      row({ symbol: "-AAPL300118C100", description: "AAPL JAN 18 2030 $100 CALL", quantity: 1, currentValue: 4500 }),
      row({ symbol: "-TSLA260821P380", description: "TSLA AUG 21 2026 $380 PUT", quantity: 1, currentValue: 1280 }),
    ];
    const snap = buildSnapshot(rows, "test.csv", null, 38, true);
    const options = snap.buckets.find((b) => b.key === "options")!;
    const by = (label: string) => options.items.find((i) => i.label === label)!.value;
    expect(by("Sell Put")).toBeCloseTo(600);
    expect(by("Sell Call")).toBeCloseTo(545);
    expect(by("Buy Call")).toBeCloseTo(4500);
    expect(by("Buy Put")).toBeCloseTo(1280);
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
