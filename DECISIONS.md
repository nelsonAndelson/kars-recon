# Confirmed decisions

The original SPEC.md is preserved verbatim. These later instructions take precedence.

- No sign-in. This is a shared shop application. Everyone using it may see costs and all tech pay. Profile roles are descriptive; they do not authenticate or authorize a visitor.
- Keep the exact original tables and columns for now. No new cost tables, pay snapshot columns, QC columns, or approval columns.
- New Supabase project `kars-recon` in `nelsonbaguma`, US East (Ohio). Existing projects are untouched.
- Milestone 1 was completed and milestone 2 approved. Complete milestone 2, test, commit, and stop for review before milestone 3.
- Record QC sign-offs in the existing activity log, using a selected team member's self-reported name. No QC column is added.

## Access model

Shared access through Supabase's publishable key deliberately includes costs and pay, per the no-sign-in decision. Anyone with the app/API address can read it and use the implemented vehicle workflows; an unlisted URL is not a security boundary. All tables have RLS and direct table writes remain denied. Milestone 2 adds transactional commands for creation, check-in, moves, blockers and QC, plus scoped check-in photo policies. A profile picker must never be represented as authentication. Selecting another profile is possible; the QC rule is a workflow guard, not proof of identity.

## QC and check-in without schema changes

QC writes a JSON event into `activity_log.what`, with the selected profile in `who`, the vehicle and timestamp in their existing columns. A fingerprint of all jobs binds the sign-off to that work. Frontline checks the latest eligible sign-off against current jobs and any return to Repair or earlier. Eligibility excludes every technician tied for the largest positive completed-hour total, unless the selected profile is an owner. The timeline identifies attribution as self-reported.

Check-in uses a fixed four-item checklist (fluids, tires, warning lights, body/interior) in the existing JSON column. Checklist, VIN/year/make/model confirmation, keys and photo paths save in one transaction. Arriving vehicles move to Diagnosis; vehicles already later in the process retain their stage. Uploads are compressed JPEGs, at most four per inspection. Failed submissions attempt to remove unlinked uploads; linked inspection photos cannot be removed through the shared upload policy.

## Deferred schema gaps

The unchanged schema cannot directly store immutable pay amount/rate snapshots, an owner comeback-pay override, or a part approval state. These features require a decision at their milestones. Do not silently claim they are implemented or hide financial snapshots inside unrelated notes. QC is separately resolved by the approved activity-log approach above.

`stage_history`, `sublets`, and `activity_log` did not specify IDs. No surrogate IDs were added. Row targeting for editable sublets needs discussion before that feature ships. A single check-in row uses vehicle_id as its key. Settings is limited to one row by a constant-expression unique index.

Core charges and refund amounts are interpreted as line totals; qty multiplies only unit_cost_cents. Hours are numeric(6,2), cents are integers. Per-job pay rounds half-up to the nearest cent using integer arithmetic. Pay dates use the shop's America/New_York calendar. UI/pay workflows are deferred to milestone 3.

## Verification scope

Money tests run locally with Vitest. Database policy and constraint tests run against PostgreSQL (PGlite) with minimal auth/storage fixtures; live Supabase checks verify the migrated schema, seeded counts, RLS, and public read/write behavior. Local Docker is unavailable to this process, so a full `supabase start` reset is not claimed.
