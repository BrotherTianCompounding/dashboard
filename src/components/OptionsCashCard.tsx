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

/** Block 2 — 期权仓 + 现金: cash ratio on top, option budget bars below. */
export default function OptionsCashCard({ cash, options }: OptionsCashCardProps) {
  const cashUnder = cash.currentPctOfTotal < cash.targetPctOfTotal - 1;
  const cashColor = cashUnder ? "text-blue-400" : "text-green-400";
  const optionRisk = options.optionRisk;

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

      {/* ===== 期权预算 ===== */}
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
          期权允许金额 {formatDollar(optionRisk?.budgetBase ?? 0)} · 目标{" "}
          {options.targetPctOfTotal.toFixed(1)}%
          <br />
          <span className="text-gray-600">
            三个进度条使用同一预算基数，口径不同，不相加为 100%
          </span>
        </p>

        <div className="space-y-3">
          {optionRisk ? (
            optionRisk.bars.map((bar) => <BudgetBar key={bar.key} bar={bar} />)
          ) : (
            <div className="rounded-lg bg-[#101521] p-3 text-xs text-red-300">
              期权预算数据缺失，无法展示进度条
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
