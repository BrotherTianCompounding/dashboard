import { calculateBullishAllocation } from "../lib/optionRisk";
import type { ClassifiedHolding } from "../lib/types";
const leg = (description: string, quantity: number, currentValue: number): ClassifiedHolding => ({
  symbol: "-", description, quantity, currentValue, costBasisTotal: 0,
  totalGainLossDollar: 0, category: "wheel",
});
describe("bullish allocation", () => {
  it("excludes matched synthetic calls and counts partial residuals once", () => {
    const result = calculateBullishAllocation([
      leg("AAA JAN 15 2027 $100 CALL", 3, 3000),
      leg("AAA JAN 15 2027 $100 PUT", -2, -500),
      leg("AAA JAN 15 2027 $120 CALL", -1, -200),
    ], 10000, 20000);
    expect(result.calls.currentValue).toBe(800);
    expect(result.holdings[0].contracts).toBe(1);
    expect(result.sellPut.currentValue).toBe(20000);
    expect(result.sellPut.maxValue).toBe(26000);
  });
  it("uses cash capacity, equality red and exact overage", () => {
    const full = calculateBullishAllocation([leg("AAA JAN 15 2027 $130 PUT", -1, -100)], 100000, 10000);
    expect(full.sellPut.isOver).toBe(true);
    expect(full.sellPut.visualPercent).toBe(100);
    const over = calculateBullishAllocation([leg("AAA JAN 15 2027 $160 PUT", -1, -100)], 100000, 10000);
    expect(over.sellPut.overAmount).toBe(3000);
    expect(over.sellPut.overPercent).toBeCloseTo(23.076923);
    expect(calculateBullishAllocation([], 10000, 0).sellPut.status).toBe("invalid-budget");
  });
  it("excludes standalone sellers and includes unmatched long calls of any expiry", () => {
    const result = calculateBullishAllocation([
      leg("BBB JAN 15 2027 $100 CALL", -1, -300),
      leg("CCC NOV 20 2026 $50 CALL", 1, 2000),
      leg("DDD JAN 15 2027 $60 PUT", -1, -100),
    ], 10000, 10000);
    expect(result.holdings.map((r) => r.symbol)).toEqual(["CCC"]);
    expect(result.calls.maxValue).toBe(2000);
    expect(result.calls.isOver).toBe(true);
  });
});
