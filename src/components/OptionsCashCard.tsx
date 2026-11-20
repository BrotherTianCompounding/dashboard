"use client";

import { useState } from "react";
import type { BucketData, OptionLegGroup, OptionLegKind } from "../lib/types";

function formatDollar(value: number): string {
  const sign = value < 0 ? "−" : "";
  return `${sign}$${Math.round(Math.abs(value)).toLocaleString("en-US")}`;
}

interface OptionsCashCardProps {
  options: BucketData;
}

function OptionGroup({ group }: { group: OptionLegGroup }) {
  return (
    <section className="pt-4">
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="text-sm font-semibold text-gray-100">{group.label}</h3>
        <span className="text-xs font-mono text-gray-400">
          {group.items.length} 份 · {formatDollar(group.totalValue)}
        </span>
      </div>

      {group.items.length === 0 ? (
        <p className="mt-2 text-xs text-gray-600">暂无持仓</p>
      ) : (
        <div className="mt-3 max-h-[356px] space-y-1.5 overflow-y-auto pr-1">
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
  const [activeKey, setActiveKey] = useState<OptionLegKind>("sell-put");
  const activeGroup = groups?.find((group) => group.key === activeKey) ?? groups?.[0];

  return (
    <div className="bg-[#1a1f2e] rounded-xl p-5 min-w-0">
      <h2 className="text-sm font-medium text-gray-400 mb-2">
        期权仓 Options
      </h2>
      {groups ? (
        <>
          <div className="grid grid-cols-2 gap-2 border-b border-gray-700/60 pb-3">
            {groups.map((group) => {
              const isActive = group.key === activeGroup?.key;
              return (
                <button
                  key={group.key}
                  type="button"
                  onClick={() => setActiveKey(group.key)}
                  className={`rounded-lg border px-3 py-2 text-left transition-colors ${
                    isActive
                      ? "border-cyan-400/60 bg-cyan-400/10 text-cyan-200"
                      : "border-gray-700 bg-[#151927] text-gray-400 hover:border-gray-500 hover:text-gray-200"
                  }`}
                >
                  <span className="block text-xs font-semibold">{group.label}</span>
                  <span className="mt-0.5 block text-[11px] font-mono opacity-75">
                    {group.items.length} 份
                  </span>
                </button>
              );
            })}
          </div>

          {activeGroup && <OptionGroup group={activeGroup} />}
        </>
      ) : (
        <p className="py-4 text-sm text-red-300">期权持仓数据缺失</p>
      )}
    </div>
  );
}
