import { classifyHoldings } from "./classifyHoldings";
import { classifyOptionCombos } from "./classifyOptionCombos";
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
  date: Date | null,
  age: number,
  hasIncome: boolean,
  /** Manually-entered cash (e.g. moomoo, whose positions export omits cash). */
  manualCash: number = 0
): PortfolioSnapshot {
  const totalValue = calcTotal(rows) + manualCash;
  const classified = classifyHoldings(
    rows.filter((r) => r.symbol !== "Pending activity")
  );
  const targets = calculateTargets(age, hasIncome);

  const pct = (numerator: number, denom: number) =>
    denom > 0 ? (numerator / denom) * 100 : 0;

  // ===== 正股定投仓 (stocks + ETFs) =====
  // Same symbol split across cash + margin accounts is summed. A few ETF
  // families are displayed as one line: QQQ+QQQM → "QQQ", VOO+SPY+FXAIX → "VOO".
  // Everything else keeps its own symbol. Only holdings > 1% of the stock
  // bucket are shown individually; the rest are folded into a single "其他".
  const STOCK_MERGE: Record<string, string> = {
    QQQ: "QQQ",
    QQQM: "QQQ",
    VOO: "VOO",
    SPY: "VOO",
    FXAIX: "VOO",
  };
  const MIN_ITEM_PCT = 1;

  const safeSideHoldings = classified.filter((h) => h.category === "safe-side");
  const safeSideValue = safeSideHoldings.reduce(
    (s, h) => s + h.currentValue,
    0
  );

  const safeSideByGroup = new Map<string, number>();
  for (const h of safeSideHoldings) {
    const label = STOCK_MERGE[h.symbol] ?? h.symbol;
    safeSideByGroup.set(label, (safeSideByGroup.get(label) ?? 0) + h.currentValue);
  }
  const allStockItems = Array.from(safeSideByGroup.entries())
    .map(([label, value]) => ({
      label,
      value,
      currentPctOfBucket: pct(value, safeSideValue),
      targetPctOfBucket: 0, // no per-ticker target in the two-block view
    }))
    .sort((a, b) => b.value - a.value);

  const safeSideItems: BucketItem[] = allStockItems.filter(
    (i) => i.currentPctOfBucket > MIN_ITEM_PCT
  );
  const smallStockItems = allStockItems.filter(
    (i) => i.currentPctOfBucket <= MIN_ITEM_PCT
  );
  if (smallStockItems.length > 0) {
    const otherValue = smallStockItems.reduce((s, i) => s + i.value, 0);
    safeSideItems.push({
      label: "其他",
      value: otherValue,
      currentPctOfBucket: pct(otherValue, safeSideValue),
      targetPctOfBucket: 0,
    });
  }

  // ===== Cash bucket (all cash + pending settlement) =====
  const cashHoldings = classified.filter((h) => h.category === "cash");
  const pendingValue = rows
    .filter((r) => r.symbol === "Pending activity")
    .reduce((s, r) => s + r.currentValue, 0);
  const cashValue =
    cashHoldings.reduce((s, h) => s + h.currentValue, 0) +
    pendingValue +
    manualCash;

  // ===== Options bucket (positions only, no cash) =====
  const optionsHoldings = classified.filter(
    (h) => h.category === "wheel" || h.category === "leaps"
  );
  const optionsValue = optionsHoldings.reduce(
    (s, h) => s + Math.abs(h.currentValue),
    0
  );

  // Shown single-leg categories only (LEAPS Call / Sell Put / Sell Call), each
  // collapsed to a per-underlying contract tally. Synthetic longs and spreads
  // are detected purely to exclude their legs, and are not displayed.
  const optionsItems: BucketItem[] = classifyOptionCombos(optionsHoldings).map(
    (c) => ({
      label: c.label,
      value: c.value,
      currentPctOfBucket: pct(c.value, optionsValue),
      targetPctOfBucket: 0,
      contracts: c.contracts,
      tickers: c.tickers,
    })
  );

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
