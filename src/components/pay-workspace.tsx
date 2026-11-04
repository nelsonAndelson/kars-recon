"use client";
import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Banknote,
  Clock3,
  RotateCcw,
  Download,
  LockKeyhole,
  ChevronLeft,
  ChevronRight,
  Settings2,
} from "lucide-react";
import { Button } from "./ui/button";
import { ActionDialog } from "./action-dialog";
import { useActor } from "./shop-shell";
import { payAction } from "@/app/work-actions";
import {
  addDays,
  dateLabel,
  weekStart,
  payTotal,
  comebackTotals,
  type WorkData,
  type PayReport,
} from "@/lib/jobs";
import { formatMoney, totalCents } from "@/lib/money";
export function PayWorkspace({
  data,
  report,
  today,
}: {
  data: WorkData;
  report: PayReport;
  today: string;
}) {
  const { actor } = useActor(),
    router = useRouter();
  const [tech, setTech] = useState(""),
    [confirm, setConfirm] = useState(false),
    [pending, start] = useTransition(),
    [error, setError] = useState("");
  const owner = data.profiles.some(
    (p) => p.id === actor && p.active && p.role === "owner",
  );
  const rows = report.rows.filter((r) => !tech || r.tech_id === tech),
    total = payTotal(rows),
    wholeTotal = payTotal(report.rows);
  const ended = addDays(report.week_start, 7) <= today;
  const technicians = data.profiles
    .filter(
      (p) => p.role === "tech" || report.rows.some((r) => r.tech_id === p.id),
    )
    .filter((p) => !tech || p.id === tech);
  return (
    <>
      <div className="page-heading">
        <div>
          <div className="eyebrow">BOOK HOURS TO PAYDAY</div>
          <h1>
            Weekly pay<span className="title-dot">.</span>
          </h1>
          <p>
            {dateLabel(report.week_start)} –{" "}
            {dateLabel(addDays(report.week_start, 6))} · Cleveland time
          </p>
        </div>
        <Button asChild variant="outline">
          <Link href="/pay/rates">
            <Settings2 />
            Manage rates
          </Link>
        </Button>
      </div>
      <div className={`pay-state ${report.locked ? "is-locked" : ""}`}>
        <LockKeyhole size={21} />
        <div>
          <strong>
            {report.locked ? "Locked · paid record" : "Live · unpaid week"}
          </strong>
          <p>
            {report.locked
              ? `Recorded by ${data.profiles.find((p) => p.id === report.locked_by)?.full_name ?? "owner"} (self-reported). Saved amounts do not recalculate.`
              : "Completed jobs use the rate effective on their completion date. Rate changes recalculate unlocked weeks."}
          </p>
        </div>
      </div>
      <div className="pay-week-toolbar">
        <div className="week-picker">
          <Link
            className="icon-button"
            aria-label="Previous pay week"
            href={`/pay?week=${addDays(report.week_start, -7)}`}
          >
            <ChevronLeft />
          </Link>
          <label className="compact-field">
            Week of Monday
            <input
              aria-label="Pay week"
              type="date"
              value={report.week_start}
              onChange={(e) => {
                if (e.target.value)
                  router.push(`/pay?week=${weekStart(e.target.value)}`);
              }}
            />
          </label>
          <Link
            className="icon-button"
            aria-label="Next pay week"
            href={`/pay?week=${addDays(report.week_start, 7)}`}
          >
            <ChevronRight />
          </Link>
        </div>
        <label className="compact-field">
          Technician
          <select
            aria-label="Pay technician filter"
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
        </label>
        <Button asChild variant="outline">
          <a href={`/pay/export?week=${report.week_start}`}>
            <Download />
            Export full week
          </a>
        </Button>
        <Button
          variant="outline"
          disabled={pending}
          onClick={() => start(() => router.refresh())}
        >
          Refresh pay
        </Button>
      </div>
      <section className="work-stats">
        <div>
          <Banknote />
          <strong>{total === null ? "Rate needed" : formatMoney(total)}</strong>
          <span>{report.locked ? "Recorded pay" : "Calculated pay"}</span>
        </div>
        <div>
          <Clock3 />
          <strong>
            {(
              rows.reduce((sum, r) => sum + Math.round(r.book_hours * 100), 0) /
              100
            ).toFixed(2)}
          </strong>
          <span>Completed book hours</span>
        </div>
        <div>
          <RotateCcw />
          <strong>{rows.filter((r) => r.is_comeback).length}</strong>
          <span>Comeback jobs completed</span>
        </div>
      </section>
      {wholeTotal === null && (
        <p role="alert" className="form-error">
          Some completed jobs have no effective rate. Add the missing rate
          before paying or locking this week.
        </p>
      )}
      <div className="pay-tech-grid">
        {technicians.map((person) => {
          const own = report.rows.filter((r) => r.tech_id === person.id),
            amount = payTotal(own),
            comebacks = report.rows.filter(
              (r) => r.is_comeback && r.original_tech_id === person.id,
            ),
            lifetime = comebackTotals(data, person.id);
          return (
            <section className="pay-tech-card" key={person.id}>
              <div className="pay-tech-heading">
                <div className="tech-avatar">
                  {person.full_name
                    .split(" ")
                    .map((n) => n[0])
                    .slice(0, 2)
                    .join("")}
                </div>
                <div>
                  <h2>{person.full_name}</h2>
                  <p>
                    {own.length} completed jobs ·{" "}
                    {(
                      own.reduce(
                        (sum, r) => sum + Math.round(r.book_hours * 100),
                        0,
                      ) / 100
                    ).toFixed(2)}{" "}
                    hours
                  </p>
                </div>
                <strong>
                  {amount === null ? "Rate needed" : formatMoney(amount)}
                </strong>
              </div>
              <div className="comeback-summary">
                <span>
                  <RotateCcw size={15} />
                  Comebacks on their original work
                </span>
                <p>
                  This week: <b>{comebacks.length}</b> ·{" "}
                  {formatMoney(
                    totalCents(comebacks.map((r) => r.comeback_parts_cents)),
                  )}{" "}
                  parts {report.locked ? "at lock" : ""}
                </p>
                <p>
                  All time, current: <b>{lifetime.count}</b> ·{" "}
                  {formatMoney(lifetime.cost)} parts
                </p>
              </div>
              {own.length ? (
                <div className="pay-lines">
                  {own.map((row) => (
                    <article key={row.job_id}>
                      <div>
                        <Link href={`/vehicles/${row.vehicle_id}`}>
                          #{row.stock_number} · {row.title}
                        </Link>
                        <p>
                          {dateLabel(row.completed_date)} ·{" "}
                          {row.book_hours.toFixed(2)} h ×{" "}
                          {row.rate_cents === null
                            ? "no rate"
                            : `${formatMoney(row.rate_cents)}/h`}
                          {row.is_comeback ? " · Comeback" : ""}
                        </p>
                        {row.override_reason && (
                          <p>Override: {row.override_reason}</p>
                        )}
                      </div>
                      <strong>
                        {row.pay_cents === null
                          ? "Rate needed"
                          : formatMoney(row.pay_cents)}
                      </strong>
                    </article>
                  ))}
                </div>
              ) : (
                <p className="pay-no-jobs">No completed jobs for this week.</p>
              )}
            </section>
          );
        })}
      </div>
      {!report.locked && (
        <section className="pay-lock-panel">
          <div>
            <h2>After the week is paid</h2>
            <p>
              Locking saves every job’s pay and prevents edits to paid work. All
              technicians in this week are included, regardless of the filter.
            </p>
            {!ended && (
              <p>
                This week can be locked after Sunday ends, so later completions
                are not shut out.
              </p>
            )}
            {!owner && (
              <p>Select an owner under Working as to record payment.</p>
            )}
          </div>
          <Button
            disabled={
              !owner ||
              !ended ||
              !report.rows.length ||
              wholeTotal === null ||
              pending
            }
            onClick={() => {
              setError("");
              setConfirm(true);
            }}
          >
            <LockKeyhole />
            Review & lock week
          </Button>
        </section>
      )}
      {confirm && (
        <ActionDialog
          title="Record paid week"
          onClose={() => {
            if (!pending) setConfirm(false);
          }}
        >
          <p className="dialog-description">
            {dateLabel(report.week_start)} –{" "}
            {dateLabel(addDays(report.week_start, 6))}
          </p>
          <div className="lock-total">
            {formatMoney(wholeTotal ?? 0)}
            <span>{report.rows.length} completed jobs · all technicians</span>
          </div>
          <p className="notice">
            Confirm only after payment. This saves an immutable record and locks
            these jobs. It does not send money. Later rate changes cannot change
            this week.
          </p>
          <p className="form-hint">
            Recorded by {data.profiles.find((p) => p.id === actor)?.full_name} ·
            self-reported
          </p>
          {error && (
            <p role="alert" className="form-error">
              {error}
            </p>
          )}
          <Button
            disabled={pending}
            onClick={() =>
              start(async () => {
                try {
                  const result = await payAction({
                    command: "lock",
                    actor_id: actor,
                    week_start: report.week_start,
                    revision: report.revision,
                  });
                  if (!result.ok) {
                    setError(result.error);
                    return;
                  }
                  setConfirm(false);
                  router.refresh();
                } catch {
                  setError(
                    "Could not record the payment. Refresh to check the week before retrying.",
                  );
                }
              })
            }
          >
            {pending
              ? "Saving paid record…"
              : "I have paid this week — lock it"}
          </Button>
        </ActionDialog>
      )}
    </>
  );
}
