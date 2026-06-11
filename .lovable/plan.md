# System Owner Management Module — Implementation Plan

Adds a top-level **Owner** governance layer above the existing `admin → manager → accountant → viewer` hierarchy, without touching any existing module logic, reports, analytics, finance, fixed-cost automation, or branding. Scope confirmed: **governance layer only** (existing data registered as the primary company; multi-company structures prepared, not enforced), **request-form-only** registration, first Owner = Shamim Ahmed, existing users grandfathered in.

## 1. Database (single migration)

**Enums**
- `app_role`: add value `owner`.
- `user_status`: add `pending`, `suspended`, `locked` (keep `active`/`inactive`).
- New `company_status`: `active`, `suspended`, `deleted`.
- New `subscription_plan`: `free`, `starter`, `pro`, `enterprise` (future-ready, unused now).

**New tables** (each with GRANTs + RLS, Owner-only via new `is_owner()` function)
- `companies` — registry: name, legal_name, email, phone, address, status, plan, is_primary, admin_user_id, suspended_at/by, deleted_at/by, notes. Existing `company_profile` data seeded as the primary company.
- `registration_requests` — company_name, contact_name, email, phone, address, message, status (`pending`/`approved`/`rejected`/`info_requested`), info_request_note, reviewed_by/at, created_company_id, created_user_id. **anon INSERT allowed** (public request form); Owner reads/updates.
- `login_history` — user_id, email, ip_address, user_agent, event_type, success.
- `security_events` — user_id, email, type, severity, ip_address, details jsonb.
- Add nullable `company_id` to `profiles` (multi-company readiness; no enforcement).

**Functions / policies**
- `is_owner(uuid)` security-definer.
- Extend SELECT policies on `profiles`, `user_roles`, `activity_logs`, `login_history`, `security_events`, `companies` so Owner can read across the platform.
- Reuse existing `activity_logs` (immutable) for the **Owner Audit Center** and existing `notifications` for Owner alerts (new notification types only — no schema change needed).
- Triggers: on `registration_requests` insert → notify Owner + log activity; on company suspend → notify Owner.

## 2. Edge functions (service-role, Owner-gated)
- `owner-bootstrap` — one-time: creates the Owner auth account (Shamim) + assigns `owner` role if no owner exists. Invoked once with credentials at call time (never hardcoded in repo).
- `owner-approve-registration` — Owner approves a request → creates company + company-admin auth user + `admin` role + links request; rejects / requests-info paths update status and notify.
- `owner-user-admin` — Owner password actions (send reset link, generate temporary password, require-change-on-next-login) and suspend/lock/unlock; all write to `activity_logs`.

## 3. Frontend
- **Auth/role context**: add `owner` to `AppRole`, `isOwner`, Owner bypasses all permission checks; expand `Profile.status` union.
- **AuthGate**: block `pending`/`suspended`/`locked` users with a dedicated "account unavailable" screen (existing `active` users unaffected).
- **Sign-in page**: replace the self-signup tab with a **"Request access"** form (writes to `registration_requests`); disable open auth signups via auth config.
- **Owner section** (visible only to Owner, separate nav group):
  - `/owner` — Owner Dashboard: companies (total/active/suspended), users (total/active/suspended), pending requests, recent registrations, recent logins, system health, charts.
  - `/owner/registrations` — review/approve/reject/request-info.
  - `/owner/companies` + `/owner/companies/:id` — list/search/edit/suspend/reactivate/soft-delete; detail shows profile, users, activity, audit.
  - `/owner/users` — cross-platform user list: search/filter, edit, suspend/reactivate, lock/unlock, role promote/demote, password actions.
  - `/owner/audit` — Owner Audit Center (filtered activity logs).
  - `/owner/security` — login history, failed-login/security events, session info.
- New `src/lib/owner.ts` data layer; reuse existing card/chart/table components and brand-gradient design tokens.

## 4. Validation
Manual test scenarios after build: submit registration → Owner approval creates company + admin → user suspend/lock → password reset/temp password → company suspend/reactivate; verify Owner-only permissions and that every action appears in audit logs. Confirm all existing modules still load and behave unchanged.

## Technical notes
- No `company_id` is added to business tables and no existing RLS policy is rewritten in a breaking way — only additive Owner read access, so current behavior is preserved.
- Lock/temp-password/force-reset require the service role, hence the edge functions; the service-role key never reaches the client.
- Billing is intentionally **not** built; only `subscription_plan`/`plan` columns are added for future SaaS use.
