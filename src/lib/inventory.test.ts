import { describe, it, expect } from "vitest";
import { parseInventory, fileDate } from "./inventory";
const header =
  "AccountID,VIN,Year,Make,Model,Odometer,PhotoURLs,Trim,ExteriorColor\n";
const row =
  '28126551,1FTFW1EF5EKF48812,2014,Ford,F150,162024,"https://imagesdl.dealercenter.net/a.jpg,https://imagesdl.dealercenter.net/b.jpg","STX, pickup",Blue\n';
describe("DealerCenter CSV", () => {
  it("parses quoted commas, photos and mileage", () => {
    const result = parseInventory(header + row);
    expect(result[0]).toMatchObject({
      trim: "STX, pickup",
      advertised_mileage: 162024,
    });
    expect(result[0].photos).toHaveLength(2);
  });
  it.each([
    header,
    header + row.replace("28126551", "16936663"),
    header + row.replace("162024", "-2"),
    header + row.replace("1FTFW1EF5EKF48812", "bad"),
    header + row.replace("2014", "abc"),
    header + row.replace("imagesdl.dealercenter.net", "evil.example"),
    header + row.replace('"STX, pickup"', '"unterminated'),
  ])("rejects empty, invalid or partial input", (csv) =>
    expect(() => parseInventory(csv)).toThrow(),
  );
  it("preserves duplicates for conflict review", () =>
    expect(parseInventory(header + row + row)).toHaveLength(2));
  it("does not confuse account suffixes or impossible dates", () => {
    expect(fileDate("DealerCenter_20261104_28126551.csv")).toBe("2026-11-04");
    expect(fileDate("DealerCenter_20261104_16936663.csv")).toBeNull();
    expect(fileDate("DealerCenter_20260231_28126551.csv")).toBeNull();
  });
});
