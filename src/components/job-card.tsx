"use client";
import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Play,
  Check,
  RotateCcw,
  PackagePlus,
  Flag,
  Pencil,
  LockKeyhole,
} from "lucide-react";
import { Button } from "./ui/button";
import { ActionDialog } from "./action-dialog";
import { JobEditor } from "./job-editor";
import { useActor } from "./shop-shell";
import { jobAction, payAction, type WorkResult } from "@/app/work-actions";
import { flagVehicle } from "@/app/actions";
import { dollarsToCents, type WorkData, type WorkJob } from "@/lib/jobs";
import { BLOCKER_LABELS } from "@/lib/vehicles";
import { BLOCKERS } from "@/lib/domain";
import { formatMoney } from "@/lib/money";
export function JobCard({
  job,
  data,
  today,
  showVehicle = false,
}: {
  job: WorkJob;
  data: WorkData;
  today: string;
  showVehicle?: boolean;
}) {
  const { actor } = useActor(),
    router = useRouter();
  const [mode, setMode] = useState<
    | "edit"
    | "comeback"
    | "done"
    | "need_part"
    | "block"
    | "override"
    | "cancel"
    | "reopen"
    | null
  >(null);
  const [pending, start] = useTransition(),
    [error, setError] = useState(""),
    [message, setMessage] = useState("");
  const car = data.vehicles.find((v) => v.id === job.vehicle_id)!;
  const tech = data.profiles.find((p) => p.id === job.tech_id),
    original = data.jobs.find((j) => j.id === job.original_job_id);
  const originalTech = data.profiles.find((p) => p.id === original?.tech_id);
  const outstanding = data.parts.filter(
    (p) =>
      p.job_id === job.id &&
      ["needed", "ordered", "received"].includes(p.status),
  );
  const isOwner = data.profiles.some(
    (p) => p.id === actor && p.role === "owner" && p.active,
  );
  const override = job.override as {
    amount_cents?: number;
    reason?: string;
  } | null;
  const mutable = !job.pay_week_id,
    open = !["done", "cancelled"].includes(job.status),
    active = car.status === "active";
  function openMode(next: typeof mode) {
    setError("");
    setMessage("");
    setMode(next);
  }
  function run(action: () => Promise<WorkResult>, success: string) {
    setError("");
    setMessage("");
    start(async () => {
      try {
        const result = await action();
        if (!result.ok) {
          setError(result.error);
          return;
        }
        setMode(null);
        setMessage(success);
        router.refresh();
      } catch {
        setError("Could not save. Check your connection and try again.");
      }
    });
  }
  function command(command: string, extra: Record<string, unknown> = {}) {
    return jobAction({
      command,
      job_id: job.id,
      revision: job.revision,
      actor_id: actor,
      ...extra,
    });
  }
  return (
    <article className={`job-card ${job.is_comeback ? "comeback-card" : ""}`}>
      <div className="job-card-top">
        <div>
          {showVehicle && (
            <Link className="job-stock" href={`/vehicles/${car.id}`}>
              #{car.stock_number} · {car.year} {car.make} {car.model}
            </Link>
          )}
          <h3>{job.title}</h3>
          <p>
            {tech?.full_name ?? "Unassigned"} <span>·</span>{" "}
            {job.book_hours.toFixed(2)} book hours <span>·</span> {job.category}
          </p>
        </div>
        <span className={`job-status status-${job.status}`}>
          {job.status.replaceAll("_", " ")}
        </span>
      </div>
      {job.notes && <p className="job-note">{job.notes}</p>}
      {job.is_comeback && (
        <div className="comeback-note">
          <RotateCcw size={16} />
          <div>
            <strong>
              Comeback · {formatMoney(override?.amount_cents ?? 0)} labor pay
            </strong>
            <p>
              Original: {original?.title ?? "Original job"} ·{" "}
              {originalTech?.full_name ?? "Unassigned"}
              {override?.reason ? ` · Override: ${override.reason}` : ""}
            </p>
          </div>
        </div>
      )}
      {car.blocker && (
        <div className="job-blocker">
          <Flag size={15} />
          {BLOCKER_LABELS[car.blocker]}
          {car.blocker_note ? ` · ${car.blocker_note}` : ""}
        </div>
      )}
      {job.pay_week_id && (
        <p className="locked-job">
          <LockKeyhole size={16} />
          Paid week locked · job is read-only
        </p>
      )}
      {mutable && (
        <div className="job-actions">
          {active && ["pending", "approved"].includes(job.status) && (
            <Button
              disabled={pending}
              onClick={() => run(() => command("start"), "Job started.")}
            >
              <Play />
              Start
            </Button>
          )}
          {active &&
            ["pending", "approved", "in_progress"].includes(job.status) && (
              <Button disabled={pending} onClick={() => openMode("done")}>
                <Check />
                Done
              </Button>
            )}
          {job.status !== "cancelled" && (
            <Button
              variant="outline"
              disabled={pending}
              onClick={() => openMode("edit")}
            >
              <Pencil />
              Edit
            </Button>
          )}
          {open && active && (
            <>
              <Button
                variant="outline"
                disabled={pending}
                onClick={() => openMode("need_part")}
              >
                <PackagePlus />
                Need part
              </Button>
              <Button
                variant="outline"
                disabled={pending}
                onClick={() => openMode("block")}
              >
                <Flag />
                Blocked
              </Button>
            </>
          )}
          {active && !open && (
            <Button
              variant="outline"
              disabled={pending}
              onClick={() => openMode("reopen")}
            >
              Reopen
            </Button>
          )}
          {active && job.status !== "cancelled" && (
            <button
              className="text-action"
              disabled={pending}
              onClick={() => openMode("cancel")}
            >
              Cancel job
            </button>
          )}
          {job.is_comeback && isOwner && job.status !== "cancelled" && (
            <button
              className="text-action"
              disabled={pending}
              onClick={() => openMode("override")}
            >
              Pay override
            </button>
          )}
        </div>
      )}
      {job.status === "done" && active && (
        <button
          className="text-action"
          disabled={pending}
          onClick={() => openMode("comeback")}
        >
          <RotateCcw size={16} />
          Record comeback
        </button>
      )}
      {job.completed_at && (
        <p className="job-date">
          Completed{" "}
          {new Intl.DateTimeFormat("en-US", {
            timeZone: "America/New_York",
            dateStyle: "medium",
          }).format(new Date(job.completed_at))}
        </p>
      )}
      {message && (
        <p className="action-feedback" role="status">
          {message}
        </p>
      )}
      {error && !mode && (
        <p role="alert" className="form-error">
          {error}
        </p>
      )}
      {(mode === "edit" || mode === "comeback") && (
        <JobEditor
          data={data}
          job={mode === "edit" ? job : undefined}
          original={mode === "comeback" ? job : undefined}
          vehicleId={car.id}
          onClose={() => setMode(null)}
        />
      )}
      {mode && !["edit", "comeback"].includes(mode) && (
        <ActionDialog
          title={
            mode === "done"
              ? "Complete job"
              : mode === "need_part"
                ? "Request a part"
                : mode === "block"
                  ? "Vehicle blocker"
                  : mode === "override"
                    ? "Comeback pay override"
                    : mode === "cancel"
                      ? "Cancel this job?"
                      : "Reopen this job?"
          }
          onClose={() => {
            if (!pending) setMode(null);
          }}
        >
          <p className="dialog-description">{job.title}</p>
          <form
            onSubmit={(event) => {
              event.preventDefault();
              const values = new FormData(event.currentTarget);
              if (mode === "done")
                run(
                  () =>
                    command("done", {
                      completed_date: values.get("completed_date"),
                      parts: Object.fromEntries(
                        outstanding.map((p) => [p.id, values.get(p.id)]),
                      ),
                    }),
                  "Job completed. Weekly pay updated.",
                );
              else if (mode === "need_part")
                run(
                  () => command("need_part", { note: values.get("note") }),
                  "Part request recorded on the timeline.",
                );
              else if (mode === "block")
                run(
                  () =>
                    flagVehicle({
                      vehicle_id: car.id,
                      actor_id: actor,
                      blocker: values.get("blocker"),
                      note: values.get("note"),
                    }),
                  "Vehicle blocker saved.",
                );
              else if (mode === "override") {
                try {
                  const amount = dollarsToCents(String(values.get("amount")));
                  run(
                    () =>
                      payAction({
                        command: "override",
                        actor_id: actor,
                        job_id: job.id,
                        revision: job.revision,
                        expected_override: job.override,
                        amount_cents: amount,
                        reason: values.get("reason"),
                      }),
                    "Comeback pay override recorded.",
                  );
                } catch (error) {
                  setError(
                    error instanceof Error
                      ? error.message
                      : "Check the amount.",
                  );
                }
              } else if (mode === "cancel" || mode === "reopen")
                run(
                  () => command(mode),
                  mode === "cancel" ? "Job cancelled." : "Job reopened.",
                );
            }}
          >
            <fieldset className="plain-fieldset" disabled={pending}>
              {mode === "done" && (
                <>
                  <label className="field">
                    Completion date
                    <input
                      type="date"
                      name="completed_date"
                      required
                      defaultValue={today}
                      min={car.purchase_date}
                      max={today}
                    />
                  </label>
                  <p className="form-hint">
                    Pay uses this date in Cleveland time. Select an earlier date
                    only when recording work already completed.
                  </p>
                  <h3 className="parts-question">Were all parts used?</h3>
                  {outstanding.length ? (
                    outstanding.map((part) => (
                      <label className="field" key={part.id}>
                        {part.name} · {part.status}
                        <select name={part.id} required defaultValue="">
                          <option value="" disabled>
                            Select disposition
                          </option>
                          {part.status === "received" && (
                            <option value="used">Used — mark installed</option>
                          )}
                          <option value="unused">
                            Not used — send to returns
                          </option>
                        </select>
                      </label>
                    ))
                  ) : (
                    <p className="notice">
                      No outstanding parts are linked to this job.
                    </p>
                  )}
                  <p className="form-hint">
                    Unused linked parts move to the returns queue. Received
                    parts marked used become installed.
                  </p>
                </>
              )}
              {mode === "need_part" && (
                <>
                  <p className="notice">
                    Record what is needed. This flags the vehicle as waiting on
                    parts if it has no blocker, and preserves any existing
                    blocker.
                  </p>
                  <label className="field">
                    Part needed
                    <textarea
                      name="note"
                      required
                      maxLength={1000}
                      placeholder="Name, part number, or what the technician needs"
                    />
                  </label>
                </>
              )}
              {mode === "block" && (
                <>
                  <label className="field">
                    Blocker
                    <select
                      name="blocker"
                      defaultValue={car.blocker ?? "waiting_parts"}
                    >
                      {BLOCKERS.map((b) => (
                        <option key={b} value={b}>
                          {BLOCKER_LABELS[b]}
                        </option>
                      ))}
                      <option value="">Clear blocker</option>
                    </select>
                  </label>
                  <label className="field">
                    Note <span className="optional">required for Other</span>
                    <textarea
                      name="note"
                      maxLength={1000}
                      defaultValue={car.blocker_note ?? ""}
                    />
                  </label>
                </>
              )}
              {mode === "override" && (
                <>
                  <p className="notice">
                    Owner:{" "}
                    {data.profiles.find((p) => p.id === actor)?.full_name}{" "}
                    (self-reported). This is the total labor pay for this
                    comeback, replacing its default $0.
                  </p>
                  <label className="field">
                    Override pay ($)
                    <input
                      name="amount"
                      required
                      inputMode="decimal"
                      type="number"
                      min="0"
                      max="10000000"
                      step="0.01"
                      defaultValue={(
                        (override?.amount_cents ?? 0) / 100
                      ).toFixed(2)}
                    />
                  </label>
                  <label className="field">
                    Reason
                    <textarea name="reason" required maxLength={1000} />
                  </label>
                </>
              )}
              {mode === "cancel" && (
                <p className="notice">
                  This removes the job from open work and live pay. Its history
                  stays available. You can reopen an unlocked job later.
                </p>
              )}
              {mode === "reopen" && (
                <p className="notice">
                  This returns the job to Pending and removes its completion
                  from live pay. Its hours and notes are retained.
                </p>
              )}
            </fieldset>
            {error && (
              <p role="alert" className="form-error">
                {error}
              </p>
            )}
            <Button type="submit" disabled={pending}>
              {pending
                ? "Saving…"
                : mode === "done"
                  ? "Complete job"
                  : mode === "cancel"
                    ? "Cancel job"
                    : mode === "reopen"
                      ? "Reopen job"
                      : "Save"}
            </Button>
          </form>
        </ActionDialog>
      )}
    </article>
  );
}
