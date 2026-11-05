"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useActor } from "./shop-shell";
import { JobCard } from "./job-card";
import { Button } from "./ui/button";
import { PartsList, PartRequest, PART_LABELS } from "./parts-workspace";
import { STAGE_LABELS } from "@/lib/domain";
import { BLOCKER_LABELS } from "@/lib/vehicles";
import type { WorkData } from "@/lib/jobs";
export function TechnicianWorkspace({
  data,
  today,
}: {
  data: WorkData;
  today: string;
}) {
  const { actor, setActor } = useActor(),
    router = useRouter();
  const [tab, setTab] = useState("mine"),
    [search, setSearch] = useState(""),
    [partFilter, setPartFilter] = useState("open"),
    [request, setRequest] = useState<string | null>(null),
    [pending, start] = useTransition();
  const active = data.vehicles.filter((v) => v.status === "active");
  const visibleCars = tab === "done" ? data.vehicles : active;
  const own = data.jobs.filter(
    (j) =>
      j.tech_id === actor && visibleCars.some((v) => v.id === j.vehicle_id),
  );
  const cars = visibleCars
    .filter(
      (v) =>
        (tab === "cars" ||
          own.some(
            (j) =>
              j.vehicle_id === v.id &&
              (tab === "done"
                ? j.status === "done"
                : !["done", "cancelled"].includes(j.status)),
          )) &&
        `${v.stock_number} ${v.make} ${v.model}`
          .toLowerCase()
          .includes(search.toLowerCase()),
    )
    .sort(
      (a, b) =>
        Number(
          data.jobs.some(
            (j) =>
              j.vehicle_id === b.id &&
              j.status === "in_progress" &&
              j.tech_id === actor,
          ),
        ) -
        Number(
          data.jobs.some(
            (j) =>
              j.vehicle_id === a.id &&
              j.status === "in_progress" &&
              j.tech_id === actor,
          ),
        ),
    );
  const parts = data.parts.filter(
    (p) =>
      active.some((v) => v.id === p.vehicle_id) &&
      (partFilter === "open"
        ? ["needed", "ordered", "received"].includes(p.status)
        : p.status === partFilter),
  );
  return (
    <>
      <div className="floor-heading">
        <div>
          <h1>
            {tab === "mine"
              ? "My work"
              : tab === "cars"
                ? "Shop cars"
                : tab === "parts"
                  ? "Parts"
                  : "Completed work"}
          </h1>
          <p>
            {actor
              ? data.profiles.find((p) => p.id === actor)?.full_name
              : "Choose your name to get started"}
          </p>
        </div>
        <Button
          variant="outline"
          disabled={pending}
          onClick={() => start(() => router.refresh())}
        >
          {pending ? "Refreshing…" : "Refresh"}
        </Button>
      </div>
      {!actor ? (
        <section className="choose-person">
          <h2>Who is using this device?</h2>
          <div>
            {data.profiles
              .filter((p) => p.active)
              .map((p) => (
                <Button
                  key={p.id}
                  variant="outline"
                  onClick={() => setActor(p.id)}
                >
                  {p.full_name}
                </Button>
              ))}
          </div>
        </section>
      ) : (
        <>
          {tab !== "parts" && (
            <input
              className="floor-search"
              aria-label="Find a car"
              placeholder="Find stock number or car"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          )}
          {tab === "parts" ? (
            <>
              <div className="floor-filters">
                {["open", "needed", "ordered", "received"].map((s) => (
                  <button
                    key={s}
                    aria-pressed={partFilter === s}
                    onClick={() => setPartFilter(s)}
                  >
                    {s === "open"
                      ? "All open"
                      : PART_LABELS[s as keyof typeof PART_LABELS]}
                  </button>
                ))}
              </div>
              <PartsList data={data} parts={parts} technician />
            </>
          ) : (
            <div className="floor-cars">
              {cars.map((car) => {
                const jobs = data.jobs.filter(
                  (j) =>
                    j.vehicle_id === car.id &&
                    (tab === "cars"
                      ? !["done", "cancelled"].includes(j.status)
                      : j.tech_id === actor &&
                        (tab === "done"
                          ? j.status === "done"
                          : !["done", "cancelled"].includes(j.status))),
                );
                const carParts = data.parts.filter(
                  (p) =>
                    p.vehicle_id === car.id &&
                    ["needed", "ordered", "received"].includes(p.status),
                );
                return (
                  <section className="floor-car" key={car.id}>
                    <header>
                      <div>
                        <strong className="floor-stock">
                          #{car.stock_number}
                        </strong>
                        <h2>
                          {car.year} {car.make} {car.model}
                        </h2>
                      </div>
                      <span className="floor-stage">
                        {STAGE_LABELS[car.stage]}
                      </span>
                    </header>
                    {car.blocker && (
                      <p className="floor-blocker">
                        {BLOCKER_LABELS[car.blocker]}
                        {car.blocker_note ? " · " + car.blocker_note : ""}
                      </p>
                    )}
                    <div className="floor-part-summary">
                      {carParts.length ? (
                        ["needed", "ordered", "received"].map((s) => {
                          const count = carParts.filter(
                            (p) => p.status === s,
                          ).length;
                          return count ? (
                            <span key={s} className={"part-state part-" + s}>
                              {count}{" "}
                              {PART_LABELS[s as keyof typeof PART_LABELS]}
                            </span>
                          ) : null;
                        })
                      ) : (
                        <span>No parts requests recorded</span>
                      )}
                    </div>
                    {jobs.length ? (
                      jobs.map((j) => (
                        <JobCard
                          key={j.id}
                          job={j}
                          data={data}
                          today={today}
                          simple
                        />
                      ))
                    ) : (
                      <p className="quiet-empty">
                        No open repair tasks assigned yet.
                      </p>
                    )}
                    <details className="floor-parts">
                      <summary>Parts on this car ({carParts.length})</summary>
                      <PartsList data={data} parts={carParts} technician />
                      <Button
                        variant="outline"
                        onClick={() => setRequest(car.id)}
                      >
                        Request a part for this car
                      </Button>
                    </details>
                  </section>
                );
              })}
            </div>
          )}
          {tab !== "parts" && !cars.length && (
            <div className="quiet-empty">
              <h2>
                {tab === "done"
                  ? "No completed work yet"
                  : "No cars in this list"}
              </h2>
              <p>
                {tab === "mine"
                  ? "Your assigned work will appear here. You can still check every car in the shop."
                  : "Try another stock number or view."}
              </p>
              <Button
                onClick={() => {
                  setTab("cars");
                  setSearch("");
                }}
              >
                See shop cars
              </Button>
            </div>
          )}
        </>
      )}
      <nav className="floor-nav" aria-label="Technician navigation">
        {[
          ["mine", "My work"],
          ["cars", "Shop cars"],
          ["parts", "Parts"],
          ["done", "Done"],
        ].map(([key, label]) => (
          <button
            key={key}
            aria-current={tab === key ? "page" : undefined}
            onClick={() => {
              setTab(key);
              setSearch("");
            }}
          >
            {label}
          </button>
        ))}
      </nav>
      {request && (
        <PartRequest
          data={data}
          vehicleId={request}
          onClose={() => setRequest(null)}
        />
      )}
    </>
  );
}
