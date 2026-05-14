export interface SplitCashInput {
  totalCash: number;
  totalValue: number;
  /** Cash target as a percentage of total portfolio (e.g., 5 for 5%) */
  cashTargetPct: number;
}

export interface SplitCashResult {
  /** Cash assigned to the cash bucket (capped at target) */
  cashBucket: number;
  /** Cash beyond target, available for options deployment */
  optionsExcessCash: number;
}

export function splitCash({
  totalCash,
  totalValue,
  cashTargetPct,
}: SplitCashInput): SplitCashResult {
  const cashTargetValue = (totalValue * cashTargetPct) / 100;
  const cashBucket = Math.min(totalCash, cashTargetValue);
  const optionsExcessCash = Math.max(0, totalCash - cashTargetValue);
  return { cashBucket, optionsExcessCash };
}
