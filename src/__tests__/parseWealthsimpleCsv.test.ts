import { parseWealthsimpleCsv } from "../lib/parseWealthsimpleCsv";
import { parseDateFromFilename } from "../lib/parseFidelityCsv";
import { buildSnapshot } from "../lib/buildSnapshot";

const HEADER =
  "Account Name,Account Type,Account Classification,Account Number,Symbol,Exchange,MIC,Name,Security Type,Quantity,Position Direction,Market Price,Market Price Currency,Book Value (CAD),Book Value Currency (CAD),Book Value (Market),Book Value Currency (Market),Market Value,Market Value Currency,Market Unrealized Returns,Market Unrealized Returns Currency";

// USD cash row makes the derived USD→CAD rate exactly 1.40 (1400 / 1000).
const WS_CSV = [
  HEADER,
  '"Acct","Joint","Trade","X","AAPL","NASDAQ","XNAS","Apple Inc","EQUITY","10","LONG","100","USD","1120","CAD","800","USD","1000","USD","200","USD"',
  '"Acct","Joint","Trade","X","ATRL","TSX","XTSE","AtkinsRealis","EQUITY","10","LONG","140","CAD","1400","CAD","1400","CAD","1400","CAD","0","CAD"',
  '"Acct","Joint","Trade","X","AAPL  280121C00260000","NASDAQ","XNAS","","OPTION","1","LONG","80.475","USD","10447","CAD","7455","USD","8047.5","USD","592.5","USD"',
  '"Acct","Joint","Trade","X","APP   260925P00370000","NASDAQ","XNAS","","OPTION","-1","SHORT","69.25","USD","-7798","CAD","-5594","USD","-6925","USD","-1331","USD"',
  '"Acct","Joint","Trade","X","USD","","","USD","CURRENCY","1000","LONG","1","USD","1400","CAD","1000","USD","1000","USD","0","USD"',
  '"Acct","Joint","Trade","X","CAD","","","CAD","CURRENCY","140","LONG","1","CAD","140","CAD","140","CAD","140","CAD","0","CAD"',
].join("\n");

describe("parseWealthsimpleCsv", () => {
  it("keeps all real rows (equity, option, cash)", () => {
    expect(parseWealthsimpleCsv(WS_CSV)).toHaveLength(6);
  });

  it("leaves USD values as-is and converts CAD values to USD at the derived rate", () => {
    const rows = parseWealthsimpleCsv(WS_CSV);
    const aapl = rows.find((r) => r.symbol === "AAPL" && r.description === "Apple Inc")!;
    expect(aapl.currentValue).toBeCloseTo(1000); // USD, unchanged
    const atrl = rows.find((r) => r.symbol === "ATRL")!;
    expect(atrl.currentValue).toBeCloseTo(1000); // 1400 CAD / 1.40
    expect(atrl.costBasisTotal).toBeCloseTo(1000);
  });

  it("maps currency rows to normalized cash and converts CAD cash to USD", () => {
    const rows = parseWealthsimpleCsv(WS_CSV);
    const cash = rows.filter((r) => r.symbol === "CASH");
    expect(cash).toHaveLength(2);
    const usdCash = cash.find((r) => r.description === "Cash (USD)")!;
    const cadCash = cash.find((r) => r.description === "Cash (CAD)")!;
    expect(usdCash.currentValue).toBeCloseTo(1000);
    expect(cadCash.currentValue).toBeCloseTo(100); // 140 CAD / 1.40
  });

  it("normalizes option OCC symbols to Fidelity-style descriptions with signed qty", () => {
    const rows = parseWealthsimpleCsv(WS_CSV);
    const longCall = rows.find((r) => r.symbol === "AAPL  280121C00260000")!;
    expect(longCall.description).toBe("AAPL JAN 21 2028 $260 CALL");
    expect(longCall.quantity).toBe(1);
    expect(longCall.currentValue).toBeCloseTo(8047.5);

    const shortPut = rows.find((r) => r.symbol === "APP   260925P00370000")!;
    expect(shortPut.description).toBe("APP SEP 25 2026 $370 PUT");
    expect(shortPut.quantity).toBe(-1);
  });

  it("feeds cleanly into buildSnapshot", () => {
    const rows = parseWealthsimpleCsv(WS_CSV);
    const snap = buildSnapshot(rows, "holdings-report-2026-08-24_wealthsimple.csv", null, 38, true);
    const cash = snap.buckets.find((b) => b.key === "cash")!;
    expect(cash.totalValue).toBeCloseTo(1100); // 1000 USD + 100 (CAD→USD)
    const dca = snap.buckets.find((b) => b.key === "safe-side")!;
    expect(dca.totalValue).toBeCloseTo(2000); // AAPL 1000 + ATRL 1000
    const options = snap.buckets.find((b) => b.key === "options")!;
    const leaps = options.items.find((i) => i.label === "LEAPS Call");
    const sellPut = options.items.find((i) => i.label === "Sell Put");
    expect(leaps?.tickers?.find((t) => t.underlying === "AAPL")?.contracts).toBe(1);
    expect(sellPut?.tickers?.find((t) => t.underlying === "APP")?.contracts).toBe(1);
  });
});

describe("parseDateFromFilename — wealthsimple", () => {
  it("parses holdings-report-2026-08-24_wealthsimple.csv", () => {
    const d = parseDateFromFilename("holdings-report-2026-08-24_wealthsimple.csv");
    expect(d).toEqual(new Date(2026, 7, 24));
  });
});
