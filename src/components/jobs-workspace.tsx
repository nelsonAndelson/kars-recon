"use client";
import { useState } from "react";
import { Plus, Wrench, Clock3, RotateCcw, Search } from "lucide-react";
import { Button } from "./ui/button";
import { useActor } from "./shop-shell";
import { JobCard } from "./job-card";
import { JobEditor } from "./job-editor";
import type { WorkData } from "@/lib/jobs";
export function JobsWorkspace({
  data,
  today,
}: {
  data: WorkData;
  today: string;
}) {
  const { actor } = useActor();
  const [tech, setTech] = useState(""),
    [status, setStatus] = useState("open"),
    [search, setSearch] = useState(""),
    [create, setCreate] = useState(false);
  const selected = tech === "mine" ? actor : tech;
  // Keep filter grouping explicit: All includes completed and cancelled jobs.
  const filtered = data.jobs
    .filter(
      (j) =>
        (!selected || j.tech_id === selected) &&
        (status === "all" ||
          (status === "open"
            ? !["done", "cancelled"].includes(j.status)
            : j.status === status)),
    )
    .filter((j) => {
      const car = data.vehicles.find((v) => v.id === j.vehicle_id);
      return `${j.title} ${car?.stock_number} ${car?.make} ${car?.model}`
        .toLowerCase()
        .includes(search.toLowerCase());
    });
  const open = data.jobs.filter(
    (j) =>
      !["done", "cancelled"].includes(j.status) &&
      (!selected || j.tech_id === selected),
  );
  return (
    <>
      <div className="page-heading">
        <div>
          <div className="eyebrow">THE WORK IN FRONT OF YOU</div>
          <h1>
            Jobs & hours<span className="title-dot">.</span>
          </h1>
          <p>Book hours, clear handoffs, and every repair accounted for.</p>
        </div>
        <Button onClick={() => setCreate(true)}>
          <Plus />
          Add job
        </Button>
      </div>
      <section className="work-stats">
        <div>
          <Wrench />
          <strong>{open.length}</strong>
          <span>Open jobs</span>
        </div>
        <div>
          <Clock3 />
          <strong>
            {open.reduce((n, j) => n + Math.round(j.book_hours * 100), 0) / 100}
          </strong>
          <span>Book hours remaining</span>
        </div>
        <div>
          <RotateCcw />
          <strong>{open.filter((j) => j.is_comeback).length}</strong>
          <span>Open comebacks</span>
        </div>
      </section>
      <div className="work-toolbar">
        <label className="board-search">
          <Search size={20} />
          <input
            aria-label="Search jobs"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Job title or stock number"
          />
        </label>
        <label className="compact-field">
          Technician
          <select
            aria-label="Job technician filter"
            value={tech}
            onChange={(e) => setTech(e.target.value)}
          >
            <option value="mine">
              Working as{" "}
              {data.profiles.find((p) => p.id === actor)?.full_name ?? "shared"}
            </option>
            <option value="">All technicians</option>
            {data.profiles
              .filter((p) => p.role === "tech")
              .map((p) => (
                <option key={p.id} value={p.id}>
                  {p.full_name}
                </option>
              ))}
          </select>
        </label>
        <label className="compact-field">
          Show
          <select
            aria-label="Job status filter"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
          >
            <option value="open">Open jobs</option>
            <option value="done">Completed</option>
            <option value="cancelled">Cancelled</option>
            <option value="all">All jobs</option>
          </select>
        </label>
      </div>
      {tech === "mine" &&
        !data.profiles.some((p) => p.id === actor && p.role === "tech") && (
          <p className="notice">
            Choose a technician above to see their jobs. “Working as” records a
            self-reported name; everyone can view all work.
          </p>
        )}
      <p className="results-caption">
        {filtered.length} job{filtered.length === 1 ? "" : "s"} shown
      </p>
      <div className="jobs-grid">
        {filtered.map((job) => (
          <JobCard
            key={job.id}
            job={job}
            data={data}
            today={today}
            showVehicle
          />
        ))}
      </div>
      {!filtered.length && (
        <div className="empty-state board-empty">
          <Wrench size={36} />
          <h2>No jobs here</h2>
          <p>Choose another technician or add work to a vehicle.</p>
          <Button
            variant="outline"
            onClick={() => {
              setTech("");
              setStatus("all");
              setSearch("");
            }}
          >
            Show all jobs
          </Button>
        </div>
      )}
      {create && <JobEditor data={data} onClose={() => setCreate(false)} />}
    </>
  );
}
