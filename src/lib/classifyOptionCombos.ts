import type { ClassifiedHolding, OptionTickerCount } from "./types";

const MONTH_MAP: Record<string, number> = {
  JAN: 0, FEB: 1, MAR: 2, APR: 3, MAY: 4, JUN: 5,
  JUL: 6, AUG: 7, SEP: 8, OCT: 9, NOV: 10, DEC: 11,
};

/** Internal grouping buckets. */
type Category =
  | "LEAPS Call"
  | "Sell Put"
  | "Sell Call"
  | "Synthetic Long"
  | "Call Spread"
  | "Put Spread"
  | "Other";

/** Only these are shown; combos merely absorb their legs so they don't count. */
export type ShownKey = "LEAPS Call" | "Sell Put" | "Sell Call";
const SHOWN: ShownKey[] = ["LEAPS Call", "Sell Put", "Sell Call"];

interface OptLeg {
  underlying: string;
  expiryKey: string;
  strike: number;
  isCall: boolean;
  qty: number;
  value: number; // abs current market value
}

/** Parse "NVDA AUG 07 2026 $220 CALL" → leg metadata. Null if not an option. */
function parseLeg(h: ClassifiedHolding): OptLeg | null {
  const m = h.description
    .toUpperCase()
    .match(/^([A-Z.]+)\s+([A-Z]{3})\s+(\d{1,2})\s+(\d{4})\s+\$?([\d.]+)\s+(PUT|CALL)/);
  if (!m) return null;
  const month = MONTH_MAP[m[2]];
  if (month === undefined) return null;
  const expiryKey = `${m[4]}-${String(month + 1).padStart(2, "0")}-${m[3].padStart(2, "0")}`;
  return {
    underlying: m[1],
    expiryKey,
    strike: parseFloat(m[5]),
    isCall: m[6] === "CALL",
    qty: h.quantity,
    value: Math.abs(h.currentValue),
  };
}

export interface OptionComboGroup {
  label: ShownKey;
  value: number;
  contracts: number;
  /** Per-underlying tally, sorted by contracts desc then value desc. */
  tickers: OptionTickerCount[];
}

/**
 * Group option holdings into categories (always within one underlying), then
 * return only the single-leg categories that are actually shown — each collapsed
 * to a per-underlying contract tally.
 *
 * Priority (higher wins, absorbs its legs so they aren't recounted):
 *   1. Synthetic Long — same expiry + strike with a long call AND a short put.
 *   2. Call Spread — remaining calls, same expiry, ≥2 strikes, AND ≥1 long & ≥1 short.
 *   3. Put Spread  — same rule for puts.
 *   4. Singles — long call → LEAPS Call; short put → Sell Put; short call → Sell Call.
 *
 * Synthetic Long / Call Spread / Put Spread / Other are detected only to exclude
 * their legs; they are not returned for display.
 */
export function classifyOptionCombos(
  holdings: ClassifiedHolding[]
): OptionComboGroup[] {
  const legs = holdings.map(parseLeg);
  const assigned: (Category | null)[] = legs.map(() => null);

  // per-shown-category, per-underlying tally
  const tally: Record<ShownKey, Map<string, { contracts: number; value: number }>> = {
    "LEAPS Call": new Map(),
    "Sell Put": new Map(),
    "Sell Call": new Map(),
  };

  const assign = (i: number, key: Category) => {
    const l = legs[i]!;
    assigned[i] = key;
    if (key === "LEAPS Call" || key === "Sell Put" || key === "Sell Call") {
      const t = tally[key];
      const cur = t.get(l.underlying) ?? { contracts: 0, value: 0 };
      cur.contracts += Math.abs(l.qty);
      cur.value += l.value;
      t.set(l.underlying, cur);
    }
  };

  const groupBy = (keyFn: (l: OptLeg, i: number) => string | null) => {
    const groups = new Map<string, number[]>();
    legs.forEach((l, i) => {
      if (!l) return;
      const k = keyFn(l, i);
      if (k === null) return;
      const arr = groups.get(k);
      if (arr) arr.push(i);
      else groups.set(k, [i]);
    });
    return groups;
  };

  // Step 1: Synthetic long (long call + short put at same underlying/expiry/strike)
  const byStrike = groupBy((l) => `${l.underlying}|${l.expiryKey}|${l.strike}`);
  for (const idxs of byStrike.values()) {
    const hasLongCall = idxs.some((i) => legs[i]!.isCall && legs[i]!.qty > 0);
    const hasShortPut = idxs.some((i) => !legs[i]!.isCall && legs[i]!.qty < 0);
    if (hasLongCall && hasShortPut) {
      for (const i of idxs) {
        const l = legs[i]!;
        if ((l.isCall && l.qty > 0) || (!l.isCall && l.qty < 0)) {
          assign(i, "Synthetic Long");
        }
      }
    }
  }

  // Steps 2 & 3: spreads — same expiry, ≥2 strikes, and BOTH a long and a short leg
  const groupSpread = (wantCall: boolean, key: Category) => {
    const byExpiry = groupBy((l, i) =>
      !assigned[i] && l.isCall === wantCall ? `${l.underlying}|${l.expiryKey}` : null
    );
    for (const idxs of byExpiry.values()) {
      const strikes = new Set(idxs.map((i) => legs[i]!.strike));
      const hasLong = idxs.some((i) => legs[i]!.qty > 0);
      const hasShort = idxs.some((i) => legs[i]!.qty < 0);
      if (strikes.size >= 2 && hasLong && hasShort) {
        idxs.forEach((i) => assign(i, key));
      }
    }
  };
  groupSpread(true, "Call Spread");
  groupSpread(false, "Put Spread");

  // Step 4: remaining singles
  legs.forEach((l, i) => {
    if (assigned[i] || !l) return;
    if (l.isCall && l.qty > 0) assign(i, "LEAPS Call");
    else if (!l.isCall && l.qty < 0) assign(i, "Sell Put");
    else if (l.isCall && l.qty < 0) assign(i, "Sell Call");
    // lone long put etc. → not shown
  });

  return SHOWN.map((key) => {
    const tickers: OptionTickerCount[] = Array.from(tally[key].entries())
      .map(([underlying, v]) => ({ underlying, contracts: v.contracts, value: v.value }))
      .sort((a, b) => b.contracts - a.contracts || b.value - a.value);
    return {
      label: key,
      value: tickers.reduce((s, t) => s + t.value, 0),
      contracts: tickers.reduce((s, t) => s + t.contracts, 0),
      tickers,
    };
  }).filter((g) => g.tickers.length > 0);
}
