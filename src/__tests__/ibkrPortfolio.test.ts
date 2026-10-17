import { parseIbkrCsv } from "../lib/parseIbkrCsv";
import { buildSnapshot } from "../lib/buildSnapshot";
const csv = [
  "Portfolio",
  "Account,Financial Instrument Description,Exchange,Position,Currency,Market Price,Market Value,Average Price,Unrealized P&L,Realized P&L,Liquidate Last,Security Type,Delta Dollars",
  "DEMO,XYZ,TEST,4,USD,25,100,20,20,0,No,STK,100",
  "DEMO,XYZ DEC2028 20 C [XYZ  281215C00020000 100],TEST,2,USD,3,600,2,200,0,No,OPT,800",
  "DEMO,XYZ DEC2028 20 P [XYZ  281215P00020000 100],TEST,-1,USD,1,-100,2,100,0,No,OPT,100",
  "",
  "Cash Balances",
  "AUD,,30,AUD",
  "USD,,500,USD",
  "Total (in USD),,520,USD",
].join("\n");
describe("IBKR Portfolio export", () => {
  it("supports preamble, exact OCC expiry, signed positions and converted cash", () => {
    const rows = parseIbkrCsv(csv);
    expect(rows).toHaveLength(4);
    expect(rows[1].description).toBe("XYZ DEC 15 2028 $20 CALL");
    expect(rows[1].quantity).toBe(2);
    expect(rows[1].costBasisTotal).toBe(400);
    expect(rows[2].description).toBe("XYZ DEC 15 2028 $20 PUT");
    expect(rows[2].currentValue).toBe(-100);
    const snapshot = buildSnapshot(rows, "portfolio.20261016.csv", new Date(2026, 9, 16), 39, true);
    expect(snapshot.totalValue).toBe(1120);
    expect(snapshot.buckets.find((b) => b.key === "cash")!.totalValue).toBe(520);
    expect(snapshot.buckets.find((b) => b.key === "safe-side")!.totalValue).toBe(100);
  });
  it("uses USD cash when there is no converted total or foreign cash", () => {
    const usd = csv.replace("AUD,,30,AUD\n", "").replace("Total (in USD),,520,USD", "");
    expect(parseIbkrCsv(usd).find((r) => r.symbol === "CASH")!.currentValue).toBe(500);
  });
  it("does not silently add unconverted foreign cash", () => {
    expect(() => parseIbkrCsv(csv.replace("Total (in USD),,520,USD", ""))).toThrow("Total (in USD)");
  });
  it("rejects non-USD security values rather than labeling them USD", () => {
    expect(() => parseIbkrCsv(csv.replace("4,USD,25", "4,AUD,25"))).toThrow("非美元");
  });
  it("rejects options without exact contract codes", () => {
    expect(() => parseIbkrCsv(csv.replace(" [XYZ  281215C00020000 100]", ""))).toThrow("合约代码");
  });
});
