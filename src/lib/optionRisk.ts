import type {
  BudgetUsageBar,
  BullishAllocation,
  ClassifiedHolding,
  DeltaExposureRow,
  FidelityRow,
  OptionBudgetConfig,
  OptionRiskSummary,
} from "./types";

export const OPTION_BUDGET_CONFIG: OptionBudgetConfig = {
  sellPutBudgetPct: 0.7,
  leapsBudgetPct: 0.25,
  tacticalBudgetPct: 0.05,
  sellPutMultiplier: 1.3,
};

const CONTRACT_MULTIPLIER_FALLBACK = 100;
const MONTH_MAP: Record<string, number> = {
  JAN: 0,
  FEB: 1,
  MAR: 2,
  APR: 3,
  MAY: 4,
  JUN: 5,
  JUL: 6,
  AUG: 7,
  SEP: 8,
  OCT: 9,
  NOV: 10,
  DEC: 11,
};

interface ParsedOptionLeg {
  id: number;
  underlying: string;
  expiry: Date;
  expiryKey: string;
  strike: number;
  right: "CALL" | "PUT";
  qty: number;
  absQty: number;
  multiplier: number;
  currentValue: number;
  delta: number | null;
}

interface LegSlice {
  leg: ParsedOptionLeg;
  qty: number;
}

function addCalendarMonths(date: Date, months: number): Date {
  return new Date(date.getFullYear(), date.getMonth() + months, date.getDate());
}

function parseOptionLeg(holding: ClassifiedHolding, id: number): ParsedOptionLeg | null {
  const match = holding.description
    .toUpperCase()
    .match(/^([A-Z.]+)\s+([A-Z]{3})\s+(\d{1,2})\s+(\d{4})\s+\$?([\d.]+)\s+(PUT|CALL)/);
  if (!match) return null;
  const month = MONTH_MAP[match[2]];
  if (month === undefined) return null;
  const expiry = new Date(parseInt(match[4], 10), month, parseInt(match[3], 10));
  const multiplier = holding.contractMultiplier ?? CONTRACT_MULTIPLIER_FALLBACK;
  return {
    id,
    underlying: match[1],
    expiry,
    expiryKey: `${match[4]}-${String(month + 1).padStart(2, "0")}-${match[3].padStart(2, "0")}`,
    strike: parseFloat(match[5]),
    right: match[6] as "CALL" | "PUT",
    qty: holding.quantity,
    absQty: Math.abs(holding.quantity),
    multiplier,
    currentValue: holding.currentValue,
    delta: holding.delta ?? null,
  };
}

function addBarMeta(bar: Omit<BudgetUsageBar, "percentUsed" | "visualPercent" | "isOver" | "overAmount" | "overPercent" | "status">): BudgetUsageBar {
  if (bar.maxValue <= 0 || !Number.isFinite(bar.maxValue)) {
    return {
      ...bar,
      percentUsed: null,
      visualPercent: 0,
      isOver: false,
      overAmount: 0,
      overPercent: null,
      status: "invalid-budget",
    };
  }
  const raw = bar.currentValue / bar.maxValue;
  const overAmount = Math.max(bar.currentValue - bar.maxValue, 0);
  return {
    ...bar,
    percentUsed: raw * 100,
    visualPercent: Math.min(Math.max(raw, 0), 1) * 100,
    isOver: bar.currentValue >= bar.maxValue,
    overAmount,
    overPercent: overAmount > 0 ? (overAmount / bar.maxValue) * 100 : 0,
    status: "ok",
  };
}

function proportionalValue(leg: ParsedOptionLeg, qty: number): number {
  return leg.absQty > 0 ? (leg.currentValue / leg.absQty) * qty : 0;
}

function consume(remaining: Map<number, number>, leg: ParsedOptionLeg, qty: number) {
  remaining.set(leg.id, Math.max((remaining.get(leg.id) ?? 0) - qty, 0));
}

