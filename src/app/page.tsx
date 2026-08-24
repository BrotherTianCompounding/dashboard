"use client";

import { useState, useCallback, useMemo } from "react";
import UploadZone from "../components/UploadZone";
import PortfolioOverview from "../components/PortfolioOverview";
import StockBucketCard from "../components/StockBucketCard";
import OptionsCashCard from "../components/OptionsCashCard";
import SettingsCard from "../components/SettingsCard";
import { buildSnapshot } from "../lib/buildSnapshot";
import type {
  FidelityRow,
  PortfolioComparison,
  Broker,
} from "../lib/types";

type UploadedFile = { name: string; date: Date | null; rows: FidelityRow[] };

export default function Home() {
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [broker, setBroker] = useState<Broker>("fidelity");
  const [age, setAge] = useState(25);
  const [hasIncome, setHasIncome] = useState(true);

  const handleFilesReady = useCallback((f: UploadedFile[]) => {
    setFiles(f);
  }, []);

  const handleBrokerChange = useCallback((next: Broker) => {
    setBroker(next);
    setFiles([]); // clear stale data parsed under the previous broker
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
      <div className="flex items-start justify-between mb-8 gap-4">
        <div>
          <h1 className="text-3xl font-bold text-cyan-400 mb-1">天哥投资仪表盘</h1>
          <p className="text-gray-500">百万之路 — Portfolio Dashboard</p>
        </div>
        <label className="flex flex-col items-end gap-1 shrink-0">
          <span className="text-xs text-gray-500 uppercase tracking-wider">
            券商 Broker
          </span>
          <select
            value={broker}
            onChange={(e) => handleBrokerChange(e.target.value as Broker)}
            className="bg-[#1a1f2e] border border-gray-700 text-gray-200 text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-cyan-400 cursor-pointer"
          >
            <option value="fidelity">Fidelity</option>
            <option value="moomoo">moomoo</option>
          </select>
        </label>
      </div>

      <UploadZone
        key={broker}
        broker={broker}
        onFilesReady={handleFilesReady}
      />

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
          className="grid grid-cols-1 lg:grid-cols-[3fr_2fr] gap-4 animate-fade-in"
          style={{ animationDelay: "0.2s", opacity: 0 }}
        >
          <StockBucketCard
            bucket={current.buckets.find((b) => b.key === "safe-side")!}
          />
          <OptionsCashCard
            cash={current.buckets.find((b) => b.key === "cash")!}
            options={current.buckets.find((b) => b.key === "options")!}
          />
        </div>
      )}
    </main>
  );
}
