import type { ClassifiedHolding, OptionLegDetail } from "./types";

const MONTH_MAP: Record<string, number> = {
  JAN: 0, FEB: 1, MAR: 2, APR: 3, MAY: 4, JUN: 5,
  JUL: 6, AUG: 7, SEP: 8, OCT: 9, NOV: 10, DEC: 11,
};

const MS_PER_DAY = 1000 * 60 * 60 * 24;

/** Display categories for the options block, in render order. */
export type ComboKey =
  | "LEAPS Call"
  | "Sell Put"
  | "Sell Call"
  | "Synthetic Long"
  | "Call Spread"
  | "Put Spread"
  | "Other";

const ORDER: ComboKey[] = [
  "LEAPS Call",
  "Sell Put",
  "Sell Call",
  "Synthetic Long",
  "Call Spread",
  "Put Spread",
  "Other",
];

/** Categories that list their individual legs in the UI. */
const DETAILED: ReadonlySet<ComboKey> = new Set<ComboKey>([
  "LEAPS Call",
  "Sell Put",
  "Sell Call",
]);

interface OptLeg {
  underlying: string;
  expiryKey: string;
  expiryDate: Date;
  strike: number;
  isCall: boolean;
  qty: number;
  value: number; // abs current market value
  cost: number; // abs cost basis
}

/** Parse "NVDA AUG 07 2026 $220 CALL" → leg metadata. Null if not an option. */
function parseLeg(h: ClassifiedHolding): OptLeg | null {
  const m = h.description
    .toUpperCase()
    .match(/^([A-Z.]+)\s+([A-Z]{3})\s+(\d{1,2})\s+(\d{4})\s+\$?([\d.]+)\s+(PUT|CALL)/);
  if (!m) return null;
  const month = MONTH_MAP[m[2]];
  if (month === undefined) return null;
  const year = parseInt(m[4]);
  const day = parseInt(m[3]);
  const expiryKey = `${m[4]}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  return {
    underlying: m[1],
    expiryKey,
    expiryDate: new Date(year, month, day),
    strike: parseFloat(m[5]),
    isCall: m[6] === "CALL",
    qty: h.quantity,
    value: Math.abs(h.currentValue),
    cost: Math.abs(h.costBasisTotal),
  };
}

export interface OptionComboGroup {
  label: ComboKey;
  value: number;
  /** Populated for LEAPS Call / Sell Put / Sell Call; empty otherwise. */
  legs: OptionLegDetail[];
}

/**
 * Group option holdings into display categories (always within one underlying).
 *
 * Priority:
 *   1. Synthetic Long — same expiry + strike with a long call AND a short put.
 *   2. Call Spread — remaining calls, same expiry, ≥2 strikes, AND at least one
 *      long and one short leg (a real vertical, not a same-direction ladder).
 *   3. Put Spread  — same rule for puts.
 *   4. Singles — long call → LEAPS Call; short put → Sell Put;
 *      short call → Sell Call; anything else (lone long put) → Other.
 *
 * Value per category = sum of absolute market value of its member legs.
 * LEAPS Call / Sell Put / Sell Call also carry per-leg detail.
 */
export function classifyOptionCombos(
  holdings: ClassifiedHolding[],
  now: Date = new Date()
): OptionComboGroup[] {
  const totals: Record<ComboKey, number> = {
    "LEAPS Call": 0,
    "Sell Put": 0,
    "Sell Call": 0,
    "Synthetic Long": 0,
    "Call Spread": 0,
    "Put Spread": 0,
    Other: 0,
  };
  const detailLegs: Record<ComboKey, OptionLegDetail[]> = {
    "LEAPS Call": [],
    "Sell Put": [],
    "Sell Call": [],
    "Synthetic Long": [],
    "Call Spread": [],
    "Put Spread": [],
    Other: [],
  };

  const legs = holdings.map(parseLeg);
  const assigned: (ComboKey | null)[] = legs.map(() => null);

  const assign = (i: number, key: ComboKey) => {
    const l = legs[i]!;
    assigned[i] = key;
    totals[key] += l.value;
    if (DETAILED.has(key)) {
      detailLegs[key].push({
        underlying: l.underlying,
        right: l.isCall ? "C" : "P",
        strike: l.strike,
        expiry: l.expiryKey,
        daysToExpiry: Math.round((l.expiryDate.getTime() - now.getTime()) / MS_PER_DAY),
        contracts: Math.abs(l.qty),
        value: l.value,
        cost: l.cost,
      });
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
  const groupSpread = (wantCall: boolean, key: ComboKey) => {
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
    if (assigned[i]) return;
    if (!l) {
      totals.Other += Math.abs(holdings[i].currentValue);
      return;
    }
    if (l.isCall && l.qty > 0) assign(i, "LEAPS Call");
    else if (!l.isCall && l.qty < 0) assign(i, "Sell Put");
    else if (l.isCall && l.qty < 0) assign(i, "Sell Call");
    else assign(i, "Other"); // lone long put, etc.
  });

  // Sort detailed legs by soonest expiry, then largest value
  for (const k of DETAILED) {
    detailLegs[k].sort(
      (a, b) => a.daysToExpiry - b.daysToExpiry || b.value - a.value
    );
  }

  return ORDER.filter((k) => k !== "Other" || totals[k] > 0).map((k) => ({
    label: k,
    value: totals[k],
    legs: detailLegs[k],
  }));
}
