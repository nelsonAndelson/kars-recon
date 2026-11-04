import { SetupWorkspace } from "@/components/setup-workspace";
import { getSetupData } from "@/lib/setup";
export const dynamic = "force-dynamic";
export default async function Setup() {
  return <SetupWorkspace data={await getSetupData()} />;
}
