/** Supported brokers for CSV import */
export type Broker = "fidelity" | "moomoo" | "wealthsimple" | "ibkr";

/** A single normalized position row (Fidelity-shaped; moomoo maps into this) */
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
  /** Standard option delta when provided by broker export. */
  delta?: number | null;
  /** Option contract multiplier. Defaults to 100 when omitted. */
  contractMultiplier?: number | null;
  /** Underlying stock/ETF price for option delta-dollar exposure. */
  underlyingPrice?: number | null;
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
  delta?: number | null;
  contractMultiplier?: number | null;
  underlyingPrice?: number | null;
}

/** Per-underlying contract tally, shown under single-leg categories. */
export interface OptionTickerCount {
  underlying: string;
  /** Total contracts across this underlying (absolute) */
  contracts: number;
  /** Absolute current market value */
  value: number;
}

export interface OptionBudgetConfig {
  sellPutBudgetPct: number;
  leapsBudgetPct: number;
  tacticalBudgetPct: number;
  sellPutMultiplier: number;
}

export interface BudgetUsageBar {
  key: "sell-put" | "leaps-call" | "tactical";
  label: string;
  currentValue: number;
  baseBudget: number;
  maxValue: number;
  budgetPct: number;
  detail: string;
  netValueNote?: string;
  percentUsed: number | null;
  visualPercent: number;
  isOver: boolean;
  overAmount: number;
  overPercent: number | null;
  status: "ok" | "invalid-budget";
}

export interface OptionRiskSummary {
  budgetBase: number;
  config: OptionBudgetConfig;
  bars: BudgetUsageBar[];
}

export interface DeltaExposureRow {
  symbol: string;
  stockExposure: number;
  optionExposure: number;
  deltaDollarExposure: number;
  deltaShares: number;
  portfolioPct: number;
  underlyingPrice: number | null;
  hasIncompleteData: boolean;
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
  /** Total contracts (options single-leg categories only) */
  contracts?: number;
  /** Per-underlying contract tally (options single-leg categories only) */
  tickers?: OptionTickerCount[];
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
  optionRisk?: OptionRiskSummary;
}

/** Full parsed portfolio snapshot */
export interface PortfolioSnapshot {
  totalValue: number;
  buckets: BucketData[];
  date: Date | null;
  fileName: string;
  deltaExposures: DeltaExposureRow[];
}

/** Comparison result when two snapshots are provided */
export interface PortfolioComparison {
  current: PortfolioSnapshot;
  previous: PortfolioSnapshot;
  valueDelta: number;
  valueDeltaPercent: number;
}
