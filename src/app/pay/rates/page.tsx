import { getWorkData } from "@/lib/work-data";
import { RatesWorkspace } from "@/components/rates-workspace";
import { ShopShell } from "@/components/shop-shell";
import { shopDate } from "@/lib/vehicles";
export const dynamic = "force-dynamic";
export default async function RatesPage() {
  const data = await getWorkData();
  return (
    <ShopShell profiles={data.profiles} title="Pay rates" active="pay">
      <RatesWorkspace data={data} today={shopDate()} />
    </ShopShell>
  );
}
