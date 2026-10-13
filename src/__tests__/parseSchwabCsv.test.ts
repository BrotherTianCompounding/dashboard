import { parseSchwabCsv } from "../lib/parseSchwabCsv";
import { parseDateFromFilename } from "../lib/parseFidelityCsv";
import { buildSnapshot } from "../lib/buildSnapshot";

const header = '"Symbol","Description","Qty (Quantity)","Price","Mkt Val (Market Value)","Cost Basis","Gain $ (Gain/Loss $)","Asset Type",';
const fixture = [
  '"Positions for account Individual as of 09:12 PM ET, 2026/10/12"',
  "",
  header,
  '"GOOGL","ALPHABET INC CLASS A","20","353.30","$7,066.00","$6,998.70","$67.30","Equity",',
  '"GOOGL 12/15/2028 320.00 C","CALL ALPHABET INC $320 EXP 12/15/28","1","105.50","$10,550.00","$12,675.66","-$2,125.66","Option",',
  '"Cash & Cash Investments","--","--","--","$44,438.27","--","--","Cash and Money Market",',
  '"Positions Total","","--","--","$62,054.27","--","--","--",',
].join("\n");

describe("Schwab positions import", () => {
  it("skips the preamble and total, preserves cash and fractional quantities", () => {
    const rows = parseSchwabCsv("\uFEFF" + fixture);
    expect(rows).toHaveLength(3);
    expect(rows[1].description).toBe("GOOGL DEC 15 2028 $320 CALL");
    expect(rows[1].contractMultiplier).toBe(100);
    expect(rows[1].totalGainLossDollar).toBe(-2125.66);
    expect(rows[2].symbol).toBe("CASH");
    expect(rows.reduce((sum, r) => sum + r.currentValue, 0)).toBeCloseTo(62054.27);
    const fractional = parseSchwabCsv(header + '\n"VOO","VANGUARD","8.1074","714.44","$5,792.25","$4,518.53","$1,273.72","ETFs & Closed End Funds",');
    expect(fractional[0].quantity).toBe(8.1074);
  });

  it("feeds cash, LEAPS and account ranking into the existing dashboard", () => {
    const date = parseDateFromFilename("Individual-Positions-2026-10-12-211207.csv");
    expect(date).toEqual(new Date(2026, 9, 12));
    const snapshot = buildSnapshot(parseSchwabCsv(fixture), "positions.csv", date, 25, true);
    expect(snapshot.totalValue).toBeCloseTo(62054.27);
    expect(snapshot.buckets.find((b) => b.key === "cash")!.totalValue).toBe(44438.27);
    expect(snapshot.buckets.find((b) => b.key === "options")!.optionRisk!.bars.find((b) => b.key === "leaps-call")!.currentValue).toBe(10550);
    expect(snapshot.deltaExposures.find((r) => r.symbol === "GOOGL")!.deltaDollarExposure).toBeCloseTo(17616);
  });

  it("preserves negative short-put quantities and signed market values", () => {
    const rows = parseSchwabCsv(header + '\n"QQQ 01/15/2027 600.00 P","PUT INVESCO","-2","5.00","-$1,000.00","--","--","Option",');
    expect(rows[0].description).toBe("QQQ JAN 15 2027 $600 PUT");
    expect(rows[0].quantity).toBe(-2);
    expect(rows[0].currentValue).toBe(-1000);
    const snapshot = buildSnapshot(rows, "positions.csv", new Date(2026, 9, 12), 25, true);
    expect(snapshot.deltaExposures[0].optionExposure).toBe(120000);
  });

  it("rejects unrelated files instead of importing an empty account", () => {
    expect(() => parseSchwabCsv("Symbol,Value\nAAPL,100")).toThrow();
  });
});
