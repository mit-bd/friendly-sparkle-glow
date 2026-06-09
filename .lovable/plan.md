## Goal

Evolve the existing Fixed Cost module from a simple approve/reject flow into a real-world settlement workflow with unlimited partial payments — reusing the existing expense rows, audit system, report engine, notifications, and finance architecture. No module is rebuilt.

## Architecture decision

Generated fixed costs stay as rows in the shared `expenses` table (`is_fixed_cost = true`), so all existing screens, history, and audit keep working. Settlement is added as a parallel dimension instead of polluting the global expense-status enum:

- New columns on `expenses` (only meaningful for fixed-cost rows):
  - `fc_settlement_status text` → `generated` | `partially_paid` | `paid` | `rejected`
  - `fc_paid_amount numeric not null default 0`
- New table `fixed_cost_payments` mirroring the proven `payable_payments` shape (amount, payment_date, notes, reference_number, attachment file fields, created_by). Unlimited rows per fixed cost.

This keeps the existing `status` enum untouched for other modules.

```text
Generated ──record payment──▶ Partially Paid ──final payment──▶ Paid
    │                                                            
    └────────────── Reject ──────────────▶ Rejected            
```

## Settlement rules (DB triggers)

A trigger on `fixed_cost_payments` recomputes the parent expense after every insert/delete:
- `fc_paid_amount` = sum of payments
- remaining = `amount − fc_paid_amount`
- remaining = amount (0 paid) → `generated`
- 0 < paid < amount → `partially_paid`
- remaining ≤ 0 → `paid`, and set `expenses.status = 'approved'` + `approved_at` so a fully-settled fixed cost counts as real approved company spend platform-wide
- Reject action → `fc_settlement_status = 'rejected'`, `expenses.status = 'rejected'`

Requirement #1 is already honored (generation never auto-approves); generation now also stamps `fc_settlement_status = 'generated'`.

## Database (migration)

1. Add the two columns to `expenses`; backfill existing fixed-cost rows (`generated`, or `paid` where already approved).
2. Create `fixed_cost_payments` with GRANTs (authenticated + service_role), RLS scoped like payables (creator / `fixed_costs` view/edit permission / admin), and `ALTER … ENABLE RLS`.
3. Update `generate_fixed_costs()` to set `fc_settlement_status='generated'`.
4. Trigger `tg_fixed_cost_payment` → recompute totals + settlement status, write `activity_logs` (`payment_added`, plus `partial approval` / `full approval` when crossing thresholds), and notify the creator (reusing the in-app notification settings pattern).
5. A `record_fixed_cost_payment` flow done via direct insert (triggers handle the rest), matching how `payable_payments` works.

## Data layer (`src/lib/fixed-costs.ts`)

- Extend `FixedCostRecord` with `fc_settlement_status`, `fc_paid_amount`.
- Add `fetchFixedCostPayments(expenseId)`, `addFixedCostPayment(...)`, `fetchOutstandingFixedCosts(range)`, `fetchFixedCostPaymentHistory(range)`.
- Add aggregation helpers: total / paid / remaining, settlement split, and **analytics that count only `partially_paid` + `paid`** (requirement #10) — never `generated` / `pending` / `rejected`.

## UI

- **Overview (`fixed-costs.index.tsx`)**: settlement metric cards (Outstanding, Paid this period, Partially paid count), settlement-status filter + badges, replace approve-only chart with Paid vs Outstanding. Row click → details.
- **New details route `fixed-costs.$id.tsx`**: header with Total / Paid / Remaining, settlement status badge, **Record Payment** dialog (Payment Amount, Payment Date, Reference Number, Notes, Attachment via existing `AttachmentUploader`), **payment timeline** (reusing the events/timeline pattern), and admin Reject action.
- **Settlement status badge** component aligned with brand + light/dark tokens.

## Reports (`fixed-costs.reports.tsx`)

Add to the existing report selector (preserving current three):
- **Fixed Cost Outstanding Report** — per record: total, paid, remaining, status (only unpaid/partially paid).
- **Fixed Cost Payment History Report** — every payment with date, reference, amount, recorded-by.
Both use the existing `ReportDocument`, report numbering, print/PDF, CSV export (`downloadCsv`), and `logReportExport`.

## Finance Control (Payables) integration

On the Payables dashboard, add a read-only "Outstanding Fixed Costs" panel sourced from `fetchOutstandingFixedCosts` (total outstanding + count), linking into the Fixed Cost module. No changes to payables data or logic.

## Audit / notifications / branding

- Audit: `payment_added`, partial approval, full approval via triggers + `logActivity`; `payment_added`/`payment_removed` already exist in the audit label maps.
- Notifications: reuse in-app notification settings; notify creator on payment + full settlement.
- Branding, permissions (`fixed_costs` module), and all existing reports/analytics are preserved.

## Technical notes

- `expenses` enum is NOT modified. Company-wide approved analytics keep working; fully-paid fixed costs flow in as `approved`.
- Existing `fetchApprovedFixedCosts` and current reports remain intact for backward compatibility.
- Generated types lag new columns — continue using the existing loose `db` cast in `fixed-costs.ts`.

## Verification

- Build passes; generate a month → rows appear as `generated` in Pending Approval.
- Record partial payment → `partially_paid`, remaining recalculated, audit + timeline entry.
- Final payment → `paid`, expense becomes approved, counts in analytics.
- Outstanding + Payment History reports render, print, and export CSV.
- Payables dashboard shows outstanding fixed costs.
