import { getWorkData, getPayReport } from "@/lib/work-data";
import { PayWorkspace } from "@/components/pay-workspace";
import { ShopShell } from "@/components/shop-shell";
import { weekStart } from "@/lib/jobs";
import { shopDate } from "@/lib/vehicles";
export const dynamic = "force-dynamic";
export default async function PayPage({
  searchParams,
}: {
  searchParams: Promise<{ week?: string }>;
}) {
  const params = await searchParams;
  let start = weekStart();
  try {
    if (params.week) start = weekStart(params.week);
  } catch {
    /* Invalid URLs fall back to current week. */
  }
  const [data, report] = await Promise.all([
    getWorkData(),
    getPayReport(start),
  ]);
  return (
    <ShopShell profiles={data.profiles} title="Weekly pay" active="pay">
      <PayWorkspace
        key={start}
        data={data}
        report={report}
        today={shopDate()}
      />
    </ShopShell>
  );
}
