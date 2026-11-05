"use client";
import Link from "next/link";
import { createContext, useContext, useEffect, useState } from "react";
import {
  LayoutDashboard,
  Users,
  Wrench,
  Package,
  Banknote,
  CarFront,
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
  active?:
    "board" | "new" | "jobs" | "pay" | "admin" | "tech" | "team" | "parts";
}) {
  const [actor, setActorState] = useState("");
  const technician = active === "tech";
  useEffect(() => {
    try {
      const saved = localStorage.getItem("kars.actor");
      setActorState(
        saved && profiles.some((p) => p.id === saved && p.active) ? saved : "",
      );
    } catch {
      setActorState("");
    }
  }, [profiles]);
  function setActor(value: string) {
    setActorState(value);
    try {
      localStorage.setItem("kars.actor", value);
    } catch {}
  }
  const nav = [
    { href: "/admin", label: "Today", id: "admin", Icon: LayoutDashboard },
    { href: "/board", label: "Cars", id: "board", Icon: CarFront },
    { href: "/jobs", label: "Jobs & hours", id: "jobs", Icon: Wrench },
    { href: "/parts", label: "Parts", id: "parts", Icon: Package },
    { href: "/pay", label: "Weekly pay", id: "pay", Icon: Banknote },
    { href: "/team", label: "Team", id: "team", Icon: Users },
  ];
  return (
    <ActorContext.Provider value={{ actor, setActor }}>
      <div
        className={`app-shell recon-shell ${technician ? "technician-shell" : ""}`}
      >
        <a className="skip-link" href="#main">
          Skip to workspace
        </a>
        <aside className="sidebar">
          <Link className="brand" href={technician ? "/tech" : "/admin"}>
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
          <div className="nav-label">
            {technician ? "TECHNICIAN" : "ADMIN"} WORKSPACE
          </div>
          <nav aria-label="Workspace">
            {technician ? (
              <Link href="/tech" className="nav-active">
                <Wrench size={20} />
                Shop floor
              </Link>
            ) : (
              nav.map(({ href, label, id, Icon }) => (
                <Link
                  key={id}
                  href={href}
                  className={active === id ? "nav-active" : ""}
                >
                  <Icon size={20} />
                  {label}
                </Link>
              ))
            )}
          </nav>
          <div className="sidebar-bottom">
            <Users size={20} />
            <div>
              Shared shop<span>No sign-in required</span>
            </div>
          </div>
        </aside>
        <div className="main-shell">
          <header className="topbar">
            <Link
              className="workspace-title"
              href={technician ? "/tech" : "/admin"}
            >
              KARS / {title}
            </Link>
            <div className="workspace-controls">
              <label className="actor-picker">
                <span>
                  Working as <small>self-reported</small>
                </span>
                <select
                  aria-label="Working as (self-reported)"
                  value={actor}
                  onChange={(e) => setActor(e.target.value)}
                >
                  <option value="">Choose your name</option>
                  {profiles
                    .filter((p) => p.active)
                    .map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.full_name}
                      </option>
                    ))}
                </select>
              </label>
              <Link
                className="view-switch"
                href={technician ? "/admin" : "/tech"}
                onClick={() => {
                  try {
                    localStorage.setItem(
                      "kars.view",
                      technician ? "admin" : "tech",
                    );
                  } catch {}
                }}
              >
                {technician ? "Admin view" : "Technician view"} ↗
              </Link>
            </div>
          </header>
          {!technician && (
            <nav
              className="mobile-work-nav admin-mobile-nav"
              aria-label="Shop navigation"
            >
              {nav.map((n) => (
                <Link
                  key={n.id}
                  href={n.href}
                  aria-current={active === n.id ? "page" : undefined}
                >
                  {n.label}
                </Link>
              ))}
            </nav>
          )}
          <main id="main" className="recon-main">
            {children}
            <footer className="main-footer">
              <span>KARS RECON / Shop workspace</span>
              <span>{technician ? "Technician view" : "Admin view"}</span>
            </footer>
          </main>
        </div>
      </div>
    </ActorContext.Provider>
  );
}
