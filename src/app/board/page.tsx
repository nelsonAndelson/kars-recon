import { ReconBoard } from "@/components/recon-board";
import { getBoardData } from "@/lib/recon-data";
export const dynamic = "force-dynamic";
export default async function Board() {
  return <ReconBoard data={await getBoardData()} />;
}
