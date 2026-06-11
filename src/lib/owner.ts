import { supabase } from "@/integrations/supabase/client";

/** Cast helper so the new governance tables compile regardless of generated-type timing. */
const db = supabase as unknown as {
  from: (t: string) => any;
  functions: typeof supabase.functions;
};

/* ------------------------------- Types ------------------------------- */

export type CompanyStatus = "active" | "suspended" | "deleted";
export type SubscriptionPlan = "free" | "starter" | "pro" | "enterprise";
export type RegistrationStatus = "pending" | "approved" | "rejected" | "info_requested";
export type AccountStatus = "active" | "inactive" | "pending" | "suspended" | "locked";

export interface Company {
  id: string;
  name: string;
  legal_name: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  status: CompanyStatus;
  plan: SubscriptionPlan;
  is_primary: boolean;
  admin_user_id: string | null;
  notes: string | null;
  suspended_at: string | null;
  deleted_at: string | null;
  created_at: string;
}

export interface RegistrationRequest {
  id: string;
  company_name: string;
  contact_name: string;
  email: string;
  phone: string | null;
  address: string | null;
  message: string | null;
  status: RegistrationStatus;
  info_request_note: string | null;
  reviewed_at: string | null;
  created_company_id: string | null;
  created_user_id: string | null;
  created_at: string;
}

export interface OwnerUserRow {
  id: string;
  full_name: string;
  email: string;
  phone: string | null;
  status: AccountStatus;
  role: string | null;
  company_id: string | null;
  require_password_change: boolean;
  created_at: string;
}

export interface LoginHistoryRow {
  id: string;
  user_id: string | null;
  email: string | null;
  ip_address: string | null;
  user_agent: string | null;
  event_type: string;
  success: boolean;
  created_at: string;
}

export interface SecurityEventRow {
  id: string;
  user_id: string | null;
  email: string | null;
  type: string;
  severity: string;
  ip_address: string | null;
  details: Record<string, unknown> | null;
  created_at: string;
}

export interface OwnerStats {
  companiesTotal: number;
  companiesActive: number;
  companiesSuspended: number;
  usersTotal: number;
  usersActive: number;
  usersSuspended: number;
  pendingRequests: number;
}

export const COMPANY_STATUS_LABELS: Record<CompanyStatus, string> = {
  active: "Active",
  suspended: "Suspended",
  deleted: "Deleted",
};

export const PLAN_LABELS: Record<SubscriptionPlan, string> = {
  free: "Free",
  starter: "Starter",
  pro: "Pro",
  enterprise: "Enterprise",
};

export const REGISTRATION_STATUS_LABELS: Record<RegistrationStatus, string> = {
  pending: "Pending",
  approved: "Approved",
  rejected: "Rejected",
  info_requested: "Info Requested",
};

export const ACCOUNT_STATUS_LABELS: Record<AccountStatus, string> = {
  active: "Active",
  inactive: "Inactive",
  pending: "Pending Approval",
  suspended: "Suspended",
  locked: "Locked",
};

/* ------------------------------ Stats ------------------------------ */

export async function fetchOwnerStats(): Promise<OwnerStats> {
  const [companies, profiles, requests] = await Promise.all([
    db.from("companies").select("status"),
    db.from("profiles").select("status"),
    db.from("registration_requests").select("status").eq("status", "pending"),
  ]);
  const comp = (companies.data ?? []) as { status: CompanyStatus }[];
  const prof = (profiles.data ?? []) as { status: AccountStatus }[];
  return {
    companiesTotal: comp.filter((c) => c.status !== "deleted").length,
    companiesActive: comp.filter((c) => c.status === "active").length,
    companiesSuspended: comp.filter((c) => c.status === "suspended").length,
    usersTotal: prof.length,
    usersActive: prof.filter((p) => p.status === "active").length,
    usersSuspended: prof.filter((p) => p.status === "suspended" || p.status === "locked").length,
    pendingRequests: (requests.data ?? []).length,
  };
}

/* ---------------------------- Companies ---------------------------- */

export async function fetchCompanies(search?: string): Promise<Company[]> {
  let q = db.from("companies").select("*").order("is_primary", { ascending: false }).order("created_at", { ascending: false });
  if (search?.trim()) q = q.ilike("name", `%${search.trim()}%`);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as Company[];
}

export async function fetchCompany(id: string): Promise<Company | null> {
  const { data, error } = await db.from("companies").select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  return (data as Company) ?? null;
}

export async function updateCompany(id: string, patch: Partial<Company>): Promise<void> {
  const { error } = await db.from("companies").update(patch).eq("id", id);
  if (error) throw error;
}

