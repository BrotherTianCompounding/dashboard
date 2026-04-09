# Portfolio Dashboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a dark-themed, Bloomberg-style portfolio dashboard that parses Fidelity CSV files and displays account overview + asset allocation with week-over-week comparison.

**Architecture:** Single-page Next.js app. CSV files are parsed client-side with Papa Parse. No backend/database — all data lives in React state. Two main display modules: Portfolio Overview (net value, change, progress bar) and Asset Allocation (donut chart + comparison table). Upload 1 file for snapshot mode, 2 files for comparison mode.

**Tech Stack:** Next.js 14 (App Router), TypeScript, Tailwind CSS, Recharts, Papa Parse, Vercel deployment.

---

## File Structure

```
dashboard/
├── src/
│   ├── app/
│   │   ├── layout.tsx          # Root layout, dark theme, fonts
│   │   ├── page.tsx            # Main page, composes all modules
│   │   └── globals.css         # Tailwind base + custom dark theme
│   ├── components/
│   │   ├── UploadZone.tsx      # Drag-and-drop CSV upload (1-2 files)
│   │   ├── PortfolioOverview.tsx  # Net value, change, progress bar
│   │   ├── AllocationChart.tsx    # Donut chart (Recharts)
│   │   └── AllocationTable.tsx    # Current vs target comparison table
│   ├── lib/
│   │   ├── parseFidelityCsv.ts    # Parse CSV → structured holdings
│   │   ├── classifyHoldings.ts    # Classify holdings into 4 categories
│   │   ├── calculateTargets.ts    # Age+20 target allocation formula
│   │   └── types.ts               # All TypeScript types/interfaces
│   └── __tests__/
│       ├── parseFidelityCsv.test.ts
│       ├── classifyHoldings.test.ts
│       └── calculateTargets.test.ts
├── public/
├── package.json
├── tailwind.config.ts
├── tsconfig.json
├── next.config.ts
└── .gitignore
```

---

### Task 1: Project Scaffolding

**Files:**
- Create: `package.json`, `tsconfig.json`, `tailwind.config.ts`, `next.config.ts`, `src/app/layout.tsx`, `src/app/page.tsx`, `src/app/globals.css`, `.gitignore`

- [ ] **Step 1: Initialize Next.js project**

Run inside the `d:/ai_claude_projects/dashboard` directory:

```bash
npx create-next-app@latest . --typescript --tailwind --eslint --app --src-dir --no-import-alias --use-npm
```

When prompted, accept defaults. This creates the full Next.js scaffold with Tailwind already configured.

- [ ] **Step 2: Install dependencies**

```bash
npm install recharts papaparse
npm install -D @types/papaparse
```

- [ ] **Step 3: Configure dark theme in globals.css**

Replace `src/app/globals.css` with:

```css
@import "tailwindcss";

:root {
  --bg-primary: #0a0a0f;
  --bg-secondary: #111827;
  --bg-card: #1a1f2e;
  --text-primary: #e5e7eb;
  --text-secondary: #9ca3af;
  --accent-blue: #3b82f6;
  --accent-cyan: #06b6d4;
  --gain-green: #22c55e;
  --loss-red: #ef4444;
  --warning-yellow: #eab308;
}

body {
  background-color: var(--bg-primary);
  color: var(--text-primary);
  font-family: 'Inter', system-ui, sans-serif;
}
```

- [ ] **Step 4: Set up root layout with dark theme**

Replace `src/app/layout.tsx` with:

```tsx
import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "天哥投资仪表盘 | Portfolio Dashboard",
  description: "百万之路 — 投资组合追踪仪表盘",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-CN" className="dark">
      <body className="min-h-screen bg-[#0a0a0f] text-gray-200 antialiased">
        {children}
      </body>
    </html>
  );
}
```

- [ ] **Step 5: Create placeholder main page**

Replace `src/app/page.tsx` with:

```tsx
export default function Home() {
  return (
    <main className="max-w-6xl mx-auto px-6 py-10">
      <h1 className="text-3xl font-bold text-cyan-400 mb-2">
        天哥投资仪表盘
      </h1>
      <p className="text-gray-400">百万之路 — Portfolio Dashboard</p>
    </main>
  );
}
```

- [ ] **Step 6: Verify dev server runs**

```bash
npm run dev
```

Expected: Server starts on http://localhost:3000, dark page shows "天哥投资仪表盘" heading.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat: scaffold Next.js project with dark theme"
```

---

### Task 2: TypeScript Types

**Files:**
- Create: `src/lib/types.ts`

- [ ] **Step 1: Define all types**

Create `src/lib/types.ts`:

```ts
/** A single row from the Fidelity CSV */
export interface FidelityRow {
  accountName: string;
  symbol: string;
  description: string;
  quantity: number;
  lastPrice: number;
  currentValue: number;
  costBasisTotal: number;
  totalGainLossDollar: number;
  percentOfAccount: number;
}

/** Which category a holding belongs to */
export type HoldingCategory =
  | "safe-side"
  | "cash"
  | "wheel"
  | "leaps";

/** Sub-category within safe-side */
export type SafeSideSubCategory = "qqqm" | "voo" | "stocks";

/** A classified holding */
export interface ClassifiedHolding {
  symbol: string;
  description: string;
  quantity: number;
  currentValue: number;
  totalGainLossDollar: number;
  category: HoldingCategory;
  safeSideSubCategory?: SafeSideSubCategory;
}

/** Aggregated totals per category */
export interface CategorySummary {
  category: HoldingCategory;
  totalValue: number;
  percentOfPortfolio: number;
  holdings: ClassifiedHolding[];
}

