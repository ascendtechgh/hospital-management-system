# Supabase setup

The app uses the Supabase JavaScript client for email/password authentication,
hospital provisioning, and Postgres Changes subscriptions.

1. Create a Supabase project.
2. Copy `.env.example` to `.env.local` and set `VITE_SUPABASE_URL` and
   `VITE_SUPABASE_ANON_KEY` from the project's API settings.
3. Turn off email confirmation in Supabase Auth while using the requested
   immediate two-step signup flow.
4. Run `supabase login`, then `supabase link --project-ref <project-ref>` and
   `supabase db push` to apply the migrations in `supabase/migrations`.
5. Add the local app URL (for example, `http://localhost:5173`) and the
   deployed URL later to Supabase Auth's site URL and redirect URL settings.

The first migration creates hospital and profile tables, creates an
administrator profile when an Auth user signs up, and provides an atomic
function that assigns a readable `HMS-HOSPITAL-NAME-XXXXXXXXXX` hospital ID. The
second migration enables Postgres Changes for those tables. The third adds
workspace-scoped notifications and enables their realtime changes. The fourth
adds a profile email field for the staff directory. The fifth updates the Auth
user trigger to populate that required email field for every newly created
profile. The sixth creates tenant-scoped patient and insurance tables,
patient-only RLS, and a private hospital broadcast channel that signals patient
changes without exposing patient fields in the realtime event. The seventh
migration adds tenant-scoped patient-vitals records, measurement validation,
and private realtime broadcasts when observations are recorded.
The eighth migration seeds the diagnosis, lab, and pharmacy catalogs; creates
hospital-scoped inventory and consultation/lab/prescription records; and adds
transactional functions for saving consultations, lab results, inventory
receipts, and dispensing. The provided initial stock levels are explicitly
demo values; verify and replace them with counted stock before operational use.

Deploy the staff account-management Edge Function after applying migrations:

```powershell
supabase functions deploy staff-admin
supabase functions deploy patient-admin
supabase functions deploy clinical-admin
```

The staff function verifies the signed-in user and hospital-admin role, then
uses the server-side Supabase service-role key to create auto-confirmed
accounts and perform hospital-scoped staff CRUD. The patient function permits
hospital staff to read checked-in patients, and restricts patient registration,
changes, deletion, and check-in to reception. Both functions use the server-side
Supabase service-role key. Supabase provides that key to
deployed Edge Functions. For local function development, create
`supabase/.env.local` with `SUPABASE_URL`, `SUPABASE_ANON_KEY`, and
`SUPABASE_SERVICE_ROLE_KEY`, then run:

```powershell
supabase functions serve staff-admin --env-file supabase/.env.local
supabase functions serve patient-admin --env-file supabase/.env.local
supabase functions serve clinical-admin --env-file supabase/.env.local
```

Keep this file out of version control and never expose the service-role key
through a `VITE_` variable or browser code.
The patient function imports Supabase with Deno's explicit
`npm:@supabase/supabase-js@2` specifier so it can also be deployed from the
Supabase Dashboard function editor without relying on a local import map. The
frontend invokes the functions from the relevant role-specific pages. Apply the
latest migration with `supabase db push` before deploying the updated
`patient-admin` and `clinical-admin` functions to enable the nursing and clinical
workflows. `clinical-admin` checks the signed-in hospital role for every
consultation, lab, stock, and dispensing action; stock changes and dispensing
are performed by tenant-checked database functions in transactions. Lab
requests do not consume lab inventory. Dispensing subtracts stock and records
the dispensation atomically. Consultations can be saved incrementally; lab
requests and prescriptions are separate actions, and a saved consultation can
be reopened from the patient's Consultations tab to add either later. This
staged workflow requires only redeploying `clinical-admin`; it does not require
an additional schema migration.

Use `useRealtimeSubscription` for table updates so future data views can share
the same subscription pattern.

**Development only:** RLS is enabled for the patient and insurance tables, and
direct browser access to those tables is revoked. Patient API access is
tenant-scoped by the Edge Function; private realtime broadcasts expose only a
patient ID and are restricted to hospital members. RLS is still intentionally
not enabled on the earlier hospital, profile, and notification tables. Do not
use real patient, staff, hospital, or notification data or deploy this project
to production until all policies and role restrictions have been reviewed and
tested. Never put a Supabase service-role key in this frontend.
