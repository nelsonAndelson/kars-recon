"use client";
import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Check,
  X,
  Camera,
  ImagePlus,
  Minus,
  Plus,
  ClipboardCheck,
  ScanLine,
} from "lucide-react";
import { Button } from "./ui/button";
import { useActor } from "./shop-shell";
import { CHECKLIST, type CheckItem } from "@/lib/vehicles";
import { completeCheckin, decodeVin } from "@/app/actions";
import { checkinPhoto } from "@/lib/photo";
import type { Tables } from "@/types/database";
function PhotoPreview({ file }: { file: File }) {
  const [url, setUrl] = useState("");
  useEffect(() => {
    const next = URL.createObjectURL(file);
    setUrl(next);
    return () => URL.revokeObjectURL(next);
  }, [file]);
  return url ? <img src={url} alt={file.name} /> : null;
}
export function CheckinForm({
  car,
  profiles,
}: {
  car: Tables<"vehicles">;
  profiles: Tables<"profiles">[];
}) {
  const { actor, setActor } = useActor();
  const router = useRouter();
  const [keys, setKeys] = useState(1);
  const [checklist, setChecklist] = useState<Record<string, CheckItem>>(() =>
    Object.fromEntries(
      CHECKLIST.map((item) => [item.id, { result: "", notes: "" }]),
    ),
  );
  const [identity, setIdentity] = useState({
    vin: car.vin ?? "",
    year: String(car.year),
    make: car.make,
    model: car.model,
  });
  const [files, setFiles] = useState<File[]>([]);
  const [preparing, setPreparing] = useState(false);
  const [error, setError] = useState("");
  const [lookup, setLookup] = useState("");
  const [pending, startSave] = useTransition();
  const [decoding, startDecode] = useTransition();
  const marked = CHECKLIST.filter((item) => checklist[item.id].result).length;
  async function addPhotos(incoming: FileList | null) {
    if (!incoming) return;
    setError("");
    if (files.length + incoming.length > 4) {
      setError("Use up to four check-in photos.");
      return;
    }
    setPreparing(true);
    try {
      const prepared = await Promise.all(
        Array.from(incoming).map(checkinPhoto),
      );
      setFiles((current) => [...current, ...prepared]);
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Could not prepare the photos.",
      );
    } finally {
      setPreparing(false);
    }
  }
  return (
    <>
      <Link href={`/vehicles/${car.id}`} className="back-link">
        <ArrowLeft size={18} />
        Back to vehicle
      </Link>
      <div className="page-heading">
        <div>
          <div className="eyebrow">
            ARRIVAL INSPECTION · #{car.stock_number}
          </div>
          <h1>
            Check in<span className="title-dot">.</span>
          </h1>
          <p>
            {car.year} {car.make} {car.model} · Same checks, every car.
          </p>
        </div>
        <span className="check-progress">
          {marked} / {CHECKLIST.length} checked
        </span>
      </div>
      <form
        className="checkin-form"
        onSubmit={(e) => {
          e.preventDefault();
          setError("");
          if (!actor) {
            setError("Select who checked in this vehicle.");
            return;
          }
          if (marked < CHECKLIST.length) {
            setError("Mark every checklist item pass or fail.");
            return;
          }
          startSave(async () => {
            try {
              const form = new FormData();
              form.set(
                "payload",
                JSON.stringify({
                  vehicle_id: car.id,
                  actor_id: actor,
                  keys_count: keys,
                  checklist,
                  identity,
                }),
              );
              files.forEach((file) => form.append("photos", file));
              const result = await completeCheckin(form);
              if (!result.ok) {
                setError(result.error);
                return;
              }
              router.push(`/vehicles/${car.id}`);
              router.refresh();
            } catch {
              setError(
                "Could not complete check-in. Your entries are still here; please try again.",
              );
            }
          });
        }}
      >
        <fieldset disabled={pending || preparing || decoding}>
          <section className="checkin-section">
            <h2>Confirm the vehicle</h2>
            <div className="vin-row">
              <label className="field">
                VIN <span className="optional">if available</span>
                <input
                  value={identity.vin}
                  onChange={(e) =>
                    setIdentity({
                      ...identity,
                      vin: e.target.value.toUpperCase(),
                    })
                  }
                  maxLength={17}
                  placeholder="Enter or paste 17-character VIN"
                  autoCapitalize="characters"
                />
              </label>
              <Button
                type="button"
                variant="outline"
                disabled={!identity.vin || decoding}
                onClick={() =>
                  startDecode(async () => {
                    setLookup("");
                    try {
                      const result = await decodeVin(identity.vin);
                      if (!result.ok) {
                        setLookup(result.error);
                        return;
                      }
                      setIdentity((current) => ({
                        ...current,
                        year: result.vehicle.year,
                        make: result.vehicle.make,
                        model: result.vehicle.model,
                      }));
                      setLookup(
                        result.vehicle.warning ??
                          "VIN decoded. Confirm the details below.",
                      );
                    } catch {
                      setLookup(
                        "VIN lookup could not connect. Enter the vehicle details manually or try again.",
                      );
                    }
                  })
                }
              >
                <ScanLine />
                {decoding ? "Looking up…" : "Decode VIN"}
              </Button>
            </div>
            {lookup && (
              <p role="status" className="lookup-message">
                {lookup}
              </p>
            )}
            <div className="form-grid three">
              <label className="field">
                Year
                <input
                  type="number"
                  required
                  min={1900}
                  max={2100}
                  value={identity.year}
                  onChange={(e) =>
                    setIdentity({ ...identity, year: e.target.value })
                  }
                />
              </label>
              <label className="field">
                Make
                <input
                  required
                  maxLength={80}
                  value={identity.make}
                  onChange={(e) =>
                    setIdentity({ ...identity, make: e.target.value })
                  }
                />
              </label>
              <label className="field">
                Model
                <input
                  required
                  maxLength={80}
                  value={identity.model}
                  onChange={(e) =>
                    setIdentity({ ...identity, model: e.target.value })
                  }
                />
              </label>
            </div>
          </section>
          <section className="checkin-section">
            <div className="checklist-heading">
              <div>
                <h2>Condition checklist</h2>
                <p>Tap Pass or Needs work for every item.</p>
              </div>
              <Button
                type="button"
                variant="outline"
                onClick={() =>
                  setChecklist((current) =>
                    Object.fromEntries(
                      CHECKLIST.map((item) => [
                        item.id,
                        { ...current[item.id], result: "pass" },
                      ]),
                    ),
                  )
                }
              >
                <Check />
                All pass
              </Button>
            </div>
            <div className="checklist-rows">
              {CHECKLIST.map((item) => (
                <div className="checklist-row" key={item.id}>
                  <div className="checklist-top">
                    <h3>{item.label}</h3>
                    <div className="pass-fail">
                      <button
                        type="button"
                        aria-pressed={checklist[item.id].result === "pass"}
                        className={
                          checklist[item.id].result === "pass"
                            ? "pass-selected"
                            : ""
                        }
                        onClick={() =>
                          setChecklist({
                            ...checklist,
                            [item.id]: {
                              ...checklist[item.id],
                              result: "pass",
                            },
                          })
                        }
                      >
                        <Check size={19} />
                        Pass
                      </button>
                      <button
                        type="button"
                        aria-pressed={checklist[item.id].result === "fail"}
                        className={
                          checklist[item.id].result === "fail"
                            ? "fail-selected"
                            : ""
                        }
                        onClick={() =>
                          setChecklist({
                            ...checklist,
                            [item.id]: {
                              ...checklist[item.id],
                              result: "fail",
                            },
                          })
                        }
                      >
                        <X size={19} />
                        Needs work
                      </button>
                    </div>
                  </div>
                  {checklist[item.id].result === "fail" && (
                    <label className="field checklist-notes">
                      Notes for {item.label.toLowerCase()}{" "}
                      <span className="optional">optional</span>
                      <textarea
                        maxLength={1000}
                        value={checklist[item.id].notes}
                        onChange={(e) =>
                          setChecklist({
                            ...checklist,
                            [item.id]: {
                              ...checklist[item.id],
                              notes: e.target.value,
                            },
                          })
                        }
                        placeholder="What needs attention?"
                      />
                    </label>
                  )}
                </div>
              ))}
            </div>
          </section>
          <section className="checkin-section">
            <div className="keys-row">
              <div>
                <h2>Keys received</h2>
                <p>Include all working keys and fobs.</p>
              </div>
              <div className="key-stepper">
                <button
                  type="button"
                  aria-label="One fewer key"
                  disabled={keys === 0}
                  onClick={() => setKeys(keys - 1)}
                >
                  <Minus />
                </button>
                <output aria-label="Key count">{keys}</output>
                <button
                  type="button"
                  aria-label="One more key"
                  disabled={keys === 10}
                  onClick={() => setKeys(keys + 1)}
                >
                  <Plus />
                </button>
              </div>
            </div>
          </section>
          <section className="checkin-section">
            <h2>Arrival photos</h2>
            <p>Up to four photos of the car and any damage. Optional.</p>
            <div className="photo-pickers">
              <label className="photo-picker">
                <Camera />
                Take photo
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  capture="environment"
                  aria-label="Take a check-in photo"
                  onChange={(e) => {
                    void addPhotos(e.currentTarget.files);
                    e.currentTarget.value = "";
                  }}
                />
              </label>
              <label className="photo-picker">
                <ImagePlus />
                Choose photos
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  multiple
                  aria-label="Choose check-in photos"
                  onChange={(e) => {
                    void addPhotos(e.currentTarget.files);
                    e.currentTarget.value = "";
                  }}
                />
              </label>
            </div>
            <div className="photo-previews">
              {files.map((file, index) => (
                <div key={`${file.name}-${index}`}>
                  <PhotoPreview file={file} />
                  <button
                    type="button"
                    aria-label={`Remove photo ${index + 1}`}
                    onClick={() =>
                      setFiles((current) =>
                        current.filter((_, i) => i !== index),
                      )
                    }
                  >
                    <X size={18} />
                  </button>
                </div>
              ))}
            </div>
          </section>
          <section className="checkin-section">
            <label className="field">
              Checked in by <span className="optional">self-reported</span>
              <select
                value={actor}
                onChange={(e) => setActor(e.target.value)}
                required
              >
                <option value="">Select a team member</option>
                {profiles
                  .filter((p) => p.active)
                  .map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.full_name}
                    </option>
                  ))}
              </select>
            </label>
            <p className="form-hint">
              Completing check-in moves an arriving car to Diagnosis. Cars
              already further along keep their stage.
            </p>
          </section>
        </fieldset>
        {error && (
          <p role="alert" className="form-error">
            {error}
          </p>
        )}
        {preparing && <p role="status">Preparing photos…</p>}
        <div className="checkin-footer">
          <Button type="submit" disabled={pending || preparing || decoding}>
            <ClipboardCheck />
            {pending ? "Saving check-in…" : "Complete check-in"}
          </Button>
          <span>Checklist, keys and photos save together.</span>
        </div>
      </form>
    </>
  );
}
