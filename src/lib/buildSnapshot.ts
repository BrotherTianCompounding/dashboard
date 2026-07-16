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
  date: Date | null,
  age: number,
  hasIncome: boolean
): PortfolioSnapshot {
  const totalValue = calcTotal(rows);
  const classified = classifyHoldings(
    rows.filter((r) => r.symbol !== "Pending activity")
  );
  const targets = calculateTargets(age, hasIncome);

  const pct = (numerator: number, denom: number) =>
    denom > 0 ? (numerator / denom) * 100 : 0;

  // ===== 正股定投仓 (all stocks + ETFs, one row per ticker) =====
  // Same symbol split across cash + margin accounts (e.g. QQQM) is summed into
  // a single row. Every holding is shown, sorted by value (largest first).
  const safeSideHoldings = classified.filter((h) => h.category === "safe-side");
  const safeSideValue = safeSideHoldings.reduce(
    (s, h) => s + h.currentValue,
    0
  );

  const safeSideBySymbol = new Map<string, number>();
  for (const h of safeSideHoldings) {
    safeSideBySymbol.set(
      h.symbol,
      (safeSideBySymbol.get(h.symbol) ?? 0) + h.currentValue
    );
  }
  const safeSideItems: BucketItem[] = Array.from(safeSideBySymbol.entries())
    .map(([label, value]) => ({
      label,
      value,
      currentPctOfBucket: pct(value, safeSideValue),
      targetPctOfBucket: 0, // no per-ticker target in the two-block view
    }))
    .sort((a, b) => b.value - a.value);

  // ===== Cash bucket (all cash, uncapped) =====
  const cashHoldings = classified.filter((h) => h.category === "cash");
  const cashValue = cashHoldings.reduce((s, h) => s + h.currentValue, 0);

  // ===== Options bucket (positions only, no cash) =====
  const optionsHoldings = classified.filter(
    (h) => h.category === "wheel" || h.category === "leaps"
  );
  const optionsValue = optionsHoldings.reduce(
    (s, h) => s + Math.abs(h.currentValue),
    0
  );

  // Split by direction × right: Sell Put / Sell Call / Buy Call / Buy Put.
  // Value = absolute market value of the position(s) in that category.
  let sellPutValue = 0;
  let sellCallValue = 0;
  let buyCallValue = 0;
  let buyPutValue = 0;
  for (const h of optionsHoldings) {
    const isPut = /\bPUT\b/i.test(h.description);
    const isCall = /\bCALL\b/i.test(h.description);
    const v = Math.abs(h.currentValue);
    if (isPut && h.quantity < 0) sellPutValue += v;
    else if (isCall && h.quantity < 0) sellCallValue += v;
    else if (isCall && h.quantity > 0) buyCallValue += v;
    else if (isPut && h.quantity > 0) buyPutValue += v;
  }
  const optionsItems: BucketItem[] = [
    {
      label: "Sell Put",
      value: sellPutValue,
      currentPctOfBucket: pct(sellPutValue, optionsValue),
      targetPctOfBucket: 0,
    },
    {
      label: "Sell Call",
      value: sellCallValue,
      currentPctOfBucket: pct(sellCallValue, optionsValue),
      targetPctOfBucket: 0,
    },
    {
      label: "Buy Call",
      value: buyCallValue,
      currentPctOfBucket: pct(buyCallValue, optionsValue),
      targetPctOfBucket: 0,
    },
    {
      label: "Buy Put",
      value: buyPutValue,
      currentPctOfBucket: pct(buyPutValue, optionsValue),
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
