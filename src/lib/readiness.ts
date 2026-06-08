import { supabase } from "@/integrations/supabase/client";

/**
 * Production Readiness — best-effort configuration checks for the v1.0
 * onboarding wizard and system readiness dashboard.
 *
 * Read-only and RLS-respecting. Each check returns a boolean "done" plus a
 * human-readable count/detail. Failures degrade gracefully to `done: false`
 * so the dashboard never crashes when a table is unreachable.
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

export interface ReadinessCheck {
  key: string;
  label: string;
  description: string;
  to: string;
  done: boolean;
  detail: string;
}

async function count(table: string, build?: (q: any) => any): Promise<number> {
  try {
    let q = db.from(table).select("id", { count: "exact", head: true });
    if (build) q = build(q);
    const { count: c, error } = await q;
    if (error) return 0;
    return c ?? 0;
  } catch {
    return 0;
  }
}

export async function fetchReadiness(): Promise<ReadinessCheck[]> {
  const [company, sigs, cats, users] = await Promise.all([
    count("company_profile"),
    count("signatories"),
    count("expense_categories", (q) => q.is("deleted_at", null)),
    count("profiles"),
  ]);

  let notifEnabled = false;
  try {
    const { data } = await db
      .from("notification_settings")
      .select("enabled")
      .eq("channel", "in_app")
      .maybeSingle();
    notifEnabled = data?.enabled === true;
  } catch {
    notifEnabled = false;
  }

  return [
    {
      key: "company",
      label: "Configure Company Profile",
      description: "Set your company name, address and contact details for letterheads.",
      to: "/settings/company",
      done: company > 0,
      detail: company > 0 ? "Company profile saved." : "No company profile yet.",
    },
    {
      key: "signatories",
      label: "Configure Signatories",
      description: "Add authorised approvers shown on printed reports.",
      to: "/settings/signatories",
      done: sigs > 0,
      detail: sigs > 0 ? `${sigs} signatory(ies) configured.` : "No signatories added.",
    },
    {
      key: "categories",
      label: "Create Categories",
      description: "Define expense categories used across the platform.",
      to: "/expenses/categories",
      done: cats > 0,
      detail: cats > 0 ? `${cats} active category(ies).` : "No categories created.",
    },
    {
      key: "users",
      label: "Create Users",
      description: "Invite team members and assign their roles.",
      to: "/users",
      done: users > 1,
      detail: users > 1 ? `${users} users in the workspace.` : "Only the owner account exists.",
    },
    {
      key: "notifications",
      label: "Configure Notifications",
      description: "Enable in-app notifications for approvals and updates.",
      to: "/settings/notifications",
      done: notifEnabled,
      detail: notifEnabled ? "In-app notifications enabled." : "In-app notifications disabled.",
    },
  ];
}