"use client";
import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Plus,
  Search,
  RefreshCw,
  CarFront,
  Flag,
  Clock3,
  ArrowUpRight,
  LayoutDashboard,
  List,
  Package,
} from "lucide-react";
import { Button } from "./ui/button";
import { ShopShell } from "./shop-shell";
import { VehicleActions } from "./vehicle-actions";
import { STAGES, STAGE_LABELS } from "@/lib/domain";
import {
  stageAge,
  purchaseAge,
  ageState,
  stageTarget,
  ageLabel,
  BLOCKER_LABELS,
} from "@/lib/vehicles";
import { formatMoney } from "@/lib/money";
import type { BoardData } from "@/lib/recon-data";
export function ReconBoard({ data }: { data: BoardData }) {
  const [search, setSearch] = useState("");
  const [tech, setTech] = useState("");
  const [blocked, setBlocked] = useState(false);
  const [archived, setArchived] = useState(false);
  const [stage, setStage] = useState("");
  const [view, setView] = useState("board");
  const [pending, startRefresh] = useTransition();
  const router = useRouter();
  const active = data.vehicles.filter((car) => car.status === "active");
  const overdue = active.filter(
    (car) =>
      ageState(
        stageAge(car, data.history, data.now),
        stageTarget(data.settings, car.stage),
      ) === "over",
  ).length;
  const cars = data.vehicles.filter(
    (car) =>
      (archived || car.status === "active") &&
      (!blocked || !!car.blocker) &&
      (!stage || car.stage === stage) &&
      (!tech ||
        data.jobs.some(
          (job) => job.vehicle_id === car.id && job.tech_id === tech,
        )) &&
      `${car.stock_number} ${car.year} ${car.make} ${car.model} ${car.vin ?? ""}`
        .toLowerCase()
        .includes(search.toLowerCase()),
  );
  const stages = STAGES.filter(
    (s) => (archived || s !== "sold") && (!stage || s === stage),
  );
  return (
    <ShopShell profiles={data.profiles} title="Recon board">
      <div className="page-heading">
        <div>
          <div className="eyebrow">FROM AUCTION TO FRONTLINE</div>
          <h1>
            Recon board<span className="title-dot">.</span>
          </h1>
          <p>Every car, its next step, and what’s holding it up.</p>
        </div>
        <Button asChild>
          <Link href="/vehicles/new">
            <Plus />
            Add vehicle
          </Link>
        </Button>
      </div>
      <section className="board-stats" aria-label="Shop summary">
        <div>
          <CarFront />
          <strong>{active.length}</strong>
          <span>In the shop</span>
        </div>
        <div>
          <Flag />
          <strong>{active.filter((c) => c.blocker).length}</strong>
          <span>Blocked</span>
        </div>
        <div>
          <Clock3 />
          <strong>{overdue}</strong>
          <span>Over stage target</span>
        </div>
        <div className="board-stat-note">
          Shared workspace<span>Changes save for everyone.</span>
        </div>
      </section>
      <div className="board-toolbar">
        <label className="board-search">
          <Search size={20} />
          <input
            aria-label="Search vehicles"
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Stock #, vehicle or VIN"
          />
        </label>
        <select
          aria-label="Filter by technician"
          value={tech}
          onChange={(e) => setTech(e.target.value)}
        >
          <option value="">All technicians</option>
          {data.profiles
            .filter((p) => p.role === "tech")
            .map((p) => (
              <option key={p.id} value={p.id}>
                {p.full_name}
              </option>
            ))}
        </select>
        <select
          aria-label="Filter by stage"
          value={stage}
          onChange={(e) => setStage(e.target.value)}
        >
          <option value="">All stages</option>
          {STAGES.filter((s) => archived || s !== "sold").map((s) => (
            <option key={s} value={s}>
              {STAGE_LABELS[s]}
            </option>
          ))}
        </select>
        <button
          className={`filter-button ${blocked ? "selected" : ""}`}
          aria-pressed={blocked}
          onClick={() => setBlocked(!blocked)}
        >
          <Flag size={18} />
          Blocked only
        </button>
        <button
          className={`filter-button ${archived ? "selected" : ""}`}
          aria-pressed={archived}
          onClick={() => {
            setArchived(!archived);
            if (stage === "sold") setStage("");
          }}
        >
          Include archived
        </button>
        <button
          className="icon-button"
          aria-label="Refresh board"
          disabled={pending}
          onClick={() => startRefresh(() => router.refresh())}
        >
          <RefreshCw className={pending ? "spin" : ""} />
        </button>
      </div>
      <div className="board-caption">
        <span>
          {cars.length} vehicle{cars.length === 1 ? "" : "s"} shown{" "}
          <span className="muted">
            · Stage times come from recorded history
          </span>
        </span>
        <div className="view-switch">
          <button
            aria-label="Board view"
            aria-pressed={view === "board"}
            onClick={() => setView("board")}
          >
            <LayoutDashboard size={18} />
          </button>
          <button
            aria-label="List view"
            aria-pressed={view === "list"}
            onClick={() => setView("list")}
          >
            <List size={18} />
          </button>
        </div>
      </div>
      {cars.length === 0 ? (
        <div className="empty-state board-empty">
          <CarFront size={42} />
          <h2>No vehicles match</h2>
          <p>Adjust the filters or add your first vehicle.</p>
          <Button
            variant="outline"
            onClick={() => {
              setSearch("");
              setTech("");
              setStage("");
              setBlocked(false);
            }}
          >
            Clear filters
          </Button>
        </div>
      ) : (
        <div className={`board-scroll ${view === "list" ? "list-view" : ""}`}>
          <div className="kanban">
            {stages.map((s) => {
              const group = cars.filter((car) => car.stage === s);
              return (
                <section
                  key={s}
                  className={`kanban-column ${group.length === 0 ? "empty-column" : ""}`}
                  aria-label={`${STAGE_LABELS[s]} vehicles`}
                >
                  <header className="column-heading">
                    <h2>
                      <span className={`stage-dot dot-${s}`} />
                      {STAGE_LABELS[s]}
                    </h2>
                    <span>{group.length}</span>
                  </header>
                  <div className="column-cards">
                    {group.map((car) => {
                      const days = stageAge(car, data.history, data.now),
                        target = stageTarget(data.settings, car.stage),
                        state = ageState(days, target),
                        total = purchaseAge(car.purchase_date, data.now),
                        ordered = data.parts.some(
                          (p) => p.vehicle_id === car.id,
                        );
                      const assigned = [
                        ...new Set(
                          data.jobs
                            .filter((j) => j.vehicle_id === car.id && j.tech_id)
                            .map(
                              (j) =>
                                data.profiles.find((p) => p.id === j.tech_id)
                                  ?.full_name,
                            )
                            .filter(Boolean),
                        ),
                      ];
                      return (
                        <article
                          key={car.id}
                          className={`recon-card age-${state}`}
                        >
                          <Link
                            href={`/vehicles/${car.id}`}
                            className="card-open"
                          >
                            <div className="card-stock">
                              <span>#{car.stock_number}</span>
                              <ArrowUpRight size={18} />
                            </div>
                            <h3>
                              {car.year} {car.make}
                              <br />
                              {car.model}
                            </h3>
                            <div className="card-times">
                              <span className={`age-badge age-${state}`}>
                                <Clock3 size={14} />
                                {ageLabel(days)} in stage
                              </span>
                              <span>{total}d total</span>
                            </div>
                            <p className="target-caption">
                              Target: {target} day{target === 1 ? "" : "s"}{" "}
                              {state === "over"
                                ? "· Over target"
                                : state === "warning"
                                  ? "· Near target"
                                  : ""}
                            </p>
                            {car.blocker && (
                              <div className="car-blocker">
                                <Flag size={15} />
                                {BLOCKER_LABELS[car.blocker]}
                              </div>
                            )}
                            {!car.blocker && ordered && (
                              <div className="parts-hint">
                                <Package size={15} />
                                Parts on order
                              </div>
                            )}
                            <div className="card-assigned">
                              {assigned.length
                                ? assigned.join(", ")
                                : "No tech assigned"}
                            </div>
                            <div className="card-budget">
                              Budget{" "}
                              <strong>
                                {formatMoney(car.recon_budget_cents)}
                              </strong>
                            </div>
                          </Link>
                          <VehicleActions car={car} compact />
                        </article>
                      );
                    })}
                    {!group.length && (
                      <div className="column-empty">No vehicles here</div>
                    )}
                  </div>
                </section>
              );
            })}
          </div>
        </div>
      )}
    </ShopShell>
  );
}
