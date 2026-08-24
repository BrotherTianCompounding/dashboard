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
  costBasisTotal: number;
  totalGainLossDollar: number;
  category: HoldingCategory;
  safeSideSubCategory?: SafeSideSubCategory;
}

/** One option leg's detail, shown under single-leg categories. */
export interface OptionLegDetail {
  underlying: string;
  right: "C" | "P";
  strike: number;
  /** ISO-ish display date, e.g. "2027-06-17" */
  expiry: string;
  daysToExpiry: number;
  /** Number of contracts (absolute) */
  contracts: number;
  /** Absolute current market value */
  value: number;
  /** Absolute cost basis (premium paid/received) */
  cost: number;
}

/** Target allocation percentages */
export interface TargetAllocation {
  safeSide: number;
  cash: number;
  wheel: number;
  leaps: number;
  safeSideInner: {
    qqqm: number;
    voo: number;
    stocks: number;
  };
}

/** A single item inside a bucket (e.g., one stock within DCA, or "Sell Put" within Options) */
export interface BucketItem {
  label: string;
  value: number;
  /** Current % within this bucket (0-100) */
  currentPctOfBucket: number;
  /** Target % within this bucket (0-100) */
  targetPctOfBucket: number;
  /** Per-leg detail (options single-leg categories only) */
  legs?: OptionLegDetail[];
}

/** A high-level bucket (定投仓 / 现金仓 / 期权仓) */
export interface BucketData {
  key: "safe-side" | "cash" | "options";
  label: string;
  totalValue: number;
  /** Current % of overall portfolio (0-100) */
  currentPctOfTotal: number;
  /** Target % of overall portfolio (0-100) */
  targetPctOfTotal: number;
  items: BucketItem[];
}

/** Full parsed portfolio snapshot */
export interface PortfolioSnapshot {
  totalValue: number;
  buckets: BucketData[];
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
