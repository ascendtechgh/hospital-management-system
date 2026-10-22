# Accounts, billing and NHIS claims

## Persistence model

The billing ledger, tariff catalog, receipts, NHIS claim batches, reconciliation records and billing audit events are stored in browser `localStorage`. Keys are scoped by the active hospital ID, so separate hospitals using the same browser do not share the same local billing data.

This is intentionally a browser-local workflow. It is **not** shared across staff computers, browsers or mobile devices, and clearing browser data removes it. Patient registration and clinical records continue to use the repository's existing Supabase API.

## Initial setup

1. Open **Accounts → Tariffs & procedures**.
2. Add the hospital's approved prices. Enter the exact source code used by the clinical catalog:
   - Laboratory tests: e.g. `LAB-001`
   - Pharmacy medicines: e.g. `PH-004`
   - Consultation fee: `CONSULTATION`
   - Procedures: use a local code such as `PROC-001`
3. Enter the cash price and the approved NHIS tariff. Do not use estimated prices.
4. Complete a consultation, save a laboratory result, or dispense medicine. If a matching tariff exists, the charge is created automatically. If not, the fulfilled service appears under **Fulfilled services awaiting a price** until a tariff is added and applied.
5. Record completed procedures in **Tariffs & procedures → Record completed procedure** using a procedure tariff and a unique procedure reference.
6. Use **Cashier POS** to collect full or partial patient payments, record cash / Mobile Money / card details and print the receipt.
7. Use **NHIS claims** to select insurer-allocated NHIS charge lines, create a draft batch, export its line items as CSV, mark it submitted, and record full or partial remittances. Rejected lines become eligible for a corrected claim.
8. Close the cashier shift in **Daily reconciliation** and explain any variance across cash, Mobile Money or card totals.

## Local data keys

- `ascendhms.billing.v1:<hospital>`: charge lines, payments and unpriced fulfilled services.
- `ascendhms.billing-catalog.v1:<hospital>`: local service tariffs.
- `ascendhms.nhis-claims.v1:<hospital>`: claim batches and insurer settlements.
- `ascendhms.reconciliation.v1:<hospital>`: cashier shift closes.
- `ascendhms.audit.v1:<hospital>`: local billing audit entries.

The hospital suffix is URL-encoded. Keep this distinction in mind when troubleshooting local development.

## Clinical deployment

The branch also adds migrations for patient MRN/phone fields, ICD-10 diagnosis metadata, consultation completion state, and cashier/billing-claims roles. Apply the migrations and deploy the changed `patient-admin`, `clinical-admin`, and `staff-admin` Supabase Edge Functions before testing those clinical and staff workflows in the connected project.

## Important limitation

Because billing data stays in localStorage by design, it should be treated as a local prototype / single-browser ledger rather than a multi-user financial system of record. It does not provide server-side immutability, cross-device synchronization or centralized backup.
