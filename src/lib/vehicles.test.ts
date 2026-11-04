import { describe, it, expect } from "vitest";
import {
  ageState,
  shopDate,
  purchaseAge,
  vinSchema,
  blockerSchema,
  vehicleSchema,
} from "./vehicles";
import { parseVinResponse } from "./vin";
describe("vehicle validation and timing", () => {
  it("uses the Cleveland date at the UTC midnight boundary", () =>
    expect(shopDate(new Date("2026-11-04T02:00:00Z"))).toBe("2026-11-03"));
  it("counts calendar days across daylight saving", () =>
    expect(purchaseAge("2026-10-31", "2026-11-02T18:00:00Z")).toBe(2));
  it.each([
    [0.79, 1, "normal"],
    [0.8, 1, "warning"],
    [1, 1, "warning"],
    [1.01, 1, "over"],
  ] as const)("age %s target %s", (days, target, state) =>
    expect(ageState(days, target)).toBe(state),
  );
  it("normalizes VINs and rejects disallowed letters", () => {
    expect(vinSchema.parse(" 1hgcm82633a004352 ")).toBe("1HGCM82633A004352");
    expect(vinSchema.safeParse("1IGCM82633A004352").success).toBe(false);
  });
  it("requires notes for other blockers", () =>
    expect(
      blockerSchema.safeParse({
        vehicle_id: "20000000-0000-4000-8000-000000000001",
        actor_id: "",
        blocker: "other",
        note: "",
      }).success,
    ).toBe(false));
  it("rejects impossible calendar dates", () =>
    expect(
      vehicleSchema.shape.purchase_date.safeParse("2026-02-30").success,
    ).toBe(false));
  it("parses NHTSA response and surfaces partial decode warnings", () => {
    expect(
      parseVinResponse({
        Results: [
          { Make: "HONDA", Model: "Accord", ModelYear: "2003", ErrorCode: "0" },
        ],
      }).warning,
    ).toBeNull();
    expect(
      parseVinResponse({
        Results: [
          {
            Make: "HONDA",
            Model: "Accord",
            ModelYear: "2003",
            ErrorCode: "1,14",
          },
        ],
      }).warning,
    ).toContain("warning");
    expect(() =>
      parseVinResponse({ Results: [{ Make: "", Model: "", ModelYear: "" }] }),
    ).toThrow(/manually/);
  });
});
