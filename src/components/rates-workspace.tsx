"use client";
import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Plus } from "lucide-react";
import { Button } from "./ui/button";
import { ActionDialog } from "./action-dialog";
import { useActor } from "./shop-shell";
import { payAction } from "@/app/work-actions";
import { dollarsToCents, dateLabel, type WorkData } from "@/lib/jobs";
import { formatMoney } from "@/lib/money";
export function RatesWorkspace({
  data,
  today,
}: {
  data: WorkData;
  today: string;
}) {
  const { actor } = useActor(),
    router = useRouter();
  const [selected, setSelected] = useState(""),
    [pending, start] = useTransition(),
    [error, setError] = useState("");
  const owner = data.profiles.some(
    (p) => p.id === actor && p.active && p.role === "owner",
  );
  return (
    <>
      <Link href="/pay" className="back-link">
        <ArrowLeft size={18} />
        Back to weekly pay
      </Link>
      <div className="page-heading">
        <div>
          <div className="eyebrow">A HISTORY, NOT AN OVERWRITE</div>
          <h1>
            Tech pay rates<span className="title-dot">.</span>
          </h1>
          <p>
            Every rate has an effective date. Paid weeks keep their saved
            amounts.
          </p>
        </div>
      </div>
      {!owner && (
        <p className="notice">
          Select an owner under Working as to add a rate. Everyone can view rate
          history.
        </p>
      )}
      <div className="rate-grid">
        {data.profiles
          .filter((p) => p.role === "tech")
          .map((person) => {
            const rates = data.rates.filter((r) => r.tech_id === person.id),
              current = rates.find((r) => r.effective_from <= today);
            return (
              <section className="rate-card" key={person.id}>
                <div className="rate-heading">
                  <div>
                    <h2>{person.full_name}</h2>
                    <p>
                      {person.active
                        ? "Active technician"
                        : "Inactive technician"}
                    </p>
                  </div>
                  <strong>
                    {current
                      ? formatMoney(current.rate_cents_per_hour)
                      : "No rate"}
                    <small>/ book hour</small>
                  </strong>
                </div>
                <Button
                  variant="outline"
                  disabled={!owner || pending}
                  onClick={() => {
                    setSelected(person.id);
                    setError("");
                  }}
                >
                  <Plus />
                  Add effective rate
                </Button>
                <ol className="rate-history">
                  {rates.map((rate) => (
                    <li key={rate.effective_from}>
                      <div>
                        <strong>
                          {formatMoney(rate.rate_cents_per_hour)}/h
                        </strong>
                        <span>
                          {rate.effective_from > today
                            ? "Scheduled"
                            : "Effective"}{" "}
                          {dateLabel(rate.effective_from)}
                        </span>
                      </div>
                      <small>
                        {data.profiles.find((p) => p.id === rate.created_by)
                          ?.full_name ?? "Shared"}
                      </small>
                    </li>
                  ))}
                </ol>
              </section>
            );
          })}
      </div>
      {selected && (
        <ActionDialog
          title={`Rate for ${data.profiles.find((p) => p.id === selected)?.full_name}`}
          onClose={() => {
            if (!pending) setSelected("");
          }}
        >
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const values = new FormData(e.currentTarget);
              setError("");
              try {
                const cents = dollarsToCents(String(values.get("rate")));
                start(async () => {
                  try {
                    const result = await payAction({
                      command: "rate",
                      actor_id: actor,
                      tech_id: selected,
                      rate_cents: cents,
                      effective_from: values.get("effective_from"),
                    });
                    if (!result.ok) {
                      setError(result.error);
                      return;
                    }
                    setSelected("");
                    router.refresh();
                  } catch {
                    setError("Could not save the rate. Please try again.");
                  }
                });
              } catch (error) {
                setError(
                  error instanceof Error
                    ? error.message
                    : "Enter a valid rate.",
                );
              }
            }}
          >
            <fieldset className="plain-fieldset" disabled={pending}>
              <label className="field">
                Rate per book hour ($)
                <input
                  name="rate"
                  required
                  type="number"
                  min="0"
                  max="10000"
                  step="0.01"
                  inputMode="decimal"
                />
              </label>
              <label className="field">
                Effective from
                <input
                  name="effective_from"
                  required
                  type="date"
                  defaultValue={today}
                />
              </label>
              <p className="notice">
                The new rate applies to jobs completed on or after this date,
                until the next effective rate. Unlocked weeks recalculate.
                Locked weeks stay unchanged.
              </p>
              <p className="form-hint">
                Existing entries cannot be overwritten. Each technician can have
                one rate per effective date.
              </p>
            </fieldset>
            {error && (
              <p className="form-error" role="alert">
                {error}
              </p>
            )}
            <Button type="submit" disabled={pending}>
              {pending ? "Saving…" : "Save new rate"}
            </Button>
          </form>
        </ActionDialog>
      )}
    </>
  );
}
