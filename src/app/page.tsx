"use client";

import { useState, useCallback } from "react";
import UploadZone from "../components/UploadZone";
import PortfolioOverview from "../components/PortfolioOverview";
import BucketCard from "../components/BucketCard";
import { classifyHoldings } from "../lib/classifyHoldings";
import { calculateTargets } from "../lib/calculateTargets";
import type {
  FidelityRow,
  PortfolioSnapshot,
  PortfolioComparison,
  BucketData,
  BucketItem,
} from "../lib/types";

/** Sum all current values (incl. Pending activity for accurate total) */
function calcTotal(rows: FidelityRow[]): number {
  return rows.reduce((sum, r) => sum + r.currentValue, 0);
}

function buildSnapshot(
  rows: FidelityRow[],
  fileName: string,
  date: Date | null
): PortfolioSnapshot {
  const totalValue = calcTotal(rows);
  const classified = classifyHoldings(
    rows.filter((r) => r.symbol !== "Pending activity")
  );
  const targets = calculateTargets(38, true);

  const pct = (numerator: number, denom: number) =>
    denom > 0 ? (numerator / denom) * 100 : 0;

  // ===== Safe Side bucket =====
  const safeSideHoldings = classified.filter((h) => h.category === "safe-side");
  const safeSideValue = safeSideHoldings.reduce(
    (s, h) => s + h.currentValue,
    0
  );

  // Aggregate by symbol (same symbol may appear in multiple rows)
  const safeSideBySymbol = new Map<string, number>();
  for (const h of safeSideHoldings) {
    safeSideBySymbol.set(
      h.symbol,
      (safeSideBySymbol.get(h.symbol) ?? 0) + h.currentValue
    );
  }
  const ETF_TICKERS = new Set([
    "QQQM",
    "QQQ",
    "QLD",
    "VGT",
    "VOO",
    "SPY",
    "FXAIX",
  ]);
  const safeSideItems: BucketItem[] = Array.from(safeSideBySymbol.entries())
    .map(([symbol, value]) => ({
      label: symbol,
      value,
      currentPctOfBucket: pct(value, safeSideValue),
      // Target: ETFs (QQQM/VOO etc) get 30% target, individual stocks get 10% cap
      targetPctOfBucket: ETF_TICKERS.has(symbol) ? 30 : 10,
    }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 5);

  // ===== Cash bucket =====
  const cashHoldings = classified.filter((h) => h.category === "cash");
  const cashValue = cashHoldings.reduce((s, h) => s + h.currentValue, 0);

  // ===== Options bucket (wheel + leaps combined) =====
  const optionsHoldings = classified.filter(
    (h) => h.category === "wheel" || h.category === "leaps"
  );
  // Use absolute values for bucket size (short options have negative values)
  const optionsValue = optionsHoldings.reduce(
    (s, h) => s + Math.abs(h.currentValue),
    0
  );

  let sellPutValue = 0;
  let sellCallValue = 0;
  let leapsValue = 0;
  for (const h of optionsHoldings) {
    if (h.category === "leaps") {
      leapsValue += Math.abs(h.currentValue);
    } else if (/\bPUT\b/i.test(h.description) && h.quantity < 0) {
      sellPutValue += Math.abs(h.currentValue);
    } else if (/\bCALL\b/i.test(h.description) && h.quantity < 0) {
      sellCallValue += Math.abs(h.currentValue);
    }
  }
  const optionsItems: BucketItem[] = [
    {
      label: "Sell Put",
      value: sellPutValue,
      currentPctOfBucket: pct(sellPutValue, optionsValue),
      targetPctOfBucket: 40, // half of Wheel (80% of options)
    },
    {
      label: "Sell Call",
      value: sellCallValue,
      currentPctOfBucket: pct(sellCallValue, optionsValue),
      targetPctOfBucket: 40,
    },
    {
      label: "LEAPS Call",
      value: leapsValue,
      currentPctOfBucket: pct(leapsValue, optionsValue),
      targetPctOfBucket: 20,
    },
    {
      label: "现金",
      value: 0,
      currentPctOfBucket: 0,
      targetPctOfBucket: 0,
    },
  ];

  const buckets: BucketData[] = [
    {
      key: "safe-side",
      label: "定投仓 DCA",
      totalValue: safeSideValue,
      currentPctOfTotal: pct(safeSideValue, totalValue),
      targetPctOfTotal: targets.safeSide,
      items: safeSideItems,
    },
    {
      key: "cash",
      label: "现金仓 Cash",
      totalValue: cashValue,
      currentPctOfTotal: pct(cashValue, totalValue),
      targetPctOfTotal: targets.cash,
      items: [],
    },
    {
      key: "options",
      label: "期权仓 Options",
      totalValue: optionsValue,
      currentPctOfTotal: pct(optionsValue, totalValue),
      targetPctOfTotal: targets.wheel + targets.leaps,
      items: optionsItems,
    },
  ];

  return { totalValue, buckets, date, fileName };
}

export default function Home() {
  const [current, setCurrent] = useState<PortfolioSnapshot | null>(null);
  const [comparison, setComparison] = useState<PortfolioComparison | null>(
    null
  );

  const handleFilesReady = useCallback(
    (files: { name: string; date: Date | null; rows: FidelityRow[] }[]) => {
      if (files.length === 0) {
        setCurrent(null);
        setComparison(null);
        return;
      }
      if (files.length === 1) {
        setCurrent(buildSnapshot(files[0].rows, files[0].name, files[0].date));
        setComparison(null);
      } else {
        const prev = buildSnapshot(files[0].rows, files[0].name, files[0].date);
        const curr = buildSnapshot(files[1].rows, files[1].name, files[1].date);
        setCurrent(curr);
        setComparison({
          current: curr,
          previous: prev,
          valueDelta: curr.totalValue - prev.totalValue,
          valueDeltaPercent:
            prev.totalValue > 0
              ? ((curr.totalValue - prev.totalValue) / prev.totalValue) * 100
              : 0,
        });
      }
    },
    []
  );

  return (
    <main className="max-w-6xl mx-auto px-6 py-10">
      <h1 className="text-3xl font-bold text-cyan-400 mb-1">天哥投资仪表盘</h1>
      <p className="text-gray-500 mb-8">百万之路 — Portfolio Dashboard</p>

      <UploadZone onFilesReady={handleFilesReady} />

      {!current && (
        <div className="text-center text-gray-600 py-20">
          上传 Fidelity CSV 文件开始
        </div>
      )}

      {current && (
        <div className="animate-fade-in">
          <PortfolioOverview snapshot={current} comparison={comparison} />
        </div>
      )}

      {current && (
        <div
          className="animate-fade-in space-y-6"
          style={{ animationDelay: "0.2s", opacity: 0 }}
        >
          {current.buckets.map((bucket) => (
            <BucketCard key={bucket.key} bucket={bucket} />
          ))}
        </div>
      )}
    </main>
  );
}
