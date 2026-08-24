"use client";

import type { BucketData } from "../lib/types";

function formatDollar(v: number): string {
  return "$" + Math.round(v).toLocaleString("en-US");
}

/** Bar color per option category (fixed hues, purely descriptive). */
const LEG_COLORS: Record<string, string> = {
  "LEAPS Call": "bg-blue-500",
  "Sell Put": "bg-emerald-500",
  "Sell Call": "bg-amber-500",
  "Synthetic Long": "bg-cyan-500",
  "Call Spread": "bg-indigo-500",
  "Put Spread": "bg-purple-500",
  Other: "bg-gray-500",
};
const LEG_LABELS: Record<string, string> = {
  "LEAPS Call": "LEAPS Call 长期看涨",
  "Sell Put": "Sell Put 卖出看跌",
  "Sell Call": "Sell Call 卖出看涨",
  "Synthetic Long": "合成多头 Synthetic Long",
  "Call Spread": "看涨价差 Call Spread",
  "Put Spread": "看跌价差 Put Spread",
  Other: "其他 Other",
};

interface OptionsCashCardProps {
  cash: BucketData;
  options: BucketData;
}

/** Block 2 — 期权仓 + 现金: cash ratio on top, options grouped by combo below. */
export default function OptionsCashCard({ cash, options }: OptionsCashCardProps) {
  const cashUnder = cash.currentPctOfTotal < cash.targetPctOfTotal - 1;
  const cashColor = cashUnder ? "text-blue-400" : "text-green-400";

  const items = options.items;
  const maxBarPct = Math.max(1, ...items.map((l) => l.currentPctOfBucket));

  return (
    <div className="bg-[#1a1f2e] rounded-xl p-5 flex flex-col">
      <h2 className="text-sm font-medium text-gray-400 uppercase tracking-wider mb-4">
        期权仓 + 现金 Options &amp; Cash
      </h2>

      {/* ===== 现金仓 ===== */}
      <div className="rounded-lg bg-[#141926] p-4 mb-4">
        <div className="flex items-baseline justify-between">
          <span className="text-sm font-medium text-gray-300">
            现金仓 Cash <span className="text-gray-600">（含 pending）</span>
          </span>
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
          {items.map((item, idx) => {
            const widthPct = Math.min(
              (item.currentPctOfBucket / maxBarPct) * 100,
              100
            );
            const legs = item.legs ?? [];
            return (
              <div key={idx}>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-medium text-gray-300 truncate">
                    {LEG_LABELS[item.label] ?? item.label}
                  </span>
                  <span className="ml-auto text-xs font-mono text-gray-400 whitespace-nowrap">
                    {item.currentPctOfBucket.toFixed(1)}%
                  </span>
                  <span className="text-xs font-mono text-gray-300 whitespace-nowrap w-20 text-right">
                    {formatDollar(item.value)}
                  </span>
                </div>
                <div className="h-2.5 bg-gray-800 rounded-full overflow-hidden">
                  <div
                    className={`h-full ${
                      LEG_COLORS[item.label] ?? "bg-gray-500"
                    } rounded-full transition-all duration-700 ease-out`}
                    style={{ width: `${widthPct}%` }}
                  />
                </div>

                {/* Per-leg detail for single-leg categories */}
                {legs.length > 0 && (
                  <div className="mt-2 ml-1 space-y-1.5 border-l border-gray-800 pl-3">
                    {legs.map((leg, li) => (
                      <div key={li} className="text-xs">
                        <div className="flex items-baseline gap-2">
                          <span className="font-semibold text-gray-200">
                            {leg.underlying} ${leg.strike}{" "}
                            {leg.right === "C" ? "Call" : "Put"}
                          </span>
                          <span className="text-gray-500">×{leg.contracts}</span>
                          <span className="ml-auto font-mono text-gray-300">
                            {formatDollar(leg.value)}
                          </span>
                        </div>
                        <div className="flex items-baseline gap-2 text-gray-500">
                          <span>{leg.expiry}</span>
                          <span
                            className={
                              leg.daysToExpiry <= 30
                                ? "text-amber-400"
                                : "text-gray-500"
                            }
                          >
                            剩 {leg.daysToExpiry} 天
                          </span>
                          <span className="ml-auto">
                            成本 {formatDollar(leg.cost)}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
