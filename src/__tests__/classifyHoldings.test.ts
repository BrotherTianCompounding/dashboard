import { classifyHoldings } from "../lib/classifyHoldings";
import type { FidelityRow } from "../lib/types";

function makeRow(overrides: Partial<FidelityRow>): FidelityRow {
  return {
    accountName: "INDIVIDUAL - XXX123456",
    symbol: "TEST",
    description: "TEST CORP",
    quantity: 100,
    lastPrice: 10,
    currentValue: 1000,
    costBasisTotal: 900,
    totalGainLossDollar: 100,
    percentOfAccount: 1,
    ...overrides,
  };
}

describe("classifyHoldings", () => {
  it("classifies QQQM as safe-side/qqqm", () => {
    const rows = [makeRow({ symbol: "QQQM", currentValue: 10000 })];
    const result = classifyHoldings(rows);
    expect(result[0].category).toBe("safe-side");
    expect(result[0].safeSideSubCategory).toBe("qqqm");
  });

  it("classifies VOO as safe-side/voo", () => {
    const rows = [makeRow({ symbol: "VOO", currentValue: 10000 })];
    const result = classifyHoldings(rows);
    expect(result[0].category).toBe("safe-side");
    expect(result[0].safeSideSubCategory).toBe("voo");
  });

  it("classifies SPY and FXAIX as safe-side/stocks", () => {
    const rows = [
      makeRow({ symbol: "SPY", currentValue: 5000 }),
      makeRow({ symbol: "FXAIX", currentValue: 3000 }),
    ];
    const result = classifyHoldings(rows);
    expect(result.every((r) => r.category === "safe-side")).toBe(true);
    expect(result.every((r) => r.safeSideSubCategory === "stocks")).toBe(true);
  });

  it("classifies NVDA (positive shares) as safe-side/stocks", () => {
    const rows = [makeRow({ symbol: "NVDA", quantity: 100, currentValue: 11000 })];
    const result = classifyHoldings(rows);
    expect(result[0].category).toBe("safe-side");
    expect(result[0].safeSideSubCategory).toBe("stocks");
  });

  it("classifies SPAXX as cash", () => {
    const rows = [makeRow({ symbol: "SPAXX", currentValue: 18500 })];
    const result = classifyHoldings(rows);
    expect(result[0].category).toBe("cash");
  });

  it("classifies short puts as wheel", () => {
    const rows = [
      makeRow({
        symbol: "-HOOD250418P32",
        description: "HOOD APR 18 2025 32 PUT",
        quantity: -2,
        currentValue: -300,
      }),
    ];
    const result = classifyHoldings(rows);
    expect(result[0].category).toBe("wheel");
  });

  it("classifies stock held alongside a short put (wheel assign) as wheel", () => {
    const rows = [
      makeRow({
        symbol: "-HOOD250418P32",
        description: "HOOD APR 18 2025 32 PUT",
        quantity: -2,
        currentValue: -300,
      }),
      makeRow({
        symbol: "HOOD",
        description: "ROBINHOOD MARKETS INC",
        quantity: 200,
        currentValue: 7600,
      }),
    ];
    const result = classifyHoldings(rows);
    const hoodStock = result.find((r) => r.symbol === "HOOD" && r.quantity > 0)!;
    expect(hoodStock.category).toBe("wheel");
  });

  it("classifies long-dated calls (>180 DTE) as leaps", () => {
    const rows = [
      makeRow({
        symbol: "-QQQ270116C420",
        description: "QQQ JAN 16 2027 420 CALL",
        quantity: 2,
        currentValue: 9000,
      }),
    ];
    const result = classifyHoldings(rows);
    expect(result[0].category).toBe("leaps");
  });

  it("classifies short-dated calls as wheel (covered call)", () => {
    const rows = [
      makeRow({
        symbol: "-NVDA250502C130",
        description: "NVDA MAY 02 2025 130 CALL",
        quantity: -1,
        currentValue: -200,
      }),
    ];
    const result = classifyHoldings(rows);
    expect(result[0].category).toBe("wheel");
  });
});
