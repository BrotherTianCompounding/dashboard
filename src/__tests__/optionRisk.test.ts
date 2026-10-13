import { calculateDeltaExposures, calculateOptionRiskSummary } from "../lib/optionRisk";
import type { ClassifiedHolding, FidelityRow } from "../lib/types";

function holding(overrides: Partial<ClassifiedHolding>): ClassifiedHolding {
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

function row(overrides: Partial<FidelityRow>): FidelityRow {
  return {
    accountName: "test",
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

describe("calculateOptionRiskSummary", () => {
  it("uses budget base splits and sell-put assignment value with 130% max", () => {
    const summary = calculateOptionRiskSummary(
      [
        holding({ description: "AAPL JAN 16 2027 $150 PUT", quantity: -2, currentValue: -800 }),
      ],
      100000,
      new Date(2026, 0, 16)
    );
    const sellPut = summary.bars.find((bar) => bar.key === "sell-put")!;
    expect(sellPut.baseBudget).toBe(70000);
    expect(sellPut.maxValue).toBe(91000);
    expect(sellPut.currentValue).toBe(30000);
    expect(sellPut.detail).toBe("$70,000 × 130% = $91,000【70%】");
  });

  it("turns red when current value exactly reaches max", () => {
    const summary = calculateOptionRiskSummary(
      [
        holding({ description: "AAPL JAN 16 2027 $91 PUT", quantity: -10, currentValue: -800 }),
      ],
      100000,
      new Date(2026, 0, 16)
    );
    const sellPut = summary.bars.find((bar) => bar.key === "sell-put")!;
    expect(sellPut.currentValue).toBe(91000);
    expect(sellPut.isOver).toBe(true);
    expect(sellPut.visualPercent).toBe(100);
  });

  it("keeps exactly eight-month long calls in tactical and longer calls in LEAPS", () => {
    const summary = calculateOptionRiskSummary(
      [
        holding({ description: "QQQ SEP 16 2026 $500 CALL", quantity: 1, currentValue: 4000 }),
        holding({ description: "QQQ SEP 17 2026 $500 CALL", quantity: 1, currentValue: 9000 }),
      ],
      100000,
      new Date(2026, 0, 16)
    );
    expect(summary.bars.find((bar) => bar.key === "tactical")!.currentValue).toBe(4000);
    expect(summary.bars.find((bar) => bar.key === "leaps-call")!.currentValue).toBe(9000);
  });

  it("counts matched spread quantities once and keeps credit-spread net value negative", () => {
    const summary = calculateOptionRiskSummary(
      [
        holding({ description: "NVDA MAR 20 2026 $120 PUT", quantity: 1, currentValue: 200 }),
        holding({ description: "NVDA MAR 20 2026 $125 PUT", quantity: -1, currentValue: -500 }),
        holding({ description: "NVDA MAR 20 2026 $130 PUT", quantity: -1, currentValue: -700 }),
      ],
      100000,
      new Date(2026, 0, 16)
    );
    const tactical = summary.bars.find((bar) => bar.key === "tactical")!;
    const sellPut = summary.bars.find((bar) => bar.key === "sell-put")!;
    expect(tactical.currentValue).toBe(-300);
    expect(tactical.visualPercent).toBe(0);
    expect(sellPut.currentValue).toBe(13000);
  });
});

describe("calculateDeltaExposures", () => {
  it("combines stock, long call, short put, and short call signs by underlying", () => {
    const exposures = calculateDeltaExposures(
      [
        row({ symbol: "NVDA", description: "NVIDIA CORP", quantity: 10, lastPrice: 100, currentValue: 1000 }),
        row({ symbol: "-NVDA", description: "NVDA JAN 16 2027 $120 CALL", quantity: 1, currentValue: 1000, delta: 0.6, underlyingPrice: 100 }),
        row({ symbol: "-NVDA", description: "NVDA JAN 16 2027 $90 PUT", quantity: -1, currentValue: -500, delta: -0.3, underlyingPrice: 100 }),
        row({ symbol: "-NVDA", description: "NVDA JAN 16 2027 $150 CALL", quantity: -1, currentValue: -300, delta: 0.2, underlyingPrice: 100 }),
      ],
      10000
    );
    expect(exposures[0].symbol).toBe("NVDA");
    expect(exposures[0].deltaShares).toBeCloseTo(10 + 60 + 30 - 20);
    expect(exposures[0].deltaDollarExposure).toBeCloseTo(8000);
    expect(exposures[0].portfolioPct).toBeCloseTo(80);
  });

  it("uses current long-call value when delta is missing", () => {
    const exposures = calculateDeltaExposures(
      [
        row({ symbol: "-QQQ", description: "QQQ JAN 16 2027 $500 CALL", quantity: 1, currentValue: 1000, underlyingPrice: 500 }),
      ],
      10000
    );
    expect(exposures[0].symbol).toBe("QQQ");
    expect(exposures[0].hasIncompleteData).toBe(false);
    expect(exposures[0].hasEstimatedExposure).toBe(true);
    expect(exposures[0].deltaDollarExposure).toBe(1000);
    expect(exposures[0].portfolioPct).toBe(10);
  });
});

describe("missing-delta assignment estimates", () => {
  it("uses the true multiplier and sorts combined estimates against NAV", () => {
    const exposures = calculateDeltaExposures([
      row({ symbol: "AAPL", quantity: 10, lastPrice: 200, currentValue: 2000 }),
      row({ description: "AAPL JAN 16 2027 $150 PUT", quantity: -2, currentValue: -800, contractMultiplier: 50 }),
      row({ description: "AAPL JAN 16 2027 $200 CALL", quantity: 1, currentValue: 3000 }),
      row({ symbol: "QQQ", quantity: 10, lastPrice: 500, currentValue: 5000 }),
    ], 10000);
    expect(exposures[0].symbol).toBe("AAPL");
    expect(exposures[0].optionExposure).toBe(18000);
    expect(exposures[0].deltaDollarExposure).toBe(20000);
    expect(exposures[0].portfolioPct).toBe(200);
    expect(exposures[0].hasIncompleteData).toBe(false);
  });

  it("keeps unsupported missing-delta short calls incomplete", () => {
    const exposures = calculateDeltaExposures([
      row({ description: "QQQ JAN 16 2027 $500 CALL", quantity: -1, currentValue: -1000 }),
    ], 10000);
    expect(exposures[0].hasIncompleteData).toBe(true);
    expect(exposures[0].hasEstimatedExposure).toBe(false);
  });
});
