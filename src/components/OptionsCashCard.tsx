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
  "buy-call": "bg-blue-500",
  "sell-call": "bg-amber-500",
  "buy-put": "bg-pink-500",
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
    <div className="py-4">
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
  const bars = options.optionLegBars;
  return (
    <div className="bg-[#1a1f2e] rounded-xl p-5 min-w-0">
      <h2 className="text-sm font-medium text-gray-400 mb-1">期权仓 Options · 目标 {options.targetPctOfTotal.toFixed(1)}%</h2>
      {bars ? <div className="divide-y divide-gray-700/60">
        {bars.map((bar) => <BudgetBar key={bar.key} bar={bar} />)}
      </div> : <p className="text-sm text-red-300">仓位数据缺失</p>}
    </div>
  );
}
