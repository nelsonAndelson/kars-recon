# Kars Recon

Milestone 3 of 7 is complete: vehicles, VIN decode, check-in photos/checklist, responsive recon board, stage history, blockers, QC sign-offs, jobs, weekly pay, effective rates and immutable paid records. The original brief is in `SPEC.md`; your subsequent choices are in `DECISIONS.md`. No sign-in is required.

## Open it on this computer

Production: **https://kars-recon.vercel.app**. Open this address on shop computers or phones; the local development server does not need to be running. Vercel project `kars-recon` belongs to `nelsonandelsons-projects` and connects to the existing Supabase project. The release uses source commit `faa3bf7` and deployment `dpl_2XTQu5f7tzynzTQQ1nXuhJNavLKo`. Production configuration contains only the Supabase URL and publishable key. No service-role key is used.

While the development server is running, visit http://127.0.0.1:3000.

To restart it in PowerShell:

```powershell
Set-Location 'C:\Users\Admin\Documents\Codex\2026-11-03\bu\outputs\kars-recon'
.\Start-KarsRecon.ps1
```

The launcher uses Node already installed on this computer, including the bundled Codex runtime when needed. It listens only on this computer. Keep the terminal open for local development. The production deployment runs independently of this computer.

## What to click for milestone 2

1. Open the board. Try **Blocked only**, technician/stage filters and the desktop board/list switch. On a phone it automatically groups a list by stage.
2. Select **Demo Owner** under **Working as**, then **Add vehicle**. Decode the sample VIN `1HGCM82633A004352` (2003 Honda Accord), use a unique test stock number, and choose **Add & check in**.
3. Mark each checklist item, set the key count, optionally attach a photo, and **Complete check-in**. The car moves to Diagnosis. Its **Check-in** tab preserves the inspection.
4. Use **Move stage** and **Flag blocker**, then inspect the **Timeline**. Standard stage/blocker selections take two taps; clearing a blocker takes one.
5. Try moving to Frontline before QC: it should be refused. Move to QC, use **Sign off QC** with a selected team member, then move to Frontline. The lead technician cannot sign their own work off; the selected owner can.
6. To inspect the completed browser test without creating anything, turn on **Include archived**, search `TEST-M2-1104`, and open its Check-in and Timeline tabs. It is archived as Sold to keep it off the active board.

The seeded names, vehicles and financial values are fake fixtures. The verification record has a synthetic photo. Profile names are database records, not hardcoded workflow identities. Setup review remains available at `/setup`.

## Development on another computer

Install Node.js 22 or newer and Git. From this directory:

```powershell
npm ci
Copy-Item .env.example .env.local
```

Fill in `.env.local` using the project's publishable key and URL from Supabase, then run:

```powershell
npm run dev
npm test
npm run typecheck
npm run build
```

Project: `jnrmevlbqshnjsyymtod`, name `kars-recon`, organization `nelsonbaguma`, US East (Ohio).
Dashboard: https://supabase.com/dashboard/project/jnrmevlbqshnjsyymtod
API URL: https://jnrmevlbqshnjsyymtod.supabase.co

`.env.local` is ignored by Git. The app uses a publishable key, never a service-role key. Dependencies are pinned in `package.json` and `package-lock.json`.

## Back up the source to a PRIVATE GitHub repository

Git was initialized before implementation. The source has local commits but has **not** been pushed to GitHub. Local Git alone will not protect against losing this computer.

If GitHub CLI is not installed, run this in PowerShell, then open a new PowerShell window:

```powershell
winget install --id GitHub.cli --exact
```

Then run these exact commands:

```powershell
Set-Location 'C:\Users\Admin\Documents\Codex\2026-11-03\bu\outputs\kars-recon'
gh auth login
gh repo create kars-recon --private --source . --remote origin --push
```

This creates the repository under the GitHub account you sign into. If a repository named `kars-recon` already exists, connect this checkout to the intended private repository instead of overwriting it. Future milestone backups:

```powershell
Set-Location 'C:\Users\Admin\Documents\Codex\2026-11-03\bu\outputs\kars-recon'
git push origin main
```

If Git reports "dubious ownership" for this exact checkout, trust only this path:

```powershell
git config --global --add safe.directory 'C:/Users/Admin/Documents/Codex/2026-11-03/bu/outputs/kars-recon'
```

Do not commit `.env.local`, passwords, or service-role keys. **Push after every milestone.**

## Database and access

- All eleven original tables and columns are retained; enums, constraints, indexes and internal triggers implement the foundation.
- RLS is enabled on every public table. The approved shared mode grants everyone reads, including costs and all tech rates. Roles describe responsibilities; there is no authenticated owner or tech permission boundary.
- Direct table writes are denied. Validated transactional workflows now allow shared vehicle creation, check-in, stage moves, blockers and QC. The public invoker RPC delegates to a narrowly scoped private definer function. Zod/server actions validate the UI boundary; database checks also protect direct RPC calls.
- Private `recon-photos` storage supports compressed JPEG uploads scoped to an existing vehicle, signed read URLs and cleanup of unlinked uploads. Up to four check-in photos are supported. Receipt upload arrives with parts.
- Stage changes record history; changes append audit events. A selected profile is explicitly **self-reported**, never authenticated. Unnamed changes use `who = null`. Check-in and QC require a selected active profile.
- QC sign-offs use the existing activity log, as approved. Frontline requires a current eligible sign-off. Returning to Repair or earlier, changing jobs, or making the signer ineligible invalidates it. The comparison uses completed job hours, including ties; owners may sign off.
- Stage age comes from stage history. Yellow begins at 80% of the stage target; red is over target. Purchase age uses calendar days in America/New_York. Refresh the board for changes from another device.
- Pay rates are append-only. Historical rates cannot be updated or deleted.
- Cents are integers. Hours are `numeric(6,2)`. Unit tests use integer arithmetic, including rounding per job and zero-pay comebacks.