/** Safe-side breakdown */
export interface SafeSideBreakdown {
  qqqm: number;
  voo: number;
  stocks: number;
}

/** Target allocation percentages */
export interface TargetAllocation {
  safeSide: number;
  cash: number;
  wheel: number;
  leaps: number;
  /** Inner safe-side targets as % of total portfolio */
  safeSideInner: {
    qqqm: number;
    voo: number;
    stocks: number;
  };
}

/** Full parsed portfolio snapshot */
export interface PortfolioSnapshot {
  totalValue: number;
  categories: CategorySummary[];
  safeSideBreakdown: SafeSideBreakdown;
  date: Date | null;
  fileName: string;
}

/** Comparison result when two snapshots are provided */
export interface PortfolioComparison {
  current: PortfolioSnapshot;
  previous: PortfolioSnapshot;
  valueDelta: number;
  valueDeltaPercent: number;
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/types.ts
git commit -m "feat: add TypeScript type definitions"
```

---

### Task 3: CSV Parser

**Files:**
- Create: `src/lib/parseFidelityCsv.ts`, `src/__tests__/parseFidelityCsv.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/__tests__/parseFidelityCsv.test.ts`:

```ts
import { parseFidelityCsv, parseDateFromFilename } from "../lib/parseFidelityCsv";

const MOCK_CSV = `Account Name/Number,Symbol,Description,Quantity,Last Price,Current Value,Cost Basis Total,Total Gain/Loss Dollar,Percent Of Account
INDIVIDUAL - XXX123456,QQQM,INVESCO NASDAQ 100 ETF,50,$185.00,"$9,250.00","$8,500.00",$750.00,2.50%
INDIVIDUAL - XXX123456,VOO,VANGUARD S&P 500 ETF,30,$480.00,"$14,400.00","$13,000.00","$1,400.00",3.89%
INDIVIDUAL - XXX123456,NVDA,NVIDIA CORP,100,$110.00,"$11,000.00","$9,000.00","$2,000.00",2.97%
INDIVIDUAL - XXX123456,SPAXX,FIDELITY GOVERNMENT MONEY MARKET,1,"$18,500.00","$18,500.00","$18,500.00",$0.00,5.00%
INDIVIDUAL - XXX123456,-HOOD250418P32,HOOD APR 18 2025 32 PUT,-2,$1.50,"-$300.00","-$400.00",$100.00,0.08%
INDIVIDUAL - XXX123456,HOOD,ROBINHOOD MARKETS INC,200,$38.00,"$7,600.00","$6,400.00","$1,200.00",2.05%
INDIVIDUAL - XXX123456,-QQQ270116C420,QQQ JAN 16 2027 420 CALL,2,$45.00,"$9,000.00","$7,500.00","$1,500.00",2.43%`;

describe("parseFidelityCsv", () => {
  it("parses all rows from CSV string", () => {
    const rows = parseFidelityCsv(MOCK_CSV);
    expect(rows).toHaveLength(7);
  });

  it("parses numeric fields correctly (strips $ and ,)", () => {
    const rows = parseFidelityCsv(MOCK_CSV);
    const qqqm = rows.find((r) => r.symbol === "QQQM")!;
    expect(qqqm.quantity).toBe(50);
    expect(qqqm.lastPrice).toBe(185.0);
    expect(qqqm.currentValue).toBe(9250.0);
    expect(qqqm.costBasisTotal).toBe(8500.0);
    expect(qqqm.totalGainLossDollar).toBe(750.0);
    expect(qqqm.percentOfAccount).toBe(2.5);
  });

  it("handles negative values for short options", () => {
    const rows = parseFidelityCsv(MOCK_CSV);
    const put = rows.find((r) => r.symbol === "-HOOD250418P32")!;
    expect(put.quantity).toBe(-2);
    expect(put.currentValue).toBe(-300.0);
  });

  it("parses SPAXX as cash", () => {
    const rows = parseFidelityCsv(MOCK_CSV);
    const spaxx = rows.find((r) => r.symbol === "SPAXX")!;
    expect(spaxx.currentValue).toBe(18500.0);
  });
});

describe("parseDateFromFilename", () => {
  it("parses Fidelity format: Portfolio_Positions_Apr-05-2026.csv", () => {
    const date = parseDateFromFilename("Portfolio_Positions_Apr-05-2026.csv");
    expect(date).toEqual(new Date(2026, 3, 5)); // April = month 3
  });

  it("parses numeric format: 2026-04-05.csv", () => {
    const date = parseDateFromFilename("positions_2026-04-05.csv");
    expect(date).toEqual(new Date(2026, 3, 5));
  });

  it("returns null for unrecognized format", () => {
    const date = parseDateFromFilename("random_file.csv");
    expect(date).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx jest src/__tests__/parseFidelityCsv.test.ts --no-cache
```

If Jest is not configured yet, first install and configure:

```bash
npm install -D jest ts-jest @types/jest
npx ts-jest config:init
```

Then run:

```bash
npx jest src/__tests__/parseFidelityCsv.test.ts --no-cache
```

Expected: FAIL — `Cannot find module '../lib/parseFidelityCsv'`

- [ ] **Step 3: Write implementation**

Create `src/lib/parseFidelityCsv.ts`:

```ts
import Papa from "papaparse";
import type { FidelityRow } from "./types";

/** Strip "$", ",", "%" and parse as number */
function parseNum(raw: string | undefined): number {
  if (!raw) return 0;
  const cleaned = raw.replace(/[$,%]/g, "").replace(/"/g, "").trim();
  if (cleaned === "" || cleaned === "--") return 0;
  return parseFloat(cleaned);
}

/** Column name mapping from Fidelity CSV headers to our fields */
const COLUMN_MAP: Record<string, keyof FidelityRow> = {
  "Account Name/Number": "accountName",
  "Symbol": "symbol",
  "Description": "description",
  "Quantity": "quantity",
  "Last Price": "lastPrice",
  "Current Value": "currentValue",
  "Cost Basis Total": "costBasisTotal",
  "Total Gain/Loss Dollar": "totalGainLossDollar",
  "Percent Of Account": "percentOfAccount",
};

export function parseFidelityCsv(csvString: string): FidelityRow[] {
  const result = Papa.parse<Record<string, string>>(csvString, {
    header: true,
    skipEmptyLines: true,
  });

  return result.data
    .filter((row) => row["Symbol"] && row["Symbol"].trim() !== "")
    .map((row) => ({
      accountName: (row["Account Name/Number"] ?? "").trim(),
      symbol: (row["Symbol"] ?? "").trim(),
      description: (row["Description"] ?? "").trim(),
      quantity: parseNum(row["Quantity"]),
      lastPrice: parseNum(row["Last Price"]),
      currentValue: parseNum(row["Current Value"]),
      costBasisTotal: parseNum(row["Cost Basis Total"]),
      totalGainLossDollar: parseNum(row["Total Gain/Loss Dollar"]),
      percentOfAccount: parseNum(row["Percent Of Account"]),
    }));
}

const MONTH_MAP: Record<string, number> = {
  Jan: 0, Feb: 1, Mar: 2, Apr: 3, May: 4, Jun: 5,
  Jul: 6, Aug: 7, Sep: 8, Oct: 9, Nov: 10, Dec: 11,
};

export function parseDateFromFilename(filename: string): Date | null {
  // Format: Portfolio_Positions_Apr-05-2026.csv
  const fidelityMatch = filename.match(
    /([A-Z][a-z]{2})-(\d{2})-(\d{4})/
  );
  if (fidelityMatch) {
    const month = MONTH_MAP[fidelityMatch[1]];
    if (month !== undefined) {
      return new Date(
        parseInt(fidelityMatch[3]),
        month,
        parseInt(fidelityMatch[2])
      );
    }
  }

  // Format: 2026-04-05 or positions_2026-04-05.csv
  const isoMatch = filename.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (isoMatch) {
    return new Date(
      parseInt(isoMatch[1]),
      parseInt(isoMatch[2]) - 1,
      parseInt(isoMatch[3])
    );
  }

  return null;
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx jest src/__tests__/parseFidelityCsv.test.ts --no-cache
```

Expected: All 5 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/parseFidelityCsv.ts src/__tests__/parseFidelityCsv.test.ts jest.config.ts
git commit -m "feat: add Fidelity CSV parser with date extraction"
```

---

### Task 4: Holdings Classifier

**Files:**
- Create: `src/lib/classifyHoldings.ts`, `src/__tests__/classifyHoldings.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/__tests__/classifyHoldings.test.ts`:

```ts
import { classifyHoldings } from "../lib/classifyHoldings";
import type { FidelityRow } from "../lib/types";

function makeRow(overrides: Partial<FidelityRow>): FidelityRow {
  return {
    accountName: "INDIVIDUAL - XXX123456",
    symbol: "TEST",
    description: "TEST CORP",
    quantity: 100,
    lastPrice: 10,
    currentValue: 1000,
    costBasisTotal: 900,
    totalGainLossDollar: 100,
    percentOfAccount: 1,
    ...overrides,
  };
}

describe("classifyHoldings", () => {
  it("classifies QQQM as safe-side/qqqm", () => {
    const rows = [makeRow({ symbol: "QQQM", currentValue: 10000 })];
    const result = classifyHoldings(rows);
    expect(result[0].category).toBe("safe-side");
    expect(result[0].safeSideSubCategory).toBe("qqqm");
  });

  it("classifies VOO as safe-side/voo", () => {
    const rows = [makeRow({ symbol: "VOO", currentValue: 10000 })];
    const result = classifyHoldings(rows);
    expect(result[0].category).toBe("safe-side");
    expect(result[0].safeSideSubCategory).toBe("voo");
  });

  it("classifies SPY and FXAIX as safe-side/stocks", () => {
    const rows = [
      makeRow({ symbol: "SPY", currentValue: 5000 }),
      makeRow({ symbol: "FXAIX", currentValue: 3000 }),
    ];
    const result = classifyHoldings(rows);
    expect(result.every((r) => r.category === "safe-side")).toBe(true);
    expect(result.every((r) => r.safeSideSubCategory === "stocks")).toBe(true);
  });

  it("classifies NVDA (positive shares) as safe-side/stocks", () => {
    const rows = [makeRow({ symbol: "NVDA", quantity: 100, currentValue: 11000 })];
    const result = classifyHoldings(rows);
    expect(result[0].category).toBe("safe-side");
    expect(result[0].safeSideSubCategory).toBe("stocks");
  });

  it("classifies SPAXX as cash", () => {
    const rows = [makeRow({ symbol: "SPAXX", currentValue: 18500 })];
    const result = classifyHoldings(rows);
    expect(result[0].category).toBe("cash");
  });

  it("classifies short puts as wheel", () => {
    const rows = [
      makeRow({
        symbol: "-HOOD250418P32",
        description: "HOOD APR 18 2025 32 PUT",
        quantity: -2,
        currentValue: -300,
      }),
    ];
    const result = classifyHoldings(rows);
    expect(result[0].category).toBe("wheel");
  });

  it("classifies stock held alongside a short put (wheel assign) as wheel", () => {
    const rows = [
      makeRow({
        symbol: "-HOOD250418P32",
        description: "HOOD APR 18 2025 32 PUT",
        quantity: -2,
        currentValue: -300,
      }),
      makeRow({
        symbol: "HOOD",
        description: "ROBINHOOD MARKETS INC",
        quantity: 200,
        currentValue: 7600,
      }),
    ];
    const result = classifyHoldings(rows);
    const hoodStock = result.find((r) => r.symbol === "HOOD" && r.quantity > 0)!;
    expect(hoodStock.category).toBe("wheel");
  });

  it("classifies long-dated calls (>180 DTE) as leaps", () => {
    const rows = [
      makeRow({
        symbol: "-QQQ270116C420",
        description: "QQQ JAN 16 2027 420 CALL",
        quantity: 2,
        currentValue: 9000,
      }),
    ];
    const result = classifyHoldings(rows);
    expect(result[0].category).toBe("leaps");
  });

  it("classifies short-dated calls as wheel (covered call)", () => {
    const rows = [
      makeRow({
        symbol: "-NVDA250502C130",
        description: "NVDA MAY 02 2025 130 CALL",
        quantity: -1,
        currentValue: -200,
      }),
    ];
    const result = classifyHoldings(rows);
    expect(result[0].category).toBe("wheel");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx jest src/__tests__/classifyHoldings.test.ts --no-cache
```

Expected: FAIL — `Cannot find module '../lib/classifyHoldings'`

- [ ] **Step 3: Write implementation**

Create `src/lib/classifyHoldings.ts`:

```ts
import type { FidelityRow, ClassifiedHolding, HoldingCategory, SafeSideSubCategory } from "./types";

/** Symbols that always belong to safe-side */
const SAFE_SIDE_TICKERS: Record<string, SafeSideSubCategory> = {
  QQQM: "qqqm",
  VOO: "voo",
  SPY: "stocks",
  FXAIX: "stocks",
};

/** Cash-equivalent symbols */
const CASH_TICKERS = new Set(["SPAXX", "FCASH", "FDRXX"]);

const MONTH_MAP: Record<string, number> = {
  JAN: 0, FEB: 1, MAR: 2, APR: 3, MAY: 4, JUN: 5,
  JUL: 6, AUG: 7, SEP: 8, OCT: 9, NOV: 10, DEC: 11,
};

/**
 * Parse option expiration date from description like "QQQ JAN 16 2027 420 CALL"
 * Returns the expiration Date or null.
 */
function parseOptionExpiry(description: string): Date | null {
  const match = description.match(
    /([A-Z]{3})\s+(\d{2})\s+(\d{4})\s+[\d.]+\s+(PUT|CALL)/
  );
  if (!match) return null;
  const month = MONTH_MAP[match[1]];
  if (month === undefined) return null;
  return new Date(parseInt(match[3]), month, parseInt(match[2]));
}

function isOption(description: string): boolean {
  return /\b(PUT|CALL)\b/.test(description.toUpperCase());
}

function isPut(description: string): boolean {
  return /\bPUT\b/.test(description.toUpperCase());
}

function isCall(description: string): boolean {
  return /\bCALL\b/.test(description.toUpperCase());
}

export function classifyHoldings(rows: FidelityRow[]): ClassifiedHolding[] {
  // First pass: find which stock symbols have an associated short put (wheel candidates)
  const wheelStockSymbols = new Set<string>();
  for (const row of rows) {
    if (isPut(row.description) && row.quantity < 0) {
      // Extract underlying symbol from description: "HOOD APR 18 2025 32 PUT" → "HOOD"
      const underlying = row.description.split(/\s+/)[0];
      if (underlying) {
        wheelStockSymbols.add(underlying);
      }
    }
  }

  return rows.map((row): ClassifiedHolding => {
    const base = {
      symbol: row.symbol,
      description: row.description,
      quantity: row.quantity,
      currentValue: row.currentValue,
      totalGainLossDollar: row.totalGainLossDollar,
    };

    // 1. Cash
    if (CASH_TICKERS.has(row.symbol)) {
      return { ...base, category: "cash" };
    }

    // 2. Options
    if (isOption(row.description)) {
      // Short put → wheel
      if (isPut(row.description) && row.quantity < 0) {
        return { ...base, category: "wheel" };
      }

      // Short call → wheel (covered call)
      if (isCall(row.description) && row.quantity < 0) {
        return { ...base, category: "wheel" };
      }

      // Long call → check DTE for LEAPS vs wheel
      if (isCall(row.description) && row.quantity > 0) {
        const expiry = parseOptionExpiry(row.description);
        if (expiry) {
          const now = new Date();
          const daysToExpiry = (expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
          if (daysToExpiry > 180) {
            return { ...base, category: "leaps" };
          }
        }
        // Default: short-dated long call goes to wheel
        return { ...base, category: "wheel" };
      }

      // Fallback for other option types
      return { ...base, category: "wheel" };
    }

    // 3. Stock held alongside a short put → wheel (assigned stock)
    if (row.quantity > 0 && wheelStockSymbols.has(row.symbol)) {
      return { ...base, category: "wheel" };
    }

    // 4. Known safe-side tickers
    if (SAFE_SIDE_TICKERS[row.symbol]) {
      return {
        ...base,
        category: "safe-side",
        safeSideSubCategory: SAFE_SIDE_TICKERS[row.symbol],
      };
    }

    // 5. Default: any other stock → safe-side/stocks
    if (row.quantity > 0 && !isOption(row.description)) {
      return { ...base, category: "safe-side", safeSideSubCategory: "stocks" };
    }

    // 6. Catch-all
    return { ...base, category: "wheel" };
  });
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx jest src/__tests__/classifyHoldings.test.ts --no-cache
```

Expected: All 9 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/classifyHoldings.ts src/__tests__/classifyHoldings.test.ts
git commit -m "feat: add holdings classifier (safe-side/cash/wheel/leaps)"
```

---

### Task 5: Target Allocation Calculator

**Files:**
- Create: `src/lib/calculateTargets.ts`, `src/__tests__/calculateTargets.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/__tests__/calculateTargets.test.ts`:

```ts
import { calculateTargets } from "../lib/calculateTargets";

describe("calculateTargets", () => {
  it("calculates targets for age 38 with income", () => {
    const targets = calculateTargets(38, true);
    expect(targets.safeSide).toBe(58);
    expect(targets.cash).toBe(5);
    expect(targets.wheel).toBeCloseTo(29.6);
    expect(targets.leaps).toBeCloseTo(7.4);
  });

  it("calculates targets for age 38 without income", () => {
    const targets = calculateTargets(38, false);
    expect(targets.safeSide).toBe(58);
    expect(targets.cash).toBe(10);
    expect(targets.wheel).toBeCloseTo(25.6);
    expect(targets.leaps).toBeCloseTo(6.4);
  });

  it("caps safe-side at 80% for age 60+", () => {
    const targets = calculateTargets(65, true);
    expect(targets.safeSide).toBe(80);
    expect(targets.cash).toBe(5);
    expect(targets.wheel).toBeCloseTo(12);
    expect(targets.leaps).toBeCloseTo(3);
  });

  it("calculates safe-side inner breakdown", () => {
    const targets = calculateTargets(38, true);
    // 58% safe-side → inner: 30% QQQM, 30% VOO, 40% stocks (of 58%)
    expect(targets.safeSideInner.qqqm).toBeCloseTo(17.4);
    expect(targets.safeSideInner.voo).toBeCloseTo(17.4);
    expect(targets.safeSideInner.stocks).toBeCloseTo(23.2);
  });

  it("all percentages sum to 100", () => {
    const targets = calculateTargets(38, true);
    const total = targets.safeSide + targets.cash + targets.wheel + targets.leaps;
    expect(total).toBeCloseTo(100);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx jest src/__tests__/calculateTargets.test.ts --no-cache
```

Expected: FAIL — `Cannot find module '../lib/calculateTargets'`

- [ ] **Step 3: Write implementation**

Create `src/lib/calculateTargets.ts`:

```ts
import type { TargetAllocation } from "./types";

const SAFE_SIDE_CAP = 80;

export function calculateTargets(
  age: number,
  hasIncome: boolean
): TargetAllocation {
  const safeSide = Math.min(age + 20, SAFE_SIDE_CAP);
  const cash = hasIncome ? 5 : 10;
  const options = 100 - safeSide - cash;
  const wheel = options * 0.8;
  const leaps = options * 0.2;

  return {
    safeSide,
    cash,
    wheel,
    leaps,
    safeSideInner: {
      qqqm: safeSide * 0.3,
      voo: safeSide * 0.3,
      stocks: safeSide * 0.4,
    },
  };
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx jest src/__tests__/calculateTargets.test.ts --no-cache
```

Expected: All 5 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/calculateTargets.ts src/__tests__/calculateTargets.test.ts
git commit -m "feat: add target allocation calculator (Age+20 system)"
```

---

### Task 6: Upload Zone Component

**Files:**
- Create: `src/components/UploadZone.tsx`
- Modify: `src/app/page.tsx`

- [ ] **Step 1: Create UploadZone component**

Create `src/components/UploadZone.tsx`:

```tsx
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
```

- [ ] **Step 2: Wire up page.tsx with state management**

Replace `src/app/page.tsx` with:

```tsx
"use client";

import { useState, useCallback } from "react";
import UploadZone from "../components/UploadZone";
import { classifyHoldings } from "../lib/classifyHoldings";
import { calculateTargets } from "../lib/calculateTargets";
import type {
  FidelityRow,
  PortfolioSnapshot,
  PortfolioComparison,
  CategorySummary,
  SafeSideBreakdown,
} from "../lib/types";

function buildSnapshot(
  rows: FidelityRow[],
  fileName: string,
  date: Date | null
): PortfolioSnapshot {
  const classified = classifyHoldings(rows);

  const totalValue = classified.reduce(
    (sum, h) => sum + Math.abs(h.currentValue),
    0
  );

  const categoryMap = new Map<string, CategorySummary>();
  for (const h of classified) {
    const existing = categoryMap.get(h.category);
    if (existing) {
      existing.totalValue += Math.abs(h.currentValue);
      existing.holdings.push(h);
    } else {
      categoryMap.set(h.category, {
        category: h.category,
        totalValue: Math.abs(h.currentValue),
        percentOfPortfolio: 0,
        holdings: [h],
      });
    }
  }

  const categories = Array.from(categoryMap.values()).map((cat) => ({
    ...cat,
    percentOfPortfolio: totalValue > 0 ? (cat.totalValue / totalValue) * 100 : 0,
  }));

  const safeSideHoldings = classified.filter((h) => h.category === "safe-side");
  const safeSideBreakdown: SafeSideBreakdown = {
    qqqm: safeSideHoldings
      .filter((h) => h.safeSideSubCategory === "qqqm")
      .reduce((sum, h) => sum + h.currentValue, 0),
    voo: safeSideHoldings
      .filter((h) => h.safeSideSubCategory === "voo")
      .reduce((sum, h) => sum + h.currentValue, 0),
    stocks: safeSideHoldings
      .filter((h) => h.safeSideSubCategory === "stocks")
      .reduce((sum, h) => sum + h.currentValue, 0),
  };

  return { totalValue, categories, safeSideBreakdown, date, fileName };
}

export default function Home() {
  const [current, setCurrent] = useState<PortfolioSnapshot | null>(null);
  const [comparison, setComparison] = useState<PortfolioComparison | null>(null);
  const targets = calculateTargets(38, true);

  const handleFilesReady = useCallback(
    (
      files: { name: string; date: Date | null; rows: FidelityRow[] }[]
    ) => {
      if (files.length === 0) {
        setCurrent(null);
        setComparison(null);
        return;
      }

      if (files.length === 1) {
        const snapshot = buildSnapshot(files[0].rows, files[0].name, files[0].date);
        setCurrent(snapshot);
        setComparison(null);
      } else {
        // files[0] = older (previous), files[1] = newer (current)
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
      <h1 className="text-3xl font-bold text-cyan-400 mb-1">
        天哥投资仪表盘
      </h1>
      <p className="text-gray-500 mb-8">百万之路 — Portfolio Dashboard</p>

      <UploadZone onFilesReady={handleFilesReady} />

      {!current && (
        <div className="text-center text-gray-600 py-20">
          上传 Fidelity CSV 文件开始
        </div>
      )}

      {/* PortfolioOverview and AllocationChart/Table will be added in next tasks */}
      {current && (
        <div className="text-gray-400 text-sm">
          已解析：总净值 ${current.totalValue.toLocaleString("en-US", { minimumFractionDigits: 2 })}
        </div>
      )}
    </main>
  );
}
```

- [ ] **Step 3: Verify in browser**

```bash
npm run dev
```

Open http://localhost:3000. Test:
1. Page loads with upload zone visible
2. Can click to upload a CSV (use a mock file or Fidelity export)
3. After upload, total net value appears

- [ ] **Step 4: Commit**

```bash
git add src/components/UploadZone.tsx src/app/page.tsx
git commit -m "feat: add CSV upload zone with drag-and-drop"
```

---

### Task 7: Portfolio Overview Component

**Files:**
- Create: `src/components/PortfolioOverview.tsx`
- Modify: `src/app/page.tsx`

- [ ] **Step 1: Create PortfolioOverview component**

Create `src/components/PortfolioOverview.tsx`:

```tsx
"use client";

import type { PortfolioSnapshot, PortfolioComparison } from "../lib/types";

interface PortfolioOverviewProps {
  snapshot: PortfolioSnapshot;
  comparison: PortfolioComparison | null;
}

const INITIAL_CAPITAL = 400_000;
const TARGET_CAPITAL = 1_000_000;

function formatDollar(value: number): string {
  return value.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export default function PortfolioOverview({
  snapshot,
  comparison,
}: PortfolioOverviewProps) {
  const progressPercent = Math.min(
    ((snapshot.totalValue - INITIAL_CAPITAL) / (TARGET_CAPITAL - INITIAL_CAPITAL)) * 100,
    100
  );
  const remaining = TARGET_CAPITAL - snapshot.totalValue;

  return (
    <div className="bg-[#1a1f2e] rounded-xl p-6 mb-6">
      <h2 className="text-sm font-medium text-gray-400 uppercase tracking-wider mb-4">
        账户总览 Portfolio Overview
      </h2>

      {/* Net Value */}
      <div className="mb-6">
        <p className="text-5xl font-bold tracking-tight text-white">
          ${formatDollar(snapshot.totalValue)}
        </p>

        {comparison && (
          <div className="flex items-center gap-3 mt-2">
            <span
              className={`text-2xl font-semibold ${
                comparison.valueDelta >= 0 ? "text-green-400" : "text-red-400"
              }`}
            >
              {comparison.valueDelta >= 0 ? "+" : ""}
              ${formatDollar(comparison.valueDelta)}
            </span>
            <span
              className={`text-lg ${
                comparison.valueDeltaPercent >= 0
                  ? "text-green-400"
                  : "text-red-400"
              }`}
            >
              ({comparison.valueDeltaPercent >= 0 ? "+" : ""}
              {comparison.valueDeltaPercent.toFixed(1)}%)
            </span>
          </div>
        )}

        {comparison && (
          <p className="text-sm text-gray-500 mt-1">
            上周净值：${formatDollar(comparison.previous.totalValue)}
          </p>
        )}
      </div>

      {/* Progress Bar: $400K → $1M */}
      <div>
        <div className="flex justify-between text-sm text-gray-400 mb-2">
          <span>$400K 起点</span>
          <span className="text-cyan-400 font-medium">
            {progressPercent.toFixed(1)}% 完成
          </span>
          <span>$1M 目标</span>
        </div>
        <div className="w-full h-4 bg-gray-800 rounded-full overflow-hidden">
          <div
            className="h-full rounded-full bg-gradient-to-r from-cyan-500 to-blue-500 transition-all duration-1000 ease-out"
            style={{ width: `${Math.max(progressPercent, 0)}%` }}
          />
        </div>
        <p className="text-sm text-gray-500 mt-2">
          距离目标还差 ${formatDollar(Math.max(remaining, 0))}
        </p>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Add to page.tsx**

In `src/app/page.tsx`, add import at the top:

```tsx
import PortfolioOverview from "../components/PortfolioOverview";
```

Replace the placeholder `{current && (...)}` block with:

```tsx
{current && (
  <PortfolioOverview snapshot={current} comparison={comparison} />
)}
```

- [ ] **Step 3: Verify in browser**

```bash
npm run dev
```

Upload a CSV. Verify:
- Large net value number displays
- Progress bar renders with gradient
- If 2 files: green/red delta and percentage show

- [ ] **Step 4: Commit**

```bash
git add src/components/PortfolioOverview.tsx src/app/page.tsx
git commit -m "feat: add portfolio overview with progress bar"
```

---

### Task 8: Allocation Donut Chart

**Files:**
- Create: `src/components/AllocationChart.tsx`
- Modify: `src/app/page.tsx`

- [ ] **Step 1: Create AllocationChart component**

Create `src/components/AllocationChart.tsx`:

```tsx
"use client";

import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";
import type { CategorySummary } from "../lib/types";

interface AllocationChartProps {
  categories: CategorySummary[];
}

const CATEGORY_COLORS: Record<string, string> = {
  "safe-side": "#3b82f6", // blue
  cash: "#22c55e",        // green
  wheel: "#f59e0b",       // amber
  leaps: "#8b5cf6",       // purple
};

const CATEGORY_LABELS: Record<string, string> = {
  "safe-side": "安全端 Safe Side",
  cash: "现金 Cash",
  wheel: "轮转策略 Wheel",
  leaps: "远期期权 LEAPS",
};

function formatDollar(value: number): string {
  return value.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

interface TooltipPayload {
  name: string;
  value: number;
  payload: { percent: number };
}

function CustomTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: TooltipPayload[];
}) {
  if (!active || !payload || payload.length === 0) return null;
  const data = payload[0];
  return (
    <div className="bg-[#111827] border border-gray-700 rounded-lg px-3 py-2 shadow-lg">
      <p className="text-sm font-medium text-gray-200">{data.name}</p>
      <p className="text-sm text-gray-400">
        ${formatDollar(data.value)} ({data.payload.percent.toFixed(1)}%)
      </p>
    </div>
  );
}

export default function AllocationChart({ categories }: AllocationChartProps) {
  const data = categories.map((cat) => ({
    name: CATEGORY_LABELS[cat.category] ?? cat.category,
    value: cat.totalValue,
    percent: cat.percentOfPortfolio,
    color: CATEGORY_COLORS[cat.category] ?? "#6b7280",
  }));

  return (
    <div className="w-full h-[300px]">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius={70}
            outerRadius={120}
            paddingAngle={2}
            dataKey="value"
            animationBegin={0}
            animationDuration={800}
          >
            {data.map((entry, index) => (
              <Cell key={index} fill={entry.color} stroke="none" />
            ))}
          </Pie>
          <Tooltip content={<CustomTooltip />} />
        </PieChart>
      </ResponsiveContainer>

      {/* Legend */}
      <div className="flex flex-wrap justify-center gap-4 mt-2">
        {data.map((entry, index) => (
          <div key={index} className="flex items-center gap-2">
            <div
              className="w-3 h-3 rounded-full"
              style={{ backgroundColor: entry.color }}
            />
            <span className="text-sm text-gray-400">
              {entry.name} {entry.percent.toFixed(1)}%
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Add to page.tsx**

In `src/app/page.tsx`, add import:

```tsx
import AllocationChart from "../components/AllocationChart";
```

After the `PortfolioOverview` block, add:

```tsx
{current && (
  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
    <div className="bg-[#1a1f2e] rounded-xl p-6">
      <h2 className="text-sm font-medium text-gray-400 uppercase tracking-wider mb-4">
        资产分配 Asset Allocation
      </h2>
      <AllocationChart categories={current.categories} />
    </div>
    {/* AllocationTable will go here */}
  </div>
)}
```

- [ ] **Step 3: Verify in browser**

Upload CSV → donut chart renders with 4 colored segments, tooltip works on hover, legend shows below.

- [ ] **Step 4: Commit**

```bash
git add src/components/AllocationChart.tsx src/app/page.tsx
git commit -m "feat: add allocation donut chart"
```

---

### Task 9: Allocation Comparison Table

**Files:**
- Create: `src/components/AllocationTable.tsx`
- Modify: `src/app/page.tsx`

- [ ] **Step 1: Create AllocationTable component**

Create `src/components/AllocationTable.tsx`:

```tsx
"use client";

import type {
  CategorySummary,
  TargetAllocation,
  SafeSideBreakdown,
  PortfolioComparison,
} from "../lib/types";

interface AllocationTableProps {
  categories: CategorySummary[];
  safeSideBreakdown: SafeSideBreakdown;
  targets: TargetAllocation;
  totalValue: number;
  comparison: PortfolioComparison | null;
}

function formatDollar(value: number): string {
  return "$" + value.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function getDeviation(current: number, target: number): number {
  return current - target;
}

function deviationColor(deviation: number): string {
  if (Math.abs(deviation) <= 3) return "text-gray-300";
  if (deviation > 0) return "text-red-400";   // overweight
  return "text-yellow-400";                     // underweight
}

interface RowData {
  label: string;
  value: number;
  currentPct: number;
  targetPct: number;
  indent?: boolean;
}

export default function AllocationTable({
  categories,
  safeSideBreakdown,
  targets,
  totalValue,
  comparison,
}: AllocationTableProps) {
  const getCategoryValue = (cat: string): number => {
    return categories.find((c) => c.category === cat)?.totalValue ?? 0;
  };

  const getCategoryPct = (cat: string): number => {
    return categories.find((c) => c.category === cat)?.percentOfPortfolio ?? 0;
  };

  const getPrevCategoryPct = (cat: string): number | null => {
    if (!comparison) return null;
    return (
      comparison.previous.categories.find((c) => c.category === cat)
        ?.percentOfPortfolio ?? null
    );
  };

  const rows: RowData[] = [
    {
      label: "安全端 Safe Side",
      value: getCategoryValue("safe-side"),
      currentPct: getCategoryPct("safe-side"),
      targetPct: targets.safeSide,
    },
    {
      label: "└ QQQM",
      value: safeSideBreakdown.qqqm,
      currentPct: totalValue > 0 ? (safeSideBreakdown.qqqm / totalValue) * 100 : 0,
      targetPct: targets.safeSideInner.qqqm,
      indent: true,
    },
    {
      label: "└ VOO",
      value: safeSideBreakdown.voo,
      currentPct: totalValue > 0 ? (safeSideBreakdown.voo / totalValue) * 100 : 0,
      targetPct: targets.safeSideInner.voo,
      indent: true,
    },
    {
      label: "└ 个股",
      value: safeSideBreakdown.stocks,
      currentPct: totalValue > 0 ? (safeSideBreakdown.stocks / totalValue) * 100 : 0,
      targetPct: targets.safeSideInner.stocks,
      indent: true,
    },
    {
      label: "现金 Cash",
      value: getCategoryValue("cash"),
      currentPct: getCategoryPct("cash"),
      targetPct: targets.cash,
    },
    {
      label: "轮转策略 Wheel",
      value: getCategoryValue("wheel"),
      currentPct: getCategoryPct("wheel"),
      targetPct: targets.wheel,
    },
    {
      label: "远期期权 LEAPS",
      value: getCategoryValue("leaps"),
      currentPct: getCategoryPct("leaps"),
      targetPct: targets.leaps,
    },
  ];

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-gray-500 text-left border-b border-gray-700">
            <th className="pb-3 font-medium">类别</th>
            <th className="pb-3 font-medium text-right">当前金额</th>
            <th className="pb-3 font-medium text-right">当前占比</th>
            <th className="pb-3 font-medium text-right">目标占比</th>
            <th className="pb-3 font-medium text-right">偏差</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => {
            const deviation = getDeviation(row.currentPct, row.targetPct);
            return (
              <tr
                key={i}
                className={`border-b border-gray-800 ${
                  row.indent ? "text-gray-400" : "text-gray-200"
                }`}
              >
                <td className={`py-3 ${row.indent ? "pl-4" : "font-medium"}`}>
                  {row.label}
                </td>
                <td className="py-3 text-right font-mono">
                  {formatDollar(row.value)}
                </td>
                <td className="py-3 text-right font-mono">
                  {row.currentPct.toFixed(1)}%
                </td>
                <td className="py-3 text-right font-mono text-gray-500">
                  {row.targetPct.toFixed(1)}%
                </td>
                <td
                  className={`py-3 text-right font-mono ${
                    row.indent ? "text-gray-500" : deviationColor(deviation)
                  }`}
                >
                  {!row.indent && (
                    <>
                      {deviation >= 0 ? "+" : ""}
                      {deviation.toFixed(1)}%
                    </>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
```

- [ ] **Step 2: Add to page.tsx**

In `src/app/page.tsx`, add import:

```tsx
import AllocationTable from "../components/AllocationTable";
```

Replace the `{/* AllocationTable will go here */}` comment in the grid with:

```tsx
<div className="bg-[#1a1f2e] rounded-xl p-6">
  <h2 className="text-sm font-medium text-gray-400 uppercase tracking-wider mb-4">
    当前 vs 目标 Current vs Target
  </h2>
  <AllocationTable
    categories={current.categories}
    safeSideBreakdown={current.safeSideBreakdown}
    targets={targets}
    totalValue={current.totalValue}
    comparison={comparison}
  />
</div>
```

- [ ] **Step 3: Verify in browser**

Upload CSV → table shows all 7 rows with current values, percentages, targets, and deviation. Deviations > ±3% highlighted in red/yellow.

- [ ] **Step 4: Commit**

```bash
git add src/components/AllocationTable.tsx src/app/page.tsx
git commit -m "feat: add allocation comparison table with deviation highlighting"
```

---

### Task 10: Final Polish and Deploy

**Files:**
- Modify: `src/app/page.tsx` (minor), `src/app/globals.css` (animations)
- Create: `vercel.json` (if needed)

- [ ] **Step 1: Add fade-in animation to globals.css**

Append to `src/app/globals.css`:

```css
@keyframes fadeInUp {
  from {
    opacity: 0;
    transform: translateY(16px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.animate-fade-in {
  animation: fadeInUp 0.6s ease-out forwards;
}
```

- [ ] **Step 2: Apply animations in page.tsx**

Wrap the `PortfolioOverview` block:

```tsx
{current && (
  <div className="animate-fade-in">
    <PortfolioOverview snapshot={current} comparison={comparison} />
  </div>
)}
```

Wrap the allocation grid:

```tsx
{current && (
  <div className="animate-fade-in" style={{ animationDelay: "0.2s", opacity: 0 }}>
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* ... chart and table ... */}
    </div>
  </div>
)}
```

- [ ] **Step 3: Run build to verify no errors**

```bash
npm run build
```

Expected: Build succeeds with no errors.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat: add fade-in animations and final polish"
```

- [ ] **Step 5: Push to GitHub**

```bash
git push origin main
```

- [ ] **Step 6: Deploy to Vercel**

Option A — via Vercel CLI:
```bash
npx vercel --prod
```

Option B — via Vercel dashboard:
1. Go to https://vercel.com/new
2. Import `BrotherTianCompounding/dashboard` repo
3. Framework: Next.js (auto-detected)
4. Click Deploy

- [ ] **Step 7: Verify deployment**

Open the Vercel URL. Test full flow:
1. Page loads with dark theme
2. Upload 1 CSV → snapshot mode works
3. Upload 2 CSVs → comparison mode with green/red delta
4. Donut chart renders
5. Table shows deviation highlighting

- [ ] **Step 8: Commit Vercel config if needed**

```bash
git add -A
git commit -m "chore: add deployment config"
git push origin main
```
