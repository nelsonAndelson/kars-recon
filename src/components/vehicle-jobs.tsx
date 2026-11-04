"use client";
import { useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "./ui/button";
import { JobCard } from "./job-card";
import { JobEditor } from "./job-editor";
import type { WorkData } from "@/lib/jobs";
export function VehicleJobs({
  data,
  vehicleId,
  today,
}: {
  data: WorkData;
  vehicleId: string;
  today: string;
}) {
  const [create, setCreate] = useState(false);
  const car = data.vehicles.find((v) => v.id === vehicleId)!,
    jobs = data.jobs.filter((j) => j.vehicle_id === vehicleId);
  return (
    <>
      <div className="vehicle-jobs-heading">
        <div className="panel-intro">
          <h2>Jobs on this car</h2>
          <p>Assign work, enter book hours, and record completion.</p>
        </div>
        <Button
          disabled={car.status !== "active"}
          onClick={() => setCreate(true)}
        >
          <Plus />
          Add job
        </Button>
      </div>
      <div className="vehicle-job-list">
        {jobs.map((j) => (
          <JobCard key={j.id} job={j} data={data} today={today} />
        ))}
      </div>
      {!jobs.length && <p className="detail-empty">No jobs recorded yet.</p>}
      {car.status !== "active" && (
        <p className="form-hint">
          Move this vehicle to an active stage before adding work.
        </p>
      )}
      {create && (
        <JobEditor
          data={data}
          vehicleId={vehicleId}
          onClose={() => setCreate(false)}
        />
      )}
    </>
  );
}
