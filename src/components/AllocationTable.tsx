"use client";

import type {
  CategorySummary,
  TargetAllocation,
  SafeSideBreakdown,
  PortfolioComparison,
} from "../lib/types";

interface AllocationTableProps {
  categories: CategorySummary[];
  safeSideBreakdown: SafeSideBreakdown;
  targets: TargetAllocation;
  totalValue: number;
  comparison: PortfolioComparison | null;
}

function formatDollar(value: number): string {
  return "$" + value.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function getDeviation(current: number, target: number): number {
  return current - target;
}

function deviationColor(deviation: number): string {
  if (Math.abs(deviation) <= 3) return "text-gray-300";
  if (deviation > 0) return "text-red-400";   // overweight
  return "text-yellow-400";                     // underweight
}

interface RowData {
  label: string;
  value: number;
  currentPct: number;
  targetPct: number;
  indent?: boolean;
}

export default function AllocationTable({
  categories,
  safeSideBreakdown,
  targets,
  totalValue,
  comparison,
}: AllocationTableProps) {
  const getCategoryValue = (cat: string): number => {
    return categories.find((c) => c.category === cat)?.totalValue ?? 0;
  };

  const getCategoryPct = (cat: string): number => {
    return categories.find((c) => c.category === cat)?.percentOfPortfolio ?? 0;
  };

  const rows: RowData[] = [
    {
      label: "安全端 Safe Side",
      value: getCategoryValue("safe-side"),
      currentPct: getCategoryPct("safe-side"),
      targetPct: targets.safeSide,
    },
    {
      label: "└ QQQM",
      value: safeSideBreakdown.qqqm,
      currentPct: totalValue > 0 ? (safeSideBreakdown.qqqm / totalValue) * 100 : 0,
      targetPct: targets.safeSideInner.qqqm,
      indent: true,
    },
    {
      label: "└ VOO",
      value: safeSideBreakdown.voo,
      currentPct: totalValue > 0 ? (safeSideBreakdown.voo / totalValue) * 100 : 0,
      targetPct: targets.safeSideInner.voo,
      indent: true,
    },
    {
      label: "└ 个股",
      value: safeSideBreakdown.stocks,
      currentPct: totalValue > 0 ? (safeSideBreakdown.stocks / totalValue) * 100 : 0,
      targetPct: targets.safeSideInner.stocks,
      indent: true,
    },
    {
      label: "现金 Cash",
      value: getCategoryValue("cash"),
      currentPct: getCategoryPct("cash"),
      targetPct: targets.cash,
    },
    {
      label: "轮转策略 Wheel",
      value: getCategoryValue("wheel"),
      currentPct: getCategoryPct("wheel"),
      targetPct: targets.wheel,
    },
    {
      label: "远期期权 LEAPS",
      value: getCategoryValue("leaps"),
      currentPct: getCategoryPct("leaps"),
      targetPct: targets.leaps,
    },
  ];

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-gray-500 text-left border-b border-gray-700">
            <th className="pb-3 font-medium">类别</th>
            <th className="pb-3 font-medium text-right">当前金额</th>
            <th className="pb-3 font-medium text-right">当前占比</th>
            <th className="pb-3 font-medium text-right">目标占比</th>
            <th className="pb-3 font-medium text-right">偏差</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => {
            const deviation = getDeviation(row.currentPct, row.targetPct);
            return (
              <tr
                key={i}
                className={`border-b border-gray-800 ${
                  row.indent ? "text-gray-400" : "text-gray-200"
                }`}
              >
                <td className={`py-3 ${row.indent ? "pl-4" : "font-medium"}`}>
                  {row.label}
                </td>
                <td className="py-3 text-right font-mono">
                  {formatDollar(row.value)}
                </td>
                <td className="py-3 text-right font-mono">
                  {row.currentPct.toFixed(1)}%
                </td>
                <td className="py-3 text-right font-mono text-gray-500">
                  {row.targetPct.toFixed(1)}%
                </td>
                <td
                  className={`py-3 text-right font-mono ${
                    row.indent ? "text-gray-500" : deviationColor(deviation)
                  }`}
                >
                  {!row.indent && (
                    <>
                      {deviation >= 0 ? "+" : ""}
                      {deviation.toFixed(1)}%
                    </>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
