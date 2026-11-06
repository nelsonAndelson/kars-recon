# Kars Recon

Live app: https://kars-recon.vercel.app

## Daily use

- **Technician view** (/tech): choose your name, then My work, Shop cars, Parts or Done. Cars show repair tasks, stage, blockers and parts needed/on order/available together. Start is one tap. Normal completion is two taps; parts exceptions require explicit choices. Common blockers use large single-choice buttons. Refresh picks up changes from other devices.
- **Admin view** (/admin): review work by date/technician, switch to all open work, assign jobs, and edit book hours. Started/completed timestamps are not a time clock.
- **Team** (/team): add/edit names and roles; uncheck Active team member to remove someone from the active team. Their history is retained. Open jobs must be reassigned before removal or changing a technician's role. At least one active admin must remain.
- **Parts** (/parts): request parts, record orders already placed, mark received. These actions do not make purchases. Full receipt/return/core workflows are still forthcoming.
- **Weekly pay** (/pay): set real effective rates, review completed book hours, export CSV, and lock paid weeks after Sunday ends. Locked amounts never recalculate. Locking records payment; it does not send money.
- Everyone can switch views without changing their role. The last view and selected name are remembered on the device.

## DealerCenter inventory import — November 6, 2026

Open /inventory from the admin navigation. Select an active admin, use Sync now, then Review new car. The suggested stock number is the final six VIN characters; enter the actual purchase date and select a recon stage. Frontline still requires QC sign-off after import. New cars and changes are never applied by a fetch alone.

The importer retrieves the newest DealerCenter_YYYYMMDD_28126551.csv file. The account-relative FTP folder is /. feed.karsautollc.com and server122.web-hosting.com resolve to the same server; the FTP certificate covers the latter, so production uses server122.web-hosting.com on port 21 with Explicit FTPS and full certificate validation. No plaintext fallback or certificate bypass is enabled. Existing export files are read only.

The source provides no stock number, purchase date or sold status. Full VIN matches drive review. Duplicate VINs are conflicts; blank source values cannot erase details. Advertised mileage and inventory photos are references, separate from check-in evidence. Jobs, parts, pay, stages and blockers are preserved. Missing listings are flagged, never deleted or automatically sold. An unchanged dismissed entry stays dismissed. Photos are linked from DealerCenter, not copied into check-in storage.

The original eleven recon tables and columns remain unchanged. Two RLS-protected public tables hold import runs and items. A private deny-by-default table stores only a hash of a dedicated server worker token. Direct anonymous writes are denied. The shared no-sign-in identity model still applies to admin review. Server secrets are provisioned only in production; .env.example lists names without values.

Daily fetching is configured through vercel.json at 11:00 UTC (6 a.m. EST / 7 a.m. EDT). The scheduled endpoint validates CRON_SECRET. The worker token only authorizes import queue commands; it is not a Supabase service-role key. Concurrent syncs are blocked, abandoned runs expire after five minutes, manual retries have a one-minute cooldown, and failed downloads preserve the prior review list. Empty, malformed, unstable and oversized files are rejected. Stale feeds and large inventory drops suppress missing-listing conclusions.

Production deployment dpl_ZSEX1KfMFrjtd2jXsng8nVgV5jcD is READY at https://kars-recon.vercel.app, serving source commit 6e2f04a070cea5ad98980dddc3f45dce1996a46a. Manual sync and a manually invoked authenticated scheduled endpoint each successfully fetched seven rows from DealerCenter_20261105_28126551.csv. All seven remain pending; zero vehicles were approved. The two existing recon vehicles, their jobs, parts and pay records were checked unchanged. The first timer-driven run is due November 7, 2026, at approximately 6 a.m. Eastern and was not yet observed at release time.

126 tests pass. Type checking and both Vercel production builds passed. Windows local builds compiled and type-checked but hit an EPERM error writing generated _not-found files; the successful cloud builds provide production build verification. Live checks covered the review form, phone layout without horizontal overflow, technician-disabled controls, unauthorized cron rejection (401), technician sync rejection, and no recorded runtime errors. Approval mutations were tested in the disposable PGlite database; production cars remain for the owner to review.

## Production cleanup — November 5, 2026

Nelson and Nelly are admins. Alex and Kayenga (Pops) are technicians. These names and roles are editable.

The 12 demo vehicles and two verification vehicles, their dependent records, demo rates and test pay weeks were removed. The actual F-150 (D27772) and Honda Pilot (000006), check-ins and repair descriptions were preserved. The owner confirmed no real work had been recorded, so the F-150's test completion was reset to pending with zero book hours for admin review. Real pay rates have not been invented or set.

The cleanup was a guarded one-off transaction after a local snapshot, not a reusable destructive migration. All immutable-history triggers were re-enabled and checked. The final synthetic check-in photo was permanently removed through the Storage dashboard after explicit confirmation. Storage verification found only an empty-folder placeholder; no photos remain.

## Access and data

This is the explicitly approved shared, no-sign-in app. Selected names are self-reported. Views and roles organize workflows, not authenticated access. Everyone using the app can view costs and pay. The application uses only the Supabase publishable key; no service-role key is embedded.

The original eleven tables and columns are retained; the inventory integration adds separate supporting tables described above. Validated commands handle writes; direct anonymous table writes are denied. QC sign-offs, comeback overrides and frozen pay snapshots use activity_log as approved. Team members retain the original auth.users foreign key through banned, passwordless records; the app does not create usable logins.

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
