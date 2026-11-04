# Confirmed decisions

The original SPEC.md is preserved verbatim. These later instructions take precedence.

- No sign-in. This is a shared shop application. Everyone using it may see costs and all tech pay. Profile roles are descriptive; they do not authenticate or authorize a visitor.
- Keep the exact original tables and columns for now. No new cost tables, pay snapshot columns, QC columns, or approval columns.
- New Supabase project `kars-recon` in `nelsonbaguma`, US East (Ohio). Existing projects are untouched.
- Complete milestone 1, test, commit, and stop for review before milestone 2.

## Access model

Milestone 1 grants shared read access through Supabase's publishable key. This deliberately includes costs and pay, per the no-sign-in decision. Anyone with the app/API address can read it; an unlisted URL is not a security boundary. All tables have RLS. Client writes are denied in this milestone. Later milestones must add explicit write policies or transactional functions as each workflow is implemented. A profile picker must never be represented as authentication.

## Deferred schema gaps

The unchanged schema cannot directly store immutable pay amount/rate snapshots, an owner comeback-pay override, structured QC sign-offs, or a part approval state. These features require a decision at their milestones. Do not silently claim they are implemented or hide financial snapshots inside unrelated notes.

`stage_history`, `sublets`, and `activity_log` did not specify IDs. No surrogate IDs were added. Row targeting for editable sublets needs discussion before that feature ships. A single check-in row uses vehicle_id as its key. Settings is limited to one row by a constant-expression unique index.

Core charges and refund amounts are interpreted as line totals; qty multiplies only unit_cost_cents. Hours are numeric(6,2), cents are integers. Per-job pay rounds half-up to the nearest cent using integer arithmetic. Pay dates use the shop's America/New_York calendar. UI/pay workflows are deferred to milestone 3.

## Verification scope

Money tests run locally with Vitest. Database policy and constraint tests run against PostgreSQL (PGlite) with minimal auth/storage fixtures; live Supabase checks verify the migrated schema, seeded counts, RLS, and public read/write behavior. Local Docker is unavailable to this process, so a full `supabase start` reset is not claimed.