function detectVerticalSpreads(legs: ParsedOptionLeg[], remaining: Map<number, number>): LegSlice[] {
  const slices: LegSlice[] = [];
  const groups = new Map<string, ParsedOptionLeg[]>();
  for (const leg of legs) {
    const key = `${leg.underlying}|${leg.expiryKey}|${leg.right}`;
    groups.set(key, [...(groups.get(key) ?? []), leg]);
  }

  for (const group of groups.values()) {
    const strikes = new Set(group.map((l) => l.strike));
    if (strikes.size < 2) continue;
    const longs = group.filter((l) => l.qty > 0).sort((a, b) => a.strike - b.strike);
    const shorts = group.filter((l) => l.qty < 0).sort((a, b) => a.strike - b.strike);
    if (longs.length === 0 || shorts.length === 0) continue;

    for (const longLeg of longs) {
      for (const shortLeg of shorts) {
        const qty = Math.min(remaining.get(longLeg.id) ?? 0, remaining.get(shortLeg.id) ?? 0);
        if (qty <= 0) continue;
        slices.push({ leg: longLeg, qty }, { leg: shortLeg, qty });
        consume(remaining, longLeg, qty);
        consume(remaining, shortLeg, qty);
      }
    }
  }
  return slices;
}

function buildBudgetBar(
  key: BudgetUsageBar["key"],
  label: string,
  currentValue: number,
  baseBudget: number,
  maxValue: number,
  budgetPct: number,
  detail: string,
  netValueNote?: string
): BudgetUsageBar {
  return addBarMeta({ key, label, currentValue, baseBudget, maxValue, budgetPct, detail, netValueNote });
}

export function calculateOptionRiskSummary(
  holdings: ClassifiedHolding[],
  optionBudgetBase: number,
  valuationDate: Date | null,
  config: OptionBudgetConfig = OPTION_BUDGET_CONFIG
): OptionRiskSummary {
  const asOf = valuationDate ?? new Date();
  const eightMonthCutoff = addCalendarMonths(asOf, 8);
  const legs = holdings
    .map((h, i) => parseOptionLeg(h, i))
    .filter((leg): leg is ParsedOptionLeg => Boolean(leg));
  const remaining = new Map(legs.map((leg) => [leg.id, leg.absQty]));

  const tacticalSlices = detectVerticalSpreads(legs, remaining);

  const sellPutAssignment = legs
    .filter((leg) => leg.right === "PUT" && leg.qty < 0)
    .reduce((sum, leg) => sum + (remaining.get(leg.id) ?? 0) * leg.strike * leg.multiplier, 0);

  for (const leg of legs.filter((l) => l.right === "PUT" && l.qty < 0)) {
    consume(remaining, leg, remaining.get(leg.id) ?? 0);
  }

  for (const leg of legs) {
    const qty = remaining.get(leg.id) ?? 0;
    if (qty <= 0) continue;
    const isBuyer = leg.qty > 0;
    const isLongCall = leg.right === "CALL" && isBuyer;
    const isShortTermOrNotCall = leg.expiry.getTime() <= eightMonthCutoff.getTime() || !isLongCall;
    if (isBuyer && isShortTermOrNotCall) {
      tacticalSlices.push({ leg, qty });
      consume(remaining, leg, qty);
    }
  }

  const leapsValue = legs
    .filter((leg) => leg.right === "CALL" && leg.qty > 0)
    .reduce((sum, leg) => sum + proportionalValue(leg, remaining.get(leg.id) ?? 0), 0);

  const tacticalValue = tacticalSlices.reduce(
    (sum, slice) => sum + proportionalValue(slice.leg, slice.qty),
    0
  );

  const sellPutBase = optionBudgetBase * config.sellPutBudgetPct;
  const sellPutMax = sellPutBase * config.sellPutMultiplier;
  const leapsMax = optionBudgetBase * config.leapsBudgetPct;
  const tacticalMax = optionBudgetBase * config.tacticalBudgetPct;

  return {
    budgetBase: optionBudgetBase,
    config,
    bars: [
      buildBudgetBar(
        "sell-put",
        "Sell Put 仓位",
        sellPutAssignment,
        sellPutBase,
        sellPutMax,
        config.sellPutBudgetPct,
        `${formatDollar(sellPutBase)} × ${(config.sellPutMultiplier * 100).toFixed(0)}% = ${formatDollar(sellPutMax)}【${(config.sellPutBudgetPct * 100).toFixed(0)}%】`
      ),
      buildBudgetBar(
        "leaps-call",
        "LEAPS Call 仓位",
        leapsValue,
        leapsMax,
        leapsMax,
        config.leapsBudgetPct,
        `${formatDollar(leapsMax)}【${(config.leapsBudgetPct * 100).toFixed(0)}%】`
      ),
      buildBudgetBar(
        "tactical",
        "战术进攻仓位",
        tacticalValue,
        tacticalMax,
        tacticalMax,
        config.tacticalBudgetPct,
        `${formatDollar(tacticalMax)}【${(config.tacticalBudgetPct * 100).toFixed(0)}%】`,
        "净市值"
      ),
    ],
  };
}

