"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { shopDatabase } from "@/lib/supabase";
import { jobCommandSchema, payCommandSchema } from "@/lib/jobs";
import type { Json } from "@/types/database";
export type WorkResult =
  { ok: true; id: string } | { ok: false; error: string };
function failed(error: unknown): WorkResult {
  if (error instanceof z.ZodError)
    return { ok: false, error: error.issues[0]?.message ?? "Check the form." };
  if (
    error &&
    typeof error === "object" &&
    "code" in error &&
    error.code === "23505"
  )
    return {
      ok: false,
      error: "This record already exists. Refresh to see the saved version.",
    };
  return {
    ok: false,
    error:
      error && typeof error === "object" && "message" in error
        ? String(error.message)
        : "Could not save. Check your connection and try again.",
  };
}
function refresh() {
  revalidatePath("/", "layout");
  revalidatePath("/jobs");
  revalidatePath("/pay");
  revalidatePath("/pay/rates");
  revalidatePath("/vehicles/[id]", "page");
  revalidatePath("/setup");
}
export async function jobAction(input: unknown): Promise<WorkResult> {
  try {
    const { command, ...payload } = jobCommandSchema.parse(input);
    const { data, error } = await shopDatabase().rpc("job_command", {
      command,
      payload,
    });
    if (error) throw error;
    refresh();
    return { ok: true, id: data };
  } catch (error) {
    return failed(error);
  }
}
export async function payAction(input: unknown): Promise<WorkResult> {
  try {
    const { command, ...payload } = payCommandSchema.parse(input);
    const { data, error } = await shopDatabase().rpc("pay_command", {
      command,
      payload: payload as Json,
    });
    if (error) throw error;
    refresh();
    return { ok: true, id: data };
  } catch (error) {
    return failed(error);
  }
}
