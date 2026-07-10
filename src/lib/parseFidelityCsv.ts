import Papa from "papaparse";
import type { FidelityRow } from "./types";

/** Strip "$", ",", "%" and parse as number */
function parseNum(raw: string | undefined): number {
  if (!raw) return 0;
  const cleaned = raw.replace(/[$,%]/g, "").replace(/"/g, "").trim();
  if (cleaned === "" || cleaned === "--") return 0;
  return parseFloat(cleaned);
}

export function parseFidelityCsv(csvString: string): FidelityRow[] {
  // Fidelity has shipped headers in both Title Case ("Last Price") and
  // sentence case ("Last price"), and occasionally drops columns (e.g. "Sleeve
  // Name"). Normalize header keys to lowercase so lookups survive either style.
  const result = Papa.parse<Record<string, string>>(csvString, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h) => h.trim().toLowerCase(),
  });

  return result.data
    .filter((row) => {
      const symbol = (row["symbol"] ?? "").trim();
      if (!symbol) return false;
      // Filter out disclaimer/footer rows (but keep Pending activity for total calc)
      if (symbol.startsWith('"')) return false;
      return true;
    })
    .map((row) => ({
      accountName: (row["account name"] ?? row["account name/number"] ?? "").trim(),
      symbol: (row["symbol"] ?? "").trim().replace(/\*+$/, ""), // SPAXX** → SPAXX
      description: (row["description"] ?? "").trim(),
      quantity: parseNum(row["quantity"]),
      lastPrice: parseNum(row["last price"]),
      currentValue: parseNum(row["current value"]),
      costBasisTotal: parseNum(row["cost basis total"]),
      totalGainLossDollar: parseNum(row["total gain/loss dollar"]),
      percentOfAccount: parseNum(row["percent of account"]),
    }));
}

const MONTH_MAP: Record<string, number> = {
  Jan: 0, Feb: 1, Mar: 2, Apr: 3, May: 4, Jun: 5,
  Jul: 6, Aug: 7, Sep: 8, Oct: 9, Nov: 10, Dec: 11,
};

export function parseDateFromFilename(filename: string): Date | null {
  // Format: Portfolio_Positions_Apr-05-2026.csv
  const fidelityMatch = filename.match(
    /([A-Z][a-z]{2})-(\d{2})-(\d{4})/
  );
  if (fidelityMatch) {
    const month = MONTH_MAP[fidelityMatch[1]];
    if (month !== undefined) {
      return new Date(
        parseInt(fidelityMatch[3]),
        month,
        parseInt(fidelityMatch[2])
      );
    }
  }

  // Format: 2026-04-05 or positions_2026-04-05.csv
  const isoMatch = filename.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (isoMatch) {
    return new Date(
      parseInt(isoMatch[1]),
      parseInt(isoMatch[2]) - 1,
      parseInt(isoMatch[3])
    );
  }

  return null;
}
