import Papa from "papaparse";
import type { FidelityRow } from "./types";

/** Strip "$", ",", "%", "+" and parse as number; "--" / "" → 0 */
function parseNum(raw: string | undefined): number {
  if (!raw) return 0;
  const cleaned = raw.replace(/[$,%+"]/g, "").trim();
  if (cleaned === "" || cleaned === "--") return 0;
  const n = parseFloat(cleaned);
  return Number.isFinite(n) ? n : 0;
}

const MONTHS = [
  "JAN", "FEB", "MAR", "APR", "MAY", "JUN",
  "JUL", "AUG", "SEP", "OCT", "NOV", "DEC",
];

/**
 * Turn a moomoo option name ("SOFI 260925 21.00C") into the Fidelity-style
 * description the rest of the app parses ("SOFI SEP 25 2026 $21 CALL").
 * Returns null if the name isn't an option leg.
 */
function moomooOptionDescription(name: string): string | null {
  const m = name
    .toUpperCase()
    .match(/^([A-Z.]+)\s+(\d{2})(\d{2})(\d{2})\s+([\d.]+)([CP])$/);
  if (!m) return null;
  const month = MONTHS[parseInt(m[3]) - 1];
  if (!month) return null;
  const year = 2000 + parseInt(m[2]);
  const day = m[4];
  const strike = parseFloat(m[5]); // "21.00" → 21
  const right = m[6] === "C" ? "CALL" : "PUT";
  return `${m[1]} ${month} ${day} ${year} $${strike} ${right}`;
}

/**
 * Parse a moomoo positions CSV into the same FidelityRow shape used everywhere
 * else, so downstream classification/display is identical.
 *
 * moomoo exports both real position legs AND strategy summary rows (e.g.
 * "SOFI Covered Stock", "SOFI Diagonal Spread") whose values are the sum of
 * their legs. We keep only the real legs (stocks + option legs) and skip the
 * strategy rows so nothing is double-counted.
 */
export function parseMoomooCsv(csvString: string): FidelityRow[] {
  const result = Papa.parse<Record<string, string>>(csvString, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h) => h.trim().toLowerCase(),
  });

  const rows: FidelityRow[] = [];
  for (const r of result.data) {
    const symbol = (r["symbol"] ?? "").trim();
    const name = (r["name"] ?? "").trim();
    if (!symbol || symbol.startsWith('"')) continue;
    // Multi-leg strategy header (e.g. "SOFI280121C20/260925C21") → skip
    if (symbol.includes("/")) continue;

    const marketValue = parseNum(r["market value"]);
    const pl = parseNum(r["p/l"]);
    const base = {
      accountName: "moomoo",
      quantity: parseNum(r["quantity"]),
      lastPrice: parseNum(r["current price"]),
      currentValue: marketValue,
      // moomoo gives per-unit "Diluted Cost"; total cost = market value − P/L
      costBasisTotal: marketValue - pl,
      totalGainLossDollar: pl,
      percentOfAccount: parseNum(r["% of portfolio"]),
    };

    // Option leg — name looks like "SOFI 260925 21.00C"
    const optDescription = moomooOptionDescription(name);
    if (optDescription) {
      rows.push({ ...base, symbol, description: optDescription });
      continue;
    }

    // Stock/ETF leg — plain ticker symbol (letters/dot only)
    if (/^[A-Z.]+$/.test(symbol)) {
      rows.push({ ...base, symbol, description: name });
      continue;
    }

    // Anything else (strategy summary row like "SOFI Covered Stock") → skip
  }

  return rows;
}
