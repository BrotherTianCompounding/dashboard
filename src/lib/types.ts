/** A single row from the Fidelity CSV */
export interface FidelityRow {
  accountName: string;
  symbol: string;
  description: string;
  quantity: number;
  lastPrice: number;
  currentValue: number;
  costBasisTotal: number;
  totalGainLossDollar: number;
  percentOfAccount: number;
}

/** Which category a holding belongs to */
export type HoldingCategory =
  | "safe-side"
  | "cash"
  | "wheel"
  | "leaps";

/** Sub-category within safe-side */
export type SafeSideSubCategory = "qqqm" | "voo" | "stocks";

/** A classified holding */
export interface ClassifiedHolding {
  symbol: string;
  description: string;
  quantity: number;
  currentValue: number;
  totalGainLossDollar: number;
  category: HoldingCategory;
  safeSideSubCategory?: SafeSideSubCategory;
}

/** Aggregated totals per category */
export interface CategorySummary {
  category: HoldingCategory;
  totalValue: number;
  percentOfPortfolio: number;
  holdings: ClassifiedHolding[];
}

/** Safe-side breakdown */
export interface SafeSideBreakdown {
  qqqm: number;
  voo: number;
  stocks: number;
}

/** Target allocation percentages */
export interface TargetAllocation {
  safeSide: number;
  cash: number;
  wheel: number;
  leaps: number;
  /** Inner safe-side targets as % of total portfolio */
  safeSideInner: {
    qqqm: number;
    voo: number;
    stocks: number;
  };
}

/** Full parsed portfolio snapshot */
export interface PortfolioSnapshot {
  totalValue: number;
  categories: CategorySummary[];
  safeSideBreakdown: SafeSideBreakdown;
  date: Date | null;
  fileName: string;
}

/** Comparison result when two snapshots are provided */
export interface PortfolioComparison {
  current: PortfolioSnapshot;
  previous: PortfolioSnapshot;
  valueDelta: number;
  valueDeltaPercent: number;
}
