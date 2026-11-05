import { getWorkData } from "@/lib/work-data";
import { ShopShell } from "@/components/shop-shell";
import { TeamWorkspace } from "@/components/team-workspace";
export const dynamic = "force-dynamic";
export default async function Team() {
  const data = await getWorkData();
  return (
    <ShopShell profiles={data.profiles} title="Team" active="team">
      <TeamWorkspace profiles={data.profiles} />
    </ShopShell>
  );
}
