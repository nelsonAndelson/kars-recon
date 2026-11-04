import { z } from "zod";
import { BLOCKERS, STAGES, SHOP_TIMEZONE } from "./domain";
import type { Json, Tables } from "@/types/database";

export const SOURCES = [
  "ACV",
  "Manheim",
  "Skipco",
  "Akron Auto",
  "other",
] as const;
export const CHECKLIST = [
  { id: "fluids", label: "Fluids & visible leaks" },
  { id: "tires", label: "Tires & wheels" },
  { id: "warning_lights", label: "Warning lights & starting" },
  { id: "body", label: "Body & interior condition" },
] as const;
export const BLOCKER_LABELS = {
  waiting_parts: "Waiting on parts",
  waiting_approval: "Waiting for approval",
  waiting_diagnosis: "Waiting for diagnosis",
  at_sublet: "At sublet",
  no_tech_available: "No tech available",
  other: "Other blocker",
};
export function shopDate(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: SHOP_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}
export const vinSchema = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-HJ-NPR-Z0-9]{17}$/, "Enter a 17-character VIN (no I, O or Q).");
const optionalText = (max: number) =>
  z.string().trim().max(max).optional().default("");
export const vehicleSchema = z.object({
  id: z.uuid(),
  stock_number: z
    .string()
    .trim()
    .min(1, "Stock number is required.")
    .max(40)
    .toUpperCase(),
  vin: z.union([vinSchema, z.literal("")]),
  year: z.coerce.number().int().min(1900).max(2100),
  make: z.string().trim().min(1, "Make is required.").max(80),
  model: z.string().trim().min(1, "Model is required.").max(80),
  trim: optionalText(80),
  color: optionalText(40),
  miles_in: z.union([
    z.literal(""),
    z.coerce.number().int().min(0).max(2147483647),
  ]),
  purchase_date: z.iso
    .date()
    .refine(
      (date) => date <= shopDate(),
      "Purchase date cannot be in the future.",
    ),
  source: z.enum(SOURCES),
  actor_id: z.union([z.uuid(), z.literal("")]),
});
export const moveSchema = z.object({
  vehicle_id: z.uuid(),
  stage: z.enum(STAGES),
  expected_stage: z.enum(STAGES),
  expected_entered_at: z.iso.datetime({ offset: true }),
  actor_id: z.union([z.uuid(), z.literal("")]),
});
export const blockerSchema = z
  .object({
    vehicle_id: z.uuid(),
    blocker: z.union([z.enum(BLOCKERS), z.literal("")]),
    note: z.string().trim().max(1000),
    actor_id: z.union([z.uuid(), z.literal("")]),
  })
  .refine((value) => value.blocker !== "other" || value.note.length > 0, {
    message: "Describe the other blocker.",
    path: ["note"],
  });
const checkItem = z.object({
  result: z.enum(["pass", "fail"]),
  notes: z.string().trim().max(1000).default(""),
});
export const checkinSchema = z.object({
  vehicle_id: z.uuid(),
  actor_id: z.uuid("Select who checked in the vehicle."),
  keys_count: z.coerce.number().int().min(0).max(10),
  checklist: z.object({
    fluids: checkItem,
    tires: checkItem,
    warning_lights: checkItem,
    body: checkItem,
  }),
  identity: z
    .object({
      vin: z.union([vinSchema, z.literal("")]),
      year: z.coerce.number().int().min(1900).max(2100),
      make: z.string().trim().min(1).max(80),
      model: z.string().trim().min(1).max(80),
    })
    .optional(),
});
export type VehicleInput = z.input<typeof vehicleSchema>;
export type CheckItem = { result: "pass" | "fail" | ""; notes: string };
export function stageAge(
  vehicle: Tables<"vehicles">,
  history: Tables<"stage_history">[],
  now: string,
): number {
  const entered = history
    .filter((h) => h.vehicle_id === vehicle.id && h.to_stage === vehicle.stage)
    .sort((a, b) => b.changed_at.localeCompare(a.changed_at))[0]?.changed_at;
  if (!entered) return 0;
  return Math.max(0, (Date.parse(now) - Date.parse(entered)) / 86400000);
}
export function purchaseAge(date: string, now: string): number {
  return Math.max(
    0,
    Math.round(
      (Date.parse(shopDate(new Date(now))) - Date.parse(date)) / 86400000,
    ),
  );
}
export function ageState(
  days: number,
  target: number,
): "normal" | "warning" | "over" {
  return days > target ? "over" : days >= target * 0.8 ? "warning" : "normal";
}
export function stageTarget(
  settings: Tables<"settings">,
  stage: string,
): number {
  const value = settings.stage_target_days;
  const target =
    value && typeof value === "object" && !Array.isArray(value)
      ? value[stage]
      : undefined;
  return typeof target === "number" && target > 0 ? target : 1;
}
export function ageLabel(days: number): string {
  return days < 1
    ? "<1 day"
    : `${Math.floor(days)} day${Math.floor(days) === 1 ? "" : "s"}`;
}
export function auditEvent(what: string): {
  action: string;
  [key: string]: Json | undefined;
} {
  try {
    const parsed = JSON.parse(what);
    if (parsed && typeof parsed.action === "string") return parsed;
  } catch {
    /* Older milestone 1 events were plain strings. */
  }
  return { action: what };
}
