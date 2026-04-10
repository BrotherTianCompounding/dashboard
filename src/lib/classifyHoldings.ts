import type { FidelityRow, ClassifiedHolding, SafeSideSubCategory } from "./types";

/** Symbols that always belong to safe-side, mapped to sub-category */
const SAFE_SIDE_TICKERS: Record<string, SafeSideSubCategory> = {
  QQQM: "qqqm",
  QQQ: "qqqm",   // QQQ grouped with QQQM (both Nasdaq 100)
  QLD: "qqqm",   // ProShares Ultra QQQ, Nasdaq 100 leveraged
  VOO: "voo",
  SPY: "voo",    // SPY grouped with VOO (both S&P 500)
  FXAIX: "voo",  // Fidelity 500 Index, grouped with VOO
  VGT: "voo",    // Vanguard IT ETF, grouped with VOO as index
};

/** Cash-equivalent symbols */
const CASH_TICKERS = new Set(["SPAXX", "FCASH", "FDRXX"]);

const MONTH_MAP: Record<string, number> = {
  JAN: 0, FEB: 1, MAR: 2, APR: 3, MAY: 4, JUN: 5,
  JUL: 6, AUG: 7, SEP: 8, OCT: 9, NOV: 10, DEC: 11,
};

function parseOptionExpiry(description: string): Date | null {
  const match = description.match(
    /([A-Z]{3})\s+(\d{2})\s+(\d{4})\s+\$?[\d.]+\s+(PUT|CALL)/
  );
  if (!match) return null;
  const month = MONTH_MAP[match[1]];
  if (month === undefined) return null;
  return new Date(parseInt(match[3]), month, parseInt(match[2]));
}

function isOption(description: string): boolean {
  return /\b(PUT|CALL)\b/.test(description.toUpperCase());
}

function isPut(description: string): boolean {
  return /\bPUT\b/.test(description.toUpperCase());
}

function isCall(description: string): boolean {
  return /\bCALL\b/.test(description.toUpperCase());
}

export function classifyHoldings(rows: FidelityRow[]): ClassifiedHolding[] {
  return rows.map((row): ClassifiedHolding => {
    const base = {
      symbol: row.symbol,
      description: row.description,
      quantity: row.quantity,
      currentValue: row.currentValue,
      totalGainLossDollar: row.totalGainLossDollar,
    };

    // 1. Cash
    if (CASH_TICKERS.has(row.symbol)) {
      return { ...base, category: "cash" };
    }

    // 2. Options (PUT/CALL in description)
    if (isOption(row.description)) {
      // Short put or short call → wheel
      if (row.quantity < 0) {
        return { ...base, category: "wheel" };
      }
      // Long call → check DTE for LEAPS
      if (isCall(row.description) && row.quantity > 0) {
        const expiry = parseOptionExpiry(row.description);
        if (expiry) {
          const now = new Date();
          const daysToExpiry = (expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
          if (daysToExpiry > 180) {
            return { ...base, category: "leaps" };
          }
        }
        return { ...base, category: "wheel" };
      }
      // Long put → wheel
      return { ...base, category: "wheel" };
    }

    // 3. Known safe-side tickers (QQQ→qqqm, SPY/FXAIX→voo, etc.)
    if (SAFE_SIDE_TICKERS[row.symbol]) {
      return {
        ...base,
        category: "safe-side",
        safeSideSubCategory: SAFE_SIDE_TICKERS[row.symbol],
      };
    }

    // 4. All other positive-quantity stocks → safe-side/stocks (定投仓个股)
    if (row.quantity > 0 && !isOption(row.description)) {
      return { ...base, category: "safe-side", safeSideSubCategory: "stocks" };
    }

    // 5. Catch-all
    return { ...base, category: "wheel" };
  });
}
