import { timingSafeEqual } from "node:crypto";
import { revalidatePath } from "next/cache";
import { syncInventory } from "@/lib/inventory-server";
export const runtime = "nodejs";
export const maxDuration = 60;
export async function GET(request: Request) {
  const expected = `Bearer ${process.env.CRON_SECRET || ""}`,
    actual = request.headers.get("authorization") || "";
  if (
    !process.env.CRON_SECRET ||
    Buffer.byteLength(actual) !== Buffer.byteLength(expected) ||
    !timingSafeEqual(Buffer.from(actual), Buffer.from(expected))
  )
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const result = await syncInventory("scheduled");
    revalidatePath("/", "layout");
    return Response.json({ ok: true, result });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Sync failed" },
      { status: 500 },
    );
  }
}
