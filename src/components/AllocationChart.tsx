"use client";

import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";
import type { CategorySummary } from "../lib/types";

interface AllocationChartProps {
  categories: CategorySummary[];
}

const CATEGORY_COLORS: Record<string, string> = {
  "safe-side": "#3b82f6", // blue
  cash: "#22c55e",        // green
  wheel: "#f59e0b",       // amber
  leaps: "#8b5cf6",       // purple
};

const CATEGORY_LABELS: Record<string, string> = {
  "safe-side": "定投仓 DCA",
  cash: "现金 Cash",
  wheel: "轮转策略 Wheel",
  leaps: "远期期权 LEAPS",
};

function formatDollar(value: number): string {
  return value.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

interface TooltipPayload {
  name: string;
  value: number;
  payload: { percent: number };
}

function CustomTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: TooltipPayload[];
}) {
  if (!active || !payload || payload.length === 0) return null;
  const data = payload[0];
  return (
    <div className="bg-[#111827] border border-gray-700 rounded-lg px-3 py-2 shadow-lg">
      <p className="text-sm font-medium text-gray-200">{data.name}</p>
      <p className="text-sm text-gray-400">
        ${formatDollar(data.value)} ({data.payload.percent.toFixed(1)}%)
      </p>
    </div>
  );
}

export default function AllocationChart({ categories }: AllocationChartProps) {
  const data = categories.map((cat) => ({
    name: CATEGORY_LABELS[cat.category] ?? cat.category,
    value: cat.totalValue,
    percent: cat.percentOfPortfolio,
    color: CATEGORY_COLORS[cat.category] ?? "#6b7280",
  }));

  return (
    <div className="w-full h-[300px]">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius={70}
            outerRadius={120}
            paddingAngle={2}
            dataKey="value"
            animationBegin={0}
            animationDuration={800}
          >
            {data.map((entry, index) => (
              <Cell key={index} fill={entry.color} stroke="none" />
            ))}
          </Pie>
          <Tooltip content={<CustomTooltip />} />
        </PieChart>
      </ResponsiveContainer>

      {/* Legend */}
      <div className="flex flex-wrap justify-center gap-4 mt-2">
        {data.map((entry, index) => (
          <div key={index} className="flex items-center gap-2">
            <div
              className="w-3 h-3 rounded-full"
              style={{ backgroundColor: entry.color }}
            />
            <span className="text-sm text-gray-400">
              {entry.name} {entry.percent.toFixed(1)}%
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
