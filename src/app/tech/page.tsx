import { getWorkData } from "@/lib/work-data";
import { shopDate } from "@/lib/vehicles";
import { ShopShell } from "@/components/shop-shell";
import { TechnicianWorkspace } from "@/components/technician-workspace";
export const dynamic = "force-dynamic";
export default async function Tech() {
  const data = await getWorkData();
  return (
    <ShopShell profiles={data.profiles} active="tech" title="Shop floor">
      <TechnicianWorkspace data={data} today={shopDate()} />
    </ShopShell>
  );
}
