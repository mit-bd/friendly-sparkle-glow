import { supabase } from "@/integrations/supabase/client";
import { format, parseISO } from "date-fns";
import type { DateRange } from "./analytics";
import type { ExpenseStatus } from "./expenses";

export const APPROVED_STATUS = "approved" as const;
export const PENDING_STATUSES = ["submitted", "pending_approval", "revision_requested"] as const;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

export interface ReturnReason { id: string; name: string; is_active: boolean; sort_order: number; deleted_at?: string | null; }
export interface DamageType { id: string; name: string; is_active: boolean; sort_order: number; deleted_at?: string | null; }

export interface ReturnRecord {
  id: string; return_number: string; return_date: string; category_id: string | null; reason_id: string | null;
  product_name: string; quantity: number; customer_notes: string | null; loss_amount: number; recoverable_amount: number;
  net_loss_amount: number; notes: string | null; status: ExpenseStatus; created_by: string | null; created_at: string;
  updated_by: string | null; updated_at: string; submitted_by: string | null; submitted_at: string | null;
  approved_by: string | null; approved_at: string | null; rejected_by: string | null; rejected_at: string | null;
  deleted_at: string | null; deleted_by: string | null; restored_at: string | null; restored_by: string | null;
}
export interface DamageRecord {
  id: string; damage_number: string; damage_date: string; type_id: string | null; product_name: string; quantity: number;
  damage_value: number; notes: string | null; status: ExpenseStatus; created_by: string | null; created_at: string;
  updated_by: string | null; updated_at: string; submitted_by: string | null; submitted_at: string | null;
  approved_by: string | null; approved_at: string | null; rejected_by: string | null; rejected_at: string | null;
  deleted_at: string | null; deleted_by: string | null; restored_at: string | null; restored_by: string | null;
}
export interface LossAttachment { id: string; file_path: string; file_name: string | null; mime_type: string | null; size_bytes: number | null; created_at: string; }
export interface LossEvent { id: string; actor_id: string | null; action: string; from_status: ExpenseStatus | null; to_status: ExpenseStatus | null; notes: string | null; created_at: string; }
export type LossKind = "return" | "damage";

const RETURN_COLS = "id, return_number, return_date, category_id, reason_id, product_name, quantity, customer_notes, loss_amount, recoverable_amount, net_loss_amount, notes, status, created_by, created_at, updated_by, updated_at, submitted_by, submitted_at, approved_by, approved_at, rejected_by, rejected_at, deleted_at, deleted_by, restored_at, restored_by";
const DAMAGE_COLS = "id, damage_number, damage_date, type_id, product_name, quantity, damage_value, notes, status, created_by, created_at, updated_by, updated_at, submitted_by, submitted_at, approved_by, approved_at, rejected_by, rejected_at, deleted_at, deleted_by, restored_at, restored_by";
const PAGE = 1000;

