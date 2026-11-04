"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ActionDialog } from "./action-dialog";
import { Button } from "./ui/button";
import { useActor } from "./shop-shell";
import { JOB_CATEGORIES, type WorkData, type WorkJob } from "@/lib/jobs";
import { jobAction } from "@/app/work-actions";
export function JobEditor({
  data,
  vehicleId,
  job,
  original,
  onClose,
}: {
  data: WorkData;
  vehicleId?: string;
  job?: WorkJob;
  original?: WorkJob;
  onClose: () => void;
}) {
  const { actor } = useActor(),
    router = useRouter();
  const [id] = useState(() => crypto.randomUUID());
  const [pending, start] = useTransition();
  const [error, setError] = useState("");
  const technicians = data.profiles.filter(
    (p) => p.role === "tech" && p.active,
  );
  return (
    <ActionDialog
      title={job ? "Edit job" : original ? "Record comeback" : "Add a job"}
      onClose={() => {
        if (!pending) onClose();
      }}
    >
      <form
        onSubmit={(event) => {
          event.preventDefault();
          const values = Object.fromEntries(new FormData(event.currentTarget));
          setError("");
          start(async () => {
            try {
              const result = await jobAction(
                job
                  ? {
                      command: "edit",
                      job_id: job.id,
                      revision: job.revision,
                      actor_id: actor,
                      ...values,
                    }
                  : {
                      command: "create",
                      id,
                      actor_id: actor,
                      ...values,
                      vehicle_id:
                        vehicleId ?? original?.vehicle_id ?? values.vehicle_id,
                      is_comeback: !!original,
                      original_job_id: original?.id ?? "",
                    },
              );
              if (!result.ok) {
                setError(result.error);
                return;
              }
              onClose();
              router.refresh();
            } catch {
              setError("Could not save this job. Your entries are still here.");
            }
          });
        }}
      >
        <fieldset disabled={pending} className="plain-fieldset">
          {!vehicleId && !job && !original && (
            <label className="field">
              Vehicle
              <select name="vehicle_id" required defaultValue="">
                <option value="" disabled>
                  Select an active vehicle
                </option>
                {data.vehicles
                  .filter((v) => v.status === "active")
                  .map((v) => (
                    <option key={v.id} value={v.id}>
                      #{v.stock_number} · {v.year} {v.make} {v.model}
                    </option>
                  ))}
              </select>
            </label>
          )}
          {original && (
            <p className="notice">
              Original: {original.title}. Comeback labor earns $0 unless an
              owner records a pay override.
            </p>
          )}
          {job?.status === "done" && (
            <p className="notice">
              This unpaid job is completed. Changes to hours or technician
              recalculate its unlocked pay week.
            </p>
          )}
          <label className="field">
            Job title
            <input
              name="title"
              required
              maxLength={160}
              defaultValue={
                job?.title ?? (original ? `Comeback: ${original.title}` : "")
              }
              placeholder="e.g. Replace front brake pads"
            />
          </label>
          <div className="form-grid">
            <label className="field">
              Category
              <select
                name="category"
                defaultValue={
                  job?.category ?? original?.category ?? "mechanical"
                }
              >
                {JOB_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c[0].toUpperCase() + c.slice(1)}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              Book hours
              <input
                name="book_hours"
                type="number"
                required
                min="0"
                max="9999.99"
                step="0.01"
                inputMode="decimal"
                defaultValue={job?.book_hours ?? "1.00"}
              />
            </label>
          </div>
          <label className="field">
            Assigned technician
            <select
              name="tech_id"
              defaultValue={
                job?.tech_id ??
                original?.tech_id ??
                (technicians.some((t) => t.id === actor) ? actor : "")
              }
            >
              <option value="">Unassigned</option>
              {technicians.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.full_name}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            Notes <span className="optional">optional</span>
            <textarea
              name="notes"
              maxLength={4000}
              defaultValue={job?.notes ?? ""}
            />
          </label>
        </fieldset>
        {error && (
          <p role="alert" className="form-error">
            {error}
          </p>
        )}
        <Button type="submit" disabled={pending}>
          {pending
            ? "Saving…"
            : job
              ? "Save changes"
              : original
                ? "Add comeback"
                : "Add job"}
        </Button>
      </form>
    </ActionDialog>
  );
}
