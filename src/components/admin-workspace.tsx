"use client";
import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "./ui/button";
import { JobEditor } from "./job-editor";
import { BLOCKER_LABELS, shopDate } from "@/lib/vehicles";
import type { WorkData, WorkJob } from "@/lib/jobs";
function stamp(value: string | null) {
  return value
    ? new Intl.DateTimeFormat("en-US", {
        timeZone: "America/New_York",
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
      }).format(new Date(value))
    : "—";
}
export function AdminWorkspace({
  data,
  today,
}: {
  data: WorkData;
  today: string;
}) {
  const [day, setDay] = useState(today),
    [tech, setTech] = useState(""),
    [scope, setScope] = useState("day"),
    [edit, setEdit] = useState<WorkJob | null>(null),
    [adding, setAdding] = useState(false),
    [pending, start] = useTransition();
  const router = useRouter();
  const active = data.vehicles.filter((v) => v.status === "active"),
    open = data.jobs.filter(
      (j) =>
        active.some((v) => v.id === j.vehicle_id) &&
        !["done", "cancelled"].includes(j.status),
    );
  const worked = data.jobs
    .filter(
      (j) =>
        (!tech || j.tech_id === tech) &&
        (scope === "open"
          ? open.some((o) => o.id === j.id)
          : scope === "all" ||
            [j.started_at, j.completed_at].some(
              (t) => t && shopDate(new Date(t)) === day,
            )),
    )
    .sort((a, b) =>
      (b.completed_at ?? b.started_at ?? "").localeCompare(
        a.completed_at ?? a.started_at ?? "",
      ),
    );
  return (
    <>
      <div className="page-heading">
        <div>
          <div className="eyebrow">SHOP OVERVIEW</div>
          <h1>Today in the shop</h1>
          <p>Work, handoffs and hours in one place.</p>
        </div>
        <div className="admin-heading-actions">
          <Button
            variant="outline"
            disabled={pending}
            onClick={() => start(() => router.refresh())}
          >
            Refresh
          </Button>
          <Button asChild>
            <Link href="/vehicles/new">Add vehicle</Link>
          </Button>
          <Button onClick={() => setAdding(true)}>Assign work</Button>
        </div>
      </div>
      <div className="admin-overview">
        <div>
          <strong>{active.length}</strong>
          <span>Cars in the shop</span>
        </div>
        <div>
          <strong>
            {open.filter((j) => j.status === "in_progress").length}
          </strong>
          <span>Jobs in progress</span>
        </div>
        <div>
          <strong>{open.filter((j) => !j.tech_id).length}</strong>
          <span>Need assignment</span>
        </div>
        <div>
          <strong>
            {
              data.parts.filter(
                (p) => p.status === "needed" || p.status === "ordered",
              ).length
            }
          </strong>
          <span>Parts needed / on order</span>
        </div>
      </div>
      {active.some((v) => v.blocker) && (
        <section className="admin-blocked">
          <h2>Needs attention</h2>
          {active
            .filter((v) => v.blocker)
            .map((v) => (
              <Link href={`/vehicles/${v.id}`} key={v.id}>
                <strong>
                  #{v.stock_number} · {v.make} {v.model}
                </strong>
                <span>
                  {BLOCKER_LABELS[v.blocker!]}
                  {v.blocker_note ? " · " + v.blocker_note : ""}
                </span>
              </Link>
            ))}
        </section>
      )}
      <section className="work-ledger">
        <h2>Work log & book hours</h2>
        <div className="ledger-filters">
          <label className="field">
            Show
            <select value={scope} onChange={(e) => setScope(e.target.value)}>
              <option value="day">Worked on this date</option>
              <option value="open">All open work</option>
              <option value="all">All work</option>
            </select>
          </label>
          {scope === "day" && (
            <label className="field">
              Date
              <input
                type="date"
                value={day}
                onChange={(e) => setDay(e.target.value)}
              />
            </label>
          )}
          <label className="field">
            Technician
            <select value={tech} onChange={(e) => setTech(e.target.value)}>
              <option value="">Everyone</option>
              {data.profiles
                .filter(
                  (p) =>
                    p.role === "tech" ||
                    data.jobs.some((j) => j.tech_id === p.id),
                )
                .map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.full_name}
                  </option>
                ))}
            </select>
          </label>
        </div>
        <p className="form-hint">
          Book hours are assigned labor units, not elapsed time. Dates and times
          use Cleveland time.
        </p>
        <div className="ledger-rows">
          {worked.map((j) => {
            const car = data.vehicles.find((v) => v.id === j.vehicle_id);
            return (
              <article className="ledger-row" key={j.id}>
                <div>
                  <Link href={`/vehicles/${j.vehicle_id}`}>
                    #{car?.stock_number} · {car?.make} {car?.model}
                  </Link>
                  <h3>{j.title}</h3>
                  <p>
                    {data.profiles.find((p) => p.id === j.tech_id)?.full_name ??
                      "Unassigned"}{" "}
                    · {j.status.replaceAll("_", " ")}
                  </p>
                </div>
                <div>
                  <span>Started</span>
                  <strong>{stamp(j.started_at)}</strong>
                  <span>Completed</span>
                  <strong>{stamp(j.completed_at)}</strong>
                </div>
                <div>
                  <strong>{j.book_hours.toFixed(2)} h</strong>
                  {j.pay_week_id ? (
                    <span>Paid · locked</span>
                  ) : (
                    <Button
                      variant="outline"
                      disabled={j.status === "cancelled"}
                      onClick={() => setEdit(j)}
                    >
                      Assign / edit hours
                    </Button>
                  )}
                </div>
              </article>
            );
          })}
        </div>
        {!worked.length && (
          <div className="quiet-empty">
            <p>No work matches this view.</p>
            <Button variant="outline" onClick={() => setScope("open")}>
              Show open work
            </Button>
          </div>
        )}
      </section>
      {(adding || edit) && (
        <JobEditor
          data={data}
          job={edit ?? undefined}
          onClose={() => {
            setAdding(false);
            setEdit(null);
          }}
        />
      )}
    </>
  );
}
