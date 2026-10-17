# Migrations

Applied by hand: paste each file into the Supabase SQL Editor and Run, **in this order**:

1. `20261017000100_schema.sql` - tables, constraints, indexes, RLS (authenticated SELECT only), Realtime publication.
2. `20261017000200_seed.sql` - synthetic Patients A/B/C (rooms 201/202/203) and device `guardian-001` -> Room 203.

Both are idempotent (`IF NOT EXISTS` / `ON CONFLICT DO NOTHING`) and can be re-run. Demo-only access: any signed-in user can read; all writes go through the API with the secret key. Not a multi-tenant or HIPAA design.
`alert_acknowledgements` from the old note is not created: acknowledgement lives on `alerts` (`acknowledged_at`, `acknowledged_by`).
