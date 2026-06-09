import { supabase } from "@/integrations/supabase/client";
import type { ModuleKey } from "@/lib/modules";

/** Cast helper so the new table compiles regardless of generated-type timing. */
const db = supabase as unknown as { from: (t: string) => any };

export type QaStatus = "pending" | "tested" | "issue" | "resolved";
export type QaSeverity = "low" | "medium" | "high" | "critical";
export type QaArea =
  | "functionality"
  | "data_accuracy"
  | "report_accuracy"
  | "analytics_accuracy"
  | "performance"
  | "stability";

export interface QaItem {
  id: string;
  title: string;
  module: string;
  area: QaArea;
  status: QaStatus;
  severity: QaSeverity;
  notes: string | null;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
}

export const QA_STATUS_LABELS: Record<QaStatus, string> = {
  pending: "Pending",
  tested: "Tested",
  issue: "Issue Found",
  resolved: "Resolved",
};

/** Theme-safe tone classes (semantic tokens only — no hardcoded colors). */
export const QA_STATUS_TONE: Record<QaStatus, string> = {
  pending: "bg-muted text-muted-foreground",
  tested: "bg-chart-2/15 text-chart-2",
  issue: "bg-destructive/15 text-destructive",
  resolved: "bg-success/15 text-success",
};

export const QA_SEVERITY_LABELS: Record<QaSeverity, string> = {
  low: "Low",
  medium: "Medium",
  high: "High",
  critical: "Critical",
};

export const QA_SEVERITY_TONE: Record<QaSeverity, string> = {
  low: "bg-muted text-muted-foreground",
  medium: "bg-chart-1/15 text-chart-1",
  high: "bg-warning/15 text-warning",
  critical: "bg-destructive/15 text-destructive",
};

export const QA_AREA_LABELS: Record<QaArea, string> = {
  functionality: "Functionality",
  data_accuracy: "Data Accuracy",
  report_accuracy: "Report Accuracy",
  analytics_accuracy: "Analytics Accuracy",
  performance: "Performance",
  stability: "Stability",
};

/** Modules under validation (mirrors the app's functional surface). */
export const QA_MODULES: { key: string; label: string }[] = [
  { key: "general", label: "General / Platform" },
  { key: "dashboard", label: "Dashboard" },
  { key: "expenses", label: "Expenses" },
  { key: "marketing", label: "Marketing" },
  { key: "fixed_costs", label: "Fixed Costs" },
  { key: "returns", label: "Returns" },
  { key: "damages", label: "Damages" },
  { key: "reports", label: "Reports" },
  { key: "analytics", label: "Analytics & Intelligence" },
  { key: "audit", label: "Audit & History" },
  { key: "notifications", label: "Notifications" },
  { key: "approvals", label: "Approvals" },
  { key: "permissions", label: "Permissions & Access" },
];

export function qaModuleLabel(key: string): string {
  return QA_MODULES.find((m) => m.key === key)?.label ?? key;
}

export interface QaSummary {
  total: number;
  pending: number;
  tested: number;
  issues: number;
  resolved: number;
  /** Tested + resolved over total — validation progress. */
  progress: number;
  /** Open issues still needing a fix (status = issue). */
  openIssues: number;
}

export function summarise(items: QaItem[]): QaSummary {
  const total = items.length;
  const pending = items.filter((i) => i.status === "pending").length;
  const tested = items.filter((i) => i.status === "tested").length;
  const issues = items.filter((i) => i.status === "issue").length;
  const resolved = items.filter((i) => i.status === "resolved").length;
  const validated = tested + resolved;
  return {
    total,
    pending,
    tested,
    issues,
    resolved,
    openIssues: issues,
    progress: total ? Math.round((validated / total) * 100) : 0,
  };
}

/* ------------------------------- CRUD ----------------------------------- */

export async function fetchQaItems(): Promise<QaItem[]> {
  const { data, error } = await db
    .from("qa_checklist_items")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as QaItem[];
}

