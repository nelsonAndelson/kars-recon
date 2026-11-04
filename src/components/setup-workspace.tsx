"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  Check,
  CheckCheck,
  ChevronRight,
  CircleCheck,
  ClipboardCheck,
  Database,
  LayoutDashboard,
  Package,
  RefreshCw,
  Search,
  Settings2,
  ShieldCheck,
  Users,
  Wrench,
  CarFront,
  AlertCircle,
  CalendarDays,
  CircleDollarSign,
  ChartNoAxesCombined,
  Sunrise,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { STAGE_LABELS, type Stage } from "@/lib/domain";
import { formatMoney } from "@/lib/money";
import type { SetupData } from "@/lib/setup";

const milestones = [
  "Setup & foundation",
  "Vehicles & board",
  "Jobs & pay",
  "Parts lifecycle",
  "Budget & approvals",
  "Morning view & reports",
  "PWA & polish",
];
type Tab = "inventory" | "team" | "roadmap";
export function SetupWorkspace({ data }: { data: SetupData }) {
  const [tab, setTab] = useState<Tab>("inventory");
  const [query, setQuery] = useState("");
  const [refreshing, startRefresh] = useTransition();
  const router = useRouter();
  const cars = data.vehicles.filter((car) =>
    `${car.stock_number} ${car.year} ${car.make} ${car.model}`
      .toLowerCase()
      .includes(query.toLowerCase()),
  );
  const techs = data.profiles.filter((person) => person.role === "tech");
  function showTab(next: Tab) {
    setTab(next);
    document
      .getElementById("workspace-content")
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
  }
  return (
    <div className="app-shell">
      <a className="skip-link" href="#main">
        Skip to workspace
      </a>
      <aside className="sidebar">
        <a href="/" className="brand">
          <span className="brand-mark">
            K<span>↗</span>
          </span>
          <span>
            KARS<span className="brand-sub">RECON</span>
          </span>
        </a>
        <div className="shop-name">
          AUTO SALES & REPAIR<span>Cleveland, Ohio</span>
        </div>
        <div className="nav-label">WORKSPACE</div>
        <nav aria-label="Workspace">
          <a className="nav-active" href="#main">
            <Settings2 size={20} /> Shop setup <span className="nav-dot" />
          </a>
        </nav>
        <div className="nav-label upcoming-label">
          COMING IN NEXT MILESTONES
        </div>
        <div className="upcoming-nav">
          {[
            [LayoutDashboard, "Recon board"],
            [Sunrise, "Morning view"],
            [Wrench, "My jobs"],
            [Package, "Parts"],
            [ClipboardCheck, "Approvals"],
            [CircleDollarSign, "Tech pay"],
            [ChartNoAxesCombined, "Reports"],
          ].map(([Icon, label]) => {
            const NavIcon = Icon as typeof Wrench;
            return (
              <div key={String(label)}>
                <NavIcon size={19} />
                {String(label)}
              </div>
            );
          })}
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
            <span>Workspace</span>
            <ChevronRight size={16} />
            <strong>Shop setup</strong>
          </div>
          <div className="topbar-meta">
            <span className="connection-dot" />
            Internal recon tracker
          </div>
        </header>
        <main id="main">
          <div className="page-heading">
            <div>
              <div className="eyebrow">LET’S GET THE SHOP READY</div>
              <h1>
                Shop setup<span className="title-dot">.</span>
              </h1>
              <p>Your recon workspace starts here.</p>
            </div>
            <Button
              variant="outline"
              onClick={() => startRefresh(() => router.refresh())}
              disabled={refreshing}
            >
              <RefreshCw className={refreshing ? "spin" : ""} />
              {refreshing ? "Refreshing…" : "Refresh"}
            </Button>
          </div>
          <section className="foundation-banner" aria-label="Milestone status">
            <div className="banner-copy">
              <div className="milestone-pill">
                <span /> MILESTONE 01 OF 07
              </div>
              <h2>
                A solid start.
                <br />A clearer shop.
              </h2>
              <p>
                The foundation is in place. Explore the sample inventory and
                team before we build your working recon board.
              </p>
              <Button asChild>
                <a href="#workspace-content">
                  Explore the setup <ArrowRight />
                </a>
              </Button>
            </div>
            <div className="banner-road">
              <span className="road-label">FROM AUCTION TO FRONTLINE</span>
              <div className="road-line">
                <span>
                  <CarFront />
                  <small>Check in</small>
                </span>
                <i />
                <span>
                  <Wrench />
                  <small>Recondition</small>
                </span>
                <i />
                <span className="road-finish">
                  <CheckCheck />
                  <small>Frontline</small>
                </span>
              </div>
              <div className="banner-note">
                <ShieldCheck size={19} />
                <span>Your inventory. Your shop. One workspace.</span>
              </div>
            </div>
          </section>
          <div className="sample-note">
            <span className="sample-pill">SAMPLE DATA</span>
            <p>
              These are practice records, not your actual inventory. Editing
              starts in the next milestones.
            </p>
          </div>
          {data.error && (
            <div role="alert" className="error-banner">
              <AlertCircle />
              <div>
                <strong>Database connection needs attention</strong>
                <p>{data.error}</p>
              </div>
            </div>
          )}
          <section className="stats-grid" aria-label="Setup counts">
            {[
              {
                label: "Vehicles",
                value: data.vehicles.length,
                detail: "Across the recon pipeline",
                icon: CarFront,
              },
              {
                label: "Technicians",
                value: techs.length,
                detail: "With effective-dated pay rates",
                icon: Users,
              },
              {
                label: "Parts",
                value: data.partCount,
                detail: "All six lifecycle statuses",
                icon: Package,
              },
              {
                label: "Comeback examples",
                value: data.comebackCount,
                detail: "Zero additional labor pay",
                icon: Wrench,
              },
            ].map(({ label, value, detail, icon: Icon }) => (
              <article className="stat-card" key={label}>
                <div className="stat-top">
                  <span>{label}</span>
                  <Icon size={21} />
                </div>
                <strong>
                  {data.connected ? String(value).padStart(2, "0") : "—"}
                </strong>
                <p>{detail}</p>
              </article>
            ))}
          </section>
          <div className="workspace-columns">
            <section id="workspace-content" className="workspace-panel">
              <div className="tabs" role="tablist" aria-label="Review setup">
                {(
                  [
                    ["inventory", "Sample inventory"],
                    ["team", "Team & rates"],
                    ["roadmap", "Build roadmap"],
                  ] as const
                ).map(([id, label]) => (
                  <button
                    key={id}
                    id={`tab-${id}`}
                    role="tab"
                    aria-selected={tab === id}
                    aria-controls={`panel-${id}`}
                    onClick={() => setTab(id)}
                    className={tab === id ? "tab-active" : ""}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <div
                role="tabpanel"
                id={`panel-${tab}`}
                aria-labelledby={`tab-${tab}`}
              >
                {tab === "inventory" && (
                  <>
                    <div className="panel-heading">
                      <div>
                        <h2>Meet your sample inventory</h2>
                        <p>A little of every stage, ready to explore.</p>
                      </div>
                      <span className="record-count">
                        {cars.length} vehicles
                      </span>
                    </div>
                    <label className="search-box">
                      <Search size={20} />
                      <input
                        type="search"
                        value={query}
                        onChange={(event) => setQuery(event.target.value)}
                        placeholder="Search stock number, make or model"
                        aria-label="Search sample inventory"
                      />
                    </label>
                    <div className="vehicle-grid">
                      {cars.map((car) => (
                        <article className="vehicle-card" key={car.id}>
                          <div className="vehicle-top">
                            <span className="stock-number">
                              #{car.stock_number}
                            </span>
                            <CarFront size={23} />
                          </div>
                          <h3>
                            {car.year} {car.make}
                            <br />
                            {car.model}
                          </h3>
                          <div className="vehicle-meta">
                            {car.color} <span>·</span>{" "}
                            {car.miles_in?.toLocaleString("en-US")} mi
                          </div>
                          <div className="vehicle-bottom">
                            <span className={`stage-chip stage-${car.stage}`}>
                              {STAGE_LABELS[car.stage as Stage]}
                            </span>
                            <span className="vehicle-budget">
                              {formatMoney(car.recon_budget_cents)} budget
                            </span>
                          </div>
                          {car.blocker && (
                            <div className="blocker-note">
                              <span />
                              {car.blocker.replaceAll("_", " ")}
                            </div>
                          )}
                        </article>
                      ))}
                    </div>
                    {cars.length === 0 && (
                      <div className="empty-state">
                        <CarFront size={36} />
                        <h3>
                          {query
                            ? "No matching vehicles"
                            : "No sample vehicles yet"}
                        </h3>
                        <p>
                          {query
                            ? "Try another stock number, make or model."
                            : "Run the development seed to populate this workspace."}
                        </p>
                        {query && (
                          <Button
                            variant="outline"
                            onClick={() => setQuery("")}
                          >
                            Clear search
                          </Button>
                        )}
                      </div>
                    )}
                  </>
                )}
                {tab === "team" && (
                  <>
                    <div className="panel-heading">
                      <div>
                        <h2>A team you can grow</h2>
                        <p>
                          Sample profiles. Names and roles are not hardcoded
                          into workflows.
                        </p>
                      </div>
                    </div>
                    <div className="team-list">
                      {data.profiles.map((person) => {
                        const rates = data.rates.filter(
                          (rate) => rate.tech_id === person.id,
                        );
                        return (
                          <article className="team-row" key={person.id}>
                            <span className="person-avatar">
                              {person.full_name
                                .split(" ")
                                .map((n) => n[0])
                                .slice(0, 2)
                                .join("")}
                            </span>
                            <div className="person-info">
                              <h3>{person.full_name}</h3>
                              <p>
                                {person.role} ·{" "}
                                {person.active ? "Active" : "Inactive"}
                              </p>
                              {rates.length > 0 && (
                                <details>
                                  <summary>View rate history</summary>
                                  {rates.map((rate) => (
                                    <div
                                      className="rate-line"
                                      key={rate.effective_from}
                                    >
                                      {rate.effective_from}
                                      <strong>
                                        {formatMoney(rate.rate_cents_per_hour)}
                                        /hr
                                      </strong>
                                    </div>
                                  ))}
                                </details>
                              )}
                            </div>
                            <strong className="person-rate">
                              {rates[0]
                                ? `${formatMoney(rates[0].rate_cents_per_hour)}/hr`
                                : "—"}
                            </strong>
                          </article>
                        );
                      })}
                    </div>
                    <p className="panel-footnote">
                      In shared mode, roles describe responsibilities. Everyone
                      can view the same information.
                    </p>
                  </>
                )}
                {tab === "roadmap" && (
                  <>
                    <div className="panel-heading">
                      <div>
                        <h2>Built one milestone at a time</h2>
                        <p>Review each milestone before the next one begins.</p>
                      </div>
                    </div>
                    <ol className="roadmap-list">
                      {milestones.map((label, index) => (
                        <li key={label}>
                          <span
                            className={
                              index === 0
                                ? "step-number step-complete"
                                : "step-number"
                            }
                          >
                            {index === 0 ? (
                              <Check size={18} />
                            ) : (
                              String(index + 1).padStart(2, "0")
                            )}
                          </span>
                          <div>
                            <h3>{label}</h3>
                            <p>
                              {index === 0
                                ? "Ready for your review"
                                : index === 1
                                  ? "Next: add cars, check in, move stages and flag blockers"
                                  : "Planned for a later milestone"}
                            </p>
                          </div>
                          {index === 0 && (
                            <span className="ready-pill">Current</span>
                          )}
                        </li>
                      ))}
                    </ol>
                  </>
                )}
              </div>
            </section>
            <aside className="right-rail">
              <section className="status-panel">
                <div className="status-panel-title">
                  <span className="status-icon">
                    <Database size={21} />
                  </span>
                  <h2>Foundation status</h2>
                </div>
                <ul className="check-list">
                  <li>
                    <CircleCheck />
                    <div>
                      Supabase database
                      <span>
                        {data.connected
                          ? "Connected and responding"
                          : "Connection unavailable"}
                      </span>
                    </div>
                  </li>
                  <li>
                    <CircleCheck />
                    <div>
                      Shared workspace
                      <span>No login to slow the shop down</span>
                    </div>
                  </li>
                  <li>
                    <CircleCheck />
                    <div>
                      Source preserved
                      <span>Git repository + original brief</span>
                    </div>
                  </li>
                  <li>
                    <CircleCheck />
                    <div>
                      Money in cents<span>Integer math with unit tests</span>
                    </div>
                  </li>
                </ul>
                <div
                  className={
                    data.connected
                      ? "database-status"
                      : "database-status disconnected"
                  }
                >
                  <span />
                  {data.connected
                    ? "Database connected"
                    : "Database disconnected"}
                </div>
              </section>
              <section className="next-panel">
                <div className="eyebrow">UP NEXT · MILESTONE 02</div>
                <span className="next-icon">
                  <LayoutDashboard size={26} />
                </span>
                <h2>
                  Every car.
                  <br />
                  One clear board.
                </h2>
                <p>
                  Add inventory, check in new arrivals, move cars through the
                  shop, and see what’s holding them up.
                </p>
                <button
                  onClick={() => showTab("roadmap")}
                  className="roadmap-link"
                >
                  See the build roadmap <ArrowRight size={18} />
                </button>
              </section>
              <div className="shop-footer">
                <CalendarDays size={16} />
                <span>Made for the way your shop works.</span>
              </div>
            </aside>
          </div>
          <footer className="main-footer">
            <span>
              KARS RECON <span> / </span> Internal inventory only
            </span>
            <span>Milestone 1 · Setup review</span>
          </footer>
        </main>
      </div>
    </div>
  );
}
