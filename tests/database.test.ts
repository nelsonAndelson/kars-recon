import { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";

let db: PGlite;
beforeAll(async () => {
  db = new PGlite();
  await db.exec(`create role anon; create role authenticated; create schema auth; create schema storage;
    create table auth.users(id uuid primary key,aud text,role text,email text,raw_app_meta_data jsonb,raw_user_meta_data jsonb,created_at timestamptz,updated_at timestamptz,banned_until timestamptz);
    create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
    create table storage.objects(id uuid default gen_random_uuid(),bucket_id text,name text);
    alter table storage.objects enable row level security;
    grant usage on schema storage to anon,authenticated;
    grant select,insert,delete on storage.objects to anon,authenticated;`);
  for (const file of readdirSync("supabase/migrations")
    .filter((name) => name.endsWith(".sql"))
    .sort())
    await db.exec(readFileSync(`supabase/migrations/${file}`, "utf8"));
  await db.exec(readFileSync("supabase/seed.sql", "utf8"));
}, 30000);
afterAll(async () => {
  await db?.close();
});

async function command(action: string, payload: object) {
  return db.query("select public.vehicle_command($1,$2::jsonb)", [
    action,
    JSON.stringify(payload),
  ]);
}
const firstCar = "20000000-0000-4000-8000-000000000001";
const owner = "10000000-0000-4000-8000-000000000001";
async function move(carId: string, stage: string) {
  const { rows } = await db.query<{ stage: string; stage_entered_at: string }>(
    "select stage,stage_entered_at from public.vehicles where id=$1",
    [carId],
  );
  return command("move", {
    vehicle_id: carId,
    stage,
    expected_stage: rows[0].stage,
    expected_entered_at: rows[0].stage_entered_at,
    actor_id: owner,
  });
}
async function transaction(run: () => Promise<void>) {
  await db.exec("begin; set local role anon");
  try {
    await run();
  } finally {
    await db.exec("rollback");
  }
}

const alex = "10000000-0000-4000-8000-000000000002";
async function jobCall(action: string, payload: object) {
  return db.query<{ job_command: string }>(
    "select public.job_command($1,$2::jsonb)",
    [action, JSON.stringify({ actor_id: owner, ...payload })],
  );
}
async function payCall(action: string, payload: object) {
  return db.query("select public.pay_command($1,$2::jsonb)", [
    action,
    JSON.stringify({ actor_id: owner, ...payload }),
  ]);
}
async function jobVersion(id: string) {
  return (
    await db.query<{ revision: string }>(
      "select md5(to_jsonb(j)::text) revision from public.jobs j where id=$1",
      [id],
    )
  ).rows[0].revision;
}
async function previousWeek() {
  return (
    await db.query<{ day: string }>(
      "select (date_trunc('week',now() at time zone 'America/New_York')::date-7)::text as day",
    )
  ).rows[0].day;
}
async function report(day: string) {
  return (
    await db.query<{
      report: {
        revision: string;
        locked: boolean;
        rows: {
          job_id: string;
          pay_cents: number | null;
          rate_cents: number | null;
        }[];
      };
    }>("select public.pay_week_report($1::date) report", [day])
  ).rows[0].report;
}
async function newPayJob(comeback?: string) {
  const carId = "50000000-0000-4000-8000-000000000003";
  if (
    !(await db.query("select id from public.vehicles where id=$1", [carId]))
      .rows.length
  )
    await command("create", {
      id: carId,
      stock_number: "PAY-TEST",
      year: 2020,
      make: "Honda",
      model: "Civic",
      purchase_date: "2020-01-01",
      source: "ACV",
      actor_id: owner,
    });
  const created = await jobCall("create", {
    vehicle_id: carId,
    title: comeback ? "Comeback repair" : "Test repair",
    category: "brakes",
    book_hours: "1.25",
    tech_id: alex,
    notes: "",
    is_comeback: !!comeback,
    original_job_id: comeback ?? "",
  });
  return created.rows[0].job_command;
}
async function completePayJob(id: string, day: string) {
  await jobCall("done", {
    job_id: id,
    revision: await jobVersion(id),
    completed_date: day,
    parts: {},
  });
}
describe("jobs and pay workflows", () => {
  it("returns shared work data with optimistic job versions", async () =>
    transaction(async () => {
      const data = (
        await db.query<{
          value: { jobs: { revision: string }[]; rates: unknown[] };
        }>("select public.work_data() value")
      ).rows[0].value;
      expect(data.jobs).toHaveLength(14);
      expect(data.jobs[0].revision).toMatch(/^[a-f0-9]{32}$/);
      expect(data.rates).toHaveLength(6);
    }));
  it("creates, starts and completes a job with recorded attribution", async () =>
    transaction(async () => {
      const id = await newPayJob();
      await jobCall("start", { job_id: id, revision: await jobVersion(id) });
      await jobCall("done", {
        job_id: id,
        revision: await jobVersion(id),
        parts: {},
      });
      expect(
        (
          await db.query<{ status: string }>(
            "select status from public.jobs where id=$1",
            [id],
          )
        ).rows[0].status,
      ).toBe("done");
      expect(
        (
          await db.query(
            "select 1 from public.activity_log where who=$1 and what::jsonb->>'action'='job_done' and what::jsonb->>'job_id'=$2",
            [owner, id],
          )
        ).rows,
      ).toHaveLength(1);
    }));
  it("rejects stale edits instead of overwriting newer work", async () =>
    transaction(async () => {
      const id = await newPayJob(),
        revision = await jobVersion(id);
      await jobCall("start", { job_id: id, revision });
      await expect(jobCall("cancel", { job_id: id, revision })).rejects.toThrow(
        /another device/,
      );
    }));
  it("rejects excess hour precision at the database boundary", async () =>
    transaction(async () => {
      await expect(
        jobCall("create", {
          vehicle_id: firstCar,
          title: "Invalid hours",
          category: "brakes",
          book_hours: "1.255",
          tech_id: alex,
        }),
      ).rejects.toThrow(/two decimals/);
    }));
  it("rejects cross-vehicle comeback links", async () =>
    transaction(async () => {
      const original = await newPayJob();
      await completePayJob(original, await previousWeek());
      await expect(
        jobCall("create", {
          vehicle_id: firstCar,
          title: "Invalid comeback",
          category: "brakes",
          book_hours: "1",
          tech_id: alex,
          is_comeback: true,
          original_job_id: original,
        }),
      ).rejects.toThrow(/this vehicle/);
    }));
  it("does not allow a job waiting for approval to start", async () =>
    transaction(async () => {
      const id = "30000000-0000-4000-8000-000000000005";
      await expect(
        jobCall("start", { job_id: id, revision: await jobVersion(id) }),
      ).rejects.toThrow(/pending or approved/);
    }));
  it("recalculates unlocked pay using a newly effective rate", async () =>
    transaction(async () => {
      const day = await previousWeek(),
        id = await newPayJob();
      await completePayJob(id, day);
      await payCall("rate", {
        tech_id: alex,
        rate_cents: 4000,
        effective_from: day,
      });
      expect(
        (await report(day)).rows.find((r) => r.job_id === id)?.pay_cents,
      ).toBe(5000);
    }));
  it("pays comebacks zero until an owner records an override", async () =>
    transaction(async () => {
      const day = await previousWeek(),
        original = await newPayJob();
      await completePayJob(original, day);
      const id = await newPayJob(original);
      await completePayJob(id, day);
      expect(
        (await report(day)).rows.find((r) => r.job_id === id)?.pay_cents,
      ).toBe(0);
      await payCall("override", {
        job_id: id,
        revision: await jobVersion(id),
        expected_override: null,
        amount_cents: 1234,
        reason: "Goodwill exception",
      });
      expect(
        (await report(day)).rows.find((r) => r.job_id === id)?.pay_cents,
      ).toBe(1234);
    }));
  it("requires a selected owner for a pay override", async () =>
    transaction(async () => {
      const original = await newPayJob();
      await completePayJob(original, await previousWeek());
      const id = await newPayJob(original);
      await expect(
        payCall("override", {
          actor_id: alex,
          job_id: id,
          revision: await jobVersion(id),
          expected_override: null,
          amount_cents: 200,
          reason: "Test",
        }),
      ).rejects.toThrow(/owner/);
    }));
  it("locks snapshots and preserves pay after a retroactive rate addition", async () =>
    transaction(async () => {
      const day = await previousWeek(),
        id = await newPayJob();
      await completePayJob(id, day);
      const before = await report(day);
      await payCall("lock", { week_start: day, revision: before.revision });
      await payCall("rate", {
        tech_id: alex,
        rate_cents: 9999,
        effective_from: day,
      });
      const after = await report(day);
      expect(after.locked).toBe(true);
      expect(after.rows).toEqual(before.rows);
      expect(
        (
          await db.query<{ pay_week_id: string }>(
            "select pay_week_id from public.jobs where id=$1",
            [id],
          )
        ).rows[0].pay_week_id,
      ).toBeTruthy();
    }));
  it("refuses to lock a stale pay preview", async () =>
    transaction(async () => {
      const day = await previousWeek(),
        id = await newPayJob();
      await completePayJob(id, day);
      const before = await report(day);
      await payCall("rate", {
        tech_id: alex,
        rate_cents: 9999,
        effective_from: day,
      });
      await expect(
        payCall("lock", { week_start: day, revision: before.revision }),
      ).rejects.toThrow(/Pay changed/);
    }));
  it("rejects editing a locked job", async () =>
    transaction(async () => {
      const day = await previousWeek(),
        id = await newPayJob();
      await completePayJob(id, day);
      await payCall("lock", {
        week_start: day,
        revision: (await report(day)).revision,
      });
      await expect(
        jobCall("reopen", { job_id: id, revision: await jobVersion(id) }),
      ).rejects.toThrow(/locked/);
    }));
  it("prevents late completions from entering a locked week", async () =>
    transaction(async () => {
      const day = await previousWeek(),
        id = await newPayJob();
      await completePayJob(id, day);
      await payCall("lock", {
        week_start: day,
        revision: (await report(day)).revision,
      });
      const late = await newPayJob();
      await expect(completePayJob(late, day)).rejects.toThrow(/locked/);
    }));
  it("enforces append-only financial events even for database writes", async () => {
    await db.exec("begin");
    try {
      await expect(
        db.exec("update public.activity_log set what='changed'"),
      ).rejects.toThrow(/append-only/);
    } finally {
      await db.exec("rollback");
    }
  });
  it("requires disposition for outstanding linked parts", async () =>
    transaction(async () => {
      const id = "30000000-0000-4000-8000-000000000006";
      // This seeded job only has returned parts, so use a job with a received part.
      const target = "30000000-0000-4000-8000-000000000009";
      await expect(
        jobCall("done", {
          job_id: target,
          revision: await jobVersion(target),
          parts: {},
        }),
      ).rejects.toThrow(/every linked part/);
    }));
  it("moves unused linked parts to return_pending while completing the job", async () =>
    transaction(async () => {
      const id = "30000000-0000-4000-8000-000000000009",
        part = "40000000-0000-4000-8000-000000000009";
      await jobCall("done", {
        job_id: id,
        revision: await jobVersion(id),
        parts: { [part]: "unused" },
      });
      expect(
        (
          await db.query<{ status: string }>(
            "select status from public.parts where id=$1",
            [part],
          )
        ).rows[0].status,
      ).toBe("return_pending");
    }));
  it("preserves QC when payroll linkage alone changes", async () =>
    transaction(async () => {
      const day = await previousWeek(),
        id = await newPayJob();
      await completePayJob(id, day);
      const carId = "50000000-0000-4000-8000-000000000003";
      await move(carId, "qc");
      await command("qc", { vehicle_id: carId, actor_id: owner });
      await payCall("lock", {
        week_start: day,
        revision: (await report(day)).revision,
      });
      await move(carId, "frontline");
    }));
});
describe("paid-record boundaries", () => {
  it("blocks locking when an effective rate is missing", async () =>
    transaction(async () => {
      const id = await newPayJob();
      await completePayJob(id, "2020-01-06");
      const preview = await report("2020-01-06");
      expect(preview.rows[0].pay_cents).toBeNull();
      await expect(
        payCall("lock", {
          week_start: "2020-01-06",
          revision: preview.revision,
        }),
      ).rejects.toThrow(/missing pay rates/);
    }));
  it("rejects replacement of an existing effective-date rate", async () =>
    transaction(async () => {
      const date = (
        await db.query<{ effective_from: string }>(
          "select effective_from::text from public.tech_pay_rates where tech_id=$1 limit 1",
          [alex],
        )
      ).rows[0].effective_from;
      await expect(
        payCall("rate", {
          tech_id: alex,
          effective_from: date,
          rate_cents: 9999,
        }),
      ).rejects.toThrow(/already exists/);
    }));
  it("prevents raw database edits to locked jobs", async () => {
    await db.exec("begin");
    try {
      const day = await previousWeek(),
        id = await newPayJob();
      await completePayJob(id, day);
      await payCall("lock", {
        week_start: day,
        revision: (await report(day)).revision,
      });
      await expect(
        db.query("update public.jobs set book_hours=999 where id=$1", [id]),
      ).rejects.toThrow(/locked/);
    } finally {
      await db.exec("rollback");
    }
  });
  it("prevents raw unlocking of paid weeks", async () => {
    await db.exec("begin");
    try {
      const day = await previousWeek(),
        id = await newPayJob();
      await completePayJob(id, day);
      await payCall("lock", {
        week_start: day,
        revision: (await report(day)).revision,
      });
      await expect(
        db.query(
          "update public.pay_weeks set locked=false,locked_at=null where week_start=$1",
          [day],
        ),
      ).rejects.toThrow(/cannot be changed/);
    } finally {
      await db.exec("rollback");
    }
  });
  it("rejects a second override based on a stale preview", async () =>
    transaction(async () => {
      const day = await previousWeek(),
        original = await newPayJob();
      await completePayJob(original, day);
      const id = await newPayJob(original),
        revision = await jobVersion(id);
      await payCall("override", {
        job_id: id,
        revision,
        expected_override: null,
        amount_cents: 1000,
        reason: "First",
      });
      await expect(
        payCall("override", {
          job_id: id,
          revision,
          expected_override: null,
          amount_cents: 2000,
          reason: "Stale",
        }),
      ).rejects.toThrow(/override changed/);
    }));
  it("marks a used received part installed in the completion transaction", async () =>
    transaction(async () => {
      const id = "30000000-0000-4000-8000-000000000009",
        part = "40000000-0000-4000-8000-000000000009";
      await jobCall("done", {
        job_id: id,
        revision: await jobVersion(id),
        parts: { [part]: "used" },
      });
      const result = (
        await db.query<{ status: string; installed_at: string }>(
          "select status,installed_at from public.parts where id=$1",
          [part],
        )
      ).rows[0];
      expect(result.status).toBe("installed");
      expect(result.installed_at).toBeTruthy();
    }));
  it("preserves an existing vehicle blocker when a part is requested", async () =>
    transaction(async () => {
      const id = await newPayJob(),
        car = "50000000-0000-4000-8000-000000000003";
      await command("blocker", {
        vehicle_id: car,
        blocker: "waiting_approval",
        note: "Owner decision",
      });
      await jobCall("need_part", {
        job_id: id,
        revision: await jobVersion(id),
        note: "Brake pads",
      });
      expect(
        (
          await db.query<{ blocker: string }>(
            "select blocker from public.vehicles where id=$1",
            [car],
          )
        ).rows[0].blocker,
      ).toBe("waiting_approval");
    }));
});
describe("shared vehicle workflows", () => {
  it("creates a vehicle with the configured budget and records attribution", async () =>
    transaction(async () => {
      const payload = {
        id: "50000000-0000-4000-8000-000000000001",
        stock_number: " new-001 ",
        year: 2020,
        make: "Honda",
        model: "Civic",
        vin: "",
        purchase_date: "2026-01-01",
        source: "ACV",
        actor_id: owner,
        recon_budget_cents: 1,
      };
      await command("create", payload);
      const { rows } = await db.query<{
        stock_number: string;
        recon_budget_cents: number;
      }>(
        "select stock_number,recon_budget_cents from public.vehicles where id=$1",
        [payload.id],
      );
      expect(rows[0]).toEqual({
        stock_number: "NEW-001",
        recon_budget_cents: 80000,
      });
      expect(
        (
          await db.query<{ changed_by: string }>(
            "select changed_by from public.stage_history where vehicle_id=$1",
            [payload.id],
          )
        ).rows[0].changed_by,
      ).toBe(owner);
    }));
  it("rejects a stale stage move", async () =>
    transaction(async () => {
      const { rows } = await db.query<{ stage_entered_at: string }>(
        "select stage_entered_at from public.vehicles where id=$1",
        [firstCar],
      );
      await move(firstCar, "in_transit");
      await expect(
        command("move", {
          vehicle_id: firstCar,
          stage: "repair",
          expected_stage: "purchased",
          expected_entered_at: rows[0].stage_entered_at,
        }),
      ).rejects.toThrow(/another device/);
    }));
  it("sets and clears structured blockers", async () =>
    transaction(async () => {
      await command("blocker", {
        vehicle_id: firstCar,
        blocker: "waiting_parts",
        note: "Sensor on order",
      });
      expect(
        (
          await db.query<{ blocker: string }>(
            "select blocker from public.vehicles where id=$1",
            [firstCar],
          )
        ).rows[0].blocker,
      ).toBe("waiting_parts");
      await command("blocker", { vehicle_id: firstCar, blocker: "", note: "" });
      expect(
        (
          await db.query<{ blocker: string | null }>(
            "select blocker from public.vehicles where id=$1",
            [firstCar],
          )
        ).rows[0].blocker,
      ).toBeNull();
    }));
  it("requires a note for an other blocker", async () =>
    transaction(async () => {
      await expect(
        command("blocker", {
          vehicle_id: firstCar,
          blocker: "other",
          note: "",
        }),
      ).rejects.toThrow(/check constraint/);
    }));
  it("completes check-in atomically and advances an arriving car to Diagnosis", async () =>
    transaction(async () => {
      const checklist = Object.fromEntries(
        ["fluids", "tires", "warning_lights", "body"].map((id) => [
          id,
          { result: "pass", notes: "" },
        ]),
      );
      await command("checkin", {
        vehicle_id: firstCar,
        actor_id: owner,
        keys_count: 2,
        checklist,
        photos: [],
      });
      expect(
        (
          await db.query<{ stage: string }>(
            "select stage from public.vehicles where id=$1",
            [firstCar],
          )
        ).rows[0].stage,
      ).toBe("diagnosis");
      expect(
        (
          await db.query("select * from public.checkins where vehicle_id=$1", [
            firstCar,
          ])
        ).rows,
      ).toHaveLength(1);
    }));
  it("rejects an incomplete checklist", async () =>
    transaction(async () => {
      await expect(
        command("checkin", {
          vehicle_id: firstCar,
          actor_id: owner,
          keys_count: 1,
          checklist: { fluids: { result: "pass" } },
          photos: [],
        }),
      ).rejects.toThrow(/every checklist/);
    }));
  it("requires independent QC before Frontline", async () =>
    transaction(async () => {
      await expect(move(firstCar, "frontline")).rejects.toThrow(/QC sign-off/);
    }));
  it("allows owner sign-off and a Frontline move", async () =>
    transaction(async () => {
      await move(firstCar, "qc");
      await command("qc", { vehicle_id: firstCar, actor_id: owner });
      await move(firstCar, "frontline");
      expect(
        (
          await db.query<{ stage: string }>(
            "select stage from public.vehicles where id=$1",
            [firstCar],
          )
        ).rows[0].stage,
      ).toBe("frontline");
    }));
  it("rejects the dominant tech as the QC signer", async () =>
    transaction(async () => {
      const car = "20000000-0000-4000-8000-000000000005";
      await move(car, "qc");
      await expect(
        command("qc", {
          vehicle_id: car,
          actor_id: "10000000-0000-4000-8000-000000000003",
        }),
      ).rejects.toThrow(/most completed hours/);
    }));
  it("invalidates QC after returning to Repair", async () =>
    transaction(async () => {
      await move(firstCar, "qc");
      await command("qc", { vehicle_id: firstCar, actor_id: owner });
      await move(firstCar, "repair");
      await move(firstCar, "photos");
      await expect(move(firstCar, "frontline")).rejects.toThrow(/QC sign-off/);
    }));
  it("rejects unknown commands", async () =>
    transaction(async () => {
      await expect(command("delete", { vehicle_id: firstCar })).rejects.toThrow(
        /Unknown/,
      );
    }));
  it("invalidates QC after a job changes", async () =>
    transaction(async () => {
      await move(firstCar, "qc");
      await command("qc", { vehicle_id: firstCar, actor_id: owner });
      await db.exec("reset role");
      await db.query(
        "insert into public.jobs(vehicle_id,title,book_hours) values($1,'Additional repair',1.25)",
        [firstCar],
      );
      await db.exec("set local role anon");
      await expect(move(firstCar, "frontline")).rejects.toThrow(/QC sign-off/);
    }));
  it("saves corrected VIN details with check-in and protects the attached photo", async () =>
    transaction(async () => {
      const path = firstCar + "/90000000-0000-4000-8000-000000000001.jpg";
      await db.query(
        "insert into storage.objects(bucket_id,name) values('recon-photos',$1)",
        [path],
      );
      const checklist = Object.fromEntries(
        ["fluids", "tires", "warning_lights", "body"].map((id) => [
          id,
          { result: "pass", notes: "" },
        ]),
      );
      await command("checkin", {
        vehicle_id: firstCar,
        actor_id: owner,
        keys_count: 2,
        checklist,
        photos: [path],
        identity: {
          vin: "1HGCM82633A004352",
          year: 2003,
          make: "HONDA",
          model: "Accord",
        },
      });
      expect(
        (
          await db.query<{ vin: string }>(
            "select vin from public.vehicles where id=$1",
            [firstCar],
          )
        ).rows[0].vin,
      ).toBe("1HGCM82633A004352");
      await db.query("delete from storage.objects where name=$1", [path]);
      expect(
        (await db.query("select * from storage.objects where name=$1", [path]))
          .rows,
      ).toHaveLength(1);
    }));
  it("denies uploads outside a vehicle folder", async () =>
    transaction(async () => {
      await expect(
        db.exec(
          "insert into storage.objects(bucket_id,name) values('recon-photos','not-a-vehicle/test.jpg')",
        ),
      ).rejects.toThrow(/row-level security/);
    }));
});

describe("database foundation", () => {
  it("seeds 12 cars, three techs, every part status and two comebacks", async () => {
    const { rows } = await db.query(
      `select (select count(*)::int from public.vehicles) cars,(select count(*)::int from public.profiles where role='tech') techs,(select count(distinct status)::int from public.parts) part_states,(select count(*)::int from public.jobs where is_comeback) comebacks`,
    );
    expect(rows[0]).toEqual({
      cars: 12,
      techs: 3,
      part_states: 6,
      comebacks: 2,
    });
  });
  it("enables RLS on all eleven public tables", async () => {
    const { rows } = await db.query<{ total: number; protected: number }>(
      `select count(*)::int total,count(*) filter(where c.relrowsecurity)::int protected from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind='r'`,
    );
    expect(rows[0]).toEqual({ total: 11, protected: 11 });
  });
  it("permits shared reads and denies anonymous writes", async () => {
    await db.exec("set role anon");
    try {
      expect(
        (await db.query("select * from public.vehicles")).rows,
      ).toHaveLength(12);
      expect(
        (await db.query("select * from public.tech_pay_rates")).rows,
      ).toHaveLength(6);
      await expect(
        db.exec(
          "update public.vehicles set make='Changed' where stock_number='DEMO-1001'",
        ),
      ).rejects.toThrow(/permission denied/);
    } finally {
      await db.exec("reset role");
    }
  });
  it("seeds idempotently", async () => {
    await db.exec(readFileSync("supabase/seed.sql", "utf8"));
    expect((await db.query("select * from public.vehicles")).rows).toHaveLength(
      12,
    );
  });
  it("tracks a stage change and updates the stage clock", async () => {
    await db.exec("begin");
    try {
      await db.exec(
        "update public.vehicles set stage='in_transit' where stock_number='DEMO-1001'",
      );
      const { rows } = await db.query<{ from_stage: string; to_stage: string }>(
        "select from_stage,to_stage from public.stage_history where vehicle_id='20000000-0000-4000-8000-000000000001' order by changed_at desc limit 1",
      );
      expect(rows[0]).toEqual({
        from_stage: "purchased",
        to_stage: "in_transit",
      });
      expect(
        (
          await db.query(
            "select * from public.activity_log where what like '%vehicles:update%'",
          )
        ).rows.length,
      ).toBeGreaterThan(0);
    } finally {
      await db.exec("rollback");
    }
  });
  it("rejects overwriting historical rates", async () => {
    await expect(
      db.exec("update public.tech_pay_rates set rate_cents_per_hour=1"),
    ).rejects.toThrow(/append-only/);
  });
  it("allows only one settings row", async () => {
    await expect(
      db.exec("insert into public.settings default values"),
    ).rejects.toThrow(/unique/);
  });
  it("requires a Monday pay week", async () => {
    await expect(
      db.exec("insert into public.pay_weeks(week_start) values('2026-11-04')"),
    ).rejects.toThrow(/check constraint/);
  });
  it("rejects negative cents", async () => {
    await expect(
      db.exec("update public.parts set unit_cost_cents=-1"),
    ).rejects.toThrow(/check constraint/);
  });
  it("rejects a part linked to a job on another vehicle", async () => {
    await expect(
      db.exec(
        "update public.parts set vehicle_id='20000000-0000-4000-8000-000000000001' where job_id is not null",
      ),
    ).rejects.toThrow(/foreign key/);
  });
});

describe("team management and parts handoffs", () => {
  const person = "60000000-0000-4000-8000-000000000001";
  const part = "70000000-0000-4000-8000-000000000001";
  const member = {
    id: person,
    full_name: "Shop technician",
    role: "tech",
    active: true,
  };
  const team = (payload: object) =>
    db.query("select public.team_command($1::jsonb)", [
      JSON.stringify({ actor_id: owner, ...payload }),
    ]);
  const parts = (action: string, payload: object) =>
    db.query("select public.part_command($1,$2::jsonb)", [
      action,
      JSON.stringify({ actor_id: owner, ...payload }),
    ]);
  it("creates, edits, deactivates and restores a team member without deleting identity", async () => {
    await transaction(async () => {
      await team({ ...member, expected: null });
      await team({
        ...member,
        full_name: "Renamed technician",
        active: false,
        expected: member,
      });
      await team({
        ...member,
        expected: { ...member, full_name: "Renamed technician", active: false },
      });
      const rows = await db.query<{ full_name: string }>(
        "select full_name from public.profiles where id=$1",
        [person],
      );
      expect(rows.rows[0].full_name).toBe(member.full_name);
    });
  });
  it("rejects team changes by a selected technician", async () => {
    await transaction(async () => {
      await expect(
        team({ ...member, expected: null, actor_id: alex }),
      ).rejects.toThrow(/admin/);
    });
  });
  it("keeps the last active admin", async () => {
    await transaction(async () => {
      const p = (
        await db.query<Record<string, unknown>>(
          "select * from public.profiles where id=$1",
          [owner],
        )
      ).rows[0];
      await expect(team({ ...p, active: false, expected: p })).rejects.toThrow(
        /at least one/,
      );
    });
  });
  it("requires reassignment before removing a technician with open jobs", async () => {
    await transaction(async () => {
      const p = (
        await db.query<Record<string, unknown>>(
          "select * from public.profiles where id=$1",
          [alex],
        )
      ).rows[0];
      await expect(team({ ...p, active: false, expected: p })).rejects.toThrow(
        /Reassign/,
      );
    });
  });
  it("rejects stale team edits", async () => {
    await transaction(async () => {
      await team({ ...member, expected: null });
      await expect(
        team({
          ...member,
          full_name: "New",
          expected: { ...member, full_name: "Stale" },
        }),
      ).rejects.toThrow(/changed/);
    });
  });
  it("records request, order and receipt with exact cents and audit attribution", async () => {
    await transaction(async () => {
      await parts("request", {
        id: part,
        vehicle_id: firstCar,
        job_id: "",
        name: "Brake rotors",
        qty: 2,
      });
      let p = (
        await db.query<{ item: object }>(
          "select to_jsonb(p) item from public.parts p where id=$1",
          [part],
        )
      ).rows[0].item;
      await parts("order", {
        id: part,
        expected: p,
        vendor: "Test vendor",
        unit_cost_cents: 1234,
      });
      p = (
        await db.query<{ item: object }>(
          "select to_jsonb(p) item from public.parts p where id=$1",
          [part],
        )
      ).rows[0].item;
      await parts("receive", { id: part, expected: p });
      const saved = (
        await db.query<{
          status: string;
          unit_cost_cents: number;
          received_at: string;
        }>("select * from public.parts where id=$1", [part])
      ).rows[0];
      expect(saved.status).toBe("received");
      expect(saved.unit_cost_cents).toBe(1234);
      expect(saved.received_at).toBeTruthy();
      const audit = (
        await db.query<{ who: string }>(
          "select who from public.activity_log where what::text like '%part_receive%' and vehicle_id=$1",
          [firstCar],
        )
      ).rows;
      expect(audit.some((a) => a.who === owner)).toBe(true);
    });
  });
  it("cannot receive a part before ordering it", async () => {
    await transaction(async () => {
      await parts("request", {
        id: part,
        vehicle_id: firstCar,
        job_id: "",
        name: "Rotor",
        qty: 1,
      });
      const p = (
        await db.query<{ item: object }>(
          "select to_jsonb(p) item from public.parts p where id=$1",
          [part],
        )
      ).rows[0].item;
      await expect(parts("receive", { id: part, expected: p })).rejects.toThrow(
        /Only ordered/,
      );
    });
  });
  it("rejects a stale parts transition", async () => {
    await transaction(async () => {
      await parts("request", {
        id: part,
        vehicle_id: firstCar,
        job_id: "",
        name: "Rotor",
        qty: 1,
      });
      await expect(
        parts("order", {
          id: part,
          expected: {},
          vendor: "Test",
          unit_cost_cents: 1,
        }),
      ).rejects.toThrow(/changed/);
    });
  });
});
