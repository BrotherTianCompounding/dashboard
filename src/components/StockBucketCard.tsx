"use client";

import { PieChart, Pie, Cell, ResponsiveContainer } from "recharts";
import type { BucketData } from "../lib/types";

const ITEM_COLORS = [
  "#3b82f6", // blue
  "#06b6d4", // cyan
  "#f59e0b", // amber
  "#8b5cf6", // purple
  "#ec4899", // pink
  "#10b981", // emerald
];
const OTHER_COLOR = "#64748b"; // slate for aggregated tail

function formatDollar(v: number): string {
  return "$" + Math.round(v).toLocaleString("en-US");
}

/** Big % color vs the block target: yellow = over, blue = under, white = on. */
function titleColorClass(current: number, target: number): string {
  const diff = current - target;
  if (Math.abs(diff) <= 1) return "text-white";
  if (diff > 0) return "text-yellow-400";
  return "text-blue-400";
}

interface StockBucketCardProps {
  bucket: BucketData;
}

/** Block 1 — 正股定投仓: every ticker (cash+margin merged), sorted by value. */
export default function StockBucketCard({ bucket }: StockBucketCardProps) {
  const items = bucket.items.filter((i) => i.value > 0);

  // Pie stays readable: top 6 tickers as slices, the rest folded into 其他.
  const TOP_N = 6;
  const topItems = items.slice(0, TOP_N);
  const restValue = items.slice(TOP_N).reduce((s, i) => s + i.value, 0);
  const pieData = [
    ...topItems.map((item, i) => ({
      name: item.label,
      value: item.value,
      color: ITEM_COLORS[i % ITEM_COLORS.length],
    })),
    ...(restValue > 0
      ? [{ name: "其他", value: restValue, color: OTHER_COLOR }]
      : []),
  ];
  const pie = pieData.length > 0 ? pieData : [{ name: bucket.label, value: 1, color: "#22c55e" }];

  const titleColor = titleColorClass(
    bucket.currentPctOfTotal,
    bucket.targetPctOfTotal
  );

  const maxBarPct = Math.max(1, ...items.map((i) => i.currentPctOfBucket));

  return (
    <div className="bg-[#1a1f2e] rounded-xl p-5">
      <h2 className="text-sm font-medium text-gray-400 uppercase tracking-wider mb-4">
        {bucket.label}
      </h2>

      <div className="flex flex-col lg:flex-row gap-5 items-start">
        {/* Left: pie + total value + % of whole account */}
        <div className="flex flex-col items-center flex-shrink-0 mx-auto lg:mx-0">
          <div className="w-[150px] h-[150px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={pie}
                  cx="50%"
                  cy="50%"
                  innerRadius={40}
                  outerRadius={72}
                  paddingAngle={2}
                  dataKey="value"
                  animationDuration={800}
                >
                  {pie.map((entry, idx) => (
                    <Cell key={idx} fill={entry.color} stroke="none" />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="text-center mt-2 min-w-[150px]">
            <p
              className={`text-5xl font-black tracking-tight ${titleColor}`}
              style={{ fontFamily: "Inter, system-ui, sans-serif" }}
            >
              {bucket.currentPctOfTotal.toFixed(1)}
              <span className="text-2xl">%</span>
            </p>
            <p className="text-xs text-gray-500 mt-1">占整体仓位</p>
            <p className="text-xs text-gray-500 mt-1">
              目标 {bucket.targetPctOfTotal.toFixed(1)}%
            </p>
            <p className="text-xl text-gray-200 mt-2 font-mono">
              {formatDollar(bucket.totalValue)}
            </p>
            <p className="text-xs text-gray-500 mt-0.5">正股总额</p>
          </div>
        </div>

        {/* Right: every ticker, 2-column grid, sorted by value */}
        <div className="flex-1 min-w-0 grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2.5">
          {items.map((item, idx) => {
            const widthPct = Math.min(
              (item.currentPctOfBucket / maxBarPct) * 100,
              100
            );
            return (
              <div key={idx}>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-semibold text-gray-200 w-14 truncate">
                    {item.label}
                  </span>
                  <span className="ml-auto text-xs font-mono text-cyan-300 whitespace-nowrap">
                    {item.currentPctOfBucket.toFixed(1)}%
                  </span>
                  <span className="text-xs font-mono text-gray-400 whitespace-nowrap w-16 text-right">
                    {formatDollar(item.value)}
                  </span>
                </div>
                <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-blue-500 rounded-full transition-all duration-700 ease-out"
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
