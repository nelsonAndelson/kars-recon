"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
export default function Home() {
  const router = useRouter();
  useEffect(() => {
    let view = "admin";
    try {
      if (localStorage.getItem("kars.view") === "tech") view = "tech";
    } catch {}
    router.replace("/" + view);
  }, [router]);
  return (
    <main className="recon-main">
      <h1>Kars Recon</h1>
      <p>Opening your workspace…</p>
      <Link href="/tech">Technician view</Link> ·{" "}
      <Link href="/admin">Admin view</Link>
    </main>
  );
}
