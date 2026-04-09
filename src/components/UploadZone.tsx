"use client";

import { useCallback, useState } from "react";
import { parseFidelityCsv, parseDateFromFilename } from "../lib/parseFidelityCsv";
import type { FidelityRow } from "../lib/types";

interface UploadedFile {
  name: string;
  date: Date | null;
  rows: FidelityRow[];
}

interface UploadZoneProps {
  onFilesReady: (files: UploadedFile[]) => void;
}

export default function UploadZone({ onFilesReady }: UploadZoneProps) {
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [dragActive, setDragActive] = useState(false);

  const processFiles = useCallback(
    (fileList: FileList) => {
      const toProcess = Array.from(fileList).slice(0, 2); // max 2 files
      const results: UploadedFile[] = [];

      let remaining = toProcess.length;
      toProcess.forEach((file) => {
        const reader = new FileReader();
        reader.onload = (e) => {
          const text = e.target?.result as string;
          const rows = parseFidelityCsv(text);
          const date = parseDateFromFilename(file.name);
          results.push({ name: file.name, date, rows });
          remaining--;
          if (remaining === 0) {
            // Sort by date: older first, newer second
            results.sort((a, b) => {
              if (!a.date || !b.date) return 0;
              return a.date.getTime() - b.date.getTime();
            });
            setFiles(results);
            onFilesReady(results);
          }
        };
        reader.readAsText(file);
      });
    },
    [onFilesReady]
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
    setFiles([]);
    onFilesReady([]);
  }, [onFilesReady]);

  return (
    <div className="mb-8">
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
              拖拽 Fidelity CSV 文件到此处
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
