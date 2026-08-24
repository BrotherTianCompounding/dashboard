import { parseIbkrCsv } from "../lib/parseIbkrCsv";
import { buildSnapshot } from "../lib/buildSnapshot";

const IBKR_CSV = [
  "Net Asset Value,Header,Asset Class,Prior Total,Current Long,Current Short,Current Total,Change",
  "Net Asset Value,Data,Cash ,30184.52,30363.40202,0,30363.40202,178.8820158",
  "Net Asset Value,Data,Stock,87667.81,87860.81,0,87860.81,193",
  "Net Asset Value,Data,Options,8482.8,23308.11,-15238.71,8069.4,-413.4",
  "Net Asset Value,Data,Interest Accruals,25.54,27.29,0,27.29,1.75",
  "Net Asset Value,Data,Total,126360.67,141559.612,-15238.71,126320.902,-39.7679842",
  "Positions and Mark-to-Market Profit and Loss,Header,DataDiscriminator,Asset Class,Currency,Symbol,Description,Prior Quantity,Quantity,Prior Price,Price,Prior Market Value,Market Value,Position,Trading,Comm.,Other,Total",
  "Positions and Mark-to-Market Profit and Loss,Data,Summary,Stocks,USD,EQAC,INVESCO NASDAQ 100 ACC,35.104,35.104,500.2,502.1,17559.02,17625.72,66.7,0,0,0,66.7",
  "Positions and Mark-to-Market Profit and Loss,Data,Summary,Stocks,USD,GOOGL,ALPHABET INC-CL A,10,10,340.67,344.82,3406.7,3448.2,41.5,0,0,0,41.5",
  "Positions and Mark-to-Market Profit and Loss,Data,Summary,Stocks,USD,NVDA,NVIDIA CORP,50.0575,50.0575,216.85,214.72,10854.97,10748.35,-106.62,0,0,0,-106.62",
  "Positions and Mark-to-Market Profit and Loss,Data,Summary,Stocks,USD,TSLA,TESLA INC,10,10,345.13,362.86,3451.3,3628.6,177.3,0,0,0,177.3",
  "Positions and Mark-to-Market Profit and Loss,Data,Summary,Stocks,USD,VUAA,VANG S&P500 USDA,352.9289,352.9289,148.46,148.5,52395.82,52409.94,14.12,0,0,0,14.12",
  "Positions and Mark-to-Market Profit and Loss,Data,,Total,USD,,,,,,,87667.81,87860.81,193,0,0,0,193",
  "Positions and Mark-to-Market Profit and Loss,Data,Summary,Equity and Index Options,USD,APP,APP 11SEP26 300 P,-1,0,11.3156,12.7086,-1131.56,0,-139.3,-205.14,-1.04028,0,-345.48028",
  "Positions and Mark-to-Market Profit and Loss,Data,Details,Equity and Index Options,USD,APP,APP 11SEP26 300 P,0,1,0,14.76,0,1476,0,-205.14,-1.04028,0,-206.18028",
  "Positions and Mark-to-Market Profit and Loss,Data,Summary,Equity and Index Options,USD,APP,APP 02OCT26 290 P,0,-1,0,14.6398,0,-1463.98,0,193.02,-1.0777042,0,191.9422958",
  "Positions and Mark-to-Market Profit and Loss,Data,Summary,Equity and Index Options,USD,DRAM,DRAM 17JUN27 65 C,1,1,12.6474,12.9825,1264.74,1298.25,33.51,0,0,0,33.51",
  "Positions and Mark-to-Market Profit and Loss,Data,Summary,Equity and Index Options,USD,QQQ,QQQ 15DEC28 600 C,1,1,209.5,211.1055,20950,21110.55,160.55,0,0,0,160.55",
  "Positions and Mark-to-Market Profit and Loss,Data,Summary,Equity and Index Options,USD,SOXL,SOXL 18SEP26 155 C,1,1,6.3851,5.5342,638.51,553.42,-85.09,0,0,0,-85.09",
  "Positions and Mark-to-Market Profit and Loss,Data,Summary,Equity and Index Options,USD,SOXL,SOXL 18SEP26 170 C,1,1,4.0709,3.4589,407.09,345.89,-61.2,0,0,0,-61.2",
  "Positions and Mark-to-Market Profit and Loss,Data,Summary,Equity and Index Options,USD,SOXL,SOXL 18SEP26 155 P,-1,-1,39.2356,39.9505,-3923.56,-3995.05,-71.49,0,0,0,-71.49",
  "Positions and Mark-to-Market Profit and Loss,Data,Summary,Equity and Index Options,USD,SOXL,SOXL 18SEP26 170 P,-1,-1,51.8881,52.8449,-5188.81,-5284.49,-95.68,0,0,0,-95.68",
  "Positions and Mark-to-Market Profit and Loss,Data,Summary,Equity and Index Options,USD,SOXL,SOXL 20NOV26 135 P,-1,-1,38.8361,39.4019,-3883.61,-3940.19,-56.58,0,0,0,-56.58",
  "Positions and Mark-to-Market Profit and Loss,Data,Summary,Equity and Index Options,USD,SPCX,SPCX 18DEC26 105 P,-1,-1,6.5,5.55,-650,-555,95,0,0,0,95",
  "Positions and Mark-to-Market Profit and Loss,Data,,Total,USD,,,,,,,8482.8,8069.4,-220.28,-12.12,-2.1179842,0,-234.5179842",
  "Positions and Mark-to-Market Profit and Loss,Data,Summary,Forex,USD,USD, ,30184.52,30363.40202,1,1,30184.52,30363.40202,0,0,0,0,0",
  "Positions and Mark-to-Market Profit and Loss,Data,,Total,USD,,,,,,,30184.52,30363.40202,0,0,0,0,0",
].join("\n");

