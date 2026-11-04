"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Flag, Check, X } from "lucide-react";
import { Button } from "./ui/button";
import { ActionDialog } from "./action-dialog";
import { useActor } from "./shop-shell";
import { STAGES, STAGE_LABELS, BLOCKERS } from "@/lib/domain";
import { BLOCKER_LABELS } from "@/lib/vehicles";
import { moveVehicle, flagVehicle, signQc } from "@/app/actions";
import type { Tables } from "@/types/database";
export function VehicleActions({
  car,
  compact = false,
  waitingParts = false,
}: {
  car: Tables<"vehicles">;
  compact?: boolean;
  waitingParts?: boolean;
}) {
  const { actor } = useActor();
  const router = useRouter();
  const [dialog, setDialog] = useState<"stage" | "blocker" | null>(null);
  const [other, setOther] = useState(false);
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [pending, startTransition] = useTransition();
  function perform(
    action: () => ReturnType<typeof moveVehicle>,
    success: string,
  ) {
    setError("");
    setMessage("");
    startTransition(async () => {
      try {
        const result = await action();
        if (!result.ok) {
          setError(result.error);
          return;
        }
        setDialog(null);
        setOther(false);
        setMessage(success);
        router.refresh();
      } catch {
        setError("Could not save. Check your connection and try again.");
      }
    });
  }
  function flag(blocker: string, noteValue = "") {
    perform(
      () =>
        flagVehicle({
          vehicle_id: car.id,
          blocker,
          note: noteValue,
          actor_id: actor,
        }),
      blocker ? "Blocker saved." : "Blocker cleared.",
    );
  }
  return (
    <div className={compact ? "vehicle-actions compact" : "vehicle-actions"}>
      <div className="action-buttons">
        <Button
          variant="outline"
          disabled={pending}
          onClick={() => {
            setError("");
            setDialog("stage");
          }}
        >
          <ArrowRight />
          {compact ? "Move" : "Move stage"}
        </Button>
        {car.blocker ? (
          <Button variant="outline" disabled={pending} onClick={() => flag("")}>
            <X />
            Clear blocker
          </Button>
        ) : (
          <Button
            variant="outline"
            disabled={pending}
            onClick={() => {
              setError("");
              setOther(false);
              setDialog("blocker");
            }}
          >
            <Flag />
            {compact ? "Block" : "Flag blocker"}
          </Button>
        )}
        {!compact && car.stage === "qc" && (
          <Button
            disabled={pending}
            onClick={() =>
              perform(
                () => signQc({ vehicle_id: car.id, actor_id: actor }),
                "QC sign-off recorded under the selected name.",
              )
            }
          >
            <Check />
            Sign off QC
          </Button>
        )}
      </div>
      {!compact && waitingParts && !car.blocker && (
        <button
          className="part-suggestion"
          disabled={pending}
          onClick={() => flag("waiting_parts")}
        >
          <PackageIcon />
          Parts are on order. Set “Waiting on parts”
        </button>
      )}
      {pending && (
        <p role="status" className="action-feedback">
          Saving…
        </p>
      )}
      {error && !dialog && (
        <p role="alert" className="form-error">
          {error}
        </p>
      )}
      {message && (
        <p role="status" className="action-feedback">
          {message}
        </p>
      )}
      {dialog && (
        <ActionDialog
          title={
            dialog === "stage"
              ? `Move #${car.stock_number}`
              : `Blocker for #${car.stock_number}`
          }
          onClose={() => {
            if (!pending) setDialog(null);
          }}
        >
          {error && (
            <p role="alert" className="form-error">
              {error}
            </p>
          )}
          {dialog === "stage" ? (
            <>
              <p className="dialog-description">
                Currently {STAGE_LABELS[car.stage]}. Tap the next location.
              </p>
              <div className="stage-options">
                {STAGES.map((stage) => (
                  <button
                    type="button"
                    key={stage}
                    disabled={pending || car.stage === stage}
                    onClick={() =>
                      perform(
                        () =>
                          moveVehicle({
                            vehicle_id: car.id,
                            stage,
                            expected_stage: car.stage,
                            expected_entered_at: car.stage_entered_at,
                            actor_id: actor,
                          }),
                        `Moved to ${STAGE_LABELS[stage]}.`,
                      )
                    }
                  >
                    {STAGE_LABELS[stage]}
                    {car.stage === stage && <Check size={18} />}
                  </button>
                ))}
              </div>
              <p className="form-hint">
                Frontline requires a valid QC sign-off. Sold also archives the
                vehicle.
              </p>
            </>
          ) : (
            <>
              <p className="dialog-description">What is holding this car up?</p>
              <div className="blocker-options">
                {BLOCKERS.map((blocker) => (
                  <button
                    type="button"
                    key={blocker}
                    disabled={pending}
                    onClick={() =>
                      blocker === "other" ? setOther(true) : flag(blocker)
                    }
                  >
                    {BLOCKER_LABELS[blocker]}
                  </button>
                ))}
              </div>
              {other && (
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    flag("other", note);
                  }}
                >
                  <label className="field">
                    Describe the blocker
                    <textarea
                      value={note}
                      onChange={(e) => setNote(e.target.value)}
                      maxLength={1000}
                      required
                      autoFocus
                    />
                  </label>
                  <Button type="submit" disabled={pending}>
                    Save other blocker
                  </Button>
                </form>
              )}
            </>
          )}
        </ActionDialog>
      )}
    </div>
  );
}
function PackageIcon() {
  return <Flag size={18} />;
}
