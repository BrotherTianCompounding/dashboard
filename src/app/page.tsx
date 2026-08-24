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
  const [showProgress, setShowProgress] = useState(true);
  const [age, setAge] = useState(25);
  const [hasIncome, setHasIncome] = useState(true);

  const handleFilesReady = useCallback((f: UploadedFile[]) => {
    setFiles(f);
  }, []);

  const handleBrokerChange = useCallback((next: Broker) => {
    setBroker(next);
    setFiles([]); // clear stale data parsed under the previous broker
  }, []);

  // moomoo's positions export omits cash, so it's entered manually here.
  const [moomooCash, setMoomooCash] = useState("");
  const manualCash = broker === "moomoo" ? parseFloat(moomooCash) || 0 : 0;

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
          hasIncome,
          manualCash
        ),
        comparison: null,
      };
    }
    const prev = buildSnapshot(
      files[0].rows,
      files[0].name,
      files[0].date,
      age,
      hasIncome,
      manualCash
    );
    const curr = buildSnapshot(
      files[1].rows,
      files[1].name,
      files[1].date,
      age,
      hasIncome,
      manualCash
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
  }, [files, age, hasIncome, manualCash]);

  return (
    <main className="max-w-7xl mx-auto px-6 py-10">
      <div className="flex items-start justify-between mb-8 gap-4">
        <div>
          <h1 className="text-3xl font-bold text-cyan-400 mb-1">天哥投资仪表盘</h1>
          <p className="text-gray-500">百万之路 — Portfolio Dashboard</p>
        </div>
        <div className="flex items-center gap-4 shrink-0">
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={showProgress}
              onChange={(e) => setShowProgress(e.target.checked)}
              className="w-4 h-4 accent-cyan-500 cursor-pointer"
            />
            <span className="text-sm text-gray-300">百万进度条</span>
          </label>
          <label className="flex flex-col items-end gap-1">
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
              <option value="wealthsimple">Wealthsimple</option>
              <option value="ibkr">IBKR</option>
            </select>
          </label>
        </div>
      </div>

      <UploadZone
        key={broker}
        broker={broker}
        onFilesReady={handleFilesReady}
      />

      {broker === "moomoo" && (
        <div className="-mt-4 mb-8 flex flex-wrap items-center gap-3 rounded-xl bg-[#1a1f2e] px-4 py-3">
          <label className="text-sm text-gray-300" htmlFor="moomoo-cash">
            现金余额 Cash（USD）
          </label>
          <input
            id="moomoo-cash"
            type="number"
            inputMode="decimal"
            value={moomooCash}
            onChange={(e) => setMoomooCash(e.target.value)}
            placeholder="例如 358.99"
            className="w-40 bg-[#141926] border border-gray-700 text-gray-200 text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-cyan-400"
          />
          <span className="text-xs text-gray-500">
            moomoo 持仓表不含现金，请从账户页「Total Cash」手动填入
          </span>
        </div>
      )}

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
          <PortfolioOverview
            snapshot={current}
            comparison={comparison}
            showProgress={showProgress}
          />
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
