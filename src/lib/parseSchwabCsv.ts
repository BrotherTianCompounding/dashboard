import Papa from "papaparse";
import type { FidelityRow } from "./types";

const MONTHS = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];

function optionalNumber(raw: string | undefined): number | null {
  const text = (raw ?? "").trim();
  if (!text || text === "--" || text === "N/A") return null;
  const cleaned = text.replace(/[$,%]/g, "").replace(/^\((.*)\)$/, "-$1");
  const value = Number(cleaned);
  return Number.isFinite(value) ? value : null;
}

function optionDescription(symbol: string): string | null {
  const match = symbol.toUpperCase().match(/^([A-Z.]+)\s+(\d{2})\/(\d{2})\/(\d{4})\s+([\d.]+)\s+([CP])$/);
  if (!match) return null;
  const month = MONTHS[Number(match[2]) - 1];
  if (!month) return null;
  return `${match[1]} ${month} ${match[3]} ${match[4]} $${Number(match[5])} ${match[6] === "C" ? "CALL" : "PUT"}`;
}

/** Schwab exports include an account preamble and a trailing totals row. */
export function parseSchwabCsv(csv: string): FidelityRow[] {
  const data = Papa.parse<string[]>(csv.replace(/^\uFEFF/, ""), { skipEmptyLines: "greedy" }).data;
  const headerIndex = data.findIndex((cells) =>
    cells.some((cell) => cell.trim().toLowerCase() === "symbol") &&
    cells.some((cell) => cell.trim().toLowerCase() === "mkt val (market value)")
  );
  if (headerIndex < 0) throw new Error("未找到嘉信持仓表头，请上传 Positions CSV。");
  const columns = new Map(data[headerIndex].map((name, i) => [name.trim().toLowerCase(), i]));
  const rows: FidelityRow[] = [];
  for (const cells of data.slice(headerIndex + 1)) {
    const get = (name: string): string => cells[columns.get(name) ?? -1]?.trim() ?? "";
    const symbol = get("symbol");
    if (!symbol || /^(positions total|account total|total)$/i.test(symbol)) continue;
    const cash = symbol.toLowerCase() === "cash & cash investments" ||
      get("asset type").toLowerCase() === "cash and money market";
    const currentValue = optionalNumber(get("mkt val (market value)"));
    const quantity = optionalNumber(get("qty (quantity)"));
    if (currentValue === null || (!cash && (quantity === null || quantity === 0))) continue;
    const description = optionDescription(symbol);
    if (get("asset type").toLowerCase() === "option" && !description) {
      throw new Error(`无法识别嘉信期权合约：${symbol}`);
    }
    rows.push({
      accountName: "schwab",
      symbol: cash ? "CASH" : symbol,
      description: cash ? "Cash & Cash Investments" : description ?? get("description"),
      quantity: cash ? 0 : quantity!,
      lastPrice: cash ? 1 : optionalNumber(get("price")) ?? 0,
      currentValue,
      costBasisTotal: optionalNumber(get("cost basis")) ?? 0,
      totalGainLossDollar: optionalNumber(get("gain $ (gain/loss $)")) ?? 0,
      percentOfAccount: 0,
    });
  }
  return rows;
}
