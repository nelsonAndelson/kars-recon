import { describe, expect, it } from "vitest";
import {
  budgetState,
  effectiveRate,
  formatMoney,
  hoursToHundredths,
  laborCents,
  partNetCents,
  totalCents,
} from "./money";
describe("integer money and pay", () => {
  it.each([
    ["1.25", 2500, 3125],
    ["0.01", 1050, 11],
    ["0.01", 1049, 10],
    ["0", 2500, 0],
    ["8.50", 3200, 27200],
  ])("pays %s hours at %i cents", (hours, rate, result) =>
    expect(laborCents(hours, rate)).toBe(result),
  );
  it("pays zero for comebacks", () =>
    expect(laborCents("3.25", 3200, true)).toBe(0));
  it.each(["-1", "NaN", "1.001", "1e2", "10000", ".5", ""])(
    "rejects invalid hours %s",
    (value) => expect(() => hoursToHundredths(value)).toThrow(),
  );
  it("accepts the numeric(6,2) upper bound", () =>
    expect(hoursToHundredths("9999.99")).toBe(999999n));
  it("handles line quantity, returns and core refunds", () =>
    expect(
      partNetCents({
        qty: 2,
        unit_cost_cents: 10099,
        core_charge_cents: 5000,
        refund_cents: 10099,
        core_refund_cents: 5000,
      }),
    ).toBe(10099));
  it("rejects refunds above the charged total", () =>
    expect(() =>
      partNetCents({
        qty: 1,
        unit_cost_cents: 100,
        core_charge_cents: 0,
        refund_cents: 101,
        core_refund_cents: 0,
      }),
    ).toThrow());
  it("sums cents exactly", () =>
    expect(totalCents([10, 20, 79970])).toBe(80000));
  it("rejects fractional cents and overflow", () => {
    expect(() => totalCents([1.1])).toThrow();
    expect(() => totalCents([Number.MAX_SAFE_INTEGER, 1])).toThrow();
  });
  it("formats cents without floating point division", () =>
    expect(formatMoney(120001)).toBe("$1,200.01"));
  it.each([
    [63999, 80000, "normal"],
    [64000, 80000, "warning"],
    [80000, 80000, "warning"],
    [80001, 80000, "over"],
    [0, 0, "normal"],
    [1, 0, "over"],
  ] as const)("budget boundary %i/%i", (spent, budget, result) =>
    expect(budgetState(spent, budget)).toBe(result),
  );
  it("uses the rate effective on the completion date", () => {
    const rates = [
      { effective_from: "2026-01-01", rate_cents_per_hour: 2500 },
      { effective_from: "2026-03-02", rate_cents_per_hour: 3000 },
    ];
    expect(effectiveRate(rates, "2026-03-01")).toBe(2500);
    expect(effectiveRate(rates, "2026-03-02")).toBe(3000);
    expect(() => effectiveRate(rates, "2025-12-31")).toThrow();
  });
});
