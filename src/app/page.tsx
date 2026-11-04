import { SetupWorkspace } from "@/components/setup-workspace";
import { getSetupData } from "@/lib/setup";
export const dynamic = "force-dynamic";
export default async function Home() {
  return <SetupWorkspace data={await getSetupData()} />;
}
