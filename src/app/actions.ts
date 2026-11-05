"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { shopDatabase } from "@/lib/supabase";
import {
  vehicleSchema,
  moveSchema,
  blockerSchema,
  checkinSchema,
  vinSchema,
} from "@/lib/vehicles";
import { parseVinResponse } from "@/lib/vin";
import type { Json } from "@/types/database";

type Result = { ok: true; id: string } | { ok: false; error: string };
function failure(error: unknown): { ok: false; error: string } {
  if (error instanceof z.ZodError)
    return {
      ok: false,
      error: error.issues[0]?.message ?? "Check the form fields.",
    };
  if (
    error &&
    typeof error === "object" &&
    "code" in error &&
    error.code === "23505"
  )
    return {
      ok: false,
      error:
        "That stock number already exists. Open the existing car or use a different stock number.",
    };
  if (error && typeof error === "object" && "message" in error)
    return { ok: false, error: String(error.message) };
  return {
    ok: false,
    error:
      "The change could not be saved. Check your connection and try again.",
  };
}
async function run(command: string, payload: Json): Promise<Result> {
  try {
    const { data, error } = await shopDatabase().rpc("vehicle_command", {
      command,
      payload,
    });
    if (error) throw error;
    revalidatePath("/", "layout");
    revalidatePath(`/vehicles/${data}`);
    revalidatePath(`/vehicles/${data}/check-in`);
    return { ok: true, id: data };
  } catch (error) {
    return failure(error);
  }
}
export async function addVehicle(input: unknown): Promise<Result> {
  try {
    return await run("create", vehicleSchema.parse(input));
  } catch (error) {
    return failure(error);
  }
}
export async function moveVehicle(input: unknown): Promise<Result> {
  try {
    return await run("move", moveSchema.parse(input));
  } catch (error) {
    return failure(error);
  }
}
export async function flagVehicle(input: unknown): Promise<Result> {
  try {
    return await run("blocker", blockerSchema.parse(input));
  } catch (error) {
    return failure(error);
  }
}
export async function signQc(input: unknown): Promise<Result> {
  try {
    return await run(
      "qc",
      z
        .object({
          vehicle_id: z.uuid(),
          actor_id: z.uuid("Select the person signing QC."),
        })
        .parse(input),
    );
  } catch (error) {
    return failure(error);
  }
}
export async function decodeVin(input: unknown) {
  try {
    const vin = vinSchema.parse(input);
    const response = await fetch(
      `https://vpic.nhtsa.dot.gov/api/vehicles/DecodeVinValues/${vin}?format=json`,
      { signal: AbortSignal.timeout(12000), cache: "no-store" },
    );
    if (!response.ok)
      throw new Error(
        "NHTSA is unavailable. You can enter the vehicle details manually.",
      );
    return {
      ok: true as const,
      vehicle: parseVinResponse(await response.json()),
    };
  } catch (error) {
    if (error instanceof z.ZodError) return failure(error);
    return {
      ok: false as const,
      error:
        error instanceof Error && error.message.includes("NHTSA")
          ? error.message
          : "VIN lookup is unavailable. Check the VIN or enter the details manually.",
    };
  }
}
export async function completeCheckin(form: FormData): Promise<Result> {
  const uploaded: string[] = [];
  const db = shopDatabase();
  try {
    const payload = checkinSchema.parse(
      JSON.parse(String(form.get("payload"))),
    );
    const files = form
      .getAll("photos")
      .filter((file): file is File => file instanceof File && file.size > 0);
    if (
      files.length > 4 ||
      files.reduce((sum, file) => sum + file.size, 0) > 3 * 1024 * 1024
    )
      throw new Error(
        "Use up to four photos, totaling under 3 MB after compression.",
      );
    const prepared = await Promise.all(
      files.map(async (file) => {
        const bytes = new Uint8Array(await file.arrayBuffer());
        if (
          file.type !== "image/jpeg" ||
          bytes[0] !== 0xff ||
          bytes[1] !== 0xd8 ||
          bytes[2] !== 0xff
        )
          throw new Error(
            "Choose a valid photo. Supported photos are converted to JPEG before upload.",
          );
        return bytes;
      }),
    );
    for (const bytes of prepared) {
      const path = `${payload.vehicle_id}/${crypto.randomUUID()}.jpg`;
      const { error } = await db.storage
        .from("recon-photos")
        .upload(path, bytes, { contentType: "image/jpeg", upsert: false });
      if (error)
        throw new Error("A photo could not be uploaded. Please try again.");
      uploaded.push(path);
    }
    const result = await run("checkin", { ...payload, photos: uploaded });
    if (!result.ok && uploaded.length)
      await db.storage.from("recon-photos").remove(uploaded);
    return result;
  } catch (error) {
    if (uploaded.length) await db.storage.from("recon-photos").remove(uploaded);
    return failure(error);
  }
}
