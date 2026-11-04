# Build prompt: Kars Recon (internal recon tracker)

> Paste everything below into your coding agent. Save this file in the repo as `SPEC.md` so the agent can come back to it.

---

## Who I am and what this is

I run Kars Auto Sales and Repair, a small used-car dealer and repair shop in Cleveland, OH. I buy about 3–4 cars a week at auction. Every car goes through reconditioning (recon) in our own shop before we list it. Right now nothing about recon is tracked. We don't know:

- where each car is in the process, or what is holding it up
- how much each car really cost to recon (parts + labor + sublet)
- what each tech should be paid for the work they did
- which parts were ordered, received, used, need to go back, or have a core charge we still need to get back
- who worked on which car, and whose work came back broken (comebacks)

Build an internal web app that fixes this. It is for **our own inventory only**, not customer repair orders. Customer ROs stay in AutoLeap. Purchase and sale prices stay in DealerCenter. This app owns **recon**.

## Who uses it

| Person | Role | What they do in the app |
|---|---|---|
| Nelson (me) | `owner` | Everything. Approves spend, sets pay rates, locks pay weeks, sees all costs. |
| Alex (tech) | `tech` | Checks the board every morning. Updates his own jobs. Can order parts. Sees his own pay only. |
| Pops (lead tech) | `viewer` | View only: the board and car details. No costs, no pay. He's not very comfortable with computers, so keep his screens dead simple. |
| Future techs/advisor | `tech` / `advisor` | Leave room for these. Don't hardcode names. |

**Most important design rule:** techs update the app with greasy hands on a phone or shop tablet. Any common tech action (start job, finish job, mark part received, flag blocked) must take **2 taps or fewer** from the screen they're already on. Big buttons (min 48px), high contrast, no small text inputs on the main path. If a feature makes this harder, push back and tell me.

## Tech stack (don't change it)

- Next.js (App Router) + TypeScript (strict)
- Tailwind CSS + shadcn/ui
- Supabase: Postgres, Auth (email magic link or email+password), Storage (photos, receipts)
- Supabase CLI migrations in the repo. Generate DB types into `src/types/database.ts`
- Zod for validation, server actions for writes
- Row-level security on every table, based on role
- PWA (installable on Android/iPad, works on a shared shop tablet)
- Vitest for unit tests. **All money and pay math must have tests.**
- Deploy target: Vercel

**Money rules:** store all money as integer cents. Store hours as `numeric(6,2)`. Never use floats for money.

**Source control:** I lost the source code to my last version of this app. Set up git at the very start, give me the exact commands to push to a private GitHub repo, and commit at the end of every milestone with a clear message. Remind me to push.

## Data model (starting point; improve it if you see a problem, but tell me why)

- **profiles**: id (auth user), full_name, role (`owner` | `tech` | `advisor` | `viewer`), active
- **tech_pay_rates**: tech_id, rate_cents_per_hour, effective_from (date), created_by. Rate history, never overwrite. Pay for a job uses the rate in effect on the job's completed date.
- **settings** (single row): default_recon_budget_cents (default 80000 = $800), budget_warning_pct (default 80), stage_target_days (JSON per stage), total_target_days (default 8)
- **vehicles**: id, stock_number (unique, matches DealerCenter), vin, year, make, model, trim, color, miles_in, purchase_date, source (ACV / Manheim / Skipco / Akron Auto / other), stage, stage_entered_at, blocker (nullable enum), blocker_note, recon_budget_cents (defaults from settings, editable per car), status (`active` | `sold` | `wholesaled`), created_at
- **stage_history**: vehicle_id, from_stage, to_stage, changed_by, changed_at. Write to this on every stage change. All "days in stage" and cycle-time reports come from here.
- **checkins**: vehicle_id, checklist (JSON of pass/fail/notes items), keys_count, photos (storage paths), done_by, done_at
- **jobs**: id, vehicle_id, title, category (mechanical / electrical / body / tires / brakes / detail / other), book_hours, tech_id, status (`pending` | `needs_approval` | `approved` | `in_progress` | `done` | `cancelled`), started_at, completed_at, is_comeback (bool), original_job_id (nullable, points to the job that failed), notes, pay_week_id (nullable, set when the week is locked)
- **parts**: id, vehicle_id, job_id (nullable), name, part_number, vendor, qty, unit_cost_cents, status (`needed` | `ordered` | `received` | `installed` | `return_pending` | `returned`), ordered_by, ordered_at, received_at, installed_at, return_due_date, returned_at, refund_cents, core_charge_cents, core_due_date, core_returned_at, core_refund_cents, receipt_photo
- **sublets**: vehicle_id, vendor (e.g. Admiral Auto Care), description, cost_cents, sent_at, returned_at
- **pay_weeks**: id, week_start (Monday), locked (bool), locked_at, locked_by
- **activity_log**: who, what, vehicle_id, when. A simple audit trail of every change.

## Stages and blockers

**Stages (in order):** Purchased → In transit → Check-in → Diagnosis → Repair → QC → Detail → Photos → Frontline → Sold

