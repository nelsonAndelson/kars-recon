"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useActor } from "./shop-shell";
import { ActionDialog } from "./action-dialog";
import { Button } from "./ui/button";
import { savePart } from "@/app/shop-actions";
import { dollarsToCents, type WorkData } from "@/lib/jobs";
import { formatMoney } from "@/lib/money";
import type { Tables } from "@/types/database";
export const PART_LABELS = {
  needed: "Needed",
  ordered: "On order",
  received: "Available",
  installed: "Installed",
  return_pending: "To return",
  returned: "Returned",
};
export function PartRequest({
  data,
  vehicleId,
  jobId = "",
  onClose,
}: {
  data: WorkData;
  vehicleId?: string;
  jobId?: string;
  onClose: () => void;
}) {
  const { actor } = useActor(),
    router = useRouter();
  const [id] = useState(() => crypto.randomUUID()),
    [pending, start] = useTransition(),
    [error, setError] = useState("");
  return (
    <ActionDialog
      title="Request a part"
      onClose={() => {
        if (!pending) onClose();
      }}
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const f = new FormData(e.currentTarget);
          start(async () => {
            try {
              const r = await savePart({
                command: "request",
                id,
                actor_id: actor,
                vehicle_id: vehicleId ?? f.get("vehicle"),
                job_id: jobId,
                name: f.get("name"),
                qty: Number(f.get("qty")),
              });
              if (!r.ok) {
                setError(r.error);
                return;
              }
              onClose();
              router.refresh();
            } catch {
              setError("Could not save. Check your connection.");
            }
          });
        }}
      >
        <fieldset className="plain-fieldset" disabled={pending}>
          {!vehicleId && (
            <label className="field">
              Vehicle
              <select name="vehicle" required defaultValue="">
                <option value="" disabled>
                  Choose a car
                </option>
                {data.vehicles
                  .filter((v) => v.status === "active")
                  .map((v) => (
                    <option key={v.id} value={v.id}>
                      #{v.stock_number} · {v.make} {v.model}
                    </option>
                  ))}
              </select>
            </label>
          )}
          <label className="field">
            Part needed
            <input
              name="name"
              required
              maxLength={160}
              placeholder="e.g. Front brake rotors"
            />
          </label>
          <label className="field">
            Quantity
            <input
              name="qty"
              type="number"
              min="1"
              max="999"
              defaultValue="1"
              required
              inputMode="numeric"
            />
          </label>
        </fieldset>
        <p className="form-hint">
          This adds a visible parts request. It does not place an order with a
          vendor.
        </p>
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <Button disabled={pending || !actor} type="submit">
          {pending ? "Saving…" : "Request part"}
        </Button>
      </form>
    </ActionDialog>
  );
}
export function PartsList({
  data,
  parts,
  technician = false,
}: {
  data: WorkData;
  parts: Tables<"parts">[];
  technician?: boolean;
}) {
  const { actor } = useActor(),
    router = useRouter();
  const [selected, setSelected] = useState<Tables<"parts"> | null>(null),
    [pending, start] = useTransition(),
    [error, setError] = useState(""),
    [message, setMessage] = useState("");
  const mayChange = data.profiles.some(
    (p) => p.id === actor && p.active && ["owner", "tech"].includes(p.role),
  );
  function receive(p: Tables<"parts">) {
    setError("");
    start(async () => {
      try {
        const r = await savePart({
          command: "receive",
          id: p.id,
          actor_id: actor,
          expected: p,
        });
        if (!r.ok) {
          setError(r.error);
          return;
        }
        setMessage(p.name + " is available.");
        router.refresh();
      } catch {
        setError("Could not save. Refresh to check before retrying.");
      }
    });
  }
  return (
    <>
      {error && !selected && (
        <p role="alert" className="form-error">
          {error}
        </p>
      )}
      {message && (
        <p role="status" className="action-feedback">
          {message}
        </p>
      )}
      <div className="parts-stack">
        {parts.map((p) => {
          const car = data.vehicles.find((v) => v.id === p.vehicle_id);
          return (
            <article className="part-row" key={p.id}>
              <div>
                <span className={"part-state part-" + p.status}>
                  {PART_LABELS[p.status]}
                </span>
                <h3>
                  {p.qty} × {p.name}
                </h3>
                <p>
                  #{car?.stock_number} · {car?.make} {car?.model}
                </p>
                {p.vendor && (
                  <p>
                    {p.vendor}
                    {p.ordered_at
                      ? " · Ordered " +
                        new Date(p.ordered_at).toLocaleDateString("en-US", {
                          timeZone: "America/New_York",
                        })
                      : ""}
                  </p>
                )}
                {!technician && <p>{formatMoney(p.unit_cost_cents)} each</p>}
              </div>
              {p.status === "needed" && (
                <Button
                  variant="outline"
                  disabled={!mayChange || pending}
                  onClick={() => {
                    setError("");
                    setSelected(p);
                  }}
                >
                  Record order
                </Button>
              )}
              {p.status === "ordered" && (
                <Button
                  disabled={!mayChange || pending}
                  onClick={() => receive(p)}
                >
                  Mark received
                </Button>
              )}
            </article>
          );
        })}
      </div>
      {!parts.length && <p className="quiet-empty">No parts recorded here.</p>}
      {selected && (
        <ActionDialog
          title="Record a parts order"
          onClose={() => {
            if (!pending) setSelected(null);
          }}
        >
          <p>{selected.name}</p>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              setError("");
              start(async () => {
                try {
                  const r = await savePart({
                    command: "order",
                    id: selected.id,
                    actor_id: actor,
                    expected: selected,
                    vendor: f.get("vendor"),
                    unit_cost_cents: dollarsToCents(String(f.get("cost"))),
                  });
                  if (!r.ok) {
                    setError(r.error);
                    return;
                  }
                  setSelected(null);
                  router.refresh();
                } catch (e) {
                  setError(e instanceof Error ? e.message : "Could not save.");
                }
              });
            }}
          >
            <fieldset className="plain-fieldset" disabled={pending}>
              <label className="field">
                Vendor
                <input name="vendor" required maxLength={120} />
              </label>
              <label className="field">
                Unit cost ($)
                <input
                  name="cost"
                  type="number"
                  min="0"
                  step=".01"
                  required
                  inputMode="decimal"
                />
              </label>
            </fieldset>
            <p className="notice">
              Record an order you have already placed. This does not purchase
              the part.
            </p>
            {error && (
              <p role="alert" className="form-error">
                {error}
              </p>
            )}
            <Button type="submit" disabled={pending}>
              Save order
            </Button>
          </form>
        </ActionDialog>
      )}
    </>
  );
}
export function PartsWorkspace({ data }: { data: WorkData }) {
  const [filter, setFilter] = useState("open"),
    [request, setRequest] = useState(false);
  const { actor } = useActor();
  const parts = data.parts.filter((p) =>
    filter === "all" || filter === "open"
      ? filter === "all" || ["needed", "ordered", "received"].includes(p.status)
      : p.status === filter,
  );
  return (
    <>
      <div className="page-heading">
        <div>
          <h1>Parts</h1>
          <p>Requests, orders and what is ready to use.</p>
        </div>
        <Button disabled={!actor} onClick={() => setRequest(true)}>
          Request part
        </Button>
      </div>
      <label className="field">
        Show
        <select value={filter} onChange={(e) => setFilter(e.target.value)}>
          <option value="open">Needed, ordered & available</option>
          {Object.entries(PART_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
          <option value="all">All parts</option>
        </select>
      </label>
      <PartsList data={data} parts={parts} />
      {request && <PartRequest data={data} onClose={() => setRequest(false)} />}
    </>
  );
}
