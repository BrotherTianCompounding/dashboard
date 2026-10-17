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

function parseOptionalNum(raw: string | undefined): number | null {
  if (!raw) return null;
  const cleaned = raw.replace(/[$,%"]/g, "").trim();
  if (cleaned === "" || cleaned === "--") return null;
  const n = parseFloat(cleaned);
  return Number.isFinite(n) ? n : null;
}

function firstNum(row: string[], cols: Record<string, number>, names: string[]): number | null {
  for (const name of names) {
    const idx = cols[name];
    if (idx === undefined) continue;
    const n = parseOptionalNum(row[idx]);
    if (n !== null) return n;
  }
  return null;
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

const OPTION_MONTHS = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];

/** Portfolio exports carry the exact expiry and strike in the bracketed OCC code. */
function portfolioOption(description: string): { symbol: string; description: string; multiplier: number } | null {
  const match = description.toUpperCase().match(/\[([A-Z.]+)\s+(\d{2})(\d{2})(\d{2})([CP])(\d{8})\s+(\d+(?:\.\d+)?)\]/);
  if (!match) return null;
  const month = OPTION_MONTHS[Number(match[3]) - 1];
  const multiplier = Number(match[7]);
  if (!month || multiplier <= 0) return null;
  const symbol = match[1];
  return {
    symbol,
    description: `${symbol} ${month} ${match[4]} ${2000 + Number(match[2])} $${Number(match[6]) / 1000} ${match[5] === "C" ? "CALL" : "PUT"}`,
    multiplier,
  };
}

function parsePortfolio(data: string[][], headerIndex: number): FidelityRow[] {
  const cols = new Map(data[headerIndex].map((name, i) => [name.trim(), i]));
  const rows: FidelityRow[] = [];
  let cashSection = false;
  let usdCash = 0;
  let totalCash: number | null = null;
  let hasForeignCash = false;
  for (const cells of data.slice(headerIndex + 1)) {
    const first = (cells[0] ?? "").trim();
    if (first === "Cash Balances") { cashSection = true; continue; }
    if (cashSection) {
      if (first === "Total (in USD)") totalCash = parseNum(cells[2]);
      else if (first === "USD") usdCash += parseNum(cells[2]);
      else if (/^[A-Z]{3}$/.test(first) && parseNum(cells[2]) !== 0) hasForeignCash = true;
      continue;
    }
    const get = (name: string) => (cells[cols.get(name) ?? -1] ?? "").trim();
    const type = get("Security Type");
    if (!type) continue;
    const quantity = parseNum(get("Position"));
    if (quantity === 0) continue;
    const currency = get("Currency");
    if (currency !== "USD") {
      throw new Error("IBKR Portfolio 持仓包含非美元资产，请使用美元口径的 Activity Statement 导出。");
    }
    const instrument = get("Financial Instrument Description");
    if (!["STK", "OPT"].includes(type)) {
      throw new Error(`暂不支持此 IBKR Portfolio 资产类型：${type}`);
    }
    const option = type === "OPT" ? portfolioOption(instrument) : null;
    if (type === "OPT" && !option) throw new Error("无法识别 IBKR Portfolio 期权合约代码。");
    const multiplier = option?.multiplier ?? 1;
    rows.push({
      accountName: "ibkr",
      symbol: option?.symbol ?? instrument,
      description: option?.description ?? instrument,
      quantity,
      lastPrice: parseNum(get("Market Price")),
      currentValue: parseNum(get("Market Value")),
      costBasisTotal: parseNum(get("Average Price")) * quantity * multiplier,
      contractMultiplier: option?.multiplier ?? null,
      totalGainLossDollar: parseNum(get("Unrealized P&L")),
      percentOfAccount: 0,
    });
  }
  if (hasForeignCash && totalCash === null) {
    throw new Error("IBKR Portfolio 外币现金缺少 Total (in USD)，无法准确换算账户总值。");
  }
  const cash = totalCash ?? usdCash;
  if (cash !== 0) rows.push(cashRow("Cash (USD equivalent)", cash));
  return rows;
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
  const portfolioHeader = data.findIndex((cells) =>
    cells.some((cell) => cell.trim() === "Financial Instrument Description") &&
    cells.some((cell) => cell.trim() === "Position") &&
    cells.some((cell) => cell.trim() === "Market Value")
  );
  if (portfolioHeader >= 0) return parsePortfolio(data, portfolioHeader);


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
        delta: firstNum(r, posCols, ["Delta", "Option Delta"]),
        contractMultiplier: firstNum(r, posCols, ["Multiplier", "Contract Multiplier"]),
        underlyingPrice: firstNum(r, posCols, ["Underlying Price", "Underlying Close Price"]),
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
