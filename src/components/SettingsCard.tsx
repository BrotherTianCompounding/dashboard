"use client";

import { useEffect, useState } from "react";

interface SettingsCardProps {
  age: number;
  hasIncome: boolean;
  onAgeChange: (age: number) => void;
  onIncomeChange: (hasIncome: boolean) => void;
}

function clampAge(v: number): number {
  if (Number.isNaN(v)) return 0;
  return Math.max(0, Math.min(50, Math.round(v)));
}

export default function SettingsCard({
  age,
  hasIncome,
  onAgeChange,
  onIncomeChange,
}: SettingsCardProps) {
  // Local draft for the number input so the user can clear it and type freely.
  // Committed to the parent on blur / Enter; kept in sync when `age` changes
  // from elsewhere (e.g. the slider).
  const [ageDraft, setAgeDraft] = useState(String(age));

  useEffect(() => {
    setAgeDraft(String(age));
  }, [age]);

  const commitDraft = () => {
    const next = clampAge(Number(ageDraft));
    onAgeChange(next);
    setAgeDraft(String(next));
  };

  return (
    <div className="bg-[#1a1f2e] rounded-xl p-5 mb-6 flex flex-col sm:flex-row sm:items-center gap-5">
      <h2 className="text-sm font-medium text-gray-400 uppercase tracking-wider whitespace-nowrap">
        参数设置
      </h2>

      <div className="flex items-center gap-3 flex-1 min-w-0">
        <label
          htmlFor="settings-age-range"
          className="text-sm text-gray-300 whitespace-nowrap"
        >
          年龄
        </label>
        <input
          id="settings-age-range"
          type="range"
          min={0}
          max={50}
          value={age}
          onChange={(e) => onAgeChange(clampAge(Number(e.target.value)))}
          className="flex-1 accent-cyan-400"
        />
        <input
          id="settings-age-number"
          aria-label="年龄"
          type="number"
          min={0}
          max={50}
          value={ageDraft}
          onChange={(e) => setAgeDraft(e.target.value)}
          onBlur={commitDraft}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.currentTarget.blur();
            }
          }}
          className="w-16 bg-[#0f1320] border border-gray-700 rounded px-2 py-1 text-sm text-gray-200 text-center"
        />
      </div>

      <div className="flex items-center gap-3">
        <label
          htmlFor="settings-income"
          className="text-sm text-gray-300 whitespace-nowrap"
        >
          收入
        </label>
        <select
          id="settings-income"
          value={hasIncome ? "yes" : "no"}
          onChange={(e) => onIncomeChange(e.target.value === "yes")}
          className="bg-[#0f1320] border border-gray-700 rounded px-2 py-1 text-sm text-gray-200"
        >
          <option value="yes">有收入</option>
          <option value="no">没有收入</option>
        </select>
      </div>
    </div>
  );
}
