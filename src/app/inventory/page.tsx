import { ShopShell } from "@/components/shop-shell";
import { InventoryWorkspace } from "@/components/inventory-workspace";
import { getInventoryData } from "@/lib/inventory-server";
export const dynamic = "force-dynamic";
export default async function InventoryPage() {
  const data = await getInventoryData();
  return (
    <ShopShell
      profiles={data.profiles}
      active="inventory"
      title="Inventory import"
    >
      <InventoryWorkspace data={data} />
    </ShopShell>
  );
}
