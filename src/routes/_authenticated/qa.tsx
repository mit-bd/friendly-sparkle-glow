import { createFileRoute } from '@tanstack/react-router'
import { useMemo, useState } from "react";
import { createFileRoute } from "@/lib/router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ClipboardCheck,
  CheckCircle2,
  AlertTriangle,
  Bug,
  Clock,
  Plus,
  Pencil,
  Trash2,
  Loader2,
  RefreshCw,
  ListChecks,
  type LucideIcon,
} from "lucide-react";
import { toast } from "sonner";

import { PageHeader } from "@/components/PageHeader";
import { NoAccess } from "@/components/NoAccess";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useAuth } from "@/lib/auth-context";
import { cn } from "@/lib/utils";
import {
  QA_AREA_LABELS,
  QA_MODULES,
  QA_SEVERITY_LABELS,
  QA_SEVERITY_TONE,
  QA_STATUS_LABELS,
  QA_STATUS_TONE,
  createQaItem,
  deleteQaItem,
  fetchQaItems,
  qaModuleLabel,
  seedQaChecklist,
  summarise,
  updateQaItem,
  type QaArea,
  type QaItem,
  type QaItemInput,
  type QaSeverity,
  type QaStatus,
} from "@/lib/qa";

export const Route = createFileRoute("/_authenticated/qa")({
  head: () => ({ meta: [{ title: "QA Validation — Motion IT BD" }] }),
  component: QaPage,
});

const STATUS_OPTIONS: QaStatus[] = ["pending", "tested", "issue", "resolved"];
const SEVERITY_OPTIONS: QaSeverity[] = ["low", "medium", "high", "critical"];
const AREA_OPTIONS = Object.keys(QA_AREA_LABELS) as QaArea[];

const EMPTY_FORM: QaItemInput = {
  title: "",
  module: "general",
  area: "functionality",
  status: "pending",
  severity: "medium",
  notes: "",
};