export async function fetchReturnReasons(includeInactive = false): Promise<ReturnReason[]> {
  let q = db.from("return_reasons").select("id, name, is_active, sort_order, deleted_at").is("deleted_at", null).order("sort_order").order("name");
  if (!includeInactive) q = q.eq("is_active", true);
  const { data, error } = await q; if (error) throw error; return (data ?? []) as ReturnReason[];
}
export async function fetchDamageTypes(includeInactive = false): Promise<DamageType[]> {
  let q = db.from("damage_types").select("id, name, is_active, sort_order, deleted_at").is("deleted_at", null).order("sort_order").order("name");
  if (!includeInactive) q = q.eq("is_active", true);
  const { data, error } = await q; if (error) throw error; return (data ?? []) as DamageType[];
}
export async function fetchReturnsList(): Promise<ReturnRecord[]> {
  const { data, error } = await db.from("returns").select(RETURN_COLS).neq("status", "deleted").order("return_date", { ascending: false }).limit(1000);
  if (error) throw error; return (data ?? []) as ReturnRecord[];
}
export async function fetchReturn(id: string): Promise<ReturnRecord | null> {
  const { data, error } = await db.from("returns").select(RETURN_COLS).eq("id", id).maybeSingle();
  if (error) throw error; return (data as ReturnRecord | null) ?? null;
}
export async function fetchApprovedReturns(range: DateRange): Promise<ReturnRecord[]> {
  const all: ReturnRecord[] = []; let offset = 0;
  for (let i = 0; i < 100; i++) {
    const { data, error } = await db.from("returns").select(RETURN_COLS).eq("status", APPROVED_STATUS).gte("return_date", range.from).lte("return_date", range.to).order("return_date", { ascending: false }).range(offset, offset + PAGE - 1);
    if (error) throw error; const rows = (data ?? []) as ReturnRecord[]; all.push(...rows); if (rows.length < PAGE) break; offset += PAGE;
  }
  return all;
}
export async function fetchDamagesList(): Promise<DamageRecord[]> {
  const { data, error } = await db.from("damages").select(DAMAGE_COLS).neq("status", "deleted").order("damage_date", { ascending: false }).limit(1000);
  if (error) throw error; return (data ?? []) as DamageRecord[];
}
export async function fetchDamage(id: string): Promise<DamageRecord | null> {
  const { data, error } = await db.from("damages").select(DAMAGE_COLS).eq("id", id).maybeSingle();
  if (error) throw error; return (data as DamageRecord | null) ?? null;
}
export async function fetchApprovedDamages(range: DateRange): Promise<DamageRecord[]> {
  const all: DamageRecord[] = []; let offset = 0;
  for (let i = 0; i < 100; i++) {
    const { data, error } = await db.from("damages").select(DAMAGE_COLS).eq("status", APPROVED_STATUS).gte("damage_date", range.from).lte("damage_date", range.to).order("damage_date", { ascending: false }).range(offset, offset + PAGE - 1);
    if (error) throw error; const rows = (data ?? []) as DamageRecord[]; all.push(...rows); if (rows.length < PAGE) break; offset += PAGE;
  }
  return all;
}
export async function fetchReturnAttachments(returnId: string): Promise<LossAttachment[]> {
  const { data, error } = await db.from("return_attachments").select("id, file_path, file_name, mime_type, size_bytes, created_at").eq("return_id", returnId).order("created_at");
  if (error) throw error; return (data ?? []) as LossAttachment[];
}
export async function fetchDamageAttachments(damageId: string): Promise<LossAttachment[]> {
  const { data, error } = await db.from("damage_attachments").select("id, file_path, file_name, mime_type, size_bytes, created_at").eq("damage_id", damageId).order("created_at");
  if (error) throw error; return (data ?? []) as LossAttachment[];
}
export async function fetchReturnEvents(returnId: string): Promise<LossEvent[]> {
  const { data, error } = await db.from("return_events").select("id, actor_id, action, from_status, to_status, notes, created_at").eq("return_id", returnId).order("created_at", { ascending: true });
  if (error) throw error; return (data ?? []) as LossEvent[];
}
export async function fetchDamageEvents(damageId: string): Promise<LossEvent[]> {
  const { data, error } = await db.from("damage_events").select("id, actor_id, action, from_status, to_status, notes, created_at").eq("damage_id", damageId).order("created_at", { ascending: true });
  if (error) throw error; return (data ?? []) as LossEvent[];
}
export async function logReturnEvent(input: { returnId: string; actorId: string; action: string; fromStatus?: ExpenseStatus | null; toStatus?: ExpenseStatus | null; notes?: string | null; }): Promise<void> {
  const { error } = await db.from("return_events").insert({ return_id: input.returnId, actor_id: input.actorId, action: input.action, from_status: input.fromStatus ?? null, to_status: input.toStatus ?? null, notes: input.notes ?? null });
  if (error) throw error;
}
export async function logDamageEvent(input: { damageId: string; actorId: string; action: string; fromStatus?: ExpenseStatus | null; toStatus?: ExpenseStatus | null; notes?: string | null; }): Promise<void> {
  const { error } = await db.from("damage_events").insert({ damage_id: input.damageId, actor_id: input.actorId, action: input.action, from_status: input.fromStatus ?? null, to_status: input.toStatus ?? null, notes: input.notes ?? null });
  if (error) throw error;
}
export const sumBy = <T>(rows: T[], pick: (r: T) => number) => rows.reduce((acc, r) => acc + Number(pick(r) || 0), 0);
const pct = (part: number, whole: number) => (whole > 0 ? (part / whole) * 100 : 0);

