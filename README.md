# Kars Recon

Live app: https://kars-recon.vercel.app

## Daily use

- **Technician view** (/tech): choose your name, then My work, Shop cars, Parts or Done. Cars show repair tasks, stage, blockers and parts needed/on order/available together. Start is one tap. Normal completion is two taps; parts exceptions require explicit choices. Common blockers use large single-choice buttons. Refresh picks up changes from other devices.
- **Admin view** (/admin): review work by date/technician, switch to all open work, assign jobs, and edit book hours. Started/completed timestamps are not a time clock.
- **Team** (/team): add/edit names and roles; uncheck Active team member to remove someone from the active team. Their history is retained. Open jobs must be reassigned before removal or changing a technician's role. At least one active admin must remain.
- **Parts** (/parts): request parts, record orders already placed, mark received. These actions do not make purchases. Full receipt/return/core workflows are still forthcoming.
- **Weekly pay** (/pay): set real effective rates, review completed book hours, export CSV, and lock paid weeks after Sunday ends. Locked amounts never recalculate. Locking records payment; it does not send money.
- Everyone can switch views without changing their role. The last view and selected name are remembered on the device.

## Production cleanup — November 5, 2026

Nelson and Nelly are admins. Alex and Kayenga (Pops) are technicians. These names and roles are editable.

The 12 demo vehicles and two verification vehicles, their dependent records, demo rates and test pay weeks were removed. The actual F-150 (D27772) and Honda Pilot (000006), check-ins and repair descriptions were preserved. The owner confirmed no real work had been recorded, so the F-150's test completion was reset to pending with zero book hours for admin review. Real pay rates have not been invented or set.

The cleanup was a guarded one-off transaction after a local snapshot, not a reusable destructive migration. All immutable-history triggers were re-enabled and checked. The final synthetic check-in photo was permanently removed through the Storage dashboard after explicit confirmation. Storage verification found only an empty-folder placeholder; no photos remain.

## Access and data

This is the explicitly approved shared, no-sign-in app. Selected names are self-reported. Views and roles organize workflows, not authenticated access. Everyone using the app can view costs and pay. The application uses only the Supabase publishable key; no service-role key is embedded.

The original eleven tables and columns are retained. Validated commands handle writes; direct anonymous table writes are denied. QC sign-offs, comeback overrides and frozen pay snapshots use activity_log as approved. Team members retain the original auth.users foreign key through banned, passwordless records; the app does not create usable logins.

Supabase project: jnrmevlbqshnjsyymtod, organization nelsonbaguma, Ohio.
Vercel project: kars-recon (prj_fEWoRYRnuP6IaTOSPUNgCfD0pBkz), team nelsonandelsons-projects.
The exact original brief is in SPEC.md; subsequent choices are in DECISIONS.md.

## Development

Install Node.js 22+ and Git. From this directory:

```powershell
npm ci
Copy-Item .env.example .env.local
```

Set the Supabase URL and publishable key, then:

```powershell
npm run dev
npm test
npm run typecheck
npm run build
node --env-file=.env.local scripts/check-live.mjs
```

On this computer, Start-KarsRecon.ps1 also starts the local server. Production does not depend on this computer staying on. Dependencies are pinned. Never commit .env.local.

Local Supabase needs Docker. Use npm run db:start and npm run db:reset only for a disposable local database. Demo seed refuses databases containing real shop stock. Never seed production or reset with --linked. Generated types match the hosted schema; migrations retain the hosted version numbers.

## Source backup

Local Git commits are not a remote backup. Push to a PRIVATE GitHub repository:

```powershell
winget install --id GitHub.cli --exact
# Open a new PowerShell window after installation:
Set-Location 'C:\Users\Admin\Documents\Codex\2026-11-03\bu\outputs\kars-recon'
gh auth login
gh repo create kars-recon --private --source . --remote origin --push
# Later updates:
git push origin main
```

If that repository exists, connect this checkout to the intended repository instead of overwriting it. Never commit passwords or service-role keys.

## Verification and remaining scope

Production deployment dpl_JCmRPAtAWZJr6TvXXhnPjtBnLCeG is READY, serving source commit 55cb54e95dd18ef44d2e94157d4394350e42bd81. Live admin, technician, team, parts, board and pay routes were checked. Phone layout, view switching, team editing and the unassigned-job guard were verified. Type checking and the production build passed.

98 tests cover money arithmetic, migration constraints, shared access, stale edits, jobs, QC, immutable pay, team changes, last-admin protection, open-job reassignment guards, and parts request/order/receipt transitions. PostgreSQL tests use PGlite with minimal Auth/Storage fixtures; a full Docker reset is not claimed.

Costs/budget approval, full returns/cores/receipts, comprehensive reports and installable/offline PWA support remain later milestones. Stage is process stage; physical bay/location and parts shelf locations are not fields in the unchanged schema.
