"use client";
import { Button } from "@/components/ui/button";
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <main className="loading-screen">
      <h1>We couldn’t open the workspace.</h1>
      <p>Check your connection and try again.</p>
      <Button onClick={reset}>Try again</Button>
    </main>
  );
}
