import { calculateTargets } from "../lib/calculateTargets";

describe("calculateTargets", () => {
  it("calculates targets for age 38 with income", () => {
    const targets = calculateTargets(38, true);
    expect(targets.safeSide).toBe(58);
    expect(targets.cash).toBe(5);
    expect(targets.wheel).toBeCloseTo(29.6);
    expect(targets.leaps).toBeCloseTo(7.4);
  });

  it("calculates targets for age 38 without income", () => {
    const targets = calculateTargets(38, false);
    expect(targets.safeSide).toBe(58);
    expect(targets.cash).toBe(10);
    expect(targets.wheel).toBeCloseTo(25.6);
    expect(targets.leaps).toBeCloseTo(6.4);
  });

  it("caps safe-side at 80% for age 60+", () => {
    const targets = calculateTargets(65, true);
    expect(targets.safeSide).toBe(80);
    expect(targets.cash).toBe(5);
    expect(targets.wheel).toBeCloseTo(12);
    expect(targets.leaps).toBeCloseTo(3);
  });

  it("calculates safe-side inner breakdown", () => {
    const targets = calculateTargets(38, true);
    expect(targets.safeSideInner.qqqm).toBeCloseTo(17.4);
    expect(targets.safeSideInner.voo).toBeCloseTo(17.4);
    expect(targets.safeSideInner.stocks).toBeCloseTo(23.2);
  });

  it("all percentages sum to 100", () => {
    const targets = calculateTargets(38, true);
    const total = targets.safeSide + targets.cash + targets.wheel + targets.leaps;
    expect(total).toBeCloseTo(100);
  });
});