function formatDollar(value: number): string {
  const sign = value < 0 ? "-" : "";
  return `${sign}$${Math.round(Math.abs(value)).toLocaleString("en-US")}`;
}

function getUnderlyingPrice(row: FidelityRow): number | null {
  const price = row.underlyingPrice ?? row.lastPrice;
  return Number.isFinite(price) && price > 0 ? price : null;
}

const EXPOSURE_GROUPS: Record<string, string> = {
  QQQ: "QQQ", QQQM: "QQQ",
  VOO: "VOO", SPY: "VOO", FXAIX: "VOO",
};

export function calculateDeltaExposures(rows: FidelityRow[], totalValue: number): DeltaExposureRow[] {
  const bySymbol = new Map<string, DeltaExposureRow>();

  const ensure = (symbol: string): DeltaExposureRow => {
    const existing = bySymbol.get(symbol);
    if (existing) return existing;
    const created: DeltaExposureRow = {
      symbol,
      stockExposure: 0,
      optionExposure: 0,
      deltaDollarExposure: 0,
      deltaShares: 0,
      portfolioPct: 0,
      underlyingPrice: null,
      hasIncompleteData: false,
      hasEstimatedExposure: false,
    };
    bySymbol.set(symbol, created);
    return created;
  };

  rows.forEach((row, i) => {
    if (row.symbol === "Pending activity") return;
    const parsed = parseOptionLeg(
      {
        symbol: row.symbol,
        description: row.description,
        quantity: row.quantity,
        currentValue: row.currentValue,
        costBasisTotal: row.costBasisTotal,
        totalGainLossDollar: row.totalGainLossDollar,
        category: "wheel",
        delta: row.delta,
        contractMultiplier: row.contractMultiplier,
        underlyingPrice: row.underlyingPrice,
      },
      i
    );

    if (parsed) {
      const target = ensure(parsed.underlying);
      const price = row.underlyingPrice ?? null;
      if (price && price > 0) target.underlyingPrice = price;
      if (parsed.delta === null || !Number.isFinite(parsed.delta)) {
        let estimatedValue: number | null = null;
        if (parsed.right === "CALL" && parsed.qty > 0 && Number.isFinite(row.currentValue)) {
          estimatedValue = Math.abs(row.currentValue);
        } else if (parsed.right === "PUT" && parsed.qty < 0) {
          estimatedValue = parsed.strike * parsed.multiplier * parsed.absQty;
        }
        if (estimatedValue !== null && Number.isFinite(estimatedValue)) {
          target.optionExposure += estimatedValue;
          target.hasEstimatedExposure = true;
        } else {
          target.hasIncompleteData = true;
        }
        return;
      }
      if (!target.underlyingPrice) {
        target.hasIncompleteData = true;
        return;
      }
      const deltaShares = parsed.delta * parsed.qty * parsed.multiplier;
      target.deltaShares += deltaShares;
      target.optionExposure += deltaShares * target.underlyingPrice;
      return;
    }

    if (row.quantity === 0 || row.currentValue === 0) return;
    const target = ensure(row.symbol);
    const price = getUnderlyingPrice(row);
    if (!price) {
      target.hasIncompleteData = true;
      return;
    }
    target.underlyingPrice = price;
    target.deltaShares += row.quantity;
    target.stockExposure += row.quantity * price;
  });

  return Array.from(bySymbol.values())
    .map((row) => {
      const deltaDollarExposure = row.stockExposure + row.optionExposure;
      return {
        ...row,
        deltaDollarExposure,
        portfolioPct: totalValue > 0 ? (deltaDollarExposure / totalValue) * 100 : 0,
      };
    })
    // Calculate using each instrument's own price before merging dollar exposures.
    .reduce<DeltaExposureRow[]>((groups, row) => {
      const symbol = EXPOSURE_GROUPS[row.symbol.toUpperCase()] ?? row.symbol;
      const existing = groups.find((group) => group.symbol === symbol);
      if (!existing) {
        groups.push({ ...row, symbol });
      } else {
        existing.stockExposure += row.stockExposure;
        existing.optionExposure += row.optionExposure;
        existing.deltaDollarExposure += row.deltaDollarExposure;
        existing.portfolioPct = totalValue > 0 ? existing.deltaDollarExposure / totalValue * 100 : 0;
        existing.hasIncompleteData ||= row.hasIncompleteData;
        existing.hasEstimatedExposure ||= row.hasEstimatedExposure;
        // Different funds have no common share unit or single underlying price.
        existing.deltaShares = 0;
        existing.underlyingPrice = null;
      }
      return groups;
    }, [])
    .filter((row) => row.deltaDollarExposure !== 0 || row.hasIncompleteData)
    .sort((a, b) => Math.abs(b.deltaDollarExposure) - Math.abs(a.deltaDollarExposure));
}

