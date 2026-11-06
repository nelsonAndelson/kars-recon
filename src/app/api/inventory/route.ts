import { revalidatePath } from "next/cache";
import { z } from "zod";
import {
  getInventoryData,
  requireImportAdmin,
  reviewInventory,
  syncInventory,
} from "@/lib/inventory-server";
import type { Json } from "@/types/database";
export const runtime = "nodejs";
export const maxDuration = 60;
export async function GET() {
  return Response.json(await getInventoryData(), {
    headers: { "Cache-Control": "no-store" },
  });
}
export async function POST(request: Request) {
  if (request.headers.get("origin") !== new URL(request.url).origin)
    return Response.json(
      { error: "Request origin is not allowed." },
      { status: 403 },
    );
  try {
    const input = await request.json();
    const actor = z.uuid().parse(input.actor_id);
    await requireImportAdmin(actor);
    if (input.action === "sync") await syncInventory("manual");
    else if (input.action === "review") await reviewInventory(input as Json);
    else throw new Error("Unknown inventory action.");
    revalidatePath("/", "layout");
    return Response.json({ ok: true });
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof z.ZodError
            ? "Select your admin name."
            : error instanceof Error
              ? error.message
              : "Import failed. Please refresh and try again.",
      },
      { status: 400 },
    );
  }
}