export interface ReturnTotals { count: number; loss: number; recoverable: number; netLoss: number; }
export function returnTotals(rows: ReturnRecord[]): ReturnTotals {
  return { count: rows.length, loss: sumBy(rows, (r) => r.loss_amount), recoverable: sumBy(rows, (r) => r.recoverable_amount), netLoss: sumBy(rows, (r) => r.net_loss_amount) };
}
export interface ReasonSummaryRow { id: string | null; name: string; count: number; loss: number; recoverable: number; netLoss: number; percentage: number; }
export function buildReasonSummary(rows: ReturnRecord[], reasons: ReturnReason[]): { rows: ReasonSummaryRow[]; grandNetLoss: number } {
  const nameById = new Map(reasons.map((r) => [r.id, r.name]));
  const acc = new Map<string, { count: number; loss: number; rec: number; net: number }>();
  for (const r of rows) {
    const key = r.reason_id ?? "__none__";
    const cur = acc.get(key) ?? { count: 0, loss: 0, rec: 0, net: 0 };
    cur.count += 1; cur.loss += Number(r.loss_amount || 0); cur.rec += Number(r.recoverable_amount || 0); cur.net += Number(r.net_loss_amount || 0);
    acc.set(key, cur);
  }
  const grandNetLoss = sumBy(rows, (r) => r.net_loss_amount);
  const out: ReasonSummaryRow[] = [...acc.entries()].map(([id, v]) => ({ id: id === "__none__" ? null : id, name: id === "__none__" ? "Unspecified" : nameById.get(id) ?? "Unknown", count: v.count, loss: v.loss, recoverable: v.rec, netLoss: v.net, percentage: pct(v.net, grandNetLoss) })).sort((a, b) => b.netLoss - a.netLoss);
  return { rows: out, grandNetLoss };
}
export interface TypeSummaryRow { id: string | null; name: string; count: number; value: number; percentage: number; }
export function buildTypeSummary(rows: DamageRecord[], types: DamageType[]): { rows: TypeSummaryRow[]; grandValue: number } {
  const nameById = new Map(types.map((t) => [t.id, t.name]));
  const acc = new Map<string, { count: number; value: number }>();
  for (const r of rows) {
    const key = r.type_id ?? "__none__";
    const cur = acc.get(key) ?? { count: 0, value: 0 };
    cur.count += 1; cur.value += Number(r.damage_value || 0); acc.set(key, cur);
  }
  const grandValue = sumBy(rows, (r) => r.damage_value);
  const out: TypeSummaryRow[] = [...acc.entries()].map(([id, v]) => ({ id: id === "__none__" ? null : id, name: id === "__none__" ? "Unspecified" : nameById.get(id) ?? "Unknown", count: v.count, value: v.value, percentage: pct(v.value, grandValue) })).sort((a, b) => b.value - a.value);
  return { rows: out, grandValue };
}
export interface MonthlyPoint { key: string; label: string; total: number; }
export function buildMonthly<T>(rows: T[], dateOf: (r: T) => string, valueOf: (r: T) => number): MonthlyPoint[] {
  const totals = new Map<string, number>();
  for (const r of rows) { const key = dateOf(r).slice(0, 7); totals.set(key, (totals.get(key) ?? 0) + Number(valueOf(r) || 0)); }
  return [...totals.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([key, total]) => ({ key, label: format(parseISO(`${key}-01`), "MMM yyyy"), total }));
}
export interface CombinedMonthly { key: string; label: string; returns: number; damages: number; total: number; }
export function buildCombinedMonthly(returns: ReturnRecord[], damages: DamageRecord[]): CombinedMonthly[] {
  const map = new Map<string, { returns: number; damages: number }>();
  for (const r of returns) { const k = r.return_date.slice(0, 7); const cur = map.get(k) ?? { returns: 0, damages: 0 }; cur.returns += Number(r.net_loss_amount || 0); map.set(k, cur); }
  for (const d of damages) { const k = d.damage_date.slice(0, 7); const cur = map.get(k) ?? { returns: 0, damages: 0 }; cur.damages += Number(d.damage_value || 0); map.set(k, cur); }
  return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([key, v]) => ({ key, label: format(parseISO(`${key}-01`), "MMM yyyy"), returns: v.returns, damages: v.damages, total: v.returns + v.damages }));
}
export function formatTk(amount: number): string {
  return `\u09F3 ${new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(amount || 0)}`;
}

/* ---------------- Mutations (reuse approval / audit / numbering) ---------------- */

