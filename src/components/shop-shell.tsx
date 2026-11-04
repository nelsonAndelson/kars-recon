"use client";
import Link from "next/link";
import { createContext, useContext, useEffect, useState } from "react";
import {
  LayoutDashboard,
  Plus,
  Settings2,
  Users,
  Wrench,
  Package,
  ChartNoAxesCombined,
  ChevronRight,
  Banknote,
} from "lucide-react";
import type { Tables } from "@/types/database";
const ActorContext = createContext({
  actor: "",
  setActor: (_value: string) => {},
});
export function useActor() {
  return useContext(ActorContext);
}
export function ShopShell({
  children,
  profiles,
  title,
  active = "board",
}: {
  children: React.ReactNode;
  profiles: Tables<"profiles">[];
  title: string;
  active?: "board" | "new" | "jobs" | "pay";
}) {
  const [actor, setActorState] = useState("");
  useEffect(() => {
    const saved = localStorage.getItem("kars.actor");
    if (saved && profiles.some((p) => p.id === saved && p.active))
      setActorState(saved);
  }, [profiles]);
  function setActor(value: string) {
    setActorState(value);
    localStorage.setItem("kars.actor", value);
  }
  return (
    <ActorContext.Provider value={{ actor, setActor }}>
      <div className="app-shell recon-shell">
        <a className="skip-link" href="#main">
          Skip to workspace
        </a>
        <aside className="sidebar">
          <Link className="brand" href="/">
            <span className="brand-mark">
              K<span>↗</span>
            </span>
            <span>
              KARS<span className="brand-sub">RECON</span>
            </span>
          </Link>
          <div className="shop-name">
            AUTO SALES & REPAIR<span>Cleveland, Ohio</span>
          </div>
          <div className="nav-label">WORKSPACE</div>
          <nav aria-label="Workspace">
            <Link href="/" className={active === "board" ? "nav-active" : ""}>
              <LayoutDashboard size={20} />
              Recon board
            </Link>
            <Link
              href="/vehicles/new"
              className={active === "new" ? "nav-active" : ""}
            >
              <Plus size={20} />
              Add a vehicle
            </Link>
            <Link href="/setup">
              <Settings2 size={20} />
              Setup review
            </Link>
            <Link
              href="/jobs"
              className={active === "jobs" ? "nav-active" : ""}
            >
              <Wrench size={20} />
              My jobs
            </Link>
            <Link href="/pay" className={active === "pay" ? "nav-active" : ""}>
              <Banknote size={20} />
              Weekly pay
            </Link>
          </nav>
          <div className="nav-label upcoming-label">NEXT MILESTONES</div>
          <div className="upcoming-nav">
            <div>
              <Package size={19} />
              Parts lifecycle
            </div>
            <div>
              <ChartNoAxesCombined size={19} />
              Morning & reports
            </div>
          </div>
          <div className="sidebar-bottom">
            <span className="shared-icon">
              <Users size={20} />
            </span>
            <div>
              Shared shop<span>No sign-in required</span>
            </div>
          </div>
        </aside>
        <div className="main-shell">
          <header className="topbar">
            <div className="breadcrumb">
              <Link href="/">Workspace</Link>
              <ChevronRight size={16} />
              <strong>{title}</strong>
            </div>
            <label className="actor-picker">
              <span>
                Working as <small>self-reported</small>
              </span>
              <select
                aria-label="Working as (self-reported)"
                value={actor}
                onChange={(e) => setActor(e.target.value)}
              >
                <option value="">Shared / no name</option>
                {profiles
                  .filter((p) => p.active)
                  .map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.full_name}
                    </option>
                  ))}
              </select>
            </label>
          </header>
          <nav className="mobile-work-nav" aria-label="Shop navigation">
            <Link
              href="/"
              aria-current={active === "board" ? "page" : undefined}
            >
              Board
            </Link>
            <Link
              href="/jobs"
              aria-current={active === "jobs" ? "page" : undefined}
            >
              My jobs
            </Link>
            <Link
              href="/pay"
              aria-current={active === "pay" ? "page" : undefined}
            >
              Weekly pay
            </Link>
          </nav>
          <main id="main" className="recon-main">
            {children}
            <footer className="main-footer">
              <span>KARS RECON / Internal inventory only</span>
              <span>Milestone 3 · Jobs & pay</span>
            </footer>
          </main>
        </div>
      </div>
    </ActorContext.Provider>
  );
}
