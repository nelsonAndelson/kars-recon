"use client";
import Link from "next/link";
import { useState } from "react";
import {
  ArrowLeft,
  ClipboardCheck,
  Clock3,
  Flag,
  CarFront,
  ImageIcon,
} from "lucide-react";
import { Button } from "./ui/button";
import { VehicleActions } from "./vehicle-actions";
import { STAGE_LABELS } from "@/lib/domain";
import {
  CHECKLIST,
  ageLabel,
  ageState,
  stageAge,
  stageTarget,
  purchaseAge,
  auditEvent,
  BLOCKER_LABELS,
} from "@/lib/vehicles";
import { formatMoney } from "@/lib/money";
import type { VehicleData } from "@/lib/recon-data";
function stamp(date: string) {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(date));
}
export function VehicleDetail({ data }: { data: VehicleData }) {
  const [tab, setTab] = useState("jobs");
  const car = data.car!;
  const age = stageAge(car, data.history, data.now),
    target = data.settings ? stageTarget(data.settings, car.stage) : 1,
    state = ageState(age, target);
  const person = (id: string | null) =>
    data.profiles.find((p) => p.id === id)?.full_name ?? "Shared / no name";
  const lastQc = data.activity.find(
    (event) => auditEvent(event.what).action === "qc_signed",
  );
  const events = [
    ...data.history.map((h, index) => ({
      id: `stage-${index}`,
      when: h.changed_at,
      who: h.changed_by,
      title: h.from_stage
        ? `${STAGE_LABELS[h.from_stage]} → ${STAGE_LABELS[h.to_stage]}`
        : `Added in ${STAGE_LABELS[h.to_stage]}`,
      note: "Stage history",
    })),
    ...data.activity.map((a, index) => {
      const event = auditEvent(a.what);
      return {
        id: `audit-${index}`,
        when: a.when,
        who: a.who,
        title:
          event.action === "qc_signed"
            ? "QC sign-off recorded"
            : event.action === "checkins:insert"
              ? "Check-in completed"
              : event.action === "vehicles:insert"
                ? "Vehicle added"
                : event.action === "vehicles:update"
                  ? "Vehicle updated"
                  : event.action.replace(":", " · "),
        note:
          typeof event.blocker === "string"
            ? `Blocker: ${event.blocker.replaceAll("_", " ")}${event.note ? ` — ${event.note}` : ""}`
            : "Activity log",
      };
    }),
  ].sort((a, b) => b.when.localeCompare(a.when));
  return (
    <>
      <Link href="/" className="back-link">
        <ArrowLeft size={18} />
        Back to board
      </Link>
      <div className="page-heading">
        <div>
          <div className="eyebrow">STOCK #{car.stock_number}</div>
          <h1 className="car-title">
            {car.year} {car.make} {car.model}
          </h1>
          <p>
            {[
              car.trim,
              car.color,
              car.miles_in !== null
                ? `${car.miles_in.toLocaleString("en-US")} mi`
                : null,
            ]
              .filter(Boolean)
              .join(" · ")}
          </p>
        </div>
        <span className={`detail-stage stage-${car.stage}`}>
          {STAGE_LABELS[car.stage]}
        </span>
      </div>
      <section className="detail-summary">
        <div>
          <span>Time in stage</span>
          <strong className={`age-text-${state}`}>
            <Clock3 size={20} />
            {ageLabel(age)}
          </strong>
          <small>
            {state === "over"
              ? "Over target"
              : state === "warning"
                ? "Near target"
                : "On track"}{" "}
            · {target}d target
          </small>
        </div>
        <div>
          <span>Since purchase</span>
          <strong>{purchaseAge(car.purchase_date, data.now)} days</strong>
          <small>
            {car.purchase_date} · {car.source}
          </small>
        </div>
        <div>
          <span>Recon budget</span>
          <strong>{formatMoney(car.recon_budget_cents)}</strong>
          <small>Cost rollup in milestone 5</small>
        </div>
        <div>
          <span>VIN</span>
          <strong className="vin-value">{car.vin ?? "Not entered"}</strong>
          <small>
            {car.status === "active" ? "Active inventory" : car.status}
          </small>
        </div>
      </section>
      {car.blocker && (
        <div className="detail-blocker">
          <Flag size={22} />
          <div>
            <strong>{BLOCKER_LABELS[car.blocker]}</strong>
            {car.blocker_note && <p>{car.blocker_note}</p>}
          </div>
        </div>
      )}
      <section className="detail-action-panel">
        <VehicleActions
          car={car}
          waitingParts={data.parts.some((p) => p.status === "ordered")}
        />
        {!data.checkin && (
          <Button asChild>
            <Link href={`/vehicles/${car.id}/check-in`}>
              <ClipboardCheck />
              Start check-in
            </Link>
          </Button>
        )}
      </section>
      {car.stage === "qc" && (
        <p className="qc-explanation">
          Select the signer under “Working as”, then tap Sign off QC. Use
          someone other than the tech with the most completed book hours, or the
          owner. Names are self-reported.
        </p>
      )}
      {lastQc && (
        <p className="qc-record">
          <ClipboardCheck size={17} />
          Last QC record: {person(lastQc.who)} · {stamp(lastQc.when)} ·
          self-reported. Rework requires a new sign-off.
        </p>
      )}
      <section className="detail-tabs-panel">
        <div
          className="detail-tabs"
          role="tablist"
          aria-label="Vehicle sections"
        >
          {[
            ["jobs", `Jobs (${data.jobs.length})`],
            ["parts", `Parts (${data.parts.length})`],
            ["timeline", "Timeline"],
            ["checkin", "Check-in"],
          ].map(([id, label]) => (
            <button
              key={id}
              type="button"
              role="tab"
              id={`tab-${id}`}
              aria-controls="vehicle-tab-panel"
              aria-selected={tab === id}
              tabIndex={tab === id ? 0 : -1}
              onKeyDown={(event) => {
                const tabs = Array.from(
                  event.currentTarget.parentElement!.querySelectorAll<HTMLButtonElement>(
                    '[role="tab"]',
                  ),
                );
                const index = tabs.indexOf(event.currentTarget);
                const next =
                  event.key === "ArrowRight"
                    ? (index + 1) % tabs.length
                    : event.key === "ArrowLeft"
                      ? (index + tabs.length - 1) % tabs.length
                      : event.key === "Home"
                        ? 0
                        : event.key === "End"
                          ? tabs.length - 1
                          : null;
                if (next !== null) {
                  event.preventDefault();
                  tabs[next].focus();
                  tabs[next].click();
                }
              }}
              onClick={() => setTab(id)}
            >
              {label}
            </button>
          ))}
        </div>
        <div
          className="detail-tab-content"
          role="tabpanel"
          id="vehicle-tab-panel"
          aria-labelledby={`tab-${tab}`}
          tabIndex={0}
        >
          {tab === "jobs" && (
            <>
              <div className="panel-intro">
                <h2>Jobs on this car</h2>
                <p>Job creation and tech updates arrive in milestone 3.</p>
              </div>
              {data.jobs.length ? (
                <div className="record-list">
                  {data.jobs.map((job) => (
                    <article key={job.id}>
                      <div>
                        <h3>{job.title}</h3>
                        <p>
                          {person(job.tech_id)} · {job.book_hours.toFixed(2)}{" "}
                          book hours{job.is_comeback ? " · Comeback" : ""}
                        </p>
                      </div>
                      <span className="record-status">
                        {job.status.replaceAll("_", " ")}
                      </span>
                    </article>
                  ))}
                </div>
              ) : (
                <div className="detail-empty">
                  <CarFront />
                  <p>No jobs recorded yet.</p>
                </div>
              )}
            </>
          )}
          {tab === "parts" && (
            <>
              <div className="panel-intro">
                <h2>Parts on this car</h2>
                <p>Ordering, receiving and returns arrive in milestone 4.</p>
              </div>
              {data.parts.length ? (
                <div className="record-list">
                  {data.parts.map((part) => (
                    <article key={part.id}>
                      <div>
                        <h3>{part.name}</h3>
                        <p>
                          {part.qty} × {formatMoney(part.unit_cost_cents)} ·{" "}
                          {part.vendor ?? "No vendor"}
                        </p>
                      </div>
                      <span className="record-status">
                        {part.status.replaceAll("_", " ")}
                      </span>
                    </article>
                  ))}
                </div>
              ) : (
                <div className="detail-empty">
                  <p>No parts recorded yet.</p>
                </div>
              )}
            </>
          )}
          {tab === "timeline" && (
            <>
              <div className="panel-intro">
                <h2>Vehicle timeline</h2>
                <p>
                  Stage changes and activity · Cleveland time · names are
                  self-reported.
                </p>
              </div>
              <ol className="vehicle-timeline">
                {events.map((event) => (
                  <li key={event.id}>
                    <span className="timeline-dot" />
                    <div>
                      <h3>{event.title}</h3>
                      <p>{event.note}</p>
                      <small>
                        {stamp(event.when)} · {person(event.who)}
                      </small>
                    </div>
                  </li>
                ))}
              </ol>
            </>
          )}
          {tab === "checkin" && (
            <>
              <div className="panel-intro">
                <h2>
                  {data.checkin ? "Arrival inspection" : "Ready for check-in"}
                </h2>
                <p>
                  {data.checkin
                    ? `${person(data.checkin.done_by)} · ${stamp(data.checkin.done_at)} · ${data.checkin.keys_count} keys`
                    : "Record the condition, keys and photos before diagnosis."}
                </p>
              </div>
              {data.checkin ? (
                <>
                  <div className="saved-checklist">
                    {CHECKLIST.map((item) => {
                      const result = data.checkin!.checklist as Record<
                        string,
                        { result?: string; notes?: string }
                      >;
                      return (
                        <div key={item.id}>
                          <span>{item.label}</span>
                          <strong
                            className={
                              result[item.id]?.result === "fail"
                                ? "failed"
                                : "passed"
                            }
                          >
                            {result[item.id]?.result ?? "Not recorded"}
                          </strong>
                          {result[item.id]?.notes && (
                            <p>{result[item.id].notes}</p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                  <div className="saved-photos">
                    {data.photos.map((photo, index) =>
                      photo.signedUrl ? (
                        <a
                          key={photo.path}
                          href={photo.signedUrl}
                          target="_blank"
                          rel="noreferrer"
                        >
                          <img
                            src={photo.signedUrl}
                            alt={`Check-in photo ${index + 1}`}
                          />
                        </a>
                      ) : (
                        <p key={index}>
                          <ImageIcon />
                          Photo unavailable. Refresh to retry.
                        </p>
                      ),
                    )}
                  </div>
                  {!data.checkin.photos.length && (
                    <p className="form-hint">
                      No check-in photos were recorded.
                    </p>
                  )}
                </>
              ) : (
                <Button asChild>
                  <Link href={`/vehicles/${car.id}/check-in`}>
                    Start check-in
                    <ClipboardCheck />
                  </Link>
                </Button>
              )}
            </>
          )}
        </div>
      </section>
    </>
  );
}
