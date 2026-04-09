import type { FidelityRow, ClassifiedHolding, SafeSideSubCategory } from "./types";

/** Symbols that always belong to safe-side */
const SAFE_SIDE_TICKERS: Record<string, SafeSideSubCategory> = {
  QQQM: "qqqm",
  VOO: "voo",
  SPY: "stocks",
  FXAIX: "stocks",
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
  const wheelStockSymbols = new Set<string>();
  for (const row of rows) {
    if (isPut(row.description) && row.quantity < 0) {
      const underlying = row.description.split(/\s+/)[0];
      if (underlying) {
        wheelStockSymbols.add(underlying);
      }
    }
  }

  return rows.map((row): ClassifiedHolding => {
    const base = {
      symbol: row.symbol,
      description: row.description,
      quantity: row.quantity,
      currentValue: row.currentValue,
      totalGainLossDollar: row.totalGainLossDollar,
    };

    if (CASH_TICKERS.has(row.symbol)) {
      return { ...base, category: "cash" };
    }

    if (isOption(row.description)) {
      if (isPut(row.description) && row.quantity < 0) {
        return { ...base, category: "wheel" };
      }
      if (isCall(row.description) && row.quantity < 0) {
        return { ...base, category: "wheel" };
      }
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
      return { ...base, category: "wheel" };
    }

    if (row.quantity > 0 && wheelStockSymbols.has(row.symbol)) {
      return { ...base, category: "wheel" };
    }

    if (SAFE_SIDE_TICKERS[row.symbol]) {
      return {
        ...base,
        category: "safe-side",
        safeSideSubCategory: SAFE_SIDE_TICKERS[row.symbol],
      };
    }

    if (row.quantity > 0 && !isOption(row.description)) {
      return { ...base, category: "safe-side", safeSideSubCategory: "stocks" };
    }

    return { ...base, category: "wheel" };
  });
}