export async function setCompanyStatus(
  id: string,
  status: CompanyStatus,
  actorId: string,
): Promise<void> {
  const now = new Date().toISOString();
  const patch: Record<string, unknown> = { status };
  if (status === "suspended") {
    patch.suspended_at = now;
    patch.suspended_by = actorId;
  } else if (status === "active") {
    patch.suspended_at = null;
    patch.suspended_by = null;
    patch.deleted_at = null;
    patch.deleted_by = null;
  } else if (status === "deleted") {
    patch.deleted_at = now;
    patch.deleted_by = actorId;
  }
  const { error } = await db.from("companies").update(patch).eq("id", id);
  if (error) throw error;
}

/* ------------------------ Registration review ----------------------- */

export async function fetchRegistrationRequests(
  status?: RegistrationStatus | "all",
): Promise<RegistrationRequest[]> {
  let q = db.from("registration_requests").select("*").order("created_at", { ascending: false });
  if (status && status !== "all") q = q.eq("status", status);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as RegistrationRequest[];
}

async function invokeOwner<T>(fn: string, body: Record<string, unknown>): Promise<T> {
  const { data, error } = await db.functions.invoke(fn, { body });
  if (error) {
    let message = error.message;
    const context = (error as { context?: Response }).context;
    if (context && typeof context.json === "function") {
      try {
        const b = await context.json();
        if (b?.error) message = b.error;
      } catch {
        /* ignore */
      }
    }
    throw new Error(message);
  }
  if ((data as { error?: string })?.error) throw new Error((data as { error: string }).error);
  return data as T;
}

export function approveRegistration(request_id: string, admin_password: string) {
  return invokeOwner<{ company_id: string; admin_user_id: string }>(
    "owner-approve-registration",
    { action: "approve", request_id, admin_password },
  );
}
export function rejectRegistration(request_id: string, note?: string) {
  return invokeOwner("owner-approve-registration", { action: "reject", request_id, note });
}
export function requestRegistrationInfo(request_id: string, note: string) {
  return invokeOwner("owner-approve-registration", { action: "request_info", request_id, note });
}

/* ------------------------------ Users ------------------------------ */

export async function fetchOwnerUsers(): Promise<OwnerUserRow[]> {
  const [{ data: profiles }, { data: roleRows }] = await Promise.all([
    db.from("profiles").select("id, full_name, email, phone, status, company_id, require_password_change, created_at").order("created_at"),
    db.from("user_roles").select("user_id, role"),
  ]);
  const roleMap = new Map<string, string>();
  for (const r of roleRows ?? []) roleMap.set(r.user_id, r.role);
  return ((profiles ?? []) as any[]).map((p) => ({
    id: p.id,
    full_name: p.full_name,
    email: p.email,
    phone: p.phone,
    status: p.status as AccountStatus,
    role: roleMap.get(p.id) ?? null,
    company_id: p.company_id ?? null,
    require_password_change: !!p.require_password_change,
    created_at: p.created_at,
  }));
}

export type UserAdminAction =
  | "send_reset_link"
  | "temp_password"
  | "require_password_change"
  | "suspend"
  | "reactivate"
  | "lock"
  | "unlock"
  | "set_role";

export function userAdmin(
  action: UserAdminAction,
  user_id: string,
  extra: Record<string, unknown> = {},
) {
  return invokeOwner<{ ok: boolean; password?: string; role?: string; value?: boolean }>(
    "owner-user-admin",
    { action, user_id, ...extra },
  );
}

/* ---------------------- Security & login history -------------------- */

export async function fetchLoginHistory(limit = 100): Promise<LoginHistoryRow[]> {
  const { data, error } = await db
    .from("login_history")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as LoginHistoryRow[];
}

export async function fetchSecurityEvents(limit = 100): Promise<SecurityEventRow[]> {
  const { data, error } = await db
    .from("security_events")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as SecurityEventRow[];
}

/* ----------------------- Company detail helpers --------------------- */

export async function fetchCompanyUsers(companyId: string): Promise<OwnerUserRow[]> {
  const all = await fetchOwnerUsers();
  return all.filter((u) => u.company_id === companyId);
}

/** Best-effort: record a login attempt (captures IP server-side). */
export async function recordLogin(email: string, success: boolean, userId?: string): Promise<void> {
  try {
    await db.functions.invoke("record-login", {
      body: { email, success, user_id: userId ?? null },
    });
  } catch {
    /* login logging must never block authentication */
  }
}