# 三列横排仓位看板 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把 Dashboard 的三个仓位卡片从纵向堆叠改成三列横排（DCA 宽 / 现金 窄 / 期权 宽），并引入"现金跨 Bucket 拆分"逻辑：现金仓上限为目标值，超额部分计入期权仓作为待部署弹药。

**Architecture:** 把 `buildSnapshot` 从 `page.tsx` 抽到 `src/lib/buildSnapshot.ts` 让它可测；新增纯函数 `splitCash()` 处理拆分逻辑；`BucketCard` 改为按 `bucket.key` 切换 wide / narrow 两种内部布局；`page.tsx` 容器从 `space-y-6` 改成 CSS Grid 三列。

**Tech Stack:** Next.js 16 + React 19 + TypeScript + Tailwind v4 + Recharts + Jest

**Spec:** [docs/superpowers/specs/2026-05-13-three-column-buckets-design.md](../specs/2026-05-13-three-column-buckets-design.md)

---

## File Structure

| File | Action | Responsibility |
|---|---|---|
| `src/lib/splitCash.ts` | Create | 纯函数：把总现金拆成 cash bucket + options excess |
| `src/lib/buildSnapshot.ts` | Create | 从 `page.tsx` 抽出 buildSnapshot，可测 |
| `src/__tests__/splitCash.test.ts` | Create | splitCash 单元测试 |
| `src/__tests__/buildSnapshot.test.ts` | Create | buildSnapshot 集成测试 |
| `src/app/page.tsx` | Modify | 删除 buildSnapshot，改 import；容器换 Grid；max-w 改 7xl |
| `src/components/BucketCard.tsx` | Modify | 按 `bucket.key` 切换 wide/narrow 内部布局；pie 尺寸 200→140 |

---

## Task 1: 抽出 buildSnapshot 到独立文件（无行为变化）

**Why first:** `buildSnapshot` 当前在 `page.tsx` 内，无法独立测试。先抽出来再改逻辑，保证之后的改动有测试兜底。

**Files:**
- Create: `src/lib/buildSnapshot.ts`
- Modify: `src/app/page.tsx:18-152` (删除函数体，改 import)
- Test: `src/__tests__/buildSnapshot.test.ts`

- [ ] **Step 1: 创建 `src/lib/buildSnapshot.ts`，把现有逻辑原样搬过去**

