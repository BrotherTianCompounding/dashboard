import { classifyHoldings } from "./classifyHoldings";
import { calculateTargets } from "./calculateTargets";
import type {
  FidelityRow,
  PortfolioSnapshot,
  BucketData,
  BucketItem,
} from "./types";

/** Sum all current values (incl. Pending activity for accurate total) */
function calcTotal(rows: FidelityRow[]): number {
  return rows.reduce((sum, r) => sum + r.currentValue, 0);
}

export function buildSnapshot(
  rows: FidelityRow[],
  fileName: string,
  date: Date | null
): PortfolioSnapshot {
  const totalValue = calcTotal(rows);
  const classified = classifyHoldings(
    rows.filter((r) => r.symbol !== "Pending activity")
  );
  const targets = calculateTargets(38, true);

  const pct = (numerator: number, denom: number) =>
    denom > 0 ? (numerator / denom) * 100 : 0;

  // ===== Safe Side bucket =====
  const safeSideHoldings = classified.filter((h) => h.category === "safe-side");
  const safeSideValue = safeSideHoldings.reduce(
    (s, h) => s + h.currentValue,
    0
  );

  // Aggregate by symbol (same symbol may appear in multiple rows)
  const safeSideBySymbol = new Map<string, number>();
  for (const h of safeSideHoldings) {
    safeSideBySymbol.set(
      h.symbol,
      (safeSideBySymbol.get(h.symbol) ?? 0) + h.currentValue
    );
  }
  const ETF_TICKERS = new Set([
    "QQQM",
    "QQQ",
    "QLD",
    "VGT",
    "VOO",
    "SPY",
    "FXAIX",
  ]);
  const safeSideItems: BucketItem[] = Array.from(safeSideBySymbol.entries())
    .map(([symbol, value]) => ({
      label: symbol,
      value,
      currentPctOfBucket: pct(value, safeSideValue),
      // Target: ETFs (QQQM/VOO etc) get 30% target, individual stocks get 10% cap
      targetPctOfBucket: ETF_TICKERS.has(symbol) ? 30 : 10,
    }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 5);

  // ===== Cash bucket =====
  const cashHoldings = classified.filter((h) => h.category === "cash");
  const cashValue = cashHoldings.reduce((s, h) => s + h.currentValue, 0);

  // ===== Options bucket (wheel + leaps combined) =====
  const optionsHoldings = classified.filter(
    (h) => h.category === "wheel" || h.category === "leaps"
  );
  // Use absolute values for bucket size (short options have negative values)
  const optionsValue = optionsHoldings.reduce(
    (s, h) => s + Math.abs(h.currentValue),
    0
  );

  let sellPutValue = 0;
  let sellCallValue = 0;
  let leapsValue = 0;
  for (const h of optionsHoldings) {
    if (h.category === "leaps") {
      leapsValue += Math.abs(h.currentValue);
    } else if (/\bPUT\b/i.test(h.description) && h.quantity < 0) {
      sellPutValue += Math.abs(h.currentValue);
    } else if (/\bCALL\b/i.test(h.description) && h.quantity < 0) {
      sellCallValue += Math.abs(h.currentValue);
    }
  }
  const optionsItems: BucketItem[] = [
    {
      label: "Sell Put",
      value: sellPutValue,
      currentPctOfBucket: pct(sellPutValue, optionsValue),
      targetPctOfBucket: 40, // half of Wheel (80% of options)
    },
    {
      label: "Sell Call",
      value: sellCallValue,
      currentPctOfBucket: pct(sellCallValue, optionsValue),
      targetPctOfBucket: 40,
    },
    {
      label: "LEAPS Call",
      value: leapsValue,
      currentPctOfBucket: pct(leapsValue, optionsValue),
      targetPctOfBucket: 20,
    },
    {
      label: "现金",
      value: 0,
      currentPctOfBucket: 0,
      targetPctOfBucket: 0,
    },
  ];

  const buckets: BucketData[] = [
    {
      key: "safe-side",
      label: "定投仓 DCA",
      totalValue: safeSideValue,
      currentPctOfTotal: pct(safeSideValue, totalValue),
      targetPctOfTotal: targets.safeSide,
      items: safeSideItems,
    },
    {
      key: "cash",
      label: "现金仓 Cash",
      totalValue: cashValue,
      currentPctOfTotal: pct(cashValue, totalValue),
      targetPctOfTotal: targets.cash,
      items: [],
    },
    {
      key: "options",
      label: "期权仓 Options",
      totalValue: optionsValue,
      currentPctOfTotal: pct(optionsValue, totalValue),
      targetPctOfTotal: targets.wheel + targets.leaps,
      items: optionsItems,
    },
  ];

  return { totalValue, buckets, date, fileName };
}
