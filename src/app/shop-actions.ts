"use server";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { shopDatabase } from "@/lib/supabase";
import type { Json } from "@/types/database";
const teamSchema = z.object({
  id: z.uuid(),
  actor_id: z.uuid("Choose an admin under Working as."),
  full_name: z.string().trim().min(1).max(80),
  role: z.enum(["owner", "tech", "advisor", "viewer"]),
  active: z.boolean(),
  expected: z.unknown(),
});
const partSchema = z.discriminatedUnion("command", [
  z.object({
    command: z.literal("request"),
    id: z.uuid(),
    actor_id: z.uuid(),
    vehicle_id: z.uuid(),
    job_id: z.union([z.uuid(), z.literal("")]),
    name: z.string().trim().min(1).max(160),
    qty: z.number().int().min(1).max(999),
  }),
  z.object({
    command: z.literal("order"),
    id: z.uuid(),
    actor_id: z.uuid(),
    expected: z.unknown(),
    vendor: z.string().trim().min(1).max(120),
    unit_cost_cents: z.number().int().min(0).max(100000000),
  }),
  z.object({
    command: z.literal("receive"),
    id: z.uuid(),
    actor_id: z.uuid(),
    expected: z.unknown(),
  }),
]);
function refresh() {
  revalidatePath("/", "layout");
}
function errorText(e: unknown) {
  return e instanceof z.ZodError
    ? e.issues[0].message
    : e && typeof e === "object" && "message" in e
      ? String(e.message)
      : "Could not save. Please try again.";
}
export async function saveTeam(input: unknown) {
  try {
    const payload = teamSchema.parse(input);
    const { error } = await shopDatabase().rpc("team_command", {
      payload: payload as Json,
    });
    if (error) throw error;
    refresh();
    return { ok: true as const };
  } catch (e) {
    return { ok: false as const, error: errorText(e) };
  }
}
export async function savePart(input: unknown) {
  try {
    const { command, ...payload } = partSchema.parse(input);
    const { error } = await shopDatabase().rpc("part_command", {
      command,
      payload: payload as Json,
    });
    if (error) throw error;
    refresh();
    return { ok: true as const };
  } catch (e) {
    return { ok: false as const, error: errorText(e) };
  }
}