- Stage = where the car physically is in the process.
- **Blocker** is a separate flag that can sit on any stage: `waiting_parts`, `waiting_approval`, `waiting_diagnosis`, `at_sublet`, `no_tech_available`, `other` (with a note). Pick from the list; no free-text-only blockers.
- Auto rules:
  - If any part on the car is `ordered` but not `received`, suggest the `waiting_parts` blocker.
  - If the car's recon cost goes over its budget, set `waiting_approval` and block new jobs/parts until I approve.
  - Can't move to Frontline unless QC is checked off by someone other than the tech who did the most job hours on the car (or by me).
- Every stage has a target number of days (editable in settings). Show yellow when a car is near its target, red when it's over.

## Recon cost and the $800 budget

Recon cost per car = parts (net of returns and core refunds) + labor + sublet.

- **Labor cost = book_hours × the tech's pay rate**, not our $110/hr retail rate. That's what the car actually cost us.
- Comeback jobs: count their parts cost against the car, but they earn the tech **$0 pay by default** (owner can override per job).
- Each car shows a budget bar: spent vs. budget. Yellow at the warning %, red over budget.
- Before a new job or part pushes a car over budget, mark it `needs_approval`. It goes to my approvals queue, and I get an in-app alert. Approve or reject with one tap.
- I can change the budget on any single car.

## Tech pay

- Pay screen shows each tech's week: jobs done, book hours, rate, total.
- **Rates are editable.** When I change a rate, all **unlocked** weeks recalculate right away. **Locked** weeks never change. That's the record of what was paid.
- I lock a week after I pay it. Locking stamps `pay_week_id` on those jobs.
- Show comebacks per tech per week and in total (count + parts cost). This is how I see whose work fails.
- Export a pay week to CSV.

## Parts

- Only `owner` and `tech` roles can order parts.
- Parts page with 4 lists:
  1. **On order**: ordered, not yet received, with days waiting
  2. **Received, not used**: sitting on the shelf
  3. **To return**: with return due date, sorted by soonest
  4. **Cores owed**: core charge not yet refunded, with due date and **a total dollar amount at the top**
- Receipt photo upload from the phone camera.
- Marking a job done asks: "Were all parts used?" Any part not installed moves to `return_pending`.

## Screens

1. **Board (home)**: kanban columns by stage. Each card shows stock #, year/make/model, days in stage, total days since purchase, blocker chip, budget bar (owner only). Filter by tech and by "blocked only." On phones, show a list grouped by stage instead of side-scrolling columns.
2. **Morning view**: one screen Alex and I check at the start of the day: blocked cars and why, cars over their target days, parts arriving or late, returns and cores due this week, approvals waiting on me.
3. **Car detail**: tabs for Jobs, Parts, Timeline (stage history + activity log), Cost (owner only). Big buttons to move stage and set or clear a blocker.
4. **My jobs (tech)**: only the logged-in tech's open jobs. Buttons: Start, Done, Need part, Blocked.
5. **Check-in**: VIN entry or scan → decode year/make/model with the free NHTSA vPIC API → checklist → photos → done. Same checklist every car.
6. **Parts**: the 4 lists above.
7. **Approvals** (owner)
8. **Pay** (owner; techs see only their own)
9. **Reports** (owner): average days per stage, average total recon days, average recon cost per car, cost by category, most common blockers, comebacks by tech. CSV export of all cars with total recon cost by stock number so I can match it to DealerCenter.
10. **Settings** (owner): users and roles, pay rates (with history), default budget, stage targets, checklist items.

## Not in V1 (don't build these)

- Syncing with AutoLeap, DealerCenter, or QuickBooks (CSV export only)
- Customer repair orders
- A built-in labor guide (book hours are typed in)
- AI features, listing photos, auto-posting to marketplaces
- Native mobile app (the PWA is enough)

## Build order

Do one milestone at a time. At the end of each: run the tests, give me a short summary of what to click to check it, commit, and stop for my OK before starting the next.

1. **Setup**: Next.js + Supabase project, auth, roles, RLS, all migrations, seed script with fake data (3 techs, ~12 cars spread across stages, parts in every status, a couple of comebacks). Git init + GitHub push instructions.
2. **Vehicles + board**: add a car, check-in flow with VIN decode, kanban/list board, stage moves with history, blockers, days-in-stage colors.
3. **Jobs + pay**: jobs on cars, my-jobs screen, rate history, weekly pay with live recalculation, week locking, comebacks.
4. **Parts**: full parts lifecycle, receipt photos, returns, cores, the 4 lists.
5. **Budget + approvals**: cost rollup, budget bar, approval queue and blocking.
6. **Morning view + reports + CSV exports**
7. **Polish**: PWA install, tablet layout check, loading/empty states, error handling.

## How to work with me

- Ask before you make a big decision that's hard to change later (schema shape, auth method).
- Keep code simple and readable. I'll be maintaining it myself.
- If something in this spec doesn't make sense or will cause problems, say so before building it.