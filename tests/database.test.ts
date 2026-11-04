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
