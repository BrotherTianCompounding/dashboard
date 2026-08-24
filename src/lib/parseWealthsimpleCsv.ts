import Papa from "papaparse";
import type { FidelityRow } from "./types";

/** Strip "$", ",", "%" and parse as number; blank / "--" → 0 */
function parseNum(raw: string | undefined): number {
  if (!raw) return 0;
  const cleaned = raw.replace(/[$,%"]/g, "").trim();
  if (cleaned === "" || cleaned === "--") return 0;
  const n = parseFloat(cleaned);
  return Number.isFinite(n) ? n : 0;
}

const MONTHS = [
  "JAN", "FEB", "MAR", "APR", "MAY", "JUN",
  "JUL", "AUG", "SEP", "OCT", "NOV", "DEC",
];

function median(nums: number[]): number {
  const s = [...nums].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)];
}

/**
 * Derive a USD→CAD rate from the file so CAD holdings can be shown in USD.
 * Prefers the USD cash row (book-CAD / quantity); falls back to the median
 * book-value FX of USD positions; finally a sane constant.
 */
function deriveUsdToCad(records: Record<string, string>[]): number {
  const sane = (x: number) => x >= 1.0 && x <= 2.0;

  const cashRates: number[] = [];
  for (const r of records) {
    if (
      (r["security type"] ?? "").toUpperCase() === "CURRENCY" &&
      (r["symbol"] ?? "").toUpperCase() === "USD"
    ) {
      const bookCad = parseNum(r["book value (cad)"]);
      const qty = parseNum(r["quantity"]);
      if (qty > 0) {
        const x = bookCad / qty;
        if (sane(x)) cashRates.push(x);
      }
    }
  }
  if (cashRates.length) return median(cashRates);

  const rates: number[] = [];
  for (const r of records) {
    if ((r["market value currency"] ?? "").toUpperCase() === "USD") {
      const bookCad = parseNum(r["book value (cad)"]);
      const bookMkt = parseNum(r["book value (market)"]);
      if (bookMkt > 0) {
        const x = bookCad / bookMkt;
        if (sane(x)) rates.push(x);
      }
    }
  }
  if (rates.length) return median(rates);

  return 1.4;
}

/** "AAPL  280121C00260000" → "AAPL JAN 21 2028 $260 CALL"; null if not an option. */
function wsOptionDescription(symbol: string): string | null {
  const m = symbol
    .toUpperCase()
    .match(/^([A-Z.]+)\s+(\d{2})(\d{2})(\d{2})([CP])(\d{8})$/);
  if (!m) return null;
  const month = MONTHS[parseInt(m[3]) - 1];
  if (!month) return null;
  const year = 2000 + parseInt(m[2]);
  const strike = parseInt(m[6]) / 1000;
  const right = m[5] === "C" ? "CALL" : "PUT";
  return `${m[1]} ${month} ${m[4]} ${year} $${strike} ${right}`;
}

/**
 * Parse a Wealthsimple holdings report into the shared FidelityRow shape.
 *
 * Wealthsimple is multi-currency (USD + CAD). Market Value is in each security's
 * native currency, so everything is converted to USD via a rate derived from the
 * file. Currency rows (USD/CAD) become cash. Option symbols (OCC format) are
 * normalized to the Fidelity-style description the rest of the app parses.
 */
export function parseWealthsimpleCsv(csvString: string): FidelityRow[] {
  const result = Papa.parse<Record<string, string>>(csvString, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h) => h.trim().toLowerCase(),
  });
  const records = result.data;
  const usdToCad = deriveUsdToCad(records);
  const toUsd = (v: number, currency: string | undefined) =>
    (currency ?? "").toUpperCase() === "CAD" ? v / usdToCad : v;

  const rows: FidelityRow[] = [];
  for (const r of records) {
    const symbol = (r["symbol"] ?? "").trim();
    if (!symbol || symbol.startsWith('"')) continue;

    const secType = (r["security type"] ?? "").toUpperCase();
    const mvCur = r["market value currency"];
    const currentValue = toUsd(parseNum(r["market value"]), mvCur);
    const costBasisTotal = toUsd(
      parseNum(r["book value (market)"]),
      r["book value currency (market)"] ?? mvCur
    );
    const base = {
      accountName: "wealthsimple",
      quantity: parseNum(r["quantity"]),
      lastPrice: toUsd(parseNum(r["market price"]), r["market price currency"] ?? mvCur),
      currentValue,
      costBasisTotal,
      totalGainLossDollar: toUsd(
        parseNum(r["market unrealized returns"]),
        r["market unrealized returns currency"] ?? mvCur
      ),
      percentOfAccount: 0,
    };

    // Cash / currency balance → normalized cash row
    if (secType === "CURRENCY") {
      rows.push({
        ...base,
        symbol: "CASH",
        description: `Cash (${symbol.toUpperCase()})`,
        costBasisTotal: currentValue,
        totalGainLossDollar: 0,
      });
      continue;
    }

    // Option leg → normalize the OCC symbol into a Fidelity-style description
    if (secType === "OPTION") {
      const desc = wsOptionDescription(symbol);
      if (desc) rows.push({ ...base, symbol, description: desc });
      continue;
    }

    // Equity / ETF (and anything else with a plain symbol)
    rows.push({ ...base, symbol, description: (r["name"] ?? "").trim() || symbol });
  }

  return rows;
}
