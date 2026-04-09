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