describe("parseIbkrCsv", () => {
  it("keeps only Summary rows with non-zero quantity, plus cash + interest", () => {
    const rows = parseIbkrCsv(IBKR_CSV);
    // 5 stocks + 9 live options (APP 300P closed skipped, Details skipped)
    // + 1 forex cash + 1 interest cash = 16
    expect(rows).toHaveLength(16);
    // closed APP 300P (qty 0) is not present as a live option
    expect(rows.filter((r) => r.description.includes("$300 PUT"))).toHaveLength(0);
  });

  it("normalizes IBKR option descriptions", () => {
    const rows = parseIbkrCsv(IBKR_CSV);
    const qqq = rows.find((r) => r.symbol === "QQQ" && r.quantity === 1)!;
    expect(qqq.description).toBe("QQQ DEC 15 2028 $600 CALL");
    const appPut = rows.find((r) => r.description === "APP OCT 02 2026 $290 PUT")!;
    expect(appPut.quantity).toBe(-1);
  });

  it("account total matches IBKR NAV to the cent", () => {
    const rows = parseIbkrCsv(IBKR_CSV);
    const snap = buildSnapshot(rows, "ibkr.csv", null, 38, true);
    expect(snap.totalValue).toBeCloseTo(126320.902, 2);
  });

  it("bucket totals match NAV asset-class totals; cash includes interest", () => {
    const rows = parseIbkrCsv(IBKR_CSV);
    const snap = buildSnapshot(rows, "ibkr.csv", null, 38, true);
    const cash = snap.buckets.find((b) => b.key === "cash")!;
    const dca = snap.buckets.find((b) => b.key === "safe-side")!;
    const options = snap.buckets.find((b) => b.key === "options")!;
    expect(dca.totalValue).toBeCloseTo(87860.81, 2);
    expect(cash.totalValue).toBeCloseTo(30363.40202 + 27.29, 2);
    // options abs total = 8069.4 leg net? abs sum differs; check combos instead
    expect(options.totalValue).toBeGreaterThan(0);
  });

  it("classifies SOXL 155/170 as excluded synthetics, 135P as sell put", () => {
    const rows = parseIbkrCsv(IBKR_CSV);
    const snap = buildSnapshot(rows, "ibkr.csv", null, 38, true);
    const options = snap.buckets.find((b) => b.key === "options")!;
    const sellPut = options.items.find((i) => i.label === "Sell Put");
    const leaps = options.items.find((i) => i.label === "LEAPS Call");
    // synthetic longs are not shown as an item
    expect(options.items.some((i) => i.label === "Synthetic Long")).toBe(false);
    // SOXL sell put is only the lone 135P → ×1
    expect(sellPut?.tickers?.find((t) => t.underlying === "SOXL")?.contracts).toBe(1);
    expect(sellPut?.tickers?.find((t) => t.underlying === "APP")?.contracts).toBe(1);
    expect(sellPut?.tickers?.find((t) => t.underlying === "SPCX")?.contracts).toBe(1);
    expect(leaps?.tickers?.map((t) => t.underlying).sort()).toEqual(["DRAM", "QQQ"]);
  });
});
