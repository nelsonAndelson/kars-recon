"use client";
import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useActor } from "./shop-shell";
import { Button } from "./ui/button";
import { ActionDialog } from "./action-dialog";
import { STAGES, STAGE_LABELS } from "@/lib/domain";
import { SOURCES, shopDate } from "@/lib/vehicles";
import type { ImportItem, InventoryData } from "@/lib/inventory-types";
const fields = ["year", "make", "model", "trim", "color"] as const;
const time = (value: string | null) =>
  value
    ? new Intl.DateTimeFormat("en-US", {
        timeZone: "America/New_York",
        dateStyle: "medium",
        timeStyle: "short",
      }).format(new Date(value))
    : "Not yet";
export function InventoryWorkspace({ data }: { data: InventoryData }) {
  const { actor } = useActor(),
    router = useRouter();
  const [pending, start] = useTransition(),
    [error, setError] = useState(""),
    [message, setMessage] = useState("");
  const [selected, setSelected] = useState<ImportItem | null>(null),
    [filter, setFilter] = useState("review");
  const admin = data.profiles.some(
    (p) => p.id === actor && p.active && p.role === "owner",
  );
  const latest = data.latest;
  const stale =
    !latest ||
    !latest.fresh ||
    Date.now() - Date.parse(latest.finished_at!) > 48 * 3600_000 ||
    Date.now() - Date.parse(`${latest.file_date}T23:59:59-05:00`) >
      48 * 3600_000;
  const visible = data.items.filter(
    (i) =>
      filter === "all" ||
      (filter === "review" &&
        i.decision === "pending" &&
        i.kind !== "matched") ||
      filter === i.kind,
  );
  const current =
    selected && data.vehicles.find((v) => v.id === selected.vehicle_id);
  function act(body: Record<string, unknown>, success: string) {
    setError("");
    setMessage("");
    start(async () => {
      try {
        const response = await fetch("/api/inventory", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...body, actor_id: actor }),
        });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || "Request failed.");
        setSelected(null);
        setMessage(success);
        router.refresh();
      } catch (e) {
        setError(
          e instanceof Error ? e.message : "Connection failed. Try again.",
        );
      }
    });
  }
  return (
    <>
      <div className="page-heading">
        <div>
          <h1>Inventory import</h1>
          <p>
            DealerCenter → review → recon. You decide when a car joins the shop.
          </p>
        </div>
        <div className="import-actions">
          <Button
            variant="outline"
            disabled={pending}
            onClick={() => router.refresh()}
          >
            Refresh
          </Button>
          <Button
            disabled={!admin || pending}
            onClick={() =>
              act(
                { action: "sync" },
                "Latest export fetched. Review the cars below.",
              )
            }
          >
            {pending ? "Working…" : "Sync now"}
          </Button>
        </div>
      </div>
      {!admin && (
        <p className="notice">
          Choose Nelson or another active admin under Working as to sync and
          review.
        </p>
      )}
      {error && (
        <p className="notice import-error" role="alert">
          {error}
        </p>
      )}
      {message && (
        <p className="notice" role="status">
          {message}
        </p>
      )}
      <section className="import-status">
        <div>
          <strong>Last successful fetch</strong>
          <p>{time(latest?.finished_at ?? null)} Eastern</p>
          <small>{latest?.filename ?? "No export fetched yet"}</small>
        </div>
        <div>
          <strong>Daily sync</strong>
          <p>11:00 UTC · 6 a.m. EST / 7 a.m. EDT</p>
          <small>New cars and changes always wait for review.</small>
        </div>
      </section>
      {stale && (
        <p className="notice">
          {latest
            ? "The export is stale. Sync now to check for a newer file. Missing-vehicle detection is paused."
            : "Fetch the first export to see your inventory. Nothing is added automatically."}
        </p>
      )}
      {latest?.error && <p className="notice">{latest.error}</p>}
      {data.runs[0]?.status === "failed" && (
        <p className="notice import-error">
          Last attempt failed: {data.runs[0].error} The last successful review
          list is preserved.
        </p>
      )}
      {data.runs[0]?.status === "fetching" && (
        <p className="notice">
          A sync is in progress. Refresh for results. If it stopped
          unexpectedly, retry after five minutes.
        </p>
      )}
      <div className="import-counts">
        {["new", "change", "conflict"].map((kind) => (
          <div key={kind}>
            <strong>
              {
                data.items.filter(
                  (i) => i.kind === kind && i.decision === "pending",
                ).length
              }
            </strong>
            <span>
              {kind === "new"
                ? "New cars"
                : kind === "change"
                  ? "Changes to review"
                  : "VIN conflicts"}
            </span>
          </div>
        ))}
        <div>
          <strong>{stale ? "—" : data.missing.length}</strong>
          <span>Missing from feed</span>
        </div>
      </div>
      <div className="import-filter">
        <label>
          Show{" "}
          <select value={filter} onChange={(e) => setFilter(e.target.value)}>
            <option value="review">Needs review</option>
            <option value="all">All feed vehicles</option>
            <option value="new">New vehicles</option>
            <option value="change">Changed details</option>
            <option value="conflict">VIN conflicts</option>
          </select>
        </label>
        <span>{latest?.row_count ?? 0} vehicles in latest export</span>
      </div>
      <div className="import-grid">
        {visible.map((item) => {
          const row = item.row_data,
            car = data.vehicles.find((v) => v.id === item.vehicle_id);
          return (
            <article className="import-card" key={item.id}>
              {row.photos[0] && (
                <img
                  className="import-cover"
                  src={row.photos[0]}
                  alt={`${row.year} ${row.make} ${row.model} — DealerCenter inventory photo`}
                  loading="lazy"
                  referrerPolicy="no-referrer"
                />
              )}
              <div className="import-card-body">
                <div className="import-badges">
                  <span>
                    {item.kind === "change"
                      ? "Changed details"
                      : item.kind === "matched"
                        ? "In recon"
                        : item.kind === "conflict"
                          ? "VIN conflict"
                          : "New vehicle"}
                  </span>
                  {item.decision !== "pending" && <span>{item.decision}</span>}
                </div>
                <h2>
                  {row.year} {row.make} {row.model}
                </h2>
                <p>{row.trim || "Trim not supplied"}</p>
                <code>{row.vin}</code>
                <p>
                  Advertised mileage:{" "}
                  {row.advertised_mileage?.toLocaleString() ?? "Not supplied"}
                </p>
                <small>
                  Inventory references only. Mileage and photos are not check-in
                  evidence.
                </small>
                {row.photos.length > 0 && (
                  <details>
                    <summary>{row.photos.length} inventory photos</summary>
                    <div className="import-photo-grid">
                      {row.photos.map((url, index) => (
                        <a
                          href={url}
                          target="_blank"
                          rel="noreferrer"
                          key={url}
                        >
                          <img
                            src={url}
                            loading="lazy"
                            referrerPolicy="no-referrer"
                            alt={`Inventory photo ${index + 1}`}
                          />
                        </a>
                      ))}
                    </div>
                  </details>
                )}
                {item.note && <p className="notice">{item.note}</p>}
                {car && (
                  <p>
                    <Link href={`/vehicles/${car.id}`}>
                      Open stock {car.stock_number} →
                    </Link>
                  </p>
                )}
                {item.decision === "pending" && item.kind !== "matched" && (
                  <Button
                    disabled={!admin || pending || item.kind === "conflict"}
                    onClick={() => {
                      setError("");
                      setSelected(item);
                    }}
                  >
                    Review {item.kind === "new" ? "new car" : "changes"}
                  </Button>
                )}
              </div>
            </article>
          );
        })}
      </div>
      {!visible.length && (
        <div className="notice">
          {latest
            ? "No vehicles in this view need attention."
            : "Your review queue is empty."}
        </div>
      )}
      {!stale && data.missing.length > 0 && (
        <section className="import-missing">
          <h2>Not in this export</h2>
          <p>
            These cars are still in recon. An absent listing does not mean sold;
            no status was changed.
          </p>
          {data.missing.map((v) => (
            <p key={v.id}>
              <Link href={`/vehicles/${v.id}`}>
                {v.stock_number} · {v.year} {v.make} {v.model}
              </Link>{" "}
              — {v.vin || "VIN missing; cannot match"}
            </p>
          ))}
        </section>
      )}
      <details className="import-history">
        <summary>Sync history</summary>
        {data.runs.map((run) => (
          <p key={run.id}>
            {time(run.started_at)} · {run.trigger} ·{" "}
            <strong>{run.status}</strong> · {run.row_count} rows
            {run.error && ` · ${run.error}`}
          </p>
        ))}
      </details>
      {selected && (
        <ActionDialog
          title={
            current ? "Review changed details" : "Add inventory car to recon"
          }
          onClose={() => {
            if (!pending) setSelected(null);
          }}
        >
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const form = new FormData(e.currentTarget);
              act(
                {
                  action: "review",
                  decision: "approve",
                  item_id: selected.id,
                  fingerprint: selected.fingerprint,
                  expected_vehicle: current ?? null,
                  stock_number: form.get("stock_number"),
                  purchase_date: form.get("purchase_date"),
                  source: form.get("source"),
                  stage: form.get("stage"),
                  fields: form.getAll("fields"),
                },
                "Inventory review saved.",
              );
            }}
          >
            <h3>
              {selected.row_data.year} {selected.row_data.make}{" "}
              {selected.row_data.model}
            </h3>
            <p>
              <code>{selected.row_data.vin}</code>
            </p>
            {current ? (
              <>
                <p>Select only the changes you want to accept.</p>
                <div className="import-diff">
                  {fields
                    .filter(
                      (f) =>
                        selected.row_data[f] !== "" &&
                        selected.row_data[f] !== current[f],
                    )
                    .map((f) => (
                      <label key={f}>
                        <input type="checkbox" name="fields" value={f} />
                        <span>
                          <strong>{f}</strong>
                          <span>
                            {current[f] || "Not set"} → {selected.row_data[f]}
                          </span>
                        </span>
                      </label>
                    ))}
                </div>
                <p className="notice">
                  Check-in mileage, stock number, recon stage, jobs and pay
                  remain unchanged.
                </p>
              </>
            ) : (
              <div className="form-grid">
                <label>
                  Stock number
                  <input
                    name="stock_number"
                    required
                    maxLength={40}
                    defaultValue={selected.row_data.vin.slice(-6)}
                  />
                </label>
                <label>
                  Actual purchase date
                  <input
                    name="purchase_date"
                    type="date"
                    required
                    max={shopDate()}
                  />
                </label>
                <label>
                  Purchase source
                  <select name="source" defaultValue="other">
                    {SOURCES.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Starting recon stage
                  <select name="stage" required defaultValue="">
                    <option value="" disabled>
                      Choose a stage
                    </option>
                    {STAGES.filter(
                      (s) => s !== "sold" && s !== "frontline",
                    ).map((s) => (
                      <option key={s} value={s}>
                        {STAGE_LABELS[s]}
                      </option>
                    ))}
                  </select>
                </label>
                <p className="notice">
                  Enter the actual purchase date. Record check-in mileage during
                  inspection. Frontline requires QC sign-off after import.
                </p>
              </div>
            )}
            {error && (
              <p className="notice import-error" role="alert">
                {error}
              </p>
            )}
            <div className="import-actions">
              <Button
                type="button"
                variant="outline"
                disabled={pending}
                onClick={() =>
                  act(
                    {
                      action: "review",
                      decision: "dismiss",
                      item_id: selected.id,
                      fingerprint: selected.fingerprint,
                    },
                    "Dismissed. Unchanged entries will stay dismissed.",
                  )
                }
              >
                Dismiss
              </Button>
              <Button disabled={pending || !admin} type="submit">
                {pending
                  ? "Saving…"
                  : current
                    ? "Accept selected changes"
                    : "Add to recon"}
              </Button>
            </div>
          </form>
        </ActionDialog>
      )}
    </>
  );
}
