"use client";

import { useState, useCallback, useMemo } from "react";
import UploadZone from "../components/UploadZone";
import PortfolioOverview from "../components/PortfolioOverview";
import BucketCard from "../components/BucketCard";
import SettingsCard from "../components/SettingsCard";
import { buildSnapshot } from "../lib/buildSnapshot";
import type {
  FidelityRow,
  PortfolioComparison,
} from "../lib/types";

type UploadedFile = { name: string; date: Date | null; rows: FidelityRow[] };

export default function Home() {
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [age, setAge] = useState(25);
  const [hasIncome, setHasIncome] = useState(true);

  const handleFilesReady = useCallback((f: UploadedFile[]) => {
    setFiles(f);
  }, []);

  const { current, comparison } = useMemo<{
    current: ReturnType<typeof buildSnapshot> | null;
    comparison: PortfolioComparison | null;
  }>(() => {
    if (files.length === 0) {
      return { current: null, comparison: null };
    }
    if (files.length === 1) {
      return {
        current: buildSnapshot(
          files[0].rows,
          files[0].name,
          files[0].date,
          age,
          hasIncome
        ),
        comparison: null,
      };
    }
    const prev = buildSnapshot(
      files[0].rows,
      files[0].name,
      files[0].date,
      age,
      hasIncome
    );
    const curr = buildSnapshot(
      files[1].rows,
      files[1].name,
      files[1].date,
      age,
      hasIncome
    );
    return {
      current: curr,
      comparison: {
        current: curr,
        previous: prev,
        valueDelta: curr.totalValue - prev.totalValue,
        valueDeltaPercent:
          prev.totalValue > 0
            ? ((curr.totalValue - prev.totalValue) / prev.totalValue) * 100
            : 0,
      },
    };
  }, [files, age, hasIncome]);

  return (
    <main className="max-w-7xl mx-auto px-6 py-10">
      <h1 className="text-3xl font-bold text-cyan-400 mb-1">天哥投资仪表盘</h1>
      <p className="text-gray-500 mb-8">百万之路 — Portfolio Dashboard</p>

      <UploadZone onFilesReady={handleFilesReady} />

      <SettingsCard
        age={age}
        hasIncome={hasIncome}
        onAgeChange={setAge}
        onIncomeChange={setHasIncome}
      />

      {!current && (
        <div className="text-center text-gray-600 py-20">
          上传 Fidelity CSV 文件开始
        </div>
      )}

      {current && (
        <div className="animate-fade-in">
          <PortfolioOverview snapshot={current} comparison={comparison} />
        </div>
      )}

      {current && (
        <div
          className="grid grid-cols-1 md:grid-cols-[2.5fr_1fr_2.5fr] gap-4 animate-fade-in"
          style={{ animationDelay: "0.2s", opacity: 0 }}
        >
          {current.buckets.map((bucket) => (
            <BucketCard key={bucket.key} bucket={bucket} />
          ))}
        </div>
      )}
    </main>
  );
}
