"use client";

import { useCallback, useState } from "react";
import { parseFidelityCsv, parseDateFromFilename } from "../lib/parseFidelityCsv";
import { parseMoomooCsv } from "../lib/parseMoomooCsv";
import { parseWealthsimpleCsv } from "../lib/parseWealthsimpleCsv";
import { parseSchwabCsv } from "../lib/parseSchwabCsv";
import { parseIbkrCsv } from "../lib/parseIbkrCsv";
import type { FidelityRow, Broker } from "../lib/types";

interface UploadedFile {
  name: string;
  date: Date | null;
  rows: FidelityRow[];
}

interface UploadZoneProps {
  onFilesReady: (files: UploadedFile[]) => void;
  broker: Broker;
}

const BROKER_LABEL: Record<Broker, string> = {
  fidelity: "Fidelity",
  moomoo: "moomoo",
  wealthsimple: "Wealthsimple",
  ibkr: "IBKR",
  schwab: "嘉信 Charles Schwab",
};

const PARSERS: Record<Broker, (csv: string) => FidelityRow[]> = {
  fidelity: parseFidelityCsv,
  moomoo: parseMoomooCsv,
  wealthsimple: parseWealthsimpleCsv,
  ibkr: parseIbkrCsv,
  schwab: parseSchwabCsv,
};

export default function UploadZone({ onFilesReady, broker }: UploadZoneProps) {
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [dragActive, setDragActive] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const processFiles = useCallback(
    async (fileList: FileList) => {
      const toProcess = Array.from(fileList).slice(0, 2);
      if (toProcess.length === 0) return;
      setError(null);
      const parse = PARSERS[broker] ?? parseFidelityCsv;
      try {
        const results = await Promise.all(toProcess.map(async (file) => {
          const rows = parse(await file.text());
          if (rows.length === 0) {
            throw new Error("未识别到持仓数据，请确认券商选项与 CSV 导出格式。");
          }
          return { name: file.name, date: parseDateFromFilename(file.name), rows };
        }));
        results.sort((a, b) => !a.date || !b.date ? 0 : a.date.getTime() - b.date.getTime());
        setFiles(results);
        onFilesReady(results);
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : "文件读取失败，请重新上传 CSV。");
      }
    },
    [onFilesReady, broker]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragActive(false);
      if (e.dataTransfer.files.length > 0) {
        processFiles(e.dataTransfer.files);
      }
    },
    [processFiles]
  );

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files && e.target.files.length > 0) {
        processFiles(e.target.files);
      }
    },
    [processFiles]
  );

  const handleReset = useCallback(() => {
    setError(null);
    setFiles([]);
    onFilesReady([]);
  }, [onFilesReady]);

  return (
    <div className="mb-8">
      {error && <p role="alert" className="mb-3 text-sm text-red-300">{error}</p>}
      {files.length === 0 ? (
        <label
          className={`flex flex-col items-center justify-center w-full h-40 border-2 border-dashed rounded-xl cursor-pointer transition-colors ${
            dragActive
              ? "border-cyan-400 bg-cyan-400/10"
              : "border-gray-600 bg-[#1a1f2e] hover:border-gray-400"
          }`}
          onDragOver={(e) => {
            e.preventDefault();
            setDragActive(true);
          }}
          onDragLeave={() => setDragActive(false)}
          onDrop={handleDrop}
        >
          <div className="text-center">
            <p className="text-lg text-gray-300 mb-1">
              拖拽 {BROKER_LABEL[broker]} CSV 文件到此处
            </p>
            <p className="text-sm text-gray-500">
              上传 1 个文件查看当前持仓，上传 2 个文件对比周变化
            </p>
          </div>
          <input
            type="file"
            accept=".csv"
            multiple
            className="hidden"
            onChange={handleChange}
          />
        </label>
      ) : (
        <div className="flex items-center gap-4 p-4 bg-[#1a1f2e] rounded-xl">
          <div className="flex-1">
            {files.map((f, i) => (
              <div key={i} className="flex items-center gap-2 text-sm">
                <span className="text-cyan-400">
                  {files.length === 2
                    ? i === 0
                      ? "上周"
                      : "本周"
                    : "当前"}
                </span>
                <span className="text-gray-300">{f.name}</span>
                {f.date && (
                  <span className="text-gray-500">
                    ({f.date.toLocaleDateString("zh-CN")})
                  </span>
                )}
              </div>
            ))}
          </div>
          <button
            onClick={handleReset}
            className="text-sm text-gray-400 hover:text-gray-200 transition-colors"
          >
            重新上传
          </button>
        </div>
      )}
    </div>
  );
}
