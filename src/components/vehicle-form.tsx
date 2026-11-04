"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, ScanLine, ArrowRight, Plus } from "lucide-react";
import { Button } from "./ui/button";
import { useActor } from "./shop-shell";
import { SOURCES } from "@/lib/vehicles";
import { addVehicle, decodeVin } from "@/app/actions";
export function VehicleForm({ today }: { today: string }) {
  const { actor } = useActor();
  const router = useRouter();
  const [id] = useState(() => crypto.randomUUID());
  const [vin, setVin] = useState("");
  const [year, setYear] = useState("");
  const [make, setMake] = useState("");
  const [model, setModel] = useState("");
  const [trim, setTrim] = useState("");
  const [error, setError] = useState("");
  const [lookupMessage, setLookupMessage] = useState("");
  const [saving, startSave] = useTransition();
  const [decoding, startDecode] = useTransition();
  function decode() {
    setLookupMessage("");
    startDecode(async () => {
      try {
        const result = await decodeVin(vin);
        if (!result.ok) {
          setLookupMessage(result.error);
          return;
        }
        setYear(result.vehicle.year);
        setMake(result.vehicle.make);
        setModel(result.vehicle.model);
        setTrim(result.vehicle.trim);
        setLookupMessage(
          result.vehicle.warning ??
            "Vehicle found. Check the details below before saving.",
        );
      } catch {
        setLookupMessage(
          "VIN lookup could not connect. Enter the vehicle details manually or try again.",
        );
      }
    });
  }
  return (
    <>
      <Link href="/" className="back-link">
        <ArrowLeft size={18} />
        Back to board
      </Link>
      <div className="page-heading">
        <div>
          <div className="eyebrow">NEW INVENTORY</div>
          <h1>
            Add a vehicle<span className="title-dot">.</span>
          </h1>
          <p>Start with its VIN, then confirm the auction details.</p>
        </div>
      </div>
      <form
        className="vehicle-form"
        onSubmit={(e) => {
          e.preventDefault();
          setError("");
          const form = new FormData(e.currentTarget);
          const next = (e.nativeEvent as SubmitEvent).submitter?.getAttribute(
            "value",
          );
          startSave(async () => {
            try {
              const result = await addVehicle({
                ...Object.fromEntries(form),
                id,
                actor_id: actor,
              });
              if (!result.ok) {
                setError(result.error);
                return;
              }
              router.push(
                `/vehicles/${result.id}${next === "checkin" ? "/check-in" : ""}`,
              );
            } catch {
              setError("Could not save. Check your connection and try again.");
            }
          });
        }}
      >
        <section className="form-section">
          <div className="section-number">01</div>
          <div className="section-body">
            <h2>Identify the car</h2>
            <p>
              Enter or paste the VIN. NHTSA can fill in the year, make and
              model.
            </p>
            <div className="vin-row">
              <label className="field">
                VIN <span className="optional">optional at purchase</span>
                <input
                  name="vin"
                  value={vin}
                  onChange={(e) => setVin(e.target.value.toUpperCase())}
                  maxLength={17}
                  autoCapitalize="characters"
                  autoComplete="off"
                  placeholder="17-character VIN"
                />
              </label>
              <Button
                type="button"
                variant="outline"
                disabled={decoding || saving || !vin}
                onClick={decode}
              >
                <ScanLine />
                {decoding ? "Looking up…" : "Decode VIN"}
              </Button>
            </div>
            {lookupMessage && (
              <p role="status" className="lookup-message">
                {lookupMessage}
              </p>
            )}
            <div className="form-grid three">
              <label className="field">
                Year
                <input
                  name="year"
                  type="number"
                  min="1900"
                  max="2100"
                  required
                  value={year}
                  onChange={(e) => setYear(e.target.value)}
                  inputMode="numeric"
                />
              </label>
              <label className="field">
                Make
                <input
                  name="make"
                  required
                  maxLength={80}
                  value={make}
                  onChange={(e) => setMake(e.target.value)}
                />
              </label>
              <label className="field">
                Model
                <input
                  name="model"
                  required
                  maxLength={80}
                  value={model}
                  onChange={(e) => setModel(e.target.value)}
                />
              </label>
            </div>
            <div className="form-grid">
              <label className="field">
                Trim <span className="optional">optional</span>
                <input
                  name="trim"
                  maxLength={80}
                  value={trim}
                  onChange={(e) => setTrim(e.target.value)}
                />
              </label>
              <label className="field">
                Color <span className="optional">optional</span>
                <input name="color" maxLength={40} />
              </label>
            </div>
          </div>
        </section>
        <section className="form-section">
          <div className="section-number">02</div>
          <div className="section-body">
            <h2>Purchase details</h2>
            <p>Use the same stock number as DealerCenter.</p>
            <div className="form-grid">
              <label className="field">
                Stock number
                <input
                  name="stock_number"
                  required
                  maxLength={40}
                  placeholder="e.g. K-1042"
                  autoCapitalize="characters"
                />
              </label>
              <label className="field">
                Miles in <span className="optional">optional</span>
                <input
                  name="miles_in"
                  type="number"
                  min="0"
                  max="2147483647"
                  inputMode="numeric"
                />
              </label>
              <label className="field">
                Purchase date
                <input
                  name="purchase_date"
                  type="date"
                  required
                  defaultValue={today}
                  max={today}
                />
              </label>
              <label className="field">
                Source
                <select name="source" defaultValue="ACV">
                  {SOURCES.map((source) => (
                    <option key={source}>{source}</option>
                  ))}
                </select>
              </label>
            </div>
          </div>
        </section>
        <div className="form-footer">
          {error && (
            <p role="alert" className="form-error">
              {error}
            </p>
          )}
          <p className="form-hint">
            Starts in Purchased with the shop’s default recon budget.
          </p>
          <div className="form-buttons">
            <Button
              type="submit"
              name="next"
              value="checkin"
              disabled={saving || decoding}
            >
              <ArrowRight />
              {saving ? "Saving…" : "Add & check in"}
            </Button>
            <Button
              type="submit"
              name="next"
              value="detail"
              variant="outline"
              disabled={saving || decoding}
            >
              <Plus />
              Add to Purchased
            </Button>
          </div>
        </div>
      </form>
    </>
  );
}
