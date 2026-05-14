"use client";

import { useState, useCallback } from "react";
import UploadZone from "../components/UploadZone";
import PortfolioOverview from "../components/PortfolioOverview";
import BucketCard from "../components/BucketCard";
import { buildSnapshot } from "../lib/buildSnapshot";
import type {
  FidelityRow,
  PortfolioSnapshot,
  PortfolioComparison,
} from "../lib/types";

export default function Home() {
  const [current, setCurrent] = useState<PortfolioSnapshot | null>(null);
  const [comparison, setComparison] = useState<PortfolioComparison | null>(
    null
  );

  const handleFilesReady = useCallback(
    (files: { name: string; date: Date | null; rows: FidelityRow[] }[]) => {
      if (files.length === 0) {
        setCurrent(null);
        setComparison(null);
        return;
      }
      if (files.length === 1) {
        setCurrent(buildSnapshot(files[0].rows, files[0].name, files[0].date));
        setComparison(null);
      } else {
        const prev = buildSnapshot(files[0].rows, files[0].name, files[0].date);
        const curr = buildSnapshot(files[1].rows, files[1].name, files[1].date);
        setCurrent(curr);
        setComparison({
          current: curr,
          previous: prev,
          valueDelta: curr.totalValue - prev.totalValue,
          valueDeltaPercent:
            prev.totalValue > 0
              ? ((curr.totalValue - prev.totalValue) / prev.totalValue) * 100
              : 0,
        });
      }
    },
    []
  );

  return (
    <main className="max-w-6xl mx-auto px-6 py-10">
      <h1 className="text-3xl font-bold text-cyan-400 mb-1">天哥投资仪表盘</h1>
      <p className="text-gray-500 mb-8">百万之路 — Portfolio Dashboard</p>

      <UploadZone onFilesReady={handleFilesReady} />

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
          className="animate-fade-in space-y-6"
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
