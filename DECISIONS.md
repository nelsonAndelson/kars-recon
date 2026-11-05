# Confirmed decisions

The original SPEC.md is preserved verbatim. These later instructions take precedence.

- No sign-in. This is a shared shop application. Everyone using it may see costs and all tech pay. Profile roles are descriptive; they do not authenticate or authorize a visitor.
- Keep the exact original tables and columns for now. No new cost tables, pay snapshot columns, QC columns, or approval columns.
- New Supabase project `kars-recon` in `nelsonbaguma`, US East (Ohio). Existing projects are untouched.
- Milestones 1 and 2 were completed. Milestone 3 was approved, followed by an explicit request to deploy the completed app to production.
- Store locked pay snapshots and comeback overrides as structured immutable events in the existing activity log. No table or column additions.
- Record QC sign-offs in the existing activity log, using a selected team member's self-reported name. No QC column is added.

## Access model

Shared access through Supabase's publishable key deliberately includes costs and pay, per the no-sign-in decision. Anyone with the app/API address can read it and use the implemented vehicle workflows; an unlisted URL is not a security boundary. All tables have RLS and direct table writes remain denied. Milestone 2 adds transactional commands for creation, check-in, moves, blockers and QC, plus scoped check-in photo policies. A profile picker must never be represented as authentication. Selecting another profile is possible; the QC rule is a workflow guard, not proof of identity.

## QC and check-in without schema changes

QC writes a JSON event into `activity_log.what`, with the selected profile in `who`, the vehicle and timestamp in their existing columns. A fingerprint of all jobs binds the sign-off to that work. Frontline checks the latest eligible sign-off against current jobs and any return to Repair or earlier. Eligibility excludes every technician tied for the largest positive completed-hour total, unless the selected profile is an owner. The timeline identifies attribution as self-reported.

Check-in uses a fixed four-item checklist (fluids, tires, warning lights, body/interior) in the existing JSON column. Checklist, VIN/year/make/model confirmation, keys and photo paths save in one transaction. Arriving vehicles move to Diagnosis; vehicles already later in the process retain their stage. Uploads are compressed JPEGs, at most four per inspection. Failed submissions attempt to remove unlinked uploads; linked inspection photos cannot be removed through the shared upload policy.

## Deferred schema gaps

Pay snapshots and comeback overrides are resolved by the explicitly approved activity-log approach. The log is append-only; locked snapshots retain the complete pay rows and effective rates. Selected-owner attribution remains self-reported. Week locks apply only to completed weeks, require a fresh preview, block paid-job changes and backdated new completions, and do not send money. Part approval state still requires a decision at its milestone.

`stage_history`, `sublets`, and `activity_log` did not specify IDs. No surrogate IDs were added. Row targeting for editable sublets needs discussion before that feature ships. A single check-in row uses vehicle_id as its key. Settings is limited to one row by a constant-expression unique index.

Core charges and refund amounts are interpreted as line totals; qty multiplies only unit_cost_cents. Hours are numeric(6,2), cents are integers. Per-job pay rounds half-up to the nearest cent using integer arithmetic. Pay dates use the shop's America/New_York calendar. Milestone 3 implements jobs and weekly pay, including zero-pay comebacks, reasoned overrides and CSV exports.

## Verification scope

Money tests run locally with Vitest. Database policy and constraint tests run against PostgreSQL (PGlite) with minimal auth/storage fixtures; live Supabase checks verify the migrated schema, seeded counts, RLS, and public read/write behavior. Local Docker is unavailable to this process, so a full `supabase start` reset is not claimed.

## November 5 production workflow revision

The user requested separate technician/admin views, editable team members and demo cleanup. Nelson and Nelly are admins; Alex and Kayenga (Pops) are technicians. Everyone may switch views. No sign-in remains in effect. Removing a team member deactivates them while preserving history, with guards against orphaned open work and removing the last admin. The user confirmed no real work was recorded. Preserve actual vehicle entries and repair descriptions, reset the test completion, remove demo inventory/rates/pay. Parts request/order/receipt commands support the new shop-floor view; full returns and cores are still deferred.
