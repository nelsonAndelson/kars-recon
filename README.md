# Kars Recon

Milestone 1 of 7: the database foundation and a working, no-sign-in setup review screen. This is not yet the operational recon board. The original brief is in `SPEC.md`; your subsequent choices are in `DECISIONS.md`.

## Open it on this computer

While the development server is running, visit http://127.0.0.1:3000.

To restart it in PowerShell:

```powershell
Set-Location 'C:\Users\Admin\Documents\Codex\2026-11-03\bu\outputs\kars-recon'
.\Start-KarsRecon.ps1
```

The launcher uses Node already installed on this computer, including the bundled Codex runtime when needed. It listens only on this computer. Keep the terminal open. Vercel deployment and installation on shop devices have not been performed.

## What to click for milestone 1

1. Open the setup screen. Confirm **Database connected**, **12 vehicles**, **3 technicians**, **14 parts**, and **2 comeback examples**.
2. In **Sample inventory**, search `Honda`. There should be two results. Search an unknown stock number, then click **Clear search**.
3. Open **Team & rates**, then **View rate history** under Demo Alex. The two sample rates should appear.
4. Open **Build roadmap** to see the seven milestones.
5. Narrow the browser to a phone width. Content should fit without horizontal scrolling.

All names, vehicles and financial values are fake fixtures. No existing Supabase project was modified. Profile names are database records, not hardcoded workflow identities.

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
- Direct client writes are denied in milestone 1. Later milestones add explicit validated write workflows using Zod and server actions.
- Private `recon-photos` and `recon-receipts` storage buckets exist. Upload/read policies and UI arrive with check-in and parts.
- Stage changes record history, and data changes append an audit event. Shared activity has `who = null`; the app does not pretend to know who acted.
- Pay rates are append-only. Historical rates cannot be updated or deleted.
- Cents are integers. Hours are `numeric(6,2)`. Unit tests use integer arithmetic, including rounding per job and zero-pay comebacks.

The unmodified schema does not yet solve immutable paid snapshots, comeback-pay overrides, explicit QC sign-offs, part approvals, or configurable checklist definitions. Those decisions remain open for their milestones. These features are **not** claimed as implemented.

## Migrations, seed and generated types

The migration filename matches the version applied to the new hosted project. `src/types/database.ts` was generated from that live schema using Supabase.

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

- 36 passing Vitest tests: money/pay arithmetic plus PostgreSQL constraints, seed, RLS and stage history.
- TypeScript strict check and Next.js production build passed.
- Live Supabase: seeded counts, shared reads, anonymous write denial verified; security advisors returned no findings.
- Browser: search, empty-state recovery, rate-history expansion and roadmap tabs verified.
- Phone (390px) and desktop (1440px) checked for horizontal overflow. Checked buttons, search input and disclosure controls meet 48px minimum height.
- Full local Docker/Supabase reset was not run: this process cannot access the Docker engine. PostgreSQL migration tests use PGlite with minimal Auth/Storage fixtures; hosted Supabase checks cover the live foundation.

## Next milestone

After your OK: add vehicles, VIN decode/check-in, kanban/mobile board, stage changes, blockers and age colors. No milestone 2 implementation has started.

Official references used: [Next.js App Router](https://nextjs.org/docs/app/getting-started/installation), [Supabase database security](https://supabase.com/docs/guides/database/postgres/row-level-security), [shadcn/ui](https://ui.shadcn.com/docs/components/radix/button).
