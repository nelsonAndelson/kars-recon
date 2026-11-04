import { notFound } from "next/navigation";
import { z } from "zod";
import { getVehicleData } from "@/lib/recon-data";
import { ShopShell } from "@/components/shop-shell";
import { VehicleDetail } from "@/components/vehicle-detail";
import { getWorkData } from "@/lib/work-data";
export const dynamic = "force-dynamic";
export default async function VehiclePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const [data, work] = await Promise.all([getVehicleData(id), getWorkData()]);
  if (!data.car) notFound();
  return (
    <ShopShell title={`#${data.car.stock_number}`} profiles={data.profiles}>
      <VehicleDetail data={data} work={work} />
    </ShopShell>
  );
}
