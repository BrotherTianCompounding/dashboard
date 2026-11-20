import type { BucketData, OptionLegGroup, OptionLegKind } from "../lib/types";

function formatDollar(value: number): string {
  const sign = value < 0 ? "−" : "";
  return `${sign}$${Math.round(Math.abs(value)).toLocaleString("en-US")}`;
}

const SUMMARY_META: Record<OptionLegKind, { metric: string; tone: string }> = {
  "sell-put": { metric: "接股义务", tone: "text-amber-300" },
  "buy-call": { metric: "持仓市值", tone: "text-cyan-300" },
  "sell-call": { metric: "回补市值", tone: "text-violet-300" },
  "buy-put": { metric: "持仓市值", tone: "text-rose-300" },
};

interface OptionsCashCardProps {
  options: BucketData;
}

interface UnderlyingSummary {
  symbol: string;
  value: number;
  contracts: number;
  directions: string[];
}

function buildTopUnderlyings(groups: OptionLegGroup[]): UnderlyingSummary[] {
  const byUnderlying = new Map<string, UnderlyingSummary>();

  for (const group of groups) {
    for (const item of group.items) {
      const current = byUnderlying.get(item.underlying) ?? {
        symbol: item.underlying,
        value: 0,
        contracts: 0,
        directions: [],
      };
      current.value += item.exposureValue;
      current.contracts += Math.abs(item.quantity);
      if (!current.directions.includes(group.label.split(" ")[0])) {
        current.directions.push(group.label.split(" ")[0]);
      }
      byUnderlying.set(item.underlying, current);
    }
  }

  return Array.from(byUnderlying.values())
    .sort((a, b) => b.value - a.value)
    .slice(0, 5);
}

export default function OptionsCashCard({ options }: OptionsCashCardProps) {
  const groups = options.optionLegGroups;

  if (!groups) {
    return (
      <div className="bg-[#1a1f2e] rounded-xl p-5 min-w-0">
        <h2 className="text-sm font-medium text-gray-400 mb-2">期权仓 Options</h2>
        <p className="py-4 text-sm text-red-300">期权持仓数据缺失</p>
      </div>
    );
  }

  const topUnderlyings = buildTopUnderlyings(groups);

  return (
    <div className="bg-[#1a1f2e] rounded-xl p-5 min-w-0">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-sm font-medium text-gray-400">期权策略摘要</h2>
        <span className="text-[11px] text-gray-600">按风险金额汇总</span>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2">
        {groups.map((group) => {
          const meta = SUMMARY_META[group.key];
          return (
            <div key={group.key} className="rounded-lg border border-gray-700/70 bg-[#151927] p-3">
              <div className="flex items-start justify-between gap-2">
                <span className="text-xs font-semibold text-gray-200">{group.label}</span>
                <span className="shrink-0 text-[11px] font-mono text-gray-500">{group.items.length} 份</span>
              </div>
              <div className={`mt-2 font-mono text-lg font-semibold ${meta.tone}`}>
                {formatDollar(group.exposureValue)}
              </div>
              <p className="mt-1 text-[11px] text-gray-500">{meta.metric}</p>
            </div>
          );
        })}
      </div>

      <div className="mt-5 border-t border-gray-700/60 pt-4">
        <div className="flex items-baseline justify-between">
          <h3 className="text-sm font-semibold text-gray-200">风险金额 Top 5 标的</h3>
          <span className="text-[11px] text-gray-600">跨方向合并</span>
        </div>
        {topUnderlyings.length === 0 ? (
          <p className="mt-3 text-xs text-gray-600">暂无期权持仓</p>
        ) : (
          <div className="mt-3 space-y-2">
            {topUnderlyings.map((item, index) => (
              <div key={item.symbol} className="flex items-center gap-2 text-xs">
                <span className="w-4 font-mono text-gray-600">{index + 1}</span>
                <span className="w-12 font-semibold text-gray-200">{item.symbol}</span>
                <span className="min-w-0 flex-1 truncate text-[11px] text-gray-500">
                  {item.directions.join(" / ")} · {item.contracts} 份
                </span>
                <span className="shrink-0 font-mono text-cyan-300">{formatDollar(item.value)}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
