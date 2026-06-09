import { useEffect, useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Plus, Search, Loader2, Wallet, AlertTriangle, CalendarClock, FileBarChart, Filter } from "lucide-react";
import { toast } from "sonner";

import { PageHeader } from "@/components/PageHeader";
import { NoAccess } from "@/components/NoAccess";
import { StatusBadge } from "@/components/StatusBadge";
import { SettlementBadge } from "@/components/finance/SettlementBadge";
import { EmptyState } from "@/components/analytics/EmptyState";
import { DateRangeFilter } from "@/components/analytics/DateRangeFilter";
import { AttachmentUploader, type AttachmentValue } from "@/components/AttachmentUploader";
import { FinanceFields, emptyFinanceForm, type FinanceFormValues } from "@/components/finance/FinanceFields";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useAuth } from "@/lib/auth-context";
import { DEFAULT_PRESET, resolveRange, type DateRange, type RangePreset } from "@/lib/analytics";
import { fetchUserNames, formatDate } from "@/lib/expenses";
import {
  addAttachment, addCollection, addPayment, asExpenseStatus, buildSnapshot, createPayable, createReceivable,
  fetchPayables, fetchReceivables, formatTk, partyTypeLabel, PAYABLE_PARTY_TYPES, RECEIVABLE_PARTY_TYPES,
  type FinanceKind, type Payable, type Receivable,
} from "@/lib/finance";

type Row = (Receivable | Payable) & { number: string; settled: number };

function normalize(kind: FinanceKind, rows: (Receivable | Payable)[]): Row[] {
  return rows.map((r) =>
    kind === "receivable"
      ? { ...(r as Receivable), number: (r as Receivable).receivable_number, settled: (r as Receivable).collected_amount }
      : { ...(r as Payable), number: (r as Payable).payable_number, settled: (r as Payable).paid_amount },
  );
}

