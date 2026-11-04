import { ShopShell } from "@/components/shop-shell";
import { VehicleForm } from "@/components/vehicle-form";
import { shopDatabase } from "@/lib/supabase";
import { shopDate } from "@/lib/vehicles";
export const dynamic = "force-dynamic";
export default async function NewVehicle() {
  const { data, error } = await shopDatabase()
    .from("profiles")
    .select("*")
    .eq("active", true);
  if (error) throw new Error("Could not load the shop team.");
  return (
    <ShopShell profiles={data ?? []} title="Add a vehicle" active="new">
      <VehicleForm today={shopDate()} />
    </ShopShell>
  );
}
