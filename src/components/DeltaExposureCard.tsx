"use client";

import type { PortfolioSnapshot } from "../lib/types";

function formatDollar(value: number): string {
  const sign = value < 0 ? "−" : "";
  return `${sign}$${Math.round(Math.abs(value)).toLocaleString("en-US")}`;
}

function formatDate(date: Date | null): string {
  if (!date) return "未知";
  return date.toLocaleDateString("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}

interface DeltaExposureCardProps {
  snapshot: PortfolioSnapshot;
}

export default function DeltaExposureCard({ snapshot }: DeltaExposureCardProps) {
  const rows = snapshot.deltaExposures;
  const hasEstimates = rows.some((row) => row.hasEstimatedExposure);
  const maxAbs = Math.max(1, ...rows.map((row) => Math.abs(row.deltaDollarExposure)));

  return (
    <section className="mt-4 bg-[#1a1f2e] rounded-xl p-5 animate-fade-in">
      <div className="flex flex-wrap items-end justify-between gap-3 mb-4">
        <div>
          <h2 className="text-sm font-medium text-gray-400 uppercase tracking-wider">
            全账户仓位 / Delta 敞口排名
          </h2>
          <p className="mt-1 text-xs text-gray-500">
            持仓报告日期：{formatDate(snapshot.date)}
          </p>
        </div>
        <p className="text-xs text-gray-500">
          分母：账户净资产 {formatDollar(snapshot.totalValue)}
        </p>
      </div>

      {hasEstimates && (
        <p className="mb-3 text-xs text-amber-300">
          估算口径：缺 Delta 的买入 Call 按当前市值；Sell Put 按行权价 × 合约乘数 × 合约数量计入（标准合约每张 100 股）。有 Delta 时按方向敞口计算。
        </p>
      )}

      {rows.length === 0 ? (
        <div className="rounded-lg bg-[#141926] p-4 text-sm text-gray-500">
          暂无可展示的 Delta 敞口数据
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] border-separate border-spacing-y-2 text-sm">
            <thead className="text-xs uppercase tracking-wider text-gray-500">
              <tr>
                <th className="w-12 text-left font-medium">排名</th>
                <th className="w-24 text-left font-medium">标的</th>
                <th className="text-left font-medium">方向敞口</th>
                <th className="w-32 text-right font-medium">仓位金额</th>
                <th className="w-24 text-right font-medium">比例</th>
                <th className="w-32 text-right font-medium">正股敞口</th>
                <th className="w-32 text-right font-medium">期权敞口</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, index) => {
                const isPositive = row.deltaDollarExposure >= 0;
                const width = Math.min((Math.abs(row.deltaDollarExposure) / maxAbs) * 100, 100);
                const barColor = isPositive ? "bg-emerald-500" : "bg-red-500";
                const textColor = isPositive ? "text-emerald-300" : "text-red-300";

                return (
                  <tr key={row.symbol} className="bg-[#141926]">
                    <td className="rounded-l-lg px-3 py-2 text-gray-500">{index + 1}</td>
                    <td className="px-3 py-2 font-semibold text-gray-100">
                      {row.symbol}
                    </td>
                    <td className="px-3 py-2">
                      <div className="h-2.5 overflow-hidden rounded-full bg-gray-800">
                        <div
                          className={`h-full rounded-full ${barColor}`}
                          style={{ width: `${width}%` }}
                        />
                      </div>
                    </td>
                    <td className={`px-3 py-2 text-right font-mono ${textColor}`}>
                      {formatDollar(row.deltaDollarExposure)}
                    </td>
                    <td className={`px-3 py-2 text-right font-mono ${textColor}`}>
                      {row.portfolioPct.toFixed(1)}%
                    </td>
                    <td className="px-3 py-2 text-right font-mono text-gray-300">
                      {formatDollar(row.stockExposure)}
                    </td>
                    <td className="rounded-r-lg px-3 py-2 text-right font-mono text-gray-300">
                      {formatDollar(row.optionExposure)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
