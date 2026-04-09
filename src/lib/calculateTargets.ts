import type { TargetAllocation } from "./types";

const SAFE_SIDE_CAP = 80;

export function calculateTargets(
  age: number,
  hasIncome: boolean
): TargetAllocation {
  const safeSide = Math.min(age + 20, SAFE_SIDE_CAP);
  const cash = hasIncome ? 5 : 10;
  const options = 100 - safeSide - cash;
  const wheel = options * 0.8;
  const leaps = options * 0.2;

  return {
    safeSide,
    cash,
    wheel,
    leaps,
    safeSideInner: {
      qqqm: safeSide * 0.3,
      voo: safeSide * 0.3,
      stocks: safeSide * 0.4,
    },
  };
}
