"use client";

import type { BucketData, BudgetUsageBar } from "../lib/types";

function formatDollar(v: number): string {
  const sign = v < 0 ? "−" : "";
  return `${sign}$${Math.round(Math.abs(v)).toLocaleString("en-US")}`;
}

function formatPct(v: number | null): string {
  return v === null ? "--" : `${v.toFixed(1)}%`;
}

const BAR_COLORS: Record<BudgetUsageBar["key"], string> = {
  "sell-put": "bg-emerald-500",
  "leaps-call": "bg-blue-500",
  tactical: "bg-cyan-500",
};

interface OptionsCashCardProps {
  cash: BucketData;
  options: BucketData;
}

function BudgetBar({ bar }: { bar: BudgetUsageBar }) {
  const fillColor = bar.isOver ? "bg-red-500" : BAR_COLORS[bar.key];
  const currentText = bar.status === "invalid-budget"
    ? "预算基数异常"
    : bar.overAmount > 0
      ? `当前：${formatDollar(bar.currentValue)}（+${formatDollar(bar.overAmount)}，超额${formatPct(bar.overPercent)}）`
      : `当前：${formatDollar(bar.currentValue)}（${formatPct(bar.percentUsed)}）`;

  return (
    <div className="rounded-lg bg-[#101521] p-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-gray-100">{bar.label}</span>
            {bar.netValueNote && (
              <span className="rounded bg-gray-800 px-1.5 py-0.5 text-[10px] text-gray-400">
                {bar.netValueNote}
              </span>
            )}
          </div>
          <p className="mt-0.5 text-[11px] text-gray-500">额度 {bar.detail}</p>
        </div>
        <span className={`shrink-0 text-xs font-mono ${bar.isOver ? "text-red-300" : "text-gray-300"}`}>
          {formatPct(bar.percentUsed)}
        </span>
      </div>

      <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-gray-800">
        <div
          className={`h-full rounded-full ${fillColor} transition-all duration-700 ease-out`}
          style={{ width: `${bar.visualPercent}%` }}
        />
      </div>

      <p className={`mt-1.5 text-xs font-mono ${bar.overAmount > 0 ? "text-red-300" : "text-gray-400"}`}>
        {currentText}
      </p>
    </div>
  );
}


export default function OptionsCashCard({ options }: OptionsCashCardProps) {
  const allocation = options.bullishAllocation;
  if (!allocation) return <div className="p-5 text-red-300">仓位数据缺失</div>;
  const maxValue = Math.max(1, ...allocation.holdings.map((row) => Math.abs(row.value)));
  return (
    <div className="bg-[#1a1f2e] rounded-xl p-5 min-w-0">
      <h2 className="text-sm font-medium text-gray-400 mb-4">期权仓 Options</h2>
      <BudgetBar bar={allocation.sellPut} />
      <div className="mt-5 border-t border-gray-700 pt-5">
        <BudgetBar bar={allocation.calls} />
        <div className="mt-4 space-y-3">
          {allocation.holdings.length === 0 && <p className="text-sm text-gray-500">暂无看涨期权持仓</p>}
          {allocation.holdings.map((row, index) => (
            <div key={row.symbol}>
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <span className="text-gray-500 w-4">{index + 1}</span>
                <span className="font-semibold text-gray-100">{row.symbol}</span>
                <span className="text-gray-500">{row.contracts} 张</span>
                <span className="ml-auto font-mono text-cyan-300">{formatDollar(row.value)}</span>
              </div>
              <div className="mt-1 h-2 rounded-full bg-gray-800 overflow-hidden">
                <div className={row.value < 0 ? "h-full bg-red-500" : "h-full bg-blue-500"}
                  style={{ width: `${Math.min(Math.abs(row.value) / maxValue * 100, 100)}%` }} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
