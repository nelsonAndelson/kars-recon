import { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";

let db: PGlite;
beforeAll(async () => {
  db = new PGlite();
  await db.exec(`create role anon; create role authenticated; create schema auth; create schema storage;
    create table auth.users(id uuid primary key,aud text,role text,email text,raw_app_meta_data jsonb,raw_user_meta_data jsonb,created_at timestamptz,updated_at timestamptz,banned_until timestamptz);
    create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);`);
  for (const file of readdirSync("supabase/migrations")
    .filter((name) => name.endsWith(".sql"))
    .sort())
    await db.exec(readFileSync(`supabase/migrations/${file}`, "utf8"));
  await db.exec(readFileSync("supabase/seed.sql", "utf8"));
}, 30000);
afterAll(async () => {
  await db?.close();
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
            "select * from public.activity_log where what='vehicles:update'",
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
