import { describe, it, expect } from "vitest";
import {
  addDays,
  weekStart,
  dollarsToCents,
  payCsv,
  payTotal,
  type PayReport,
  jobCommandSchema,
} from "./jobs";
const report: PayReport = {
  week_start: "2026-10-26",
  week_id: null,
  locked: false,
  locked_at: null,
  locked_by: null,
  revision: "a".repeat(32),
  rows: [
    {
      job_id: "10000000-0000-4000-8000-000000000001",
      vehicle_id: "10000000-0000-4000-8000-000000000002",
      stock_number: "K-10",
      title: '=HYPERLINK("bad")',
      tech_id: "10000000-0000-4000-8000-000000000003",
      tech_name: "A, B",
      book_hours: 1.25,
      completed_date: "2026-10-28",
      rate_cents: 3000,
      rate_date: "2026-01-01",
      is_comeback: false,
      original_job_id: null,
      original_tech_id: null,
      original_tech_name: null,
      comeback_parts_cents: 0,
      override_cents: null,
      override_reason: null,
      pay_cents: 3750,
    },
  ],
};
describe("pay calendar and export", () => {
  it("uses Monday weeks across month and DST boundaries", () => {
    expect(weekStart("2026-11-01")).toBe("2026-10-26");
    expect(weekStart("2026-11-02")).toBe("2026-11-02");
    expect(addDays("2026-10-26", 7)).toBe("2026-11-02");
  });
  it("parses dollars into integer cents without float rounding", () => {
    expect(dollarsToCents("19.99")).toBe(1999);
    expect(dollarsToCents("0.1")).toBe(10);
    expect(() => dollarsToCents("1.005")).toThrow();
    expect(() => dollarsToCents("-1")).toThrow();
  });
  it("does not silently count a missing rate as zero pay", () => {
    expect(payTotal(report.rows)).toBe(3750);
    expect(payTotal([{ ...report.rows[0], pay_cents: null }])).toBeNull();
  });
  it("quotes CSV and neutralizes spreadsheet formulas", () => {
    const csv = payCsv(report);
    expect(csv).toContain('"A, B"');
    expect(csv).toContain('"\'=HYPERLINK(""bad"")"');
    expect(csv).toContain('"37.50"');
    expect(csv.endsWith("\r\n")).toBe(true);
  });
  it("labels locked exports without recalculating their amounts", () => {
    const csv = payCsv({ ...report, locked: true });
    expect(csv).toContain('"Locked"');
    expect(csv).toContain('"37.50"');
  });
  it("requires explicit part decisions and valid revisions", () => {
    expect(
      jobCommandSchema.safeParse({
        command: "done",
        job_id: report.rows[0].job_id,
        actor_id: report.rows[0].tech_id,
        revision: "stale",
        completed_date: "2026-11-04",
        parts: {},
      }).success,
    ).toBe(false);
  });
});
