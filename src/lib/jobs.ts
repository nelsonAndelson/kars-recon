import { z } from "zod";
import { shopDate } from "./vehicles";
import { partNetCents, totalCents } from "./money";
import type { Json, Tables } from "@/types/database";

export const JOB_CATEGORIES = [
  "mechanical",
  "electrical",
  "body",
  "tires",
  "brakes",
  "detail",
  "other",
] as const;
export const jobFields = z.object({
  title: z.string().trim().min(1, "Enter a job title.").max(160),
  category: z.enum(JOB_CATEGORIES),
  book_hours: z
    .string()
    .regex(/^\d{1,4}(\.\d{1,2})?$/, "Hours must have at most two decimals."),
  tech_id: z.union([z.uuid(), z.literal("")]),
  notes: z.string().trim().max(4000).default(""),
});
const actor = z.uuid("Select a team member under Working as.");
const version = z.string().regex(/^[a-f0-9]{32}$/);
const jobRef = z.object({
  job_id: z.uuid(),
  revision: version,
  actor_id: actor,
});
export const jobCommandSchema = z.discriminatedUnion("command", [
  z.object({
    command: z.literal("create"),
    actor_id: actor,
    id: z.uuid(),
    vehicle_id: z.uuid(),
    ...jobFields.shape,
    is_comeback: z.boolean(),
    original_job_id: z.union([z.uuid(), z.literal("")]),
  }),
  z.object({ command: z.literal("edit"), ...jobRef.shape, ...jobFields.shape }),
  z.object({ command: z.enum(["start", "cancel", "reopen"]), ...jobRef.shape }),
  z.object({
    command: z.literal("done"),
    ...jobRef.shape,
    completed_date: z.iso.date(),
    parts: z.record(z.uuid(), z.enum(["used", "unused"])),
  }),
  z.object({
    command: z.literal("need_part"),
    ...jobRef.shape,
    note: z.string().trim().min(1, "Describe the part needed.").max(1000),
  }),
]);
export const payCommandSchema = z.discriminatedUnion("command", [
  z.object({
    command: z.literal("rate"),
    actor_id: actor,
    tech_id: z.uuid(),
    rate_cents: z.number().int().min(0).max(1000000),
    effective_from: z.iso.date(),
  }),
  z.object({
    command: z.literal("override"),
    ...jobRef.shape,
    expected_override: z.unknown(),
    amount_cents: z.number().int().min(0).max(1000000000),
    reason: z.string().trim().min(1, "Explain this pay exception.").max(1000),
  }),
  z.object({
    command: z.literal("lock"),
    actor_id: actor,
    week_start: z.iso.date(),
    revision: version,
  }),
]);
export function dollarsToCents(value: string) {
  if (!/^\d{1,8}(\.\d{1,2})?$/.test(value))
    throw new Error("Enter dollars with at most two decimals.");
  const [whole, fraction = ""] = value.split(".");
  return Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
}
export function weekStart(date = shopDate()) {
  const parsed = z.iso.date().parse(date),
    day = new Date(`${parsed}T12:00:00Z`);
  day.setUTCDate(day.getUTCDate() - ((day.getUTCDay() + 6) % 7));
  return day.toISOString().slice(0, 10);
}
export function addDays(date: string, count: number) {
  const day = new Date(`${z.iso.date().parse(date)}T12:00:00Z`);
  day.setUTCDate(day.getUTCDate() + count);
  return day.toISOString().slice(0, 10);
}
export function dateLabel(date: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${date}T12:00:00Z`));
}
export type WorkJob = Tables<"jobs"> & {
  revision: string;
  override: Json | null;
};
export type WorkData = {
  jobs: WorkJob[];
  vehicles: Tables<"vehicles">[];
  profiles: Tables<"profiles">[];
  parts: Tables<"parts">[];
  rates: Tables<"tech_pay_rates">[];
  weeks: Tables<"pay_weeks">[];
};
const cents = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER);
export const payRowSchema = z.object({
  job_id: z.uuid(),
  vehicle_id: z.uuid(),
  stock_number: z.string(),
  title: z.string(),
  tech_id: z.uuid(),
  tech_name: z.string(),
  book_hours: z.number().nonnegative(),
  completed_date: z.iso.date(),
  rate_cents: cents.nullable(),
  rate_date: z.iso.date().nullable(),
  is_comeback: z.boolean(),
  original_job_id: z.uuid().nullable(),
  original_tech_id: z.uuid().nullable(),
  original_tech_name: z.string().nullable(),
  comeback_parts_cents: cents,
  override_cents: cents.nullable(),
  override_reason: z.string().nullable(),
  pay_cents: cents.nullable(),
});
export const payReportSchema = z.object({
  week_start: z.iso.date(),
  week_id: z.uuid().nullable(),
  locked: z.boolean(),
  locked_at: z.string().nullable(),
  locked_by: z.uuid().nullable(),
  rows: z.array(payRowSchema),
  revision: version,
});
export type PayRow = z.infer<typeof payRowSchema>;
export type PayReport = z.infer<typeof payReportSchema>;
export function payTotal(rows: PayRow[]) {
  return rows.some((r) => r.pay_cents === null)
    ? null
    : totalCents(rows.map((r) => r.pay_cents!));
}
export function comebackTotals(data: WorkData, techId: string) {
  const originalIds = new Set(
    data.jobs.filter((j) => j.tech_id === techId).map((j) => j.id),
  );
  const jobs = data.jobs.filter(
    (j) =>
      j.is_comeback &&
      j.status !== "cancelled" &&
      j.original_job_id &&
      originalIds.has(j.original_job_id),
  );
  const ids = new Set(jobs.map((j) => j.id));
  return {
    count: jobs.length,
    cost: totalCents(
      data.parts.filter((p) => p.job_id && ids.has(p.job_id)).map(partNetCents),
    ),
  };
}
function csvCell(value: unknown) {
  let text = value === null || value === undefined ? "" : String(value);
  if (/^[\s]*[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return `"${text.replaceAll('"', '""')}"`;
}
export function payCsv(report: PayReport) {
  const header = [
    "Week starting",
    "State",
    "Technician",
    "Stock number",
    "Job",
    "Completed",
    "Book hours",
    "Rate USD",
    "Pay USD",
    "Comeback",
    "Original technician",
    "Comeback parts USD",
    "Override reason",
  ];
  const rows = report.rows.map((r) => [
    report.week_start,
    report.locked ? "Locked" : "Live",
    r.tech_name,
    r.stock_number,
    r.title,
    r.completed_date,
    r.book_hours.toFixed(2),
    r.rate_cents === null ? "" : (r.rate_cents / 100).toFixed(2),
    r.pay_cents === null ? "MISSING RATE" : (r.pay_cents / 100).toFixed(2),
    r.is_comeback ? "Yes" : "No",
    r.original_tech_name ?? "",
    (r.comeback_parts_cents / 100).toFixed(2),
    r.override_reason ?? "",
  ]);
  return (
    "\uFEFF" +
    [header, ...rows].map((row) => row.map(csvCell).join(",")).join("\r\n") +
    "\r\n"
  );
}