export interface ReturnInput {
  return_date: string; category_id: string | null; reason_id: string | null; product_name: string;
  quantity: number; customer_notes: string | null; loss_amount: number; recoverable_amount: number; notes: string | null; status: ExpenseStatus;
}
export async function createReturn(input: ReturnInput, userId: string): Promise<{ id: string; return_number: string }> {
  const finalStatus = input.status === "submitted" ? "pending_approval" : input.status;
  const { data, error } = await db.from("returns").insert({
    return_number: "", return_date: input.return_date, category_id: input.category_id, reason_id: input.reason_id,
    product_name: input.product_name, quantity: input.quantity, customer_notes: input.customer_notes,
    loss_amount: input.loss_amount, recoverable_amount: input.recoverable_amount, notes: input.notes,
    status: finalStatus, created_by: userId,
  }).select("id, return_number").single();
  if (error || !data) throw error ?? new Error("Failed to create return.");
  try {
    await logReturnEvent({ returnId: data.id, actorId: userId, action: "created", toStatus: finalStatus });
    if (finalStatus !== "draft") await logReturnEvent({ returnId: data.id, actorId: userId, action: "submitted", fromStatus: "draft", toStatus: finalStatus });
  } catch { /* best-effort history */ }
  return data as { id: string; return_number: string };
}
export async function updateReturn(id: string, patch: Partial<ReturnInput>): Promise<void> {
  const { error } = await db.from("returns").update(patch).eq("id", id);
  if (error) throw error;
}
export interface DamageInput {
  damage_date: string; type_id: string | null; product_name: string; quantity: number; damage_value: number; notes: string | null; status: ExpenseStatus;
}
export async function createDamage(input: DamageInput, userId: string): Promise<{ id: string; damage_number: string }> {
  const finalStatus = input.status === "submitted" ? "pending_approval" : input.status;
  const { data, error } = await db.from("damages").insert({
    damage_number: "", damage_date: input.damage_date, type_id: input.type_id, product_name: input.product_name,
    quantity: input.quantity, damage_value: input.damage_value, notes: input.notes, status: finalStatus, created_by: userId,
  }).select("id, damage_number").single();
  if (error || !data) throw error ?? new Error("Failed to create damage.");
  try {
    await logDamageEvent({ damageId: data.id, actorId: userId, action: "created", toStatus: finalStatus });
    if (finalStatus !== "draft") await logDamageEvent({ damageId: data.id, actorId: userId, action: "submitted", fromStatus: "draft", toStatus: finalStatus });
  } catch { /* best-effort history */ }
  return data as { id: string; damage_number: string };
}
export async function updateDamage(id: string, patch: Partial<DamageInput>): Promise<void> {
  const { error } = await db.from("damages").update(patch).eq("id", id);
  if (error) throw error;
}
export async function setLossStatus(kind: LossKind, id: string, status: ExpenseStatus, userId: string, fromStatus: ExpenseStatus): Promise<void> {
  const table = kind === "return" ? "returns" : "damages";
  const { error } = await db.from(table).update({ status }).eq("id", id);
  if (error) throw error;
  try {
    const payload = { actorId: userId, action: status === "deleted" ? "deleted" : "updated", fromStatus, toStatus: status };
    if (kind === "return") await logReturnEvent({ returnId: id, ...payload });
    else await logDamageEvent({ damageId: id, ...payload });
  } catch { /* best-effort history */ }
}
export async function addReturnAttachment(returnId: string, v: { path: string; name: string; mime: string; size: number }, userId: string): Promise<void> {
  const { error } = await db.from("return_attachments").insert({ return_id: returnId, file_path: v.path, file_name: v.name, mime_type: v.mime, size_bytes: v.size, created_by: userId });
  if (error) throw error;
}
export async function addDamageAttachment(damageId: string, v: { path: string; name: string; mime: string; size: number }, userId: string): Promise<void> {
  const { error } = await db.from("damage_attachments").insert({ damage_id: damageId, file_path: v.path, file_name: v.name, mime_type: v.mime, size_bytes: v.size, created_by: userId });
  if (error) throw error;
}
export async function deleteLossAttachment(kind: LossKind, id: string): Promise<void> {
  const table = kind === "return" ? "return_attachments" : "damage_attachments";
  const { error } = await db.from(table).delete().eq("id", id);
  if (error) throw error;
}
export async function postLossComment(kind: LossKind, id: string, userId: string, body: string): Promise<void> {
  if (kind === "return") await logReturnEvent({ returnId: id, actorId: userId, action: "comment", notes: body });
  else await logDamageEvent({ damageId: id, actorId: userId, action: "comment", notes: body });
}
