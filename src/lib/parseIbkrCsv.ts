import Papa from "papaparse";
import type { FidelityRow } from "./types";

/** Strip "$", ",", "%" and parse as number; blank → 0 */
function parseNum(raw: string | undefined): number {
  if (!raw) return 0;
  const cleaned = raw.replace(/[$,%"]/g, "").trim();
  if (cleaned === "" || cleaned === "--") return 0;
  const n = parseFloat(cleaned);
  return Number.isFinite(n) ? n : 0;
}

const POSITIONS = "Positions and Mark-to-Market Profit and Loss";
const NAV = "Net Asset Value";

function cashRow(description: string, value: number): FidelityRow {
  return {
    accountName: "ibkr",
    symbol: "CASH",
    description,
    quantity: 0,
    lastPrice: 1,
    currentValue: value,
    costBasisTotal: value,
    totalGainLossDollar: 0,
    percentOfAccount: 0,
  };
}

/** "APP 11SEP26 300 P" → "APP SEP 11 2026 $300 PUT"; null if not an option. */
function ibkrOptionDescription(description: string): string | null {
  const m = description
    .toUpperCase()
    .match(/^([A-Z.]+)\s+(\d{2})([A-Z]{3})(\d{2})\s+([\d.]+)\s+([CP])$/);
  if (!m) return null;
  const year = 2000 + parseInt(m[4]);
  const strike = parseFloat(m[5]);
  const right = m[6] === "C" ? "CALL" : "PUT";
  return `${m[1]} ${m[3]} ${m[2]} ${year} $${strike} ${right}`;
}

/**
 * Parse an IBKR Activity Statement CSV into the shared FidelityRow shape.
 *
 * IBKR's export is multi-section: each row's first cell is the section name and
 * the second is "Header" or "Data". We read the "Positions and Mark-to-Market"
 * section, keeping only "Summary" rows (skipping "Details" and per-section
 * totals) with a non-zero quantity — these sum exactly to the NAV asset-class
 * totals. Forex rows become cash; the NAV section's Interest Accruals are added
 * as cash so the account total matches IBKR's NAV to the cent.
 */
export function parseIbkrCsv(csvString: string): FidelityRow[] {
  const parsed = Papa.parse<string[]>(csvString, { skipEmptyLines: true });
  const data = parsed.data;

  let posCols: Record<string, number> | null = null;
  let navCols: Record<string, number> | null = null;
  const rows: FidelityRow[] = [];

  for (const r of data) {
    if (!r || r.length < 2) continue;
    const section = (r[0] ?? "").trim();
    const kind = (r[1] ?? "").trim();

    if (kind === "Header") {
      const map: Record<string, number> = {};
      for (let i = 2; i < r.length; i++) {
        const name = (r[i] ?? "").trim();
        if (name && !(name in map)) map[name] = i;
      }
      if (section === POSITIONS) posCols = map;
      else if (section === NAV && !navCols) navCols = map; // keep the first NAV header
      continue;
    }

    if (kind !== "Data") continue;

    // NAV → pick up Interest Accruals as cash (matches NAV total exactly)
    if (section === NAV && navCols) {
      const assetClass = (r[navCols["Asset Class"]] ?? "").trim();
      if (assetClass === "Interest Accruals") {
        const v = parseNum(r[navCols["Current Total"]]);
        if (v) rows.push(cashRow("Cash (Interest Accruals)", v));
      }
      continue;
    }

    if (section === POSITIONS && posCols) {
      if ((r[posCols["DataDiscriminator"]] ?? "").trim() !== "Summary") continue;

      const assetClass = (r[posCols["Asset Class"]] ?? "").trim();
      const symbol = (r[posCols["Symbol"]] ?? "").trim();
      const description = (r[posCols["Description"]] ?? "").trim();
      const quantity = parseNum(r[posCols["Quantity"]]);
      const marketValue = parseNum(r[posCols["Market Value"]]);
      const base = {
        accountName: "ibkr",
        quantity,
        lastPrice: parseNum(r[posCols["Price"]]),
        currentValue: marketValue,
        costBasisTotal: 0,
        totalGainLossDollar: parseNum(r[posCols["Total"]]),
        percentOfAccount: 0,
      };

      if (assetClass === "Forex") {
        if (marketValue !== 0) {
          rows.push(cashRow(`Cash (${symbol || "USD"})`, marketValue));
        }
        continue;
      }

      if (quantity === 0) continue; // closed position

      if (assetClass.includes("Options")) {
        const desc = ibkrOptionDescription(description);
        if (desc) rows.push({ ...base, symbol, description: desc });
        continue;
      }

      // Stocks / ETFs
      rows.push({ ...base, symbol, description: description || symbol });
    }
  }

  return rows;
}
