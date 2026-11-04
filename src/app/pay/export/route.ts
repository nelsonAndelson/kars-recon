import { getPayReport } from "@/lib/work-data";
import { weekStart, payCsv } from "@/lib/jobs";
export async function GET(request: Request) {
  let start: string;
  try {
    start = weekStart(
      new URL(request.url).searchParams.get("week") ?? undefined,
    );
  } catch {
    return new Response("Invalid week", { status: 400 });
  }
  try {
    const report = await getPayReport(start);
    return new Response(payCsv(report), {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="kars-pay-${start}.csv"`,
        "Cache-Control": "no-store",
      },
    });
  } catch {
    return new Response("Pay export could not load. Please try again.", {
      status: 503,
    });
  }
}
