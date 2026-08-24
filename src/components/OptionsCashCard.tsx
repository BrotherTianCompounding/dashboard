"use client";

import type { BucketData } from "../lib/types";

function formatDollar(v: number): string {
  return "$" + Math.round(v).toLocaleString("en-US");
}

/** Accent color per shown option category. */
const LEG_COLORS: Record<string, string> = {
  "LEAPS Call": "text-blue-400",
  "Sell Put": "text-emerald-400",
  "Sell Call": "text-amber-400",
};
const LEG_LABELS: Record<string, string> = {
  "LEAPS Call": "LEAPS Call 长期看涨",
  "Sell Put": "Sell Put 卖出看跌",
  "Sell Call": "Sell Call 卖出看涨",
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
          {options.targetPctOfTotal.toFixed(1)}%
          <br />
          <span className="text-gray-600">
            合成多头 / 看涨价差 / 看跌价差已计入总额，不单独列出
          </span>
        </p>

        <div className="space-y-3">
          {items.map((item, idx) => {
            const tickers = item.tickers ?? [];
            return (
              <div key={idx}>
                <div className="flex items-baseline gap-2">
                  <span
                    className={`text-xs font-semibold ${
                      LEG_COLORS[item.label] ?? "text-gray-300"
                    }`}
                  >
                    {LEG_LABELS[item.label] ?? item.label}
                  </span>
                  <span className="text-xs text-gray-500">
                    共 {item.contracts ?? 0} 张
                  </span>
                  <span className="ml-auto text-xs font-mono text-gray-400 whitespace-nowrap">
                    {formatDollar(item.value)}
                  </span>
                </div>
                <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-gray-300">
                  {tickers.map((t, ti) => (
                    <span key={ti} className="whitespace-nowrap">
                      {t.underlying}{" "}
                      <span className="font-semibold text-gray-100">
                        ×{t.contracts}
                      </span>
                    </span>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
