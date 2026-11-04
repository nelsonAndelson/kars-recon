import { ReconBoard } from "@/components/recon-board";
import { getBoardData } from "@/lib/recon-data";
export const dynamic = "force-dynamic";
export default async function Home() {
  return <ReconBoard data={await getBoardData()} />;
}
