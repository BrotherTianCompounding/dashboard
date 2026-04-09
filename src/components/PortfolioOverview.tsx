"use client";

import type { PortfolioSnapshot, PortfolioComparison } from "../lib/types";

interface PortfolioOverviewProps {
  snapshot: PortfolioSnapshot;
  comparison: PortfolioComparison | null;
}

const INITIAL_CAPITAL = 400_000;
const TARGET_CAPITAL = 1_000_000;

function formatDollar(value: number): string {
  return value.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export default function PortfolioOverview({
  snapshot,
  comparison,
}: PortfolioOverviewProps) {
  const progressPercent = Math.min(
    ((snapshot.totalValue - INITIAL_CAPITAL) / (TARGET_CAPITAL - INITIAL_CAPITAL)) * 100,
    100
  );
  const remaining = TARGET_CAPITAL - snapshot.totalValue;

  return (
    <div className="bg-[#1a1f2e] rounded-xl p-6 mb-6">
      <h2 className="text-sm font-medium text-gray-400 uppercase tracking-wider mb-4">
        账户总览 Portfolio Overview
      </h2>

      {/* Net Value */}
      <div className="mb-6">
        <p className="text-5xl font-bold tracking-tight text-white">
          ${formatDollar(snapshot.totalValue)}
        </p>

        {comparison && (
          <div className="flex items-center gap-3 mt-2">
            <span
              className={`text-2xl font-semibold ${
                comparison.valueDelta >= 0 ? "text-green-400" : "text-red-400"
              }`}
            >
              {comparison.valueDelta >= 0 ? "+" : ""}
              ${formatDollar(comparison.valueDelta)}
            </span>
            <span
              className={`text-lg ${
                comparison.valueDeltaPercent >= 0
                  ? "text-green-400"
                  : "text-red-400"
              }`}
            >
              ({comparison.valueDeltaPercent >= 0 ? "+" : ""}
              {comparison.valueDeltaPercent.toFixed(1)}%)
            </span>
          </div>
        )}

        {comparison && (
          <p className="text-sm text-gray-500 mt-1">
            上周净值：${formatDollar(comparison.previous.totalValue)}
          </p>
        )}
      </div>

      {/* Progress Bar: $400K → $1M */}
      <div>
        <div className="flex justify-between text-sm text-gray-400 mb-2">
          <span>$400K 起点</span>
          <span className="text-cyan-400 font-medium">
            {progressPercent.toFixed(1)}% 完成
          </span>
          <span>$1M 目标</span>
        </div>
        <div className="w-full h-4 bg-gray-800 rounded-full overflow-hidden">
          <div
            className="h-full rounded-full bg-gradient-to-r from-cyan-500 to-blue-500 transition-all duration-1000 ease-out"
            style={{ width: `${Math.max(progressPercent, 0)}%` }}
          />
        </div>
        <p className="text-sm text-gray-500 mt-2">
          距离目标还差 ${formatDollar(Math.max(remaining, 0))}
        </p>
      </div>
    </div>
  );
}
