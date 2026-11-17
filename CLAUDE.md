# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

Kars Recon is an internal reconditioning (recon) tracker for a used-car dealership/shop: vehicles move through stages, technicians do jobs, parts get requested/ordered/received, and weekly tech pay is calculated and locked. Live at https://kars-recon.vercel.app.

Read before big changes: `SPEC.md` (original brief, kept verbatim), `DECISIONS.md` (later decisions — these override SPEC.md), `README.md` (production state and operational notes).

## Commands

```bash
npm run dev          # Next dev server on 127.0.0.1
npm run typecheck    # next typegen && tsc --noEmit
npm test             # vitest run (unit + PGlite database tests)
npx vitest run src/lib/money.test.ts       # single file
npx vitest run -t "part of test name"      # single test
npm run build
npm run db:types     # regenerate src/types/database.ts from the hosted project (or `-- --local`)
node --env-file=.env.local scripts/check-live.mjs   # live checks against the configured Supabase
```

There is no lint script / ESLint config; Prettier is installed. `db:start` / `db:reset` need Docker and are for a disposable local DB only — never seed production or reset with `--linked`.

## Architecture

**No sign-in, by design.** Everyone uses the Supabase publishable key via `shopDatabase()` in `src/lib/supabase.ts` (no session, no service-role key). The selected team member ("actor") and view are self-reported and stored in `localStorage` (`kars.actor`, `kars.view`) by `src/components/shop-shell.tsx`. Roles organize workflows; they are not security. Don't present the profile picker as authentication.

**All writes go through Postgres command functions, not table writes.** Every table has RLS and direct anonymous writes are denied. Server actions (`src/app/actions.ts`, `work-actions.ts`, `shop-actions.ts`) validate input with Zod schemas from `src/lib/*.ts`, then call one RPC per domain: `vehicle_command`, `job_command`, `pay_command`, `team_command`, `part_command`, and `inventory_*`. Each `public.*` function is a thin wrapper over a `private.*` function in `supabase/migrations/` that holds the real business rules (QC eligibility, stage history, paid-week locks, last-admin guard, etc.). Reads are mostly RPCs too (`work_data`, `pay_week_report`, `inventory_read`) plus queries in `src/lib/recon-data.ts`. New business rules usually belong in SQL, with a matching Zod schema on the TS side.

**Pages** in `src/app/*/page.tsx` are thin `force-dynamic` server components: fetch data, wrap in `ShopShell`, render a client `*-workspace.tsx` component from `src/components/`.

**Schema is frozen.** The original eleven tables/columns must stay unchanged (see DECISIONS.md). QC sign-offs, comeback overrides and locked pay snapshots are stored as structured immutable JSON events in the append-only `activity_log`, not new columns. Only the inventory import added tables. Ask before any schema change. Migration filenames keep the hosted version numbers; after schema changes run `npm run db:types`.

**Money:** integer cents everywhere, hours as `numeric(6,2)`, never floats. Pay rounds half-up per job using integer/bigint math (`src/lib/money.ts`). Dates use the shop's `America/New_York` calendar (`SHOP_TIMEZONE` in `src/lib/domain.ts`). All money/pay math must have tests.

**Inventory import (DealerCenter):** `src/lib/inventory-server.ts` (server-only) fetches the newest `DealerCenter_YYYYMMDD_28126551.csv` over Explicit FTPS (`basic-ftp`, full cert validation, host `server122.web-hosting.com`), parses it with `src/lib/inventory.ts`, and queues items via `inventory_worker` authorized by `INVENTORY_WORKER_TOKEN` (only its hash is stored in the DB). Nothing is applied automatically — admins approve each car on `/inventory`; missing listings are flagged, never deleted or marked sold. Daily cron is in `vercel.json` (11:00 UTC) hitting `src/app/api/cron/inventory/route.ts`, which checks `CRON_SECRET`.

## Tests

- `src/lib/*.test.ts`: pure logic (money, jobs, vehicles, inventory parsing).
- `tests/database.test.ts`: loads every migration plus `supabase/seed.sql` into in-memory PGlite (with minimal `auth`/`storage` stubs) and exercises the command functions directly. Add a test here when changing SQL rules.

## Environment

Copy `.env.example` to `.env.local` and set `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`. FTP/worker/cron secrets exist only in production. Node 22+, npm.
