import { getWorkData } from "@/lib/work-data";
import { JobsWorkspace } from "@/components/jobs-workspace";
import { ShopShell } from "@/components/shop-shell";
import { shopDate } from "@/lib/vehicles";
export const dynamic = "force-dynamic";
export default async function JobsPage() {
  const data = await getWorkData();
  return (
    <ShopShell profiles={data.profiles} title="My jobs" active="jobs">
      <JobsWorkspace data={data} today={shopDate()} />
    </ShopShell>
  );
}
