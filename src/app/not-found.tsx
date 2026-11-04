import Link from "next/link";
import { Button } from "@/components/ui/button";
export default function NotFound() {
  return (
    <main className="loading-screen">
      <h1>Vehicle not found.</h1>
      <p>It may have been removed, or the link may be incomplete.</p>
      <Button asChild>
        <Link href="/">Return to board</Link>
      </Button>
    </main>
  );
}
