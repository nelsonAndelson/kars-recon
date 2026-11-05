import { getWorkData } from "@/lib/work-data";
import { shopDate } from "@/lib/vehicles";
import { ShopShell } from "@/components/shop-shell";
import { AdminWorkspace } from "@/components/admin-workspace";
export const dynamic = "force-dynamic";
export default async function Admin() {
  const data = await getWorkData();
  return (
    <ShopShell profiles={data.profiles} title="Today" active="admin">
      <AdminWorkspace data={data} today={shopDate()} />
    </ShopShell>
  );
}