export const ALLOCATION_CONFIG = {
  stocksMinPct: 65,
  stocksMaxPct: 70,
  cashMinPct: 10,
  cashMaxPct: 15,
  bullishPct: 20,
  sellPutMultiplier: 1.3,
};

export function calculateBullishAllocation(
  holdings: ClassifiedHolding[], totalValue: number, cashValue: number
): BullishAllocation {
  const legs = holdings.map((h, i) => parseOptionLeg(h, i))
    .filter((leg): leg is ParsedOptionLeg => Boolean(leg));
  const remaining = new Map(legs.map((leg) => [leg.id, leg.absQty]));
  const bySymbol = new Map<string, { symbol: string; value: number; contracts: number }>();
  const add = (leg: ParsedOptionLeg, qty: number, value: number) => {
    const entry = bySymbol.get(leg.underlying) ?? { symbol: leg.underlying, value: 0, contracts: 0 };
    entry.value += value;
    entry.contracts += qty;
    bySymbol.set(leg.underlying, entry);
  };

  // Synthetic longs take priority over vertical spreads, with partial quantities consumed.
  for (const call of legs.filter((l) => l.right === "CALL" && l.qty > 0)) {
    for (const put of legs.filter((l) => l.right === "PUT" && l.qty < 0)) {
      if (call.underlying !== put.underlying || call.expiryKey !== put.expiryKey ||
          call.strike !== put.strike || call.multiplier !== put.multiplier) continue;
      const qty = Math.min(remaining.get(call.id) ?? 0, remaining.get(put.id) ?? 0);
      consume(remaining, call, qty);
      consume(remaining, put, qty);
    }
  }

  const longs = legs.filter((l) => l.right === "CALL" && l.qty > 0).sort((a, b) => a.strike - b.strike);
  const shorts = legs.filter((l) => l.right === "CALL" && l.qty < 0).sort((a, b) => a.strike - b.strike);
  for (const long of longs) {
    for (const short of shorts) {
      if (long.underlying !== short.underlying || long.expiryKey !== short.expiryKey ||
          long.multiplier !== short.multiplier || long.strike >= short.strike) continue;
      const qty = Math.min(remaining.get(long.id) ?? 0, remaining.get(short.id) ?? 0);
      if (qty <= 0) continue;
      add(long, qty, Math.abs(proportionalValue(long, qty)) - Math.abs(proportionalValue(short, qty)));
      consume(remaining, long, qty);
      consume(remaining, short, qty);
    }
  }
  // Recognized bearish call verticals are not bullish holdings.
  for (const long of longs) {
    for (const short of shorts) {
      if (long.underlying !== short.underlying || long.expiryKey !== short.expiryKey ||
          long.multiplier !== short.multiplier || long.strike <= short.strike) continue;
      const qty = Math.min(remaining.get(long.id) ?? 0, remaining.get(short.id) ?? 0);
      consume(remaining, long, qty);
      consume(remaining, short, qty);
    }
  }
  for (const long of longs) {
    const qty = remaining.get(long.id) ?? 0;
    if (qty > 0) add(long, qty, Math.abs(proportionalValue(long, qty)));
  }
  const ranked = Array.from(bySymbol.values()).sort((a, b) => b.value - a.value);
  const callValue = ranked.reduce((sum, row) => sum + row.value, 0);
  const assignment = legs.filter((l) => l.right === "PUT" && l.qty < 0)
    .reduce((sum, leg) => sum + leg.strike * leg.multiplier * leg.absQty, 0);
  const callMax = totalValue * ALLOCATION_CONFIG.bullishPct / 100;
  const putMax = cashValue * ALLOCATION_CONFIG.sellPutMultiplier;
  return {
    holdings: ranked,
    sellPut: buildBudgetBar("sell-put", "Sell Put 抵押", assignment, cashValue, putMax, 0,
      `${formatDollar(cashValue)} × 130% = ${formatDollar(putMax)}`),
    calls: buildBudgetBar("leaps-call", "LEAPS Call / 看涨期权", callValue, callMax, callMax,
      ALLOCATION_CONFIG.bullishPct / 100, `${formatDollar(callMax)}【20%】`, "净市值"),
  };
}
