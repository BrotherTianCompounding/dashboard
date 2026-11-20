"use client";

import type { BucketData, OptionLegGroup } from "../lib/types";

function formatDollar(value: number): string {
  const sign = value < 0 ? "−" : "";
  return `${sign}$${Math.round(Math.abs(value)).toLocaleString("en-US")}`;
}

interface OptionsCashCardProps {
  options: BucketData;
}

function OptionGroup({ group }: { group: OptionLegGroup }) {
  return (
    <section className="py-4 first:pt-2">
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="text-sm font-semibold text-gray-100">{group.label}</h3>
        <span className="text-xs font-mono text-gray-400">
          {group.items.length} 份 · {formatDollar(group.totalValue)}
        </span>
      </div>

      {group.items.length === 0 ? (
        <p className="mt-2 text-xs text-gray-600">暂无持仓</p>
      ) : (
        <div className="mt-2 space-y-1.5">
          {group.items.map((item, index) => (
            <div key={`${group.key}-${item.description}-${index}`} className="flex items-center gap-2 text-xs">
              <span className="min-w-0 flex-1 truncate text-gray-300" title={item.description}>
                {item.description}
              </span>
              <span className="shrink-0 font-mono text-gray-500">×{item.quantity}</span>
              <span className="shrink-0 w-20 text-right font-mono text-cyan-300">
                {formatDollar(item.currentValue)}
              </span>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

export default function OptionsCashCard({ options }: OptionsCashCardProps) {
  const groups = options.optionLegGroups;
  return (
    <div className="bg-[#1a1f2e] rounded-xl p-5 min-w-0">
      <h2 className="text-sm font-medium text-gray-400 mb-2">
        期权仓 Options
      </h2>
      <div className="divide-y divide-gray-700/60">
        {groups ? groups.map((group) => <OptionGroup key={group.key} group={group} />) : (
          <p className="py-4 text-sm text-red-300">期权持仓数据缺失</p>
        )}
      </div>
    </div>
  );
}
