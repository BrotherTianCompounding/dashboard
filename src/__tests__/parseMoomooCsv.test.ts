import { parseMoomooCsv } from "../lib/parseMoomooCsv";
import { parseDateFromFilename } from "../lib/parseFidelityCsv";
import { buildSnapshot } from "../lib/buildSnapshot";

const HEADER =
  '"Symbol","Name","Quantity","Current price","Diluted Cost","Market Value","P/L Ratio","P/L","Today\'s P/L","% of Portfolio","Today\'s Turnover","Today\'s Purchase@Avg Price","Today\'s Sales@Avg Price","Currency","Initial Margin","Delta","Gamma (options only)","Vega (options only)","Theta (options only)","Rho (options only)","IV (options only)","Intrinsic Value (options only)","Extrinsic Value (options only)"';

const MOOMOO_CSV = [
  HEADER,
  '"RAM","Roundhill T-REX 2X Long DRAM Daily Target ETF","11","13.150","20.677","144.65","-36.40%","-82.80","0.00","5.11%","0.00","--","--","USD","--","11.00","--","--","--","--","--","--","--"',
  '"SOFI260925C21","SOFI Covered Stock","1","18.435","25.45","1,843.50","-27.56%","-701.50","0.00","65.07%","0.00","--","--","USD","--","71.7888","-11.528","-1.9133","1.5695","-0.4359","--","--","--"',
  '"SOFI","SoFi Technologies","100","18.910","26.00","1,891.00","-27.27%","-709.00","0.00","66.74%","0.00","--","--","USD","--","100.00","--","--","--","--","--","--","--"',
  '"SOFI260925C21000","SOFI 260925 21.00C","-1","0.48","0.55","-47.50","+13.64%","+7.50","0.00","-1.68%","0.00","--","--","USD","--","-28.2112","-11.528","-1.9133","1.5695","-0.4359","0.5174","0.00","0.47"',
  '"SOFI280121C20/260925C21","SOFI Diagonal Spread","1","4.861","12.35","486.09","-60.64%","-748.91","0.00","17.16%","0.00","--","--","USD","--","36.0187","-8.8357","6.4777","0.9961","9.0963","--","--","--"',
  '"SOFI280121C20000","SOFI 280121 20.00C","1","5.34","12.90","533.59","-58.64%","-756.41","0.00","18.83%","0.00","--","--","USD","--","64.2299","2.6923","8.391","-0.5734","9.5322","0.6167","0.00","5.39"',
  '"SOFI260925C21000","SOFI 260925 21.00C","-1","0.48","0.55","-47.50","+13.64%","+7.50","0.00","-1.68%","0.00","--","--","USD","--","-28.2112","-11.528","-1.9133","1.5695","-0.4359","0.5174","0.00","0.47"',
].join("\n");

describe("parseMoomooCsv", () => {
  it("keeps only real legs, skips strategy summary rows", () => {
    const rows = parseMoomooCsv(MOOMOO_CSV);
    // RAM, SOFI stock, two short calls, one long call = 5 legs.
    // "SOFI Covered Stock" and "SOFI Diagonal Spread" summary rows dropped.
    expect(rows).toHaveLength(5);
    expect(rows.some((r) => r.description.includes("Covered Stock"))).toBe(false);
    expect(rows.some((r) => r.symbol.includes("/"))).toBe(false);
  });

  it("parses stock rows with total cost basis = market value − P/L", () => {
    const rows = parseMoomooCsv(MOOMOO_CSV);
    const ram = rows.find((r) => r.symbol === "RAM")!;
    expect(ram.quantity).toBe(11);
    expect(ram.currentValue).toBeCloseTo(144.65);
    expect(ram.costBasisTotal).toBeCloseTo(227.45); // 144.65 − (−82.80)
    expect(ram.description).toBe("Roundhill T-REX 2X Long DRAM Daily Target ETF");
  });

  it("normalizes option legs into Fidelity-style descriptions", () => {
    const rows = parseMoomooCsv(MOOMOO_CSV);
    const longCall = rows.find((r) => r.symbol === "SOFI280121C20000")!;
    expect(longCall.description).toBe("SOFI JAN 21 2028 $20 CALL");
    expect(longCall.quantity).toBe(1);
    expect(longCall.currentValue).toBeCloseTo(533.59);
    expect(longCall.costBasisTotal).toBeCloseTo(1290); // 533.59 + 756.41

    const shortCalls = rows.filter((r) => r.symbol === "SOFI260925C21000");
    expect(shortCalls).toHaveLength(2);
    expect(shortCalls[0].description).toBe("SOFI SEP 25 2026 $21 CALL");
    expect(shortCalls[0].quantity).toBe(-1);
  });

  it("feeds cleanly into buildSnapshot (downstream logic unchanged)", () => {
    const rows = parseMoomooCsv(MOOMOO_CSV);
    const snap = buildSnapshot(rows, "moomoo.csv", null, 38, true);
    const options = snap.buckets.find((b) => b.key === "options")!;
    // two short SOFI calls → Sell Call ×2; one long call → LEAPS ×1
    const sellCall = options.items.find((i) => i.label === "Sell Call");
    const leaps = options.items.find((i) => i.label === "LEAPS Call");
    expect(sellCall?.tickers?.find((t) => t.underlying === "SOFI")?.contracts).toBe(2);
    expect(leaps?.tickers?.find((t) => t.underlying === "SOFI")?.contracts).toBe(1);
    // SOFI + RAM stock → safe-side bucket
    const dca = snap.buckets.find((b) => b.key === "safe-side")!;
    expect(dca.items.map((i) => i.label).sort()).toEqual(["RAM", "SOFI"]);
  });
});

describe("parseDateFromFilename — moomoo compact date", () => {
  it("parses ...-20260823-211241.csv as 2026-08-23", () => {
    const d = parseDateFromFilename("Positions-Margin Account(9592)-20260823-211241.csv");
    expect(d).toEqual(new Date(2026, 7, 23));
  });
});
