import { getWorkData } from "@/lib/work-data";
import { ShopShell } from "@/components/shop-shell";
import { PartsWorkspace } from "@/components/parts-workspace";
export const dynamic = "force-dynamic";
export default async function Parts() {
  const data = await getWorkData();
  return (
    <ShopShell profiles={data.profiles} active="parts" title="Parts">
      <PartsWorkspace data={data} />
    </ShopShell>
  );
}