复制 [src/app/page.tsx:17-152](src/app/page.tsx#L17-L152) 的 `calcTotal` 和 `buildSnapshot` 函数到新文件。注意 import 路径要从 `../lib/types` 改成 `./types`。

```typescript
// src/lib/buildSnapshot.ts
import { classifyHoldings } from "./classifyHoldings";
import { calculateTargets } from "./calculateTargets";
import type {
  FidelityRow,
  PortfolioSnapshot,
  BucketData,
  BucketItem,
} from "./types";

/** Sum all current values (incl. Pending activity for accurate total) */
function calcTotal(rows: FidelityRow[]): number {
  return rows.reduce((sum, r) => sum + r.currentValue, 0);
}

export function buildSnapshot(
  rows: FidelityRow[],
  fileName: string,
  date: Date | null
): PortfolioSnapshot {
  const totalValue = calcTotal(rows);
  const classified = classifyHoldings(
    rows.filter((r) => r.symbol !== "Pending activity")
  );
  const targets = calculateTargets(38, true);

  const pct = (numerator: number, denom: number) =>
    denom > 0 ? (numerator / denom) * 100 : 0;

  // ===== Safe Side bucket =====
  const safeSideHoldings = classified.filter((h) => h.category === "safe-side");
  const safeSideValue = safeSideHoldings.reduce(
    (s, h) => s + h.currentValue,
    0
  );

  const safeSideBySymbol = new Map<string, number>();
  for (const h of safeSideHoldings) {
    safeSideBySymbol.set(
      h.symbol,
      (safeSideBySymbol.get(h.symbol) ?? 0) + h.currentValue
    );
  }
  const ETF_TICKERS = new Set([
    "QQQM",
    "QQQ",
    "QLD",
    "VGT",
    "VOO",
    "SPY",
    "FXAIX",
  ]);
  const safeSideItems: BucketItem[] = Array.from(safeSideBySymbol.entries())
    .map(([symbol, value]) => ({
      label: symbol,
      value,
      currentPctOfBucket: pct(value, safeSideValue),
      targetPctOfBucket: ETF_TICKERS.has(symbol) ? 30 : 10,
    }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 5);

  // ===== Cash bucket =====
  const cashHoldings = classified.filter((h) => h.category === "cash");
  const cashValue = cashHoldings.reduce((s, h) => s + h.currentValue, 0);

  // ===== Options bucket (wheel + leaps combined) =====
  const optionsHoldings = classified.filter(
    (h) => h.category === "wheel" || h.category === "leaps"
  );
  const optionsValue = optionsHoldings.reduce(
    (s, h) => s + Math.abs(h.currentValue),
    0
  );

  let sellPutValue = 0;
  let sellCallValue = 0;
  let leapsValue = 0;
  for (const h of optionsHoldings) {
    if (h.category === "leaps") {
      leapsValue += Math.abs(h.currentValue);
    } else if (/\bPUT\b/i.test(h.description) && h.quantity < 0) {
      sellPutValue += Math.abs(h.currentValue);
    } else if (/\bCALL\b/i.test(h.description) && h.quantity < 0) {
      sellCallValue += Math.abs(h.currentValue);
    }
  }
  const optionsItems: BucketItem[] = [
    {
      label: "Sell Put",
      value: sellPutValue,
      currentPctOfBucket: pct(sellPutValue, optionsValue),
      targetPctOfBucket: 40,
    },
    {
      label: "Sell Call",
      value: sellCallValue,
      currentPctOfBucket: pct(sellCallValue, optionsValue),
      targetPctOfBucket: 40,
    },
    {
      label: "LEAPS Call",
      value: leapsValue,
      currentPctOfBucket: pct(leapsValue, optionsValue),
      targetPctOfBucket: 20,
    },
    {
      label: "现金",
      value: 0,
      currentPctOfBucket: 0,
      targetPctOfBucket: 0,
    },
  ];

  const buckets: BucketData[] = [
    {
      key: "safe-side",
      label: "定投仓 DCA",
      totalValue: safeSideValue,
      currentPctOfTotal: pct(safeSideValue, totalValue),
      targetPctOfTotal: targets.safeSide,
      items: safeSideItems,
    },
    {
      key: "cash",
      label: "现金仓 Cash",
      totalValue: cashValue,
      currentPctOfTotal: pct(cashValue, totalValue),
      targetPctOfTotal: targets.cash,
      items: [],
    },
    {
      key: "options",
      label: "期权仓 Options",
      totalValue: optionsValue,
      currentPctOfTotal: pct(optionsValue, totalValue),
      targetPctOfTotal: targets.wheel + targets.leaps,
      items: optionsItems,
    },
  ];

  return { totalValue, buckets, date, fileName };
}
```

- [ ] **Step 2: 修改 `src/app/page.tsx`，删除内联函数，改 import**

在 `src/app/page.tsx` 顶部：
```typescript
import { buildSnapshot } from "../lib/buildSnapshot";
```

删除 [src/app/page.tsx:17-152](src/app/page.tsx#L17-L152) 的 `calcTotal` 和 `buildSnapshot` 函数定义。
同时清理不再用到的 import：保留 `FidelityRow`、`PortfolioSnapshot`、`PortfolioComparison`，删除 `BucketData`、`BucketItem`。

最终 `page.tsx` 顶部应该是：
```typescript
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
  // ... 保留 useState / handleFilesReady / return 部分
}
```

- [ ] **Step 3: 写一个 smoke test 验证 buildSnapshot 行为没变**

```typescript
// src/__tests__/buildSnapshot.test.ts
import { buildSnapshot } from "../lib/buildSnapshot";
import type { FidelityRow } from "../lib/types";

function row(overrides: Partial<FidelityRow>): FidelityRow {
  return {
    accountName: "X12345",
    symbol: "",
    description: "",
    quantity: 0,
    lastPrice: 0,
    currentValue: 0,
    costBasisTotal: 0,
    totalGainLossDollar: 0,
    percentOfAccount: 0,
    ...overrides,
  };
}

describe("buildSnapshot (baseline behavior)", () => {
  it("computes total value from all rows including pending", () => {
    const rows: FidelityRow[] = [
      row({ symbol: "QQQM", description: "INVESCO NASDAQ 100 ETF", quantity: 100, currentValue: 25000 }),
      row({ symbol: "SPAXX", description: "FIDELITY GOVERNMENT", quantity: 5000, currentValue: 5000 }),
      row({ symbol: "Pending activity", description: "PENDING", quantity: 0, currentValue: 100 }),
    ];
    const snap = buildSnapshot(rows, "test.csv", null);
    expect(snap.totalValue).toBeCloseTo(30100);
  });

  it("creates three buckets in order: safe-side, cash, options", () => {
    const rows: FidelityRow[] = [
      row({ symbol: "QQQM", description: "INVESCO NASDAQ 100 ETF", quantity: 100, currentValue: 25000 }),
    ];
    const snap = buildSnapshot(rows, "test.csv", null);
    expect(snap.buckets.map((b) => b.key)).toEqual(["safe-side", "cash", "options"]);
  });

  it("cash bucket value equals sum of SPAXX positions (baseline, pre-split)", () => {
    const rows: FidelityRow[] = [
      row({ symbol: "QQQM", description: "INVESCO NASDAQ 100 ETF", quantity: 100, currentValue: 50000 }),
      row({ symbol: "SPAXX", description: "FIDELITY GOVERNMENT", quantity: 10000, currentValue: 10000 }),
    ];
    const snap = buildSnapshot(rows, "test.csv", null);
    const cash = snap.buckets.find((b) => b.key === "cash")!;
    expect(cash.totalValue).toBeCloseTo(10000);
  });
});
```

- [ ] **Step 4: 跑测试，确认全部通过**

```bash
cd d:/ai_claude_projects/dashboard
npx jest
```

Expected: 所有现有测试 + 3 个新测试都 PASS。

- [ ] **Step 5: 跑 build 确认 page.tsx 改动没破坏**

```bash
cd d:/ai_claude_projects/dashboard
npm run build
```

Expected: build 成功，无 TypeScript 错误。

- [ ] **Step 6: Commit**

```bash
cd d:/ai_claude_projects/dashboard
git add src/lib/buildSnapshot.ts src/app/page.tsx src/__tests__/buildSnapshot.test.ts
git commit -m "$(cat <<'EOF'
refactor: extract buildSnapshot to lib for testability

No behavior change. Adds baseline test covering total/bucket structure
to lock in current behavior before introducing cash-split logic.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: 创建 splitCash 纯函数（TDD）

**Files:**
- Create: `src/lib/splitCash.ts`
- Test: `src/__tests__/splitCash.test.ts`

- [ ] **Step 1: 写失败测试**

```typescript
// src/__tests__/splitCash.test.ts
import { splitCash } from "../lib/splitCash";

describe("splitCash", () => {
  it("returns 0 cash bucket and 0 excess when total cash is 0", () => {
    const result = splitCash({ totalCash: 0, totalValue: 100000, cashTargetPct: 5 });
    expect(result.cashBucket).toBe(0);
    expect(result.optionsExcessCash).toBe(0);
  });

  it("returns full cash in bucket when below target (3% < 5%)", () => {
    // totalValue=100000, target=5% → target value=5000
    // totalCash=3000 < 5000 → bucket=3000, excess=0
    const result = splitCash({ totalCash: 3000, totalValue: 100000, cashTargetPct: 5 });
    expect(result.cashBucket).toBe(3000);
    expect(result.optionsExcessCash).toBe(0);
  });

  it("caps bucket at target value when exactly at target (5% = 5%)", () => {
    const result = splitCash({ totalCash: 5000, totalValue: 100000, cashTargetPct: 5 });
    expect(result.cashBucket).toBe(5000);
    expect(result.optionsExcessCash).toBe(0);
  });

  it("caps bucket at target and puts excess into options (7% > 5%)", () => {
    // totalCash=7000, target=5000 → bucket=5000, excess=2000
    const result = splitCash({ totalCash: 7000, totalValue: 100000, cashTargetPct: 5 });
    expect(result.cashBucket).toBe(5000);
    expect(result.optionsExcessCash).toBe(2000);
  });

  it("handles 10% cash target (no income scenario)", () => {
    // totalCash=15000, totalValue=100000, target=10% → target value=10000
    // bucket=10000, excess=5000
    const result = splitCash({ totalCash: 15000, totalValue: 100000, cashTargetPct: 10 });
    expect(result.cashBucket).toBe(10000);
    expect(result.optionsExcessCash).toBe(5000);
  });

  it("handles totalValue=0 edge case without dividing by zero", () => {
    const result = splitCash({ totalCash: 0, totalValue: 0, cashTargetPct: 5 });
    expect(result.cashBucket).toBe(0);
    expect(result.optionsExcessCash).toBe(0);
  });

  it("invariant: cashBucket + optionsExcessCash === totalCash", () => {
    const cases = [
      { totalCash: 3000, totalValue: 100000, cashTargetPct: 5 },
      { totalCash: 7000, totalValue: 100000, cashTargetPct: 5 },
      { totalCash: 12345, totalValue: 234567, cashTargetPct: 10 },
    ];
    for (const c of cases) {
      const r = splitCash(c);
      expect(r.cashBucket + r.optionsExcessCash).toBeCloseTo(c.totalCash);
    }
  });
});
```

- [ ] **Step 2: 跑测试，确认失败**

```bash
cd d:/ai_claude_projects/dashboard
npx jest splitCash
```

Expected: FAIL with "Cannot find module '../lib/splitCash'"

- [ ] **Step 3: 实现最小代码使测试通过**

```typescript
// src/lib/splitCash.ts
export interface SplitCashInput {
  totalCash: number;
  totalValue: number;
  /** Cash target as a percentage of total portfolio (e.g., 5 for 5%) */
  cashTargetPct: number;
}

export interface SplitCashResult {
  /** Cash assigned to the cash bucket (capped at target) */
  cashBucket: number;
  /** Cash beyond target, available for options deployment */
  optionsExcessCash: number;
}

export function splitCash({
  totalCash,
  totalValue,
  cashTargetPct,
}: SplitCashInput): SplitCashResult {
  const cashTargetValue = (totalValue * cashTargetPct) / 100;
  const cashBucket = Math.min(totalCash, cashTargetValue);
  const optionsExcessCash = Math.max(0, totalCash - cashTargetValue);
  return { cashBucket, optionsExcessCash };
}
```

- [ ] **Step 4: 跑测试，确认通过**

```bash
cd d:/ai_claude_projects/dashboard
npx jest splitCash
```

Expected: 7 passed

- [ ] **Step 5: Commit**

```bash
cd d:/ai_claude_projects/dashboard
git add src/lib/splitCash.ts src/__tests__/splitCash.test.ts
git commit -m "$(cat <<'EOF'
feat: add splitCash helper for cash bucket capping

Pure function: caps cash bucket at target percentage; routes excess
into options bucket as deployable ammunition.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: 在 buildSnapshot 中应用现金拆分逻辑

**Files:**
- Modify: `src/lib/buildSnapshot.ts` (现金 + 期权 bucket 部分)
- Modify: `src/__tests__/buildSnapshot.test.ts` (新增三场景测试)

- [ ] **Step 1: 写失败测试 — 现金 < 目标场景**

在 `src/__tests__/buildSnapshot.test.ts` 末尾追加：

```typescript
describe("buildSnapshot — cash split (new behavior)", () => {
  it("cash < target: cash bucket gets all cash, options gets no excess", () => {
    // totalValue=100000, age=38+income → cash target=5% → target value=5000
    // totalCash=3000 → bucket=3000, options excess=0
    const rows: FidelityRow[] = [
      row({ symbol: "QQQM", description: "INVESCO NASDAQ 100 ETF", quantity: 100, currentValue: 97000 }),
      row({ symbol: "SPAXX", description: "FIDELITY GOVERNMENT", quantity: 3000, currentValue: 3000 }),
    ];
    const snap = buildSnapshot(rows, "test.csv", null);
    const cash = snap.buckets.find((b) => b.key === "cash")!;
    const options = snap.buckets.find((b) => b.key === "options")!;
    const cashItem = options.items.find((i) => i.label === "现金")!;

    expect(cash.totalValue).toBeCloseTo(3000);
    expect(cashItem.value).toBeCloseTo(0);
  });

  it("cash > target: cash bucket capped, excess goes to options 现金 item", () => {
    // totalValue=100000, target=5%=5000
    // totalCash=7000 → bucket=5000, options 现金=2000
    const rows: FidelityRow[] = [
      row({ symbol: "QQQM", description: "INVESCO NASDAQ 100 ETF", quantity: 100, currentValue: 93000 }),
      row({ symbol: "SPAXX", description: "FIDELITY GOVERNMENT", quantity: 7000, currentValue: 7000 }),
    ];
    const snap = buildSnapshot(rows, "test.csv", null);
    const cash = snap.buckets.find((b) => b.key === "cash")!;
    const options = snap.buckets.find((b) => b.key === "options")!;
    const cashItem = options.items.find((i) => i.label === "现金")!;

    expect(cash.totalValue).toBeCloseTo(5000);
    expect(cashItem.value).toBeCloseTo(2000);
  });

  it("options bucket value includes excess cash", () => {
    // totalValue=100000, target=5%=5000
    // totalCash=7000 → options excess=2000
    // No option positions → options.totalValue=0+2000=2000
    const rows: FidelityRow[] = [
      row({ symbol: "QQQM", description: "INVESCO NASDAQ 100 ETF", quantity: 100, currentValue: 93000 }),
      row({ symbol: "SPAXX", description: "FIDELITY GOVERNMENT", quantity: 7000, currentValue: 7000 }),
    ];
    const snap = buildSnapshot(rows, "test.csv", null);
    const options = snap.buckets.find((b) => b.key === "options")!;
    expect(options.totalValue).toBeCloseTo(2000);
  });

  it("invariant: safeSide + cash + options ≈ totalValue", () => {
    const rows: FidelityRow[] = [
      row({ symbol: "QQQM", description: "INVESCO NASDAQ 100 ETF", quantity: 100, currentValue: 60000 }),
      row({ symbol: "SPAXX", description: "FIDELITY GOVERNMENT", quantity: 8000, currentValue: 8000 }),
      row({
        symbol: "-AAPL",
        description: "AAPL JAN 16 2026 $150 PUT",
        quantity: -1,
        currentValue: -500,
      }),
    ];
    const snap = buildSnapshot(rows, "test.csv", null);
    const sum = snap.buckets.reduce((s, b) => s + b.totalValue, 0);
    expect(sum).toBeCloseTo(snap.totalValue, 0);
  });

  it("options 现金 item has target 0%", () => {
    const rows: FidelityRow[] = [
      row({ symbol: "SPAXX", description: "FIDELITY GOVERNMENT", quantity: 7000, currentValue: 7000 }),
    ];
    const snap = buildSnapshot(rows, "test.csv", null);
    const options = snap.buckets.find((b) => b.key === "options")!;
    const cashItem = options.items.find((i) => i.label === "现金")!;
    expect(cashItem.targetPctOfBucket).toBe(0);
  });
});
```

- [ ] **Step 2: 跑测试，确认失败**

```bash
cd d:/ai_claude_projects/dashboard
npx jest buildSnapshot
```

Expected: baseline 3 个测试通过，新加的 5 个失败（cash bucket 还是包含全部现金；options 还没有 excess cash）。

- [ ] **Step 3: 修改 `src/lib/buildSnapshot.ts`** —— 应用 splitCash

在 import 区加入：
```typescript
import { splitCash } from "./splitCash";
```

替换 [src/lib/buildSnapshot.ts] 中 `// ===== Cash bucket =====` 到 `// ===== Options bucket` 之间的代码：

```typescript
  // ===== Cash bucket (capped at target; excess flows to options) =====
  const cashHoldings = classified.filter((h) => h.category === "cash");
  const totalCash = cashHoldings.reduce((s, h) => s + h.currentValue, 0);
  const { cashBucket: cashValue, optionsExcessCash } = splitCash({
    totalCash,
    totalValue,
    cashTargetPct: targets.cash,
  });

  // ===== Options bucket (positions + excess cash) =====
  const optionsHoldings = classified.filter(
    (h) => h.category === "wheel" || h.category === "leaps"
  );
  const optionsPositionsValue = optionsHoldings.reduce(
    (s, h) => s + Math.abs(h.currentValue),
    0
  );
  const optionsValue = optionsPositionsValue + optionsExcessCash;
```

替换 `optionsItems` 数组中"现金"项的硬编码 0：

```typescript
  const optionsItems: BucketItem[] = [
    {
      label: "Sell Put",
      value: sellPutValue,
      currentPctOfBucket: pct(sellPutValue, optionsValue),
      targetPctOfBucket: 40,
    },
    {
      label: "Sell Call",
      value: sellCallValue,
      currentPctOfBucket: pct(sellCallValue, optionsValue),
      targetPctOfBucket: 40,
    },
    {
      label: "LEAPS Call",
      value: leapsValue,
      currentPctOfBucket: pct(leapsValue, optionsValue),
      targetPctOfBucket: 20,
    },
    {
      label: "现金",
      value: optionsExcessCash,
      currentPctOfBucket: pct(optionsExcessCash, optionsValue),
      targetPctOfBucket: 0,
    },
  ];
```

- [ ] **Step 4: 跑测试，确认全部通过**

```bash
cd d:/ai_claude_projects/dashboard
npx jest
```

Expected: 8 个 buildSnapshot 测试 + 7 个 splitCash 测试 + 现有 calculateTargets/classifyHoldings/parseFidelityCsv 测试，**全部 PASS**。

注意：Task 1 中写的第三个 baseline 测试 `cash bucket value equals sum of SPAXX positions` 的预期值是 10000（即 5% target=5000 时，cashBucket 应该被 cap 到 5000）。Task 1 当时这个测试是基于旧行为通过的。**Task 3 改完后这个测试必须更新预期**：

修改 `src/__tests__/buildSnapshot.test.ts` 中那个测试：
```typescript
  it("cash bucket is capped at target value (post-split behavior)", () => {
    // totalValue=60000, age=38+income → cash target=5% → target value=3000
    // totalCash=10000 → cash bucket=3000 (capped), excess=7000
    const rows: FidelityRow[] = [
      row({ symbol: "QQQM", description: "INVESCO NASDAQ 100 ETF", quantity: 100, currentValue: 50000 }),
      row({ symbol: "SPAXX", description: "FIDELITY GOVERNMENT", quantity: 10000, currentValue: 10000 }),
    ];
    const snap = buildSnapshot(rows, "test.csv", null);
    const cash = snap.buckets.find((b) => b.key === "cash")!;
    expect(cash.totalValue).toBeCloseTo(3000);
  });
```

- [ ] **Step 5: Commit**

```bash
cd d:/ai_claude_projects/dashboard
git add src/lib/buildSnapshot.ts src/__tests__/buildSnapshot.test.ts
git commit -m "$(cat <<'EOF'
feat: cap cash bucket at target; route excess to options

Cash bucket value is now min(totalCash, target × totalValue).
Excess cash above target shows up as "现金" item inside options
bucket with target=0% (so any presence triggers yellow warning).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: BucketCard 加入 narrow 变体（现金卡专用）

**Files:**
- Modify: `src/components/BucketCard.tsx`

- [ ] **Step 1: 在 BucketCard 顶部判断变体**

替换 [src/components/BucketCard.tsx:38-72](src/components/BucketCard.tsx#L38-L72)（组件开头到 return 之前的部分），把 `isCash` 留下，新增一个 `isNarrow` 概念（目前等价于 isCash，留出后续扩展空间）：

```typescript
export default function BucketCard({ bucket }: BucketCardProps) {
  const isCash = bucket.key === "cash";
  const isNarrow = isCash;

  // Pie chart data: bucket items, or single slice for cash
  const pieData =
    bucket.items.length > 0 && bucket.totalValue > 0
      ? bucket.items
          .filter((i) => i.value > 0)
          .map((item, i) => ({
            name: item.label,
            value: item.value,
            color: ITEM_COLORS[i % ITEM_COLORS.length],
          }))
      : [
          {
            name: bucket.label,
            value: bucket.totalValue || 1,
            color: "#22c55e",
          },
        ];

  const maxBarPct = Math.max(
    100,
    ...bucket.items.map((i) =>
      Math.max(i.currentPctOfBucket, i.targetPctOfBucket)
    )
  );

  const titleColor = bucketTextColorClass(
    bucket.currentPctOfTotal,
    bucket.targetPctOfTotal
  );
```

- [ ] **Step 2: 改写 return 部分使用 isNarrow 切换布局**

替换 [src/components/BucketCard.tsx:72-190](src/components/BucketCard.tsx#L72-L190) 的整个 return：

```typescript
  // ===== Narrow variant (cash bucket: pie + big % + status text below) =====
  if (isNarrow) {
    return (
      <div className="bg-[#1a1f2e] rounded-xl p-5 flex flex-col items-center">
        <h2 className="text-sm font-medium text-gray-400 uppercase tracking-wider mb-4 self-start">
          {bucket.label}
        </h2>
        <div className="w-[140px] h-[140px]">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={pieData}
                cx="50%"
                cy="50%"
                innerRadius={36}
                outerRadius={66}
                paddingAngle={2}
                dataKey="value"
                animationDuration={800}
              >
                {pieData.map((entry, idx) => (
                  <Cell key={idx} fill={entry.color} stroke="none" />
                ))}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
        </div>
        <div className="text-center mt-2">
          <p
            className={`text-5xl font-black tracking-tight ${titleColor}`}
            style={{ fontFamily: "Inter, system-ui, sans-serif" }}
          >
            {bucket.currentPctOfTotal.toFixed(1)}
            <span className="text-2xl">%</span>
          </p>
          <p className="text-xs text-gray-500 mt-1">
            目标 {bucket.targetPctOfTotal.toFixed(1)}%
          </p>
          <p className="text-lg text-gray-300 mt-2 font-mono">
            {formatDollar(bucket.totalValue)}
          </p>
          <p className={`text-sm font-semibold mt-3 ${titleColor}`}>
            {bucket.currentPctOfTotal < bucket.targetPctOfTotal - 1
              ? "现金略低目标"
              : "现金在目标范围"}
          </p>
          <p className="text-xs text-gray-600 mt-1 max-w-[180px]">
            超额现金已自动计入期权仓
          </p>
        </div>
      </div>
    );
  }

  // ===== Wide variant (DCA / Options: pie left + bars right) =====
  return (
    <div className="bg-[#1a1f2e] rounded-xl p-5">
      <h2 className="text-sm font-medium text-gray-400 uppercase tracking-wider mb-4">
        {bucket.label}
      </h2>

      <div className="flex flex-row gap-5 items-start">
        {/* Left: Pie chart + big percentage */}
        <div className="flex flex-col items-center flex-shrink-0">
          <div className="w-[140px] h-[140px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={36}
                  outerRadius={66}
                  paddingAngle={2}
                  dataKey="value"
                  animationDuration={800}
                >
                  {pieData.map((entry, idx) => (
                    <Cell key={idx} fill={entry.color} stroke="none" />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="text-center mt-2 min-w-[140px]">
            <p
              className={`text-5xl font-black tracking-tight ${titleColor}`}
              style={{ fontFamily: "Inter, system-ui, sans-serif" }}
            >
              {bucket.currentPctOfTotal.toFixed(1)}
              <span className="text-2xl">%</span>
            </p>
            <p className="text-xs text-gray-500 mt-1">
              目标 {bucket.targetPctOfTotal.toFixed(1)}%
            </p>
            <p className="text-lg text-gray-300 mt-2 font-mono">
              {formatDollar(bucket.totalValue)}
            </p>
          </div>
        </div>

        {/* Right: Bar chart */}
        <div className="flex-1 min-w-0 space-y-3 mt-1">
          {bucket.items.map((item, idx) => {
            const widthPct =
              maxBarPct > 0
                ? Math.min((item.currentPctOfBucket / maxBarPct) * 100, 100)
                : 0;
            return (
              <div key={idx}>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-medium text-gray-300 w-16 truncate">
                    {item.label}
                  </span>
                  <span className="ml-auto text-xs font-mono whitespace-nowrap">
                    <span
                      className={
                        item.currentPctOfBucket > item.targetPctOfBucket + 3
                          ? "text-yellow-400"
                          : item.currentPctOfBucket <
                            item.targetPctOfBucket - 3
                          ? "text-blue-400"
                          : "text-green-400"
                      }
                    >
                      {item.currentPctOfBucket.toFixed(1)}%
                    </span>
                    <span className="text-gray-500">
                      {" "}
                      ({item.targetPctOfBucket.toFixed(0)}%)
                    </span>
                  </span>
                  <span className="text-xs font-mono text-gray-400 whitespace-nowrap w-20 text-right">
                    {formatDollar(item.value)}
                  </span>
                </div>
                <div className="h-2.5 bg-gray-800 rounded-full overflow-hidden">
                  <div
                    className={`h-full ${barColorClass(
                      item.currentPctOfBucket,
                      item.targetPctOfBucket
                    )} transition-all duration-700 ease-out rounded-full`}
                    style={{ width: `${widthPct}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
```

注意几处尺寸调整（适应窄列）：
- pie 容器 `w-[200px]` → `w-[140px]`
- innerRadius 50→36, outerRadius 90→66
- 大字号 `text-6xl` → `text-5xl`, `text-3xl` → `text-2xl`
- 卡片 padding `p-6` → `p-5`
- bar 标签字号 `text-sm` → `text-xs`
- bar 宽度 `w-24` → `w-16`, `w-28` → `w-20`
- bar 高度 `h-3` → `h-2.5`
- gap `gap-3` → `gap-2`

- [ ] **Step 3: 跑 build 确认 TypeScript 不报错**

```bash
cd d:/ai_claude_projects/dashboard
npm run build
```

Expected: build success.

- [ ] **Step 4: Commit**

```bash
cd d:/ai_claude_projects/dashboard
git add src/components/BucketCard.tsx
git commit -m "$(cat <<'EOF'
feat: BucketCard narrow variant for cash + tighter wide layout

Cash bucket gets a vertical narrow layout (pie + big % + status text).
DCA/Options keep horizontal pie-left/bars-right but with smaller pie
(140px) and compact bar styling to fit the new 3-column grid.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: page.tsx 改为三列 Grid 布局

**Files:**
- Modify: `src/app/page.tsx`

- [ ] **Step 1: 改 max-width 和容器**

修改 [src/app/page.tsx:189](src/app/page.tsx#L189) — `max-w-6xl` 改成 `max-w-7xl`：

```tsx
    <main className="max-w-7xl mx-auto px-6 py-10">
```

修改 [src/app/page.tsx:208-216](src/app/page.tsx#L208-L216) — 容器从 `space-y-6` 改为 Grid：

```tsx
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
```

- [ ] **Step 2: 跑 build 确认无错误**

```bash
cd d:/ai_claude_projects/dashboard
npm run build
```

Expected: build success.

- [ ] **Step 3: 启动 dev server，浏览器肉眼检查**

```bash
cd d:/ai_claude_projects/dashboard
npm run dev
```

打开 `http://localhost:3000`，上传一份测试 CSV（用现有的 `script_template.md` 同目录下的样例，或随便一份真实的 Fidelity 导出），目测确认：

- ✅ 上传后页面显示进度条（不动）
- ✅ 进度条下方**横向三列**：定投仓（宽） | 现金仓（窄） | 期权仓（宽）
- ✅ 三个饼图大小一致（都是 140px）
- ✅ 大字百分比颜色随状态变化（绿/黄/蓝）
- ✅ DCA 卡右侧显示前5持仓柱状图
- ✅ 现金卡只有饼图 + 状态文字，**无柱状图**
- ✅ 期权卡右侧显示 4 行柱状图（SP / SC / LEAPS / 现金）
- ✅ 现金充足时（如 SPAXX=7%, target=5%），现金饼显示绿色（5%）、期权"现金"柱显示黄色（因 target=0%）
- ✅ 缩窄浏览器到 `< md` 断点，自动堆叠为单列纵向

如有 UI 问题，记录后修复再 commit。

- [ ] **Step 4: Commit**

```bash
cd d:/ai_claude_projects/dashboard
git add src/app/page.tsx
git commit -m "$(cat <<'EOF'
feat: 3-column horizontal grid for bucket cards

Replaces the vertical stack (space-y-6) with a CSS grid using
2.5fr / 1fr / 2.5fr columns: DCA wide, Cash narrow, Options wide.
Falls back to single column below md breakpoint. Page max-w bumped
to 7xl (1280px) to accommodate the new layout.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 6: 最终验证

- [ ] **Step 1: 跑全部测试**

```bash
cd d:/ai_claude_projects/dashboard
npx jest
```

Expected: 全部测试 PASS。

- [ ] **Step 2: 跑 lint**

```bash
cd d:/ai_claude_projects/dashboard
npm run lint
```

Expected: 无错误（可有 warning）。

- [ ] **Step 3: 跑 build**

```bash
cd d:/ai_claude_projects/dashboard
npm run build
```

Expected: build success.

- [ ] **Step 4: 浏览器最终走查**

```bash
cd d:/ai_claude_projects/dashboard
npm run dev
```

走一遍 Task 5 Step 3 的清单，特别确认两个边界场景：
- 上传一份现金少于目标的 CSV：现金饼显示蓝色（不足）、期权"现金"柱为 0（不显示或显示 $0）
- 上传一份现金大于目标的 CSV：现金饼显示绿色（恰好达标）、期权"现金"柱显示黄色

- [ ] **Step 5: （可选）告诉用户完工**

无需额外 commit。所有改动已在前面任务中提交。

---

## 自审清单（已检查）

**Spec coverage:**
- ✅ Section 3.1 拆分公式 → Task 2 splitCash
- ✅ Section 3.2 三 bucket 金额 → Task 3
- ✅ Section 3.3 期权 现金 item → Task 3 Step 3
- ✅ Section 3.5 现金永不黄 → Task 4 narrow variant 状态文字
- ✅ Section 4.1 页面层级 → Task 5
- ✅ Section 4.2 容器 Grid → Task 5 Step 1
- ✅ Section 4.3 narrow / wide → Task 4
- ✅ Section 6 测试场景 1-5 → Task 2 + Task 3 测试
- ✅ Section 9 不变式 → Task 2 invariant test + Task 3 invariant test

**Placeholder scan:** 无 TBD / TODO / "add error handling"。所有代码块完整。

**Type consistency:** `SplitCashInput` / `SplitCashResult` / `splitCash()` 在 Task 2 定义，Task 3 引用一致。`isNarrow` / `isCash` 在 Task 4 内部一致。