function QaPage() {
  const { isAdmin, user } = useAuth();
  const qc = useQueryClient();

  const { data, isLoading, isFetching, refetch } = useQuery({
    queryKey: ["qa-items"],
    queryFn: fetchQaItems,
    enabled: isAdmin,
    staleTime: 15_000,
  });

  const [statusFilter, setStatusFilter] = useState<QaStatus | "all">("all");
  const [moduleFilter, setModuleFilter] = useState<string>("all");
  const [search, setSearch] = useState("");

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<QaItem | null>(null);
  const [form, setForm] = useState<QaItemInput>(EMPTY_FORM);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const items = useMemo(() => data ?? [], [data]);
  const summary = useMemo(() => summarise(items), [items]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items.filter((i) => {
      if (statusFilter !== "all" && i.status !== statusFilter) return false;
      if (moduleFilter !== "all" && i.module !== moduleFilter) return false;
      if (q && !i.title.toLowerCase().includes(q) && !(i.notes ?? "").toLowerCase().includes(q))
        return false;
      return true;
    });
  }, [items, statusFilter, moduleFilter, search]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!form.title.trim()) throw new Error("A title is required.");
      if (editing) await updateQaItem(editing.id, form, user?.id ?? null);
      else await createQaItem(form, user?.id ?? null);
    },
    onSuccess: () => {
      toast.success(editing ? "Checklist item updated." : "Checklist item added.");
      setDialogOpen(false);
      setEditing(null);
      setForm(EMPTY_FORM);
      qc.invalidateQueries({ queryKey: ["qa-items"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Save failed."),
  });

  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: QaStatus }) =>
      updateQaItem(id, { status }, user?.id ?? null),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["qa-items"] }),
    onError: (e) => toast.error(e instanceof Error ? e.message : "Update failed."),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteQaItem(id),
    onSuccess: () => {
      toast.success("Checklist item removed.");
      setDeleteId(null);
      qc.invalidateQueries({ queryKey: ["qa-items"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Delete failed."),
  });

  const seedMutation = useMutation({
    mutationFn: () => seedQaChecklist(user?.id ?? null),
    onSuccess: (n) => {
      toast.success(`Seeded ${n} default validation items.`);
      qc.invalidateQueries({ queryKey: ["qa-items"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Seeding failed."),
  });

  if (!isAdmin) {
    return (
      <div className="space-y-6">
        <PageHeader title="QA Validation" description="Admin-only business validation checklist." />
        <NoAccess />
      </div>
    );
  }

  const openAdd = () => {
    setEditing(null);
    setForm(EMPTY_FORM);
    setDialogOpen(true);
  };

  const openEdit = (item: QaItem) => {
    setEditing(item);
    setForm({
      title: item.title,
      module: item.module,
      area: item.area,
      status: item.status,
      severity: item.severity,
      notes: item.notes ?? "",
    });
    setDialogOpen(true);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="QA Validation"
        description="Business Validation Mode — track tested features, found issues, and resolutions."
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
              {isFetching ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              Refresh
            </Button>
            <Button size="sm" onClick={openAdd}>
              <Plus className="h-4 w-4" />
              Add Item
            </Button>
          </div>
        }
      />

      {isLoading ? (
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-24 w-full" />
            ))}
          </div>
          <Skeleton className="h-72 w-full" />
        </div>
      ) : items.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-4 py-14 text-center">
            <span className="flex h-12 w-12 items-center justify-center rounded-md bg-brand-gradient-soft text-brand">
              <ListChecks className="h-6 w-6" />
            </span>
            <div>
              <p className="font-medium text-foreground">No validation items yet</p>
              <p className="text-sm text-muted-foreground">
                Start the production validation pass with a default checklist, or add your own items.
              </p>
            </div>
            <div className="flex gap-2">
              <Button onClick={() => seedMutation.mutate()} disabled={seedMutation.isPending}>
                {seedMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <ClipboardCheck className="h-4 w-4" />}
                Generate default checklist
              </Button>
              <Button variant="outline" onClick={openAdd}>
                <Plus className="h-4 w-4" />
                Add item
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <>
          <SummaryGrid
            items={[
              { key: "tested", label: "Tested Features", value: summary.tested, icon: CheckCircle2, tone: "text-chart-2" },
              { key: "issue", label: "Found Issues", value: summary.issues, icon: Bug, tone: "text-destructive" },
              { key: "resolved", label: "Resolved Issues", value: summary.resolved, icon: AlertTriangle, tone: "text-success" },
              { key: "pending", label: "Pending Items", value: summary.pending, icon: Clock, tone: "text-muted-foreground" },
            ]}
          />

          <Card>
            <CardContent className="flex flex-col gap-4 py-5 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-3">
                <span className="flex h-11 w-11 items-center justify-center rounded-md bg-brand-gradient-soft text-brand">
                  <ClipboardCheck className="h-5 w-5" />
                </span>
                <div>
                  <p className="text-sm font-medium text-foreground">Validation progress</p>
                  <p className="text-xs text-muted-foreground">
                    {summary.tested + summary.resolved} of {summary.total} items validated · {summary.openIssues} open issue(s).
                  </p>
                </div>
              </div>
              <div className="w-full sm:w-64">
                <div className="mb-1 flex items-center justify-between text-xs text-muted-foreground">
                  <span>Complete</span>
                  <span>{summary.progress}%</span>
                </div>
                <Progress value={summary.progress} />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="gap-3">
              <CardTitle className="text-base">Validation checklist</CardTitle>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <Input
                  placeholder="Search items…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="sm:max-w-xs"
                />
                <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as QaStatus | "all")}>
                  <SelectTrigger className="sm:w-44">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All statuses</SelectItem>
                    {STATUS_OPTIONS.map((s) => (
                      <SelectItem key={s} value={s}>
                        {QA_STATUS_LABELS[s]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={moduleFilter} onValueChange={setModuleFilter}>
                  <SelectTrigger className="sm:w-48">
                    <SelectValue placeholder="Module" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All modules</SelectItem>
                    {QA_MODULES.map((m) => (
                      <SelectItem key={m.key} value={m.key}>
                        {m.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Item</TableHead>
                      <TableHead className="hidden md:table-cell">Module</TableHead>
                      <TableHead className="hidden lg:table-cell">Area</TableHead>
                      <TableHead className="hidden sm:table-cell">Severity</TableHead>
                      <TableHead className="w-40">Status</TableHead>
                      <TableHead className="w-20 text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="py-10 text-center text-sm text-muted-foreground">
                          No items match the current filters.
                        </TableCell>
                      </TableRow>
                    ) : (
                      filtered.map((item) => (
                        <TableRow key={item.id}>
                          <TableCell className="max-w-xs">
                            <p className="font-medium text-foreground">{item.title}</p>
                            {item.notes && (
                              <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{item.notes}</p>
                            )}
                            <p className="mt-1 text-xs text-muted-foreground md:hidden">{qaModuleLabel(item.module)}</p>
                          </TableCell>
                          <TableCell className="hidden md:table-cell text-sm text-muted-foreground">
                            {qaModuleLabel(item.module)}
                          </TableCell>
                          <TableCell className="hidden lg:table-cell text-sm text-muted-foreground">
                            {QA_AREA_LABELS[item.area]}
                          </TableCell>
                          <TableCell className="hidden sm:table-cell">
                            <Badge variant="outline" className={cn("text-xs font-medium", QA_SEVERITY_TONE[item.severity])}>
                              {QA_SEVERITY_LABELS[item.severity]}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Select
                              value={item.status}
                              onValueChange={(v) => statusMutation.mutate({ id: item.id, status: v as QaStatus })}
                            >
                              <SelectTrigger className={cn("h-8 w-36 border-0 text-xs font-medium", QA_STATUS_TONE[item.status])}>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {STATUS_OPTIONS.map((s) => (
                                  <SelectItem key={s} value={s}>
                                    {QA_STATUS_LABELS[s]}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-1">
                              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(item)}>
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-destructive hover:text-destructive"
                                onClick={() => setDeleteId(item.id)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit checklist item" : "Add checklist item"}</DialogTitle>
            <DialogDescription>Track a feature or issue in the production validation pass.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="qa-title">Title</Label>
              <Input
                id="qa-title"
                value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                placeholder="e.g. Approved-only totals on dashboard"
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Module</Label>
                <Select value={form.module} onValueChange={(v) => setForm((f) => ({ ...f, module: v }))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {QA_MODULES.map((m) => (
                      <SelectItem key={m.key} value={m.key}>
                        {m.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Validation area</Label>
                <Select value={form.area} onValueChange={(v) => setForm((f) => ({ ...f, area: v as QaArea }))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {AREA_OPTIONS.map((a) => (
                      <SelectItem key={a} value={a}>
                        {QA_AREA_LABELS[a]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Status</Label>
                <Select value={form.status} onValueChange={(v) => setForm((f) => ({ ...f, status: v as QaStatus }))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {STATUS_OPTIONS.map((s) => (
                      <SelectItem key={s} value={s}>
                        {QA_STATUS_LABELS[s]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Severity</Label>
                <Select value={form.severity} onValueChange={(v) => setForm((f) => ({ ...f, severity: v as QaSeverity }))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SEVERITY_OPTIONS.map((s) => (
                      <SelectItem key={s} value={s}>
                        {QA_SEVERITY_LABELS[s]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="qa-notes">Notes</Label>
              <Textarea
                id="qa-notes"
                value={form.notes ?? ""}
                onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                placeholder="Findings, reproduction steps, or resolution detail…"
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
              {saveMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              {editing ? "Save changes" : "Add item"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteId !== null} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove checklist item?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently removes the validation item. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteId && deleteMutation.mutate(deleteId)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

interface SummaryCard {
  key: string;
  label: string;
  value: number;
  icon: LucideIcon;
  tone: string;
}

function SummaryGrid({ items }: { items: SummaryCard[] }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {items.map((c) => (
        <Card key={c.key}>
          <CardContent className="flex items-center gap-3 py-4">
            <span className={cn("flex h-10 w-10 items-center justify-center rounded-md bg-muted", c.tone)}>
              <c.icon className="h-5 w-5" />
            </span>
            <div>
              <p className="text-2xl font-bold tabular-nums text-foreground">{c.value}</p>
              <p className="text-xs text-muted-foreground">{c.label}</p>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}