Paid snapshots and comeback-pay overrides use the existing activity log, as explicitly approved. Structured part approvals and configurable checklist definitions remain open decisions. Cost totals, budget bars and approval blocking arrive in milestone 5; cards currently show the budget only. Parts lifecycle editing arrives in milestone 4.

## Jobs and weekly pay

Create and assign jobs from My jobs or a vehicle's Jobs tab. Start, complete, cancel or reopen unpaid work. Completion requires an explicit used/unused disposition for outstanding linked parts. Need part records a request and flags the vehicle; ordering and return workflows are the next milestone.

Weekly pay runs Monday through Sunday in America/New_York. Each completed job uses the rate effective on its completion date. Add effective rates from Weekly pay → Manage rates. Comebacks reference completed work on the same vehicle, default to zero pay, and count against the original technician. A selected owner may record a reasoned total-pay override.

After payment and after Sunday ends, a selected owner can review and lock the entire week. This records payment; it does not transfer money. A locked week stores its rows, rates and amounts in an immutable activity-log event. Later rate changes cannot recalculate it, paid jobs cannot be edited, and new completions cannot be backdated into that week. Export full week downloads CSV.

`TEST-M3-1104` contains synthetic verification jobs and is archived as Sold. The locked week of October 26, 2026 contains only its two test jobs ($50 repair plus $10 comeback override). These are test records, not actual wages or payments. Demo Alex's current rate remains the seeded $27/hour.

## Migrations, seed and generated types

Migration filenames match the versions applied to the hosted project: `20261104043850_initial_recon_schema.sql`, `20261104051727_vehicle_workflows.sql`, `20261104052816_checkin_identity.sql`, and `20261104060707_jobs_and_pay.sql`. No original table or column was added or removed. `src/types/database.ts` was generated from the live schema using Supabase.

For an isolated local Supabase stack (Docker required):

```powershell
npm run db:start
npm run db:reset
npm run db:types -- --local
```

`db:reset` is for the disposable **local** database and runs the fake seed. Never add `--linked` when experimenting with a reset. `supabase/seed.sql` is repeatable: it skips when the demo inventory is already present. The seed creates banned, passwordless fake Auth users solely to preserve the specified `profiles.id -> auth.users.id` relationship; no sign-in is used by the application.

To regenerate hosted types after a future approved schema change:

```powershell
npx supabase login
npm run db:types
```

The type-generation script fails without overwriting existing types if generation fails. To recheck the currently configured hosted project:

```powershell
node --env-file=.env.local scripts/check-live.mjs
```

## Verification completed

- Production verified November 4, 2026: public HTTPS board, jobs, pay, rates and CSV export return HTTP 200 without sign-in. A production browser save persisted after reload; its temporary blocker was cleared and the test vehicle archived. The existing real vehicle was not modified. Vercel reported no runtime errors following the smoke checks. The app is hosted independently of the development computer.

- 90 passing Vitest tests: money/pay arithmetic, date/VIN validation, PostgreSQL constraints, seed, RLS, transactional workflows, stale edits, QC eligibility/invalidation, photo ownership/retention, job completion, comeback attribution, immutable paid snapshots and CSV safety.
- Browser jobs/pay flow verified: create/start/cancel/reopen/complete, linked comeback, reasoned override, retroactive rate recalculation, week locking, unchanged locked amounts after another rate change, and CSV download. Mobile weekly pay was checked at 390px.
- TypeScript strict check and Next.js production build passed.
- Live browser → server action → Supabase: VIN decode, create, check-in with compressed photo, blocker set/clear, rejected Frontline without QC, QC sign-off, Frontline and Sold moves verified. Saved check-in persisted after reopening.
- Browser: empty-filter recovery, desktop list view and keyboard navigation between detail tabs verified.
- Phone (390px) and desktop (1440px) checked for page overflow. Main board buttons, inputs and selects meet 48px minimum height. Phone filters were widened after visual review.
- Supabase advisor reports leaked-password protection disabled. Password authentication is not used in this approved no-sign-in app; no authentication settings were changed.
- Physical phone-camera capture was not tested; browser file upload, compression, storage and photo display were tested. Typed/pasted VIN lookup is implemented; barcode scanning is not.
- Full local Docker/Supabase reset was not run: this process cannot access the Docker engine. PostgreSQL migration tests use PGlite with minimal Auth/Storage fixtures; hosted Supabase checks cover the live foundation.

## Next milestone

Milestone 4: parts ordering, receipts, returns and core tracking. Production deployment of the completed milestones was explicitly requested; remaining milestones are not represented as complete.

Official references used: [Next.js App Router](https://nextjs.org/docs/app/getting-started/installation), [Supabase database security](https://supabase.com/docs/guides/database/postgres/row-level-security), [NHTSA vPIC](https://vpic.nhtsa.dot.gov/api/), [shadcn/ui](https://ui.shadcn.com/docs/components/radix/button).
