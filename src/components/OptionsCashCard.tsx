"use client";

import type { BucketData } from "../lib/types";

function formatDollar(v: number): string {
  return "$" + Math.round(v).toLocaleString("en-US");
}

/** Bar color per option leg (fixed hues, purely descriptive — no target). */
const LEG_COLORS: Record<string, string> = {
  "Sell Put": "bg-emerald-500",
  "Sell Call": "bg-amber-500",
  "Buy Call": "bg-blue-500",
  "Buy Put": "bg-purple-500",
};
const LEG_LABELS: Record<string, string> = {
  "Sell Put": "Sell Put 卖出看跌",
  "Sell Call": "Sell Call 卖出看涨",
  "Buy Call": "Buy Call 买入看涨",
  "Buy Put": "Buy Put 买入看跌",
};

interface OptionsCashCardProps {
  cash: BucketData;
  options: BucketData;
}

/** Block 2 — 期权仓 + 现金: cash ratio on top, options total + 4-leg split below. */
export default function OptionsCashCard({ cash, options }: OptionsCashCardProps) {
  const cashUnder = cash.currentPctOfTotal < cash.targetPctOfTotal - 1;
  const cashColor = cashUnder ? "text-blue-400" : "text-green-400";

  const legs = options.items;
  const maxBarPct = Math.max(1, ...legs.map((l) => l.currentPctOfBucket));

  return (
    <div className="bg-[#1a1f2e] rounded-xl p-5 flex flex-col">
      <h2 className="text-sm font-medium text-gray-400 uppercase tracking-wider mb-4">
        期权仓 + 现金 Options &amp; Cash
      </h2>

      {/* ===== 现金仓 ===== */}
      <div className="rounded-lg bg-[#141926] p-4 mb-4">
        <div className="flex items-baseline justify-between">
          <span className="text-sm font-medium text-gray-300">现金仓 Cash</span>
          <span className="text-lg font-mono text-gray-200">
            {formatDollar(cash.totalValue)}
          </span>
        </div>
        <div className="flex items-baseline gap-2 mt-1">
          <span className={`text-4xl font-black tracking-tight ${cashColor}`}>
            {cash.currentPctOfTotal.toFixed(1)}
            <span className="text-xl">%</span>
          </span>
          <span className="text-xs text-gray-500">
            占整个账户 · 目标 {cash.targetPctOfTotal.toFixed(1)}%
          </span>
        </div>
      </div>

      {/* ===== 期权仓 ===== */}
      <div className="rounded-lg bg-[#141926] p-4">
        <div className="flex items-baseline justify-between mb-1">
          <span className="text-sm font-medium text-gray-300">
            期权仓 Options
          </span>
          <span className="text-2xl font-mono text-gray-100">
            {formatDollar(options.totalValue)}
          </span>
        </div>
        <p className="text-xs text-gray-500 mb-4">
          占整个账户 {options.currentPctOfTotal.toFixed(1)}% · 目标{" "}
          {options.targetPctOfTotal.toFixed(1)}% ·{" "}
          <span className="text-gray-600">金额 = 持仓当前市值绝对值</span>
        </p>

        <div className="space-y-3">
          {legs.map((leg, idx) => {
            const widthPct = Math.min(
              (leg.currentPctOfBucket / maxBarPct) * 100,
              100
            );
            return (
              <div key={idx}>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-medium text-gray-300 truncate">
                    {LEG_LABELS[leg.label] ?? leg.label}
                  </span>
                  <span className="ml-auto text-xs font-mono text-gray-400 whitespace-nowrap">
                    {leg.currentPctOfBucket.toFixed(1)}%
                  </span>
                  <span className="text-xs font-mono text-gray-300 whitespace-nowrap w-20 text-right">
                    {formatDollar(leg.value)}
                  </span>
                </div>
                <div className="h-2.5 bg-gray-800 rounded-full overflow-hidden">
                  <div
                    className={`h-full ${
                      LEG_COLORS[leg.label] ?? "bg-gray-500"
                    } rounded-full transition-all duration-700 ease-out`}
                    style={{ width: `${widthPct}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