export interface QaItemInput {
  title: string;
  module: string;
  area: QaArea;
  status: QaStatus;
  severity: QaSeverity;
  notes?: string | null;
}

export async function createQaItem(input: QaItemInput, actorId: string | null): Promise<void> {
  const { error } = await db.from("qa_checklist_items").insert({
    title: input.title.trim(),
    module: input.module,
    area: input.area,
    status: input.status,
    severity: input.severity,
    notes: input.notes?.trim() || null,
    created_by: actorId,
    updated_by: actorId,
  });
  if (error) throw error;
}

export async function updateQaItem(
  id: string,
  patch: Partial<QaItemInput>,
  actorId: string | null,
): Promise<void> {
  const payload: Record<string, unknown> = { updated_by: actorId };
  if (patch.title !== undefined) payload.title = patch.title.trim();
  if (patch.module !== undefined) payload.module = patch.module;
  if (patch.area !== undefined) payload.area = patch.area;
  if (patch.status !== undefined) payload.status = patch.status;
  if (patch.severity !== undefined) payload.severity = patch.severity;
  if (patch.notes !== undefined) payload.notes = patch.notes?.trim() || null;
  const { error } = await db.from("qa_checklist_items").update(payload).eq("id", id);
  if (error) throw error;
}

export async function deleteQaItem(id: string): Promise<void> {
  const { error } = await db.from("qa_checklist_items").delete().eq("id", id);
  if (error) throw error;
}

/** Default validation checklist seeded on first use for an empty board. */
export const QA_SEED: QaItemInput[] = [
  { title: "Expense create / edit / delete workflow", module: "expenses", area: "functionality", status: "pending", severity: "high" },
  { title: "Expense approval & rejection flow", module: "approvals", area: "functionality", status: "pending", severity: "high" },
  { title: "Only approved expenses included in totals", module: "expenses", area: "data_accuracy", status: "pending", severity: "critical" },
  { title: "Dashboard summary cards reconcile with records", module: "dashboard", area: "data_accuracy", status: "pending", severity: "high" },
  { title: "Category & subcategory drill-down totals", module: "analytics", area: "analytics_accuracy", status: "pending", severity: "high" },
  { title: "Marketing multi-currency BDT conversion", module: "marketing", area: "data_accuracy", status: "pending", severity: "high" },
  { title: "Returns net-loss calculation accuracy", module: "returns", area: "data_accuracy", status: "pending", severity: "high" },
  { title: "Damages value totals accuracy", module: "damages", area: "data_accuracy", status: "pending", severity: "medium" },
  { title: "Fixed cost monthly generation correctness", module: "fixed_costs", area: "functionality", status: "pending", severity: "high" },
  { title: "Report PDF / Print / CSV exports render correctly", module: "reports", area: "report_accuracy", status: "pending", severity: "high" },
  { title: "Executive Analytics figures match source data", module: "analytics", area: "analytics_accuracy", status: "pending", severity: "high" },
  { title: "Audit trail records every change", module: "audit", area: "functionality", status: "pending", severity: "medium" },
  { title: "Notifications fire on approvals & assignments", module: "notifications", area: "functionality", status: "pending", severity: "medium" },
  { title: "Role permissions enforce module access", module: "permissions", area: "functionality", status: "pending", severity: "critical" },
  { title: "Page load & list performance under data volume", module: "general", area: "performance", status: "pending", severity: "medium" },
  { title: "No console errors / crashes across modules", module: "general", area: "stability", status: "pending", severity: "high" },
];

export async function seedQaChecklist(actorId: string | null): Promise<number> {
  const rows = QA_SEED.map((r) => ({
    title: r.title,
    module: r.module,
    area: r.area,
    status: r.status,
    severity: r.severity,
    notes: null,
    created_by: actorId,
    updated_by: actorId,
  }));
  const { error } = await db.from("qa_checklist_items").insert(rows);
  if (error) throw error;
  return rows.length;
}

// Re-export for callers that map QA modules onto app ModuleKey values.
export type { ModuleKey };