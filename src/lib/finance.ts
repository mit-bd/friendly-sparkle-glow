import { supabase } from "@/integrations/supabase/client";
import { format, parseISO } from "date-fns";
import type { ExpenseStatus } from "./expenses";
import type { DateRange } from "./analytics";

/** Cast helper so the new tables compile regardless of generated-type timing. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

export const FINANCE_MODULE = "finance" as const;
export const ATTACHMENT_BUCKET = "expense-attachments" as const;

/** Approval lifecycle shares the expense status vocabulary (reuses StatusBadge). */
export type ApprovalStatus = "pending_approval" | "approved" | "rejected" | "revision_requested";
export type ReceivableStatus = "pending" | "partially_received" | "received" | "overdue" | "cancelled";
export type PayableStatus = "pending" | "partially_paid" | "paid" | "overdue" | "cancelled";
export type FinanceKind = "receivable" | "payable";

export interface SettlementMeta {
  label: string;
  badge: string;
}

export const RECEIVABLE_STATUS: Record<ReceivableStatus, SettlementMeta> = {
  pending: { label: "Pending", badge: "border-transparent bg-muted text-muted-foreground" },
  partially_received: { label: "Partially Received", badge: "border-transparent bg-chart-1/15 text-chart-1" },
  received: { label: "Received", badge: "border-transparent bg-chart-2/15 text-chart-2" },
  overdue: { label: "Overdue", badge: "border-transparent bg-destructive/15 text-destructive" },
  cancelled: { label: "Cancelled", badge: "border-transparent bg-muted text-muted-foreground line-through" },
};

export const PAYABLE_STATUS: Record<PayableStatus, SettlementMeta> = {
  pending: { label: "Pending", badge: "border-transparent bg-muted text-muted-foreground" },
  partially_paid: { label: "Partially Paid", badge: "border-transparent bg-chart-1/15 text-chart-1" },
  paid: { label: "Paid", badge: "border-transparent bg-chart-2/15 text-chart-2" },
  overdue: { label: "Overdue", badge: "border-transparent bg-destructive/15 text-destructive" },
  cancelled: { label: "Cancelled", badge: "border-transparent bg-muted text-muted-foreground line-through" },
};

export const RECEIVABLE_PARTY_TYPES: { value: string; label: string }[] = [
  { value: "customer", label: "Customer" },
  { value: "courier", label: "Courier" },
  { value: "dealer", label: "Dealer" },
  { value: "reseller", label: "Reseller" },
  { value: "distributor", label: "Distributor" },
  { value: "employee", label: "Employee" },
  { value: "vendor_refund", label: "Vendor Refund" },
  { value: "other", label: "Other" },
];

export const PAYABLE_PARTY_TYPES: { value: string; label: string }[] = [
  { value: "supplier", label: "Supplier" },
  { value: "service_provider", label: "Service Provider" },
  { value: "landlord", label: "Landlord" },
  { value: "marketing_agency", label: "Marketing Agency" },
  { value: "freelancer", label: "Freelancer" },
  { value: "contractor", label: "Contractor" },
  { value: "employee_reimbursement", label: "Employee Reimbursement" },
  { value: "other", label: "Other" },
];

export function partyTypeLabel(kind: FinanceKind, value: string): string {
  const list = kind === "receivable" ? RECEIVABLE_PARTY_TYPES : PAYABLE_PARTY_TYPES;
  return list.find((p) => p.value === value)?.label ?? value;
}

/* ------------------------------- Records -------------------------------- */

interface FinanceBase {
  id: string;
  party_name: string;
  party_type: string;
  contact_person: string | null;
  mobile: string | null;
  email: string | null;
  reference_number: string | null;
  amount: number;
  due_amount: number;
  due_date: string | null;
  notes: string | null;
  approval_status: ApprovalStatus;
  created_by: string | null;
  created_at: string;
  updated_by: string | null;
  updated_at: string;
  submitted_by: string | null;
  submitted_at: string | null;
  approved_by: string | null;
  approved_at: string | null;
  rejected_by: string | null;
  rejected_at: string | null;
  deleted_by: string | null;
  deleted_at: string | null;
  restored_by: string | null;
  restored_at: string | null;
}

export interface Receivable extends FinanceBase {
  receivable_number: string;
  collected_amount: number;
  status: ReceivableStatus;
}
export interface Payable extends FinanceBase {
  payable_number: string;
  paid_amount: number;
  status: PayableStatus;
}

export interface FinanceSettlement {
  id: string;
  amount: number;
  date: string;
  notes: string | null;
  file_path: string | null;
  file_name: string | null;
  mime_type: string | null;
  size_bytes: number | null;
  created_by: string | null;
  created_at: string;
}

export interface FinanceAttachment {
  id: string;
  file_path: string;
  file_name: string | null;
  mime_type: string | null;
  size_bytes: number | null;
  created_at: string;
}

export interface FinanceEvent {
  id: string;
  actor_id: string | null;
  action: string;
  from_status: string | null;
  to_status: string | null;
  notes: string | null;
  created_at: string;
}

const RCV_COLS =
  "id, receivable_number, party_name, party_type, contact_person, mobile, email, reference_number, amount, collected_amount, due_amount, due_date, notes, status, approval_status, created_by, created_at, updated_by, updated_at, submitted_by, submitted_at, approved_by, approved_at, rejected_by, rejected_at, deleted_by, deleted_at, restored_by, restored_at";
const PAY_COLS =
  "id, payable_number, party_name, party_type, contact_person, mobile, email, reference_number, amount, paid_amount, due_amount, due_date, notes, status, approval_status, created_by, created_at, updated_by, updated_at, submitted_by, submitted_at, approved_by, approved_at, rejected_by, rejected_at, deleted_by, deleted_at, restored_by, restored_at";

/* ------------------------------ Formatting ------------------------------ */

export function formatTk(amount: number): string {
  return `\u09F3 ${new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(amount || 0)}`;
}

/* ------------------------------ Fetching -------------------------------- */

export async function fetchReceivables(): Promise<Receivable[]> {
  const { data, error } = await db.from("receivables").select(RCV_COLS).is("deleted_at", null).order("created_at", { ascending: false }).limit(2000);
  if (error) throw error;
  return (data ?? []) as Receivable[];
}
export async function fetchReceivable(id: string): Promise<Receivable | null> {
  const { data, error } = await db.from("receivables").select(RCV_COLS).eq("id", id).maybeSingle();
  if (error) throw error;
  return (data as Receivable | null) ?? null;
}
export async function fetchPayables(): Promise<Payable[]> {
  const { data, error } = await db.from("payables").select(PAY_COLS).is("deleted_at", null).order("created_at", { ascending: false }).limit(2000);
  if (error) throw error;
  return (data ?? []) as Payable[];
}
export async function fetchPayable(id: string): Promise<Payable | null> {
  const { data, error } = await db.from("payables").select(PAY_COLS).eq("id", id).maybeSingle();
  if (error) throw error;
  return (data as Payable | null) ?? null;
}

export async function fetchCollections(receivableId: string): Promise<FinanceSettlement[]> {
  const { data, error } = await db.from("receivable_collections").select("id, amount, collection_date, notes, file_path, file_name, mime_type, size_bytes, created_by, created_at").eq("receivable_id", receivableId).order("collection_date", { ascending: false });
  if (error) throw error;
  return (data ?? []).map((r: any) => ({ ...r, date: r.collection_date })) as FinanceSettlement[];
}
export async function fetchPayments(payableId: string): Promise<FinanceSettlement[]> {
  const { data, error } = await db.from("payable_payments").select("id, amount, payment_date, notes, file_path, file_name, mime_type, size_bytes, created_by, created_at").eq("payable_id", payableId).order("payment_date", { ascending: false });
  if (error) throw error;
  return (data ?? []).map((r: any) => ({ ...r, date: r.payment_date })) as FinanceSettlement[];
}

export async function fetchAttachments(kind: FinanceKind, id: string): Promise<FinanceAttachment[]> {
  const table = kind === "receivable" ? "receivable_attachments" : "payable_attachments";
  const fk = kind === "receivable" ? "receivable_id" : "payable_id";
  const { data, error } = await db.from(table).select("id, file_path, file_name, mime_type, size_bytes, created_at").eq(fk, id).order("created_at");
  if (error) throw error;
  return (data ?? []) as FinanceAttachment[];
}

export async function fetchEvents(kind: FinanceKind, id: string): Promise<FinanceEvent[]> {
  const table = kind === "receivable" ? "receivable_events" : "payable_events";
  const fk = kind === "receivable" ? "receivable_id" : "payable_id";
  const { data, error } = await db.from(table).select("id, actor_id, action, from_status, to_status, notes, created_at").eq(fk, id).order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []) as FinanceEvent[];
}

/* ------------------------------ Mutations ------------------------------- */

export interface ReceivableInput {
  party_name: string;
  party_type: string;
  contact_person: string | null;
  mobile: string | null;
  email: string | null;
  reference_number: string | null;
  amount: number;
  collected_amount: number;
  due_date: string | null;
  notes: string | null;
}
export interface PayableInput {
  party_name: string;
  party_type: string;
  contact_person: string | null;
  mobile: string | null;
  email: string | null;
  reference_number: string | null;
  amount: number;
  paid_amount: number;
  due_date: string | null;
  notes: string | null;
}

export async function createReceivable(input: ReceivableInput, userId: string): Promise<Receivable> {
  const { data, error } = await db.from("receivables").insert({ ...input, created_by: userId, approval_status: "pending_approval" }).select(RCV_COLS).single();
  if (error || !data) throw error ?? new Error("Failed to create receivable.");
  return data as Receivable;
}
export async function createPayable(input: PayableInput, userId: string): Promise<Payable> {
  const { data, error } = await db.from("payables").insert({ ...input, created_by: userId, approval_status: "pending_approval" }).select(PAY_COLS).single();
  if (error || !data) throw error ?? new Error("Failed to create payable.");
  return data as Payable;
}
export async function updateReceivable(id: string, patch: Partial<ReceivableInput>): Promise<void> {
  const { error } = await db.from("receivables").update(patch).eq("id", id);
  if (error) throw error;
}
export async function updatePayable(id: string, patch: Partial<PayableInput>): Promise<void> {
  const { error } = await db.from("payables").update(patch).eq("id", id);
  if (error) throw error;
}

export async function setApproval(kind: FinanceKind, id: string, status: ApprovalStatus): Promise<void> {
  const table = kind === "receivable" ? "receivables" : "payables";
  const { error } = await db.from(table).update({ approval_status: status }).eq("id", id);
  if (error) throw error;
}
export async function softDelete(kind: FinanceKind, id: string): Promise<void> {
  const table = kind === "receivable" ? "receivables" : "payables";
  const { error } = await db.from(table).update({ deleted_at: new Date().toISOString() }).eq("id", id);
  if (error) throw error;
}
export async function setCancelled(kind: FinanceKind, id: string): Promise<void> {
  const table = kind === "receivable" ? "receivables" : "payables";
  const { error } = await db.from(table).update({ status: "cancelled" }).eq("id", id);
  if (error) throw error;
}

export async function addCollection(receivableId: string, v: { amount: number; date: string; notes: string | null; file?: { path: string; name: string; mime: string; size: number } | null }, userId: string): Promise<void> {
  const { error } = await db.from("receivable_collections").insert({
    receivable_id: receivableId, amount: v.amount, collection_date: v.date, notes: v.notes,
    file_path: v.file?.path ?? null, file_name: v.file?.name ?? null, mime_type: v.file?.mime ?? null, size_bytes: v.file?.size ?? null, created_by: userId,
  });
  if (error) throw error;
}
export async function addPayment(payableId: string, v: { amount: number; date: string; notes: string | null; file?: { path: string; name: string; mime: string; size: number } | null }, userId: string): Promise<void> {
  const { error } = await db.from("payable_payments").insert({
    payable_id: payableId, amount: v.amount, payment_date: v.date, notes: v.notes,
    file_path: v.file?.path ?? null, file_name: v.file?.name ?? null, mime_type: v.file?.mime ?? null, size_bytes: v.file?.size ?? null, created_by: userId,
  });
  if (error) throw error;
}

export async function addAttachment(kind: FinanceKind, id: string, v: { path: string; name: string; mime: string; size: number }, userId: string): Promise<void> {
  const table = kind === "receivable" ? "receivable_attachments" : "payable_attachments";
  const fk = kind === "receivable" ? "receivable_id" : "payable_id";
  const { error } = await db.from(table).insert({ [fk]: id, file_path: v.path, file_name: v.name, mime_type: v.mime, size_bytes: v.size, created_by: userId });
  if (error) throw error;
}
export async function deleteAttachment(kind: FinanceKind, id: string): Promise<void> {
  const table = kind === "receivable" ? "receivable_attachments" : "payable_attachments";
  const { error } = await db.from(table).delete().eq("id", id);
  if (error) throw error;
}

export async function postComment(kind: FinanceKind, id: string, userId: string, body: string): Promise<void> {
  const table = kind === "receivable" ? "receivable_events" : "payable_events";
  const fk = kind === "receivable" ? "receivable_id" : "payable_id";
  const { error } = await db.from(table).insert({ [fk]: id, actor_id: userId, action: "comment", notes: body });
  if (error) throw error;
}

export async function logFinanceEvent(
  kind: FinanceKind,
  id: string,
  input: { actorId: string; action: string; fromStatus?: string | null; toStatus?: string | null; notes?: string | null },
): Promise<void> {
  const table = kind === "receivable" ? "receivable_events" : "payable_events";
  const fk = kind === "receivable" ? "receivable_id" : "payable_id";
  const { error } = await db.from(table).insert({
    [fk]: id, actor_id: input.actorId, action: input.action,
    from_status: input.fromStatus ?? null, to_status: input.toStatus ?? null, notes: input.notes ?? null,
  });
  if (error) throw error;
}

/* ----------------------------- Aggregation ------------------------------ */

export const isApprovedActive = (r: { approval_status: ApprovalStatus; deleted_at: string | null; status: string }) =>
  r.approval_status === "approved" && !r.deleted_at && r.status !== "cancelled";

export const sumBy = <T>(rows: T[], pick: (r: T) => number) => rows.reduce((a, r) => a + Number(pick(r) || 0), 0);

function withinDays(due: string | null, days: number): boolean {
  if (!due) return false;
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const end = new Date(today); end.setDate(end.getDate() + days);
  const d = parseISO(due);
  return d >= today && d <= end;
}
function isThisMonth(due: string | null): boolean {
  if (!due) return false;
  const now = new Date();
  const d = parseISO(due);
  return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
}

export interface FinanceSnapshot {
  totalReceivable: number;
  totalPayable: number;
  net: number;
  overdueReceivable: number;
  overduePayable: number;
  dueThisWeek: number;
  dueThisMonth: number;
  collectionEfficiency: number;
  paymentEfficiency: number;
  receivableCount: number;
  payableCount: number;
}

export function buildSnapshot(recv: Receivable[], pay: Payable[]): FinanceSnapshot {
  const aR = recv.filter(isApprovedActive);
  const aP = pay.filter(isApprovedActive);
  const totalReceivable = sumBy(aR, (r) => r.due_amount);
  const totalPayable = sumBy(aP, (p) => p.due_amount);
  const overdueReceivable = sumBy(aR.filter((r) => r.status === "overdue"), (r) => r.due_amount);
  const overduePayable = sumBy(aP.filter((p) => p.status === "overdue"), (p) => p.due_amount);
  const dueThisWeek =
    sumBy(aR.filter((r) => r.due_amount > 0 && withinDays(r.due_date, 7)), (r) => r.due_amount) +
    sumBy(aP.filter((p) => p.due_amount > 0 && withinDays(p.due_date, 7)), (p) => p.due_amount);
  const dueThisMonth =
    sumBy(aR.filter((r) => r.due_amount > 0 && isThisMonth(r.due_date)), (r) => r.due_amount) +
    sumBy(aP.filter((p) => p.due_amount > 0 && isThisMonth(p.due_date)), (p) => p.due_amount);
  const recvGross = sumBy(aR, (r) => r.amount);
  const payGross = sumBy(aP, (p) => p.amount);
  return {
    totalReceivable,
    totalPayable,
    net: totalReceivable - totalPayable,
    overdueReceivable,
    overduePayable,
    dueThisWeek,
    dueThisMonth,
    collectionEfficiency: recvGross > 0 ? (sumBy(aR, (r) => r.collected_amount) / recvGross) * 100 : 0,
    paymentEfficiency: payGross > 0 ? (sumBy(aP, (p) => p.paid_amount) / payGross) * 100 : 0,
    receivableCount: aR.length,
    payableCount: aP.length,
  };
}

export interface PartyRow {
  name: string;
  type: string;
  outstanding: number;
  total: number;
  count: number;
}

export function topOutstandingParties<T extends { party_name: string; party_type: string; amount: number; due_amount: number }>(
  rows: T[],
  limit = 8,
): PartyRow[] {
  const acc = new Map<string, PartyRow>();
  for (const r of rows) {
    const key = `${r.party_name}__${r.party_type}`;
    const cur = acc.get(key) ?? { name: r.party_name, type: r.party_type, outstanding: 0, total: 0, count: 0 };
    cur.outstanding += Number(r.due_amount || 0);
    cur.total += Number(r.amount || 0);
    cur.count += 1;
    acc.set(key, cur);
  }
  return [...acc.values()].sort((a, b) => b.outstanding - a.outstanding).slice(0, limit);
}

/** Outstanding receivables grouped specifically by courier party type. */
export function courierReceivableSummary(recv: Receivable[]): PartyRow[] {
  return topOutstandingParties(recv.filter((r) => isApprovedActive(r) && r.party_type === "courier"), 20);
}
/** Outstanding supplier liabilities (supplier + packaging-type entries). */
export function supplierLiabilitySummary(pay: Payable[]): PartyRow[] {
  return topOutstandingParties(pay.filter((p) => isApprovedActive(p) && p.party_type === "supplier"), 20);
}

export interface MonthlyPoint { key: string; label: string; total: number; }
export function buildMonthly<T>(rows: T[], dateOf: (r: T) => string | null, valueOf: (r: T) => number): MonthlyPoint[] {
  const totals = new Map<string, number>();
  for (const r of rows) {
    const d = dateOf(r);
    if (!d) continue;
    const key = d.slice(0, 7);
    totals.set(key, (totals.get(key) ?? 0) + Number(valueOf(r) || 0));
  }
  return [...totals.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([key, total]) => ({ key, label: format(parseISO(`${key}-01`), "MMM yyyy"), total }));
}

export async function fetchAllCollections(range?: DateRange): Promise<{ amount: number; collection_date: string }[]> {
  let q = db.from("receivable_collections").select("amount, collection_date").order("collection_date", { ascending: false }).limit(5000);
  if (range) q = q.gte("collection_date", range.from).lte("collection_date", range.to);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as { amount: number; collection_date: string }[];
}
export async function fetchAllPayments(range?: DateRange): Promise<{ amount: number; payment_date: string }[]> {
  let q = db.from("payable_payments").select("amount, payment_date").order("payment_date", { ascending: false }).limit(5000);
  if (range) q = q.gte("payment_date", range.from).lte("payment_date", range.to);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as { amount: number; payment_date: string }[];
}

/* --------------------- Rule-based financial insights -------------------- */

export interface FinanceInsight { text: string; tone: "positive" | "negative" | "neutral"; }

function monthTotal<T extends { created_at: string; amount: number }>(rows: T[], monthsAgo: number): number {
  const now = new Date();
  const target = new Date(now.getFullYear(), now.getMonth() - monthsAgo, 1);
  const key = format(target, "yyyy-MM");
  return sumBy(rows.filter((r) => r.created_at.slice(0, 7) === key), (r) => r.amount);
}

function pctChange(curr: number, prev: number): number {
  if (prev === 0) return curr === 0 ? 0 : 100;
  return ((curr - prev) / prev) * 100;
}

export function financeInsights(recv: Receivable[], pay: Payable[]): FinanceInsight[] {
  const out: FinanceInsight[] = [];
  const aR = recv.filter(isApprovedActive);
  const aP = pay.filter(isApprovedActive);

  const rCurr = monthTotal(aR, 0);
  const rPrev = monthTotal(aR, 1);
  if (rCurr || rPrev) {
    const ch = pctChange(rCurr, rPrev);
    out.push({
      text: `Receivables ${ch >= 0 ? "increased" : "decreased"} ${Math.abs(ch).toFixed(0)}% compared to previous month.`,
      tone: ch > 0 ? "negative" : "positive",
    });
  }
  const pCurr = monthTotal(aP, 0);
  const pPrev = monthTotal(aP, 1);
  if (pCurr || pPrev) {
    const ch = pctChange(pCurr, pPrev);
    out.push({
      text: `Supplier & vendor liabilities ${ch >= 0 ? "increased" : "decreased"} ${Math.abs(ch).toFixed(0)}% compared to previous month.`,
      tone: ch > 0 ? "negative" : "positive",
    });
  }

  const overdueR = sumBy(aR.filter((r) => r.status === "overdue"), (r) => r.due_amount);
  const overdueP = sumBy(aP.filter((p) => p.status === "overdue"), (p) => p.due_amount);
  if (overdueR > 0 || overdueP > 0) {
    out.push({
      text:
        overdueR > overdueP
          ? `Overdue receivables (${formatTk(overdueR)}) exceed overdue payables (${formatTk(overdueP)}).`
          : `Overdue payables (${formatTk(overdueP)}) exceed overdue receivables (${formatTk(overdueR)}).`,
      tone: overdueR > overdueP ? "negative" : "neutral",
    });
  }

  // Courier settlement ageing — oldest outstanding courier receivable.
  const couriers = aR.filter((r) => r.party_type === "courier" && r.due_amount > 0);
  if (couriers.length > 0) {
    const oldest = couriers.reduce((a, b) => (a.created_at < b.created_at ? a : b));
    const days = Math.max(0, Math.round((Date.now() - new Date(oldest.created_at).getTime()) / 86400000));
    out.push({ text: `Courier settlements remain outstanding for up to ${days} day(s).`, tone: days > 14 ? "negative" : "neutral" });
  }

  const snap = buildSnapshot(recv, pay);
  out.push({
    text: `Net position is ${formatTk(snap.net)} (${snap.net >= 0 ? "company is net owed" : "company owes more than owed"}).`,
    tone: snap.net >= 0 ? "positive" : "negative",
  });
  out.push({
    text: `Collection efficiency ${snap.collectionEfficiency.toFixed(0)}% · Payment efficiency ${snap.paymentEfficiency.toFixed(0)}%.`,
    tone: "neutral",
  });

  return out;
}

/** Reuse the expense StatusBadge for the four approval states. */
export const asExpenseStatus = (s: ApprovalStatus): ExpenseStatus => s as ExpenseStatus;

/* ------------------------- Recycle-bin helpers -------------------------- */

export interface DeletedFinance {
  id: string;
  number: string;
  party_name: string;
  due_amount: number;
  deleted_at: string | null;
  deleted_by: string | null;
}

export async function fetchDeletedReceivables(): Promise<DeletedFinance[]> {
  const { data, error } = await db.from("receivables").select("id, receivable_number, party_name, due_amount, deleted_at, deleted_by").not("deleted_at", "is", null).order("deleted_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map((r: any) => ({ id: r.id, number: r.receivable_number, party_name: r.party_name, due_amount: r.due_amount, deleted_at: r.deleted_at, deleted_by: r.deleted_by })) as DeletedFinance[];
}
export async function fetchDeletedPayables(): Promise<DeletedFinance[]> {
  const { data, error } = await db.from("payables").select("id, payable_number, party_name, due_amount, deleted_at, deleted_by").not("deleted_at", "is", null).order("deleted_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map((r: any) => ({ id: r.id, number: r.payable_number, party_name: r.party_name, due_amount: r.due_amount, deleted_at: r.deleted_at, deleted_by: r.deleted_by })) as DeletedFinance[];
}
export async function restoreFinance(kind: FinanceKind, id: string): Promise<void> {
  const table = kind === "receivable" ? "receivables" : "payables";
  const { error } = await db.from(table).update({ deleted_at: null }).eq("id", id);
  if (error) throw error;
}
export async function purgeFinance(kind: FinanceKind, id: string): Promise<void> {
  const table = kind === "receivable" ? "receivables" : "payables";
  const { error } = await db.from(table).delete().eq("id", id);
  if (error) throw error;
}