"use client";

import { PieChart, Pie, Cell, ResponsiveContainer } from "recharts";
import type { BucketData } from "../lib/types";

const ITEM_COLORS = [
  "#3b82f6", // blue
  "#06b6d4", // cyan
  "#f59e0b", // amber
  "#8b5cf6", // purple
  "#ec4899", // pink
];

function formatDollar(v: number): string {
  return "$" + Math.round(v).toLocaleString("en-US");
}

/** Bar color: green = on target (±3%), yellow = over, blue = under */
function barColorClass(current: number, target: number): string {
  const diff = current - target;
  if (Math.abs(diff) <= 3) return "bg-green-500";
  if (diff > 0) return "bg-yellow-500";
  return "bg-blue-500";
}

/** Big text color: yellow = over, blue = under, default neutral */
function bucketTextColorClass(current: number, target: number): string {
  const diff = current - target;
  if (Math.abs(diff) <= 1) return "text-white";
  if (diff > 0) return "text-yellow-400";
  return "text-blue-400";
}

interface BucketCardProps {
  bucket: BucketData;
}

export default function BucketCard({ bucket }: BucketCardProps) {
  const isCash = bucket.key === "cash";

  // Pie chart data: bucket items, or single slice for cash
  const pieData =
    bucket.items.length > 0 && bucket.totalValue > 0
      ? bucket.items
          .filter((i) => i.value > 0)
          .map((item, i) => ({
            name: item.label,
            value: item.value,
            color: ITEM_COLORS[i % ITEM_COLORS.length],
          }))
      : [
          {
            name: bucket.label,
            value: bucket.totalValue || 1,
            color: "#22c55e",
          },
        ];

  // Normalize bars: scale to max bar value or target for visibility
  const maxBarPct = Math.max(
    100, // ensure at least 100% reference
    ...bucket.items.map((i) =>
      Math.max(i.currentPctOfBucket, i.targetPctOfBucket)
    )
  );

  const titleColor = bucketTextColorClass(
    bucket.currentPctOfTotal,
    bucket.targetPctOfTotal
  );

  return (
    <div className="bg-[#1a1f2e] rounded-xl p-6">
      <h2 className="text-sm font-medium text-gray-400 uppercase tracking-wider mb-4">
        {bucket.label}
      </h2>

      <div className="flex flex-col lg:flex-row gap-8 items-center lg:items-start">
        {/* Left: Pie chart + big percentage */}
        <div className="flex flex-col items-center flex-shrink-0">
          <div className="w-[200px] h-[200px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={90}
                  paddingAngle={2}
                  dataKey="value"
                  animationDuration={800}
                >
                  {pieData.map((entry, idx) => (
                    <Cell key={idx} fill={entry.color} stroke="none" />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="text-center mt-2 min-w-[200px]">
            <p
              className={`text-6xl font-black tracking-tight ${titleColor}`}
              style={{ fontFamily: "Inter, system-ui, sans-serif" }}
            >
              {bucket.currentPctOfTotal.toFixed(1)}
              <span className="text-3xl">%</span>
            </p>
            <p className="text-xs text-gray-500 mt-1">
              目标 {bucket.targetPctOfTotal.toFixed(1)}%
            </p>
            <p className="text-xl text-gray-300 mt-2 font-mono">
              {formatDollar(bucket.totalValue)}
            </p>
          </div>
        </div>

        {/* Right: Bar chart or descriptive text (for cash) */}
        <div className="flex-1 min-w-0 w-full">
          {isCash ? (
            <div className="h-full flex flex-col items-center justify-center text-center py-8">
              <p className={`text-2xl font-semibold ${titleColor}`}>
                {bucket.currentPctOfTotal > bucket.targetPctOfTotal + 1
                  ? "现金略超目标"
                  : bucket.currentPctOfTotal < bucket.targetPctOfTotal - 1
                  ? "现金略低目标"
                  : "现金在目标范围"}
              </p>
              <p className="text-sm text-gray-500 mt-3">
                目标 {bucket.targetPctOfTotal.toFixed(0)}% · 当前{" "}
                {bucket.currentPctOfTotal.toFixed(1)}%
              </p>
              <p className="text-xs text-gray-600 mt-1">
                SPAXX 货币市场基金，为期权策略提供弹药
              </p>
            </div>
          ) : (
            <div className="space-y-4 mt-1">
              {bucket.items.map((item, idx) => {
                const widthPct =
                  maxBarPct > 0
                    ? Math.min((item.currentPctOfBucket / maxBarPct) * 100, 100)
                    : 0;
                return (
                  <div key={idx}>
                    <div className="flex items-center gap-3 mb-1">
                      <span className="text-sm font-medium text-gray-300 w-24 truncate">
                        {item.label}
                      </span>
                      <span className="ml-auto text-sm font-mono whitespace-nowrap">
                        <span
                          className={
                            item.currentPctOfBucket > item.targetPctOfBucket + 3
                              ? "text-yellow-400"
                              : item.currentPctOfBucket <
                                item.targetPctOfBucket - 3
                              ? "text-blue-400"
                              : "text-green-400"
                          }
                        >
                          {item.currentPctOfBucket.toFixed(1)}%
                        </span>
                        <span className="text-gray-500">
                          {" "}
                          ({item.targetPctOfBucket.toFixed(0)}%)
                        </span>
                      </span>
                      <span className="text-sm font-mono text-gray-400 whitespace-nowrap w-28 text-right">
                        {formatDollar(item.value)}
                      </span>
                    </div>
                    <div className="h-3 bg-gray-800 rounded-full overflow-hidden">
                      <div
                        className={`h-full ${barColorClass(
                          item.currentPctOfBucket,
                          item.targetPctOfBucket
                        )} transition-all duration-700 ease-out rounded-full`}
                        style={{ width: `${widthPct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
