import { notFound, redirect } from "next/navigation";
import { z } from "zod";
import { getVehicleData } from "@/lib/recon-data";
import { ShopShell } from "@/components/shop-shell";
import { CheckinForm } from "@/components/checkin-form";
export const dynamic = "force-dynamic";
export default async function CheckinPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const data = await getVehicleData(id);
  if (!data.car) notFound();
  if (data.checkin) redirect(`/vehicles/${id}`);
  return (
    <ShopShell
      title={`Check-in · #${data.car.stock_number}`}
      profiles={data.profiles}
    >
      <CheckinForm car={data.car} profiles={data.profiles} />
    </ShopShell>
  );
}
