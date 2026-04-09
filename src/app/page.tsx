"use client";

import { useState, useCallback } from "react";
import UploadZone from "../components/UploadZone";
import PortfolioOverview from "../components/PortfolioOverview";
import { classifyHoldings } from "../lib/classifyHoldings";
import { calculateTargets } from "../lib/calculateTargets";
import type {
  FidelityRow,
  PortfolioSnapshot,
  PortfolioComparison,
  CategorySummary,
  SafeSideBreakdown,
} from "../lib/types";

function buildSnapshot(
  rows: FidelityRow[],
  fileName: string,
  date: Date | null
): PortfolioSnapshot {
  const classified = classifyHoldings(rows);

  const totalValue = classified.reduce(
    (sum, h) => sum + Math.abs(h.currentValue),
    0
  );

  const categoryMap = new Map<string, CategorySummary>();
  for (const h of classified) {
    const existing = categoryMap.get(h.category);
    if (existing) {
      existing.totalValue += Math.abs(h.currentValue);
      existing.holdings.push(h);
    } else {
      categoryMap.set(h.category, {
        category: h.category,
        totalValue: Math.abs(h.currentValue),
        percentOfPortfolio: 0,
        holdings: [h],
      });
    }
  }

  const categories = Array.from(categoryMap.values()).map((cat) => ({
    ...cat,
    percentOfPortfolio: totalValue > 0 ? (cat.totalValue / totalValue) * 100 : 0,
  }));

  const safeSideHoldings = classified.filter((h) => h.category === "safe-side");
  const safeSideBreakdown: SafeSideBreakdown = {
    qqqm: safeSideHoldings
      .filter((h) => h.safeSideSubCategory === "qqqm")
      .reduce((sum, h) => sum + h.currentValue, 0),
    voo: safeSideHoldings
      .filter((h) => h.safeSideSubCategory === "voo")
      .reduce((sum, h) => sum + h.currentValue, 0),
    stocks: safeSideHoldings
      .filter((h) => h.safeSideSubCategory === "stocks")
      .reduce((sum, h) => sum + h.currentValue, 0),
  };

  return { totalValue, categories, safeSideBreakdown, date, fileName };
}

export default function Home() {
  const [current, setCurrent] = useState<PortfolioSnapshot | null>(null);
  const [comparison, setComparison] = useState<PortfolioComparison | null>(null);
  const targets = calculateTargets(38, true);

  const handleFilesReady = useCallback(
    (
      files: { name: string; date: Date | null; rows: FidelityRow[] }[]
    ) => {
      if (files.length === 0) {
        setCurrent(null);
        setComparison(null);
        return;
      }

      if (files.length === 1) {
        const snapshot = buildSnapshot(files[0].rows, files[0].name, files[0].date);
        setCurrent(snapshot);
        setComparison(null);
      } else {
        // files[0] = older (previous), files[1] = newer (current)
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
      <h1 className="text-3xl font-bold text-cyan-400 mb-1">
        天哥投资仪表盘
      </h1>
      <p className="text-gray-500 mb-8">百万之路 — Portfolio Dashboard</p>

      <UploadZone onFilesReady={handleFilesReady} />

      {!current && (
        <div className="text-center text-gray-600 py-20">
          上传 Fidelity CSV 文件开始
        </div>
      )}

      {current && (
        <PortfolioOverview snapshot={current} comparison={comparison} />
      )}
    </main>
  );
}
