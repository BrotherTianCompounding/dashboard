"use client";

import type {
  CategorySummary,
  TargetAllocation,
  SafeSideBreakdown,
  PortfolioComparison,
  TopStock,
} from "../lib/types";

interface AllocationTableProps {
  categories: CategorySummary[];
  safeSideBreakdown: SafeSideBreakdown;
  targets: TargetAllocation;
  totalValue: number;
  comparison: PortfolioComparison | null;
  topStocks: TopStock[];
}

function formatDollar(value: number): string {
  return "$" + value.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
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
  indent?: number; // 0 = top level, 1 = sub, 2 = sub-sub
  showDeviation?: boolean;
}

export default function AllocationTable({
  categories,
  safeSideBreakdown,
  targets,
  totalValue,
  comparison,
  topStocks,
}: AllocationTableProps) {
  const getCategoryValue = (cat: string): number => {
    return categories.find((c) => c.category === cat)?.totalValue ?? 0;
  };

  const getCategoryPct = (cat: string): number => {
    return categories.find((c) => c.category === cat)?.percentOfPortfolio ?? 0;
  };

  const pct = (val: number) => totalValue > 0 ? (val / totalValue) * 100 : 0;

  // Single stock target = 10% of safe-side target (as % of total portfolio)
  const singleStockTargetPct = targets.safeSide * 0.10;

  const rows: RowData[] = [
    {
      label: "定投仓 DCA",
      value: getCategoryValue("safe-side"),
      currentPct: getCategoryPct("safe-side"),
      targetPct: targets.safeSide,
      indent: 0,
      showDeviation: true,
    },
    {
      label: "└ QQQM",
      value: safeSideBreakdown.qqqm,
      currentPct: pct(safeSideBreakdown.qqqm),
      targetPct: targets.safeSideInner.qqqm,
      indent: 1,
      showDeviation: true,
    },
    {
      label: "└ VOO",
      value: safeSideBreakdown.voo,
      currentPct: pct(safeSideBreakdown.voo),
      targetPct: targets.safeSideInner.voo,
      indent: 1,
      showDeviation: true,
    },
    {
      label: "└ 个股",
      value: safeSideBreakdown.stocks,
      currentPct: pct(safeSideBreakdown.stocks),
      targetPct: targets.safeSideInner.stocks,
      indent: 1,
      showDeviation: true,
    },
    // Top 4 individual stocks
    ...topStocks.map((stock) => ({
      label: `    └ ${stock.symbol}`,
      value: stock.currentValue,
      currentPct: pct(stock.currentValue),
      targetPct: singleStockTargetPct,
      indent: 2 as number,
      showDeviation: true,
    })),
    {
      label: "现金 Cash",
      value: getCategoryValue("cash"),
      currentPct: getCategoryPct("cash"),
      targetPct: targets.cash,
      indent: 0,
      showDeviation: true,
    },
    {
      label: "轮转策略 Wheel",
      value: getCategoryValue("wheel"),
      currentPct: getCategoryPct("wheel"),
      targetPct: targets.wheel,
      indent: 0,
      showDeviation: true,
    },
    {
      label: "远期期权 LEAPS",
      value: getCategoryValue("leaps"),
      currentPct: getCategoryPct("leaps"),
      targetPct: targets.leaps,
      indent: 0,
      showDeviation: true,
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
            const deviation = row.currentPct - row.targetPct;
            const isTopLevel = row.indent === 0;
            const isSub = row.indent === 1;
            const isSubSub = row.indent === 2;

            return (
              <tr
                key={i}
                className={`border-b border-gray-800 ${
                  isTopLevel ? "text-gray-200" : "text-gray-400"
                }`}
              >
                <td
                  className={`py-3 ${
                    isTopLevel
                      ? "font-medium"
                      : isSub
                      ? "pl-4"
                      : "pl-8 text-gray-500"
                  }`}
                >
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
                  className={`py-3 text-right font-mono ${deviationColor(deviation)}`}
                >
                  {row.showDeviation && (
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