export function FinanceListView({ kind }: { kind: FinanceKind }) {
  const { canAccessModule, can, isAdmin, user, profile } = useAuth();
  const title = kind === "receivable" ? "Receivables" : "Payables";
  const canCreate = isAdmin || can("finance", "edit");

  const [rows, setRows] = useState<Row[]>([]);
  const [names, setNames] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [addOpen, setAddOpen] = useState(false);

  // filters
  const [searchText, setSearchText] = useState("");
  const [settlement, setSettlement] = useState("all");
  const [approval, setApproval] = useState("all");
  const [partyType, setPartyType] = useState("all");
  const [preset, setPreset] = useState<RangePreset>("this_year");
  const [range, setRange] = useState<DateRange>(resolveRange("this_year"));
  const [minAmount, setMinAmount] = useState("");
  const [maxAmount, setMaxAmount] = useState("");
  const [showFilters, setShowFilters] = useState(false);

  const load = () => {
    setLoading(true);
    const fetcher = kind === "receivable" ? fetchReceivables() : fetchPayables();
    fetcher
      .then(async (data) => {
        const norm = normalize(kind, data);
        setRows(norm);
        setNames(await fetchUserNames(norm.map((r) => r.created_by ?? "").filter(Boolean)));
      })
      .catch((e) => toast.error(e instanceof Error ? e.message : `Failed to load ${title.toLowerCase()}.`))
      .finally(() => setLoading(false));
  };
  useEffect(load, [kind]);

  const snapshot = useMemo(
    () => buildSnapshot(kind === "receivable" ? (rows as Receivable[]) : [], kind === "payable" ? (rows as Payable[]) : []),
    [rows, kind],
  );
  const outstanding = kind === "receivable" ? snapshot.totalReceivable : snapshot.totalPayable;
  const overdue = kind === "receivable" ? snapshot.overdueReceivable : snapshot.overduePayable;

  const filtered = useMemo(() => {
    const q = searchText.trim().toLowerCase();
    const min = minAmount ? Number(minAmount) : null;
    const max = maxAmount ? Number(maxAmount) : null;
    return rows.filter((r) => {
      if (q && ![r.number, r.party_name, r.reference_number ?? "", r.contact_person ?? ""].join(" ").toLowerCase().includes(q)) return false;
      if (settlement !== "all" && r.status !== settlement) return false;
      if (approval !== "all" && r.approval_status !== approval) return false;
      if (partyType !== "all" && r.party_type !== partyType) return false;
      if (min !== null && r.amount < min) return false;
      if (max !== null && r.amount > max) return false;
      const created = r.created_at.slice(0, 10);
      if (created < range.from || created > range.to) return false;
      return true;
    });
  }, [rows, searchText, settlement, approval, partyType, minAmount, maxAmount, range]);

  const partyTypes = kind === "receivable" ? RECEIVABLE_PARTY_TYPES : PAYABLE_PARTY_TYPES;
  const settlementOptions =
    kind === "receivable"
      ? ["pending", "partially_received", "received", "overdue", "cancelled"]
      : ["pending", "partially_paid", "paid", "overdue", "cancelled"];

  if (!canAccessModule("finance")) {
    return (<div className="space-y-8"><PageHeader title={title} /><NoAccess /></div>);
  }

  const detailTo = kind === "receivable" ? "/finance/receivables/$id" : "/finance/payables/$id";

  return (
    <div className="space-y-6">
      <PageHeader
        title={title}
        description={kind === "receivable" ? "Money owed to the company. Only approved receivables count toward totals." : "Money the company owes. Only approved payables count toward totals."}
        actions={
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" asChild><Link to="/finance/reports"><FileBarChart className="h-4 w-4" />Reports</Link></Button>
            {canCreate && <Button onClick={() => setAddOpen(true)}><Plus className="h-4 w-4" />Add {kind}</Button>}
          </div>
        }
      />

      {loading ? (
        <div className="grid gap-4 sm:grid-cols-3">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-28 rounded-lg" />)}</div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-3">
          <Metric icon={Wallet} label={`Outstanding ${title.toLowerCase()}`} value={formatTk(outstanding)} hint="Approved · unsettled balance" />
          <Metric icon={AlertTriangle} label="Overdue" value={formatTk(overdue)} hint="Past due date" />
          <Metric icon={CalendarClock} label="Records" value={String(rows.length)} hint="All non-deleted entries" />
        </div>
      )}

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0">
          <CardTitle className="text-base">All {title.toLowerCase()}</CardTitle>
          <Button variant="outline" size="sm" onClick={() => setShowFilters((s) => !s)}><Filter className="h-4 w-4" />Filters</Button>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={searchText} onChange={(e) => setSearchText(e.target.value)} placeholder="Search by number, party, reference, contact…" className="pl-9" />
          </div>
          {showFilters && (
            <div className="grid gap-3 rounded-lg border border-border bg-muted/30 p-3 sm:grid-cols-2 lg:grid-cols-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Settlement status</Label>
                <Select value={settlement} onValueChange={setSettlement}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All statuses</SelectItem>
                    {settlementOptions.map((s) => <SelectItem key={s} value={s}>{s.replace(/_/g, " ")}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Approval status</Label>
                <Select value={approval} onValueChange={setApproval}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All</SelectItem>
                    <SelectItem value="pending_approval">Pending Approval</SelectItem>
                    <SelectItem value="approved">Approved</SelectItem>
                    <SelectItem value="rejected">Rejected</SelectItem>
                    <SelectItem value="revision_requested">Revision Requested</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Party type</Label>
                <Select value={partyType} onValueChange={setPartyType}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All types</SelectItem>
                    {partyTypes.map((p) => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5 lg:col-span-2">
                <Label className="text-xs">Created date</Label>
                <DateRangeFilter preset={preset} range={range} onChange={(p, r) => { setPreset(p); setRange(r); }} />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1.5"><Label className="text-xs">Min amount</Label><Input type="number" value={minAmount} onChange={(e) => setMinAmount(e.target.value)} /></div>
                <div className="space-y-1.5"><Label className="text-xs">Max amount</Label><Input type="number" value={maxAmount} onChange={(e) => setMaxAmount(e.target.value)} /></div>
              </div>
            </div>
          )}

          {loading ? (
            <Skeleton className="h-64 w-full rounded-lg" />
          ) : filtered.length === 0 ? (
            <EmptyState icon={Wallet} title={`No ${title.toLowerCase()} found`} description="Adjust filters or add a new record." />
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>No.</TableHead>
                    <TableHead>Party</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead className="text-right">Due</TableHead>
                    <TableHead>Due date</TableHead>
                    <TableHead>Settlement</TableHead>
                    <TableHead>Approval</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="font-medium"><Link to={detailTo} params={{ id: r.id }} className="hover:text-brand-to hover:underline">{r.number}</Link></TableCell>
                      <TableCell className="max-w-[180px] truncate">{r.party_name}</TableCell>
                      <TableCell className="whitespace-nowrap text-muted-foreground">{partyTypeLabel(kind, r.party_type)}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatTk(r.amount)}</TableCell>
                      <TableCell className="text-right font-medium tabular-nums">{formatTk(r.due_amount)}</TableCell>
                      <TableCell className="whitespace-nowrap">{formatDate(r.due_date)}</TableCell>
                      <TableCell><SettlementBadge kind={kind} status={r.status} /></TableCell>
                      <TableCell><StatusBadge status={asExpenseStatus(r.approval_status)} /></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {canCreate && addOpen && (
        <AddFinanceDialog
          kind={kind}
          userId={user?.id ?? ""}
          createdByLabel={profile?.full_name?.trim() || user?.email || "—"}
          onClose={() => setAddOpen(false)}
          onSaved={() => { setAddOpen(false); load(); }}
        />
      )}
    </div>
  );
}

function Metric({ icon: Icon, label, value, hint }: { icon: typeof Wallet; label: string; value: string; hint: string }) {
  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex items-center justify-between">
          <p className="text-xs font-medium text-muted-foreground">{label}</p>
          <span className="flex h-8 w-8 items-center justify-center rounded-md bg-brand-gradient-soft text-brand"><Icon className="h-4 w-4" /></span>
        </div>
        <p className="mt-3 text-2xl font-semibold tabular-nums text-foreground">{value}</p>
        <p className="mt-1 truncate text-xs text-muted-foreground">{hint}</p>
      </CardContent>
    </Card>
  );
}

function AddFinanceDialog({ kind, userId, createdByLabel, onClose, onSaved }: { kind: FinanceKind; userId: string; createdByLabel: string; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState<FinanceFormValues>(emptyFinanceForm(kind));
  const [attachment, setAttachment] = useState<AttachmentValue | null>(null);
  const [saving, setSaving] = useState(false);
  const patch = (p: Partial<FinanceFormValues>) => setForm((f) => ({ ...f, ...p }));

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!form.party_name.trim()) { toast.error("Please enter a party name."); return; }
    const amount = Number(form.amount);
    if (!Number.isFinite(amount) || amount <= 0) { toast.error("Please enter a valid amount."); return; }
    const settled = Number(form.settled) || 0;
    if (settled < 0 || settled > amount) { toast.error("Settled amount must be between 0 and the total."); return; }
    setSaving(true);
    try {
      const base = {
        party_name: form.party_name.trim(),
        party_type: form.party_type,
        contact_person: form.contact_person.trim() || null,
        mobile: form.mobile.trim() || null,
        email: form.email.trim() || null,
        reference_number: form.reference_number.trim() || null,
        amount,
        due_date: form.due_date || null,
        notes: form.notes.trim() || null,
      };
      const created =
        kind === "receivable"
          ? await createReceivable({ ...base, collected_amount: settled }, userId)
          : await createPayable({ ...base, paid_amount: settled }, userId);
      if (attachment) {
        try { await addAttachment(kind, created.id, attachment, userId); }
        catch { toast.error("Record saved, but attachment failed."); }
      }
      const num = kind === "receivable" ? (created as Receivable).receivable_number : (created as Payable).payable_number;
      toast.success(`${num} created and sent for approval.`);
      onSaved();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create record.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader><DialogTitle>Add {kind}</DialogTitle></DialogHeader>
        <form onSubmit={save} className="space-y-5">
          <FinanceFields kind={kind} value={form} onChange={patch} />
          <div className="space-y-2">
            <Label>Attachment (invoice / bill / statement)</Label>
            <AttachmentUploader value={attachment} onChange={setAttachment} prefix={`${userId}/`} />
          </div>
          <p className="text-xs text-muted-foreground">Created by {createdByLabel}. New entries require approval before counting toward totals.</p>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={saving}>Cancel</Button>
            <Button type="submit" disabled={saving}>{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}Create</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}