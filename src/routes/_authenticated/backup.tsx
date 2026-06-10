import { createFileRoute } from '@tanstack/react-router'
import { createFileRoute } from "@/lib/router";
import { useMemo, useRef, useState } from "react";
import {
  Database,
  HardDrive,
  ShieldCheck,
  History,
  FileBarChart,
  Download,
  AlertTriangle,
  Loader2,
  Upload,
  CheckCircle2,
  XCircle,
  RotateCcw,
  CalendarRange,
  type LucideIcon,
} from "lucide-react";
import { toast } from "sonner";

import { PageHeader } from "@/components/PageHeader";
import { NoAccess } from "@/components/NoAccess";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { useAuth } from "@/lib/auth-context";
import { logActivity } from "@/lib/audit";
import {
  BACKUP_RANGE_PRESETS,
  BACKUP_TABLES_TOTAL,
  downloadBackup,
  generateBackup,
  marketingCount,
  parseBackup,
  resolveBackupRange,
  restoreBackup,
  type BackupDocument,
  type BackupProgress,
  type BackupRangePreset,
  type ParsedBackup,
  type RestoreMode,
  type RestoreResult,
} from "@/lib/backup";

export const Route = createFileRoute("/_authenticated/backup")({
  head: () => ({ meta: [{ title: "Backup & Recovery — Motion IT BD" }] }),
  component: BackupPage,
});

interface DataArea {
  icon: LucideIcon;
  label: string;
  detail: string;
}

const CRITICAL_AREAS: DataArea[] = [
  { icon: Database, label: "Financial records", detail: "Expenses, marketing costs, returns and damages — the core ledger." },
  { icon: ShieldCheck, label: "Users, roles & permissions", detail: "Accounts, role assignments and module-level access rules." },
  { icon: History, label: "Audit trail & history", detail: "Activity logs, field-level change history and approval events." },
  { icon: FileBarChart, label: "Reports & export history", detail: "Generated report records, numbering counters and metadata." },
  { icon: HardDrive, label: "Attachments & branding assets", detail: "Receipts, logos and signatures stored in secure buckets." },
];

const RECOVERY_STEPS: string[] = [
  "Identify the affected area and the approximate time the issue began.",
  "Stop further edits to prevent overwriting recoverable data.",
  "Use the Recycle Bin to restore soft-deleted expenses, returns and damages — these are never permanently removed by normal deletes.",
  "Cross-check the Audit & History logs to confirm what changed and who made the change.",
  "For data loss beyond soft-deletes, request a point-in-time database restore from your platform administrator.",
  "After recovery, re-run the System Readiness checklist to confirm configuration is intact.",
];

const RECOMMENDATIONS: string[] = [
  "Export key reports to PDF at the end of each month and archive them off-platform.",
  "Keep at least one additional admin account so access is never lost.",
  "Review the Audit & History logs weekly for unexpected changes.",
  "Treat the Recycle Bin as the first line of recovery before escalating.",
  "Document who holds platform-level (database) restore access within your organisation.",
];

function BackupPage() {
  const { isAdmin, user } = useAuth();

  if (!isAdmin) {
    return (
      <div className="space-y-6">
        <PageHeader title="Backup & Recovery" description="Admin-only operational guidance." />
        <NoAccess />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Backup & Recovery"
        description="Generate full system backups, restore from a backup file, and review recovery guidance."
      />

      <Tabs defaultValue="backup" className="space-y-6">
        <TabsList>
          <TabsTrigger value="backup">Backup</TabsTrigger>
          <TabsTrigger value="restore">Restore</TabsTrigger>
          <TabsTrigger value="guidance">Guidance</TabsTrigger>
        </TabsList>

        <TabsContent value="backup" className="space-y-6">
          <BackupPanel actor={{ id: user?.id ?? null, email: user?.email ?? null }} />
        </TabsContent>

        <TabsContent value="restore" className="space-y-6">
          <RestorePanel />
        </TabsContent>

        <TabsContent value="guidance" className="space-y-6">
          <GuidancePanel />
        </TabsContent>
      </Tabs>
    </div>
  );
}

/* --------------------------------- Backup -------------------------------- */

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function BackupPanel({ actor }: { actor: { id: string | null; email: string | null } }) {
  const [preset, setPreset] = useState<BackupRangePreset>("all");
  const [from, setFrom] = useState(todayISO());
  const [to, setTo] = useState(todayISO());
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState<BackupProgress[]>([]);
  const [lastFile, setLastFile] = useState<string | null>(null);

  const pct = BACKUP_TABLES_TOTAL > 0 ? Math.round((progress.length / BACKUP_TABLES_TOTAL) * 100) : 0;

  async function handleBackup() {
    if (preset === "custom" && (!from || !to)) {
      toast.error("Please choose both a start and end date.");
      return;
    }
    setRunning(true);
    setProgress([]);
    setLastFile(null);
    try {
      const range = resolveBackupRange(preset, { from, to });
      const { doc, progress: prog } = await generateBackup(preset, range, actor, (p) =>
        setProgress((cur) => [...cur, p]),
      );
      const total = prog.reduce((acc, p) => acc + p.count, 0);
      const filename = downloadBackup(doc);
      setLastFile(filename);
      await logActivity({
        action: "export",
        entityType: "report",
        entityLabel: `Backup ${filename}`,
        metadata: { rows: total, range, preset },
      });
      const failed = prog.filter((p) => !p.ok);
      if (failed.length) {
        toast.warning(`Backup created with ${failed.length} table(s) skipped.`);
      } else {
        toast.success(`Backup created — ${total.toLocaleString()} records.`);
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Backup failed.");
    } finally {
      setRunning(false);
    }
  }

  const totalRows = progress.reduce((acc, p) => acc + p.count, 0);

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Download className="h-4 w-4 text-brand" />
            Full system backup
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <p className="text-sm text-muted-foreground">
            Choose a period, then download a complete JSON backup of expenses, marketing, returns,
            damages, categories, users, roles, notifications, reports, company profile, signatories
            and audit logs. Reference data (users, roles, categories, settings) is always included
            in full so the backup can be restored standalone.
          </p>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label className="flex items-center gap-2 text-sm">
                <CalendarRange className="h-4 w-4 text-muted-foreground" /> Period
              </Label>
              <Select value={preset} onValueChange={(v) => setPreset(v as BackupRangePreset)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {BACKUP_RANGE_PRESETS.map((p) => (
                    <SelectItem key={p.value} value={p.value}>
                      {p.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {preset === "custom" && (
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="bk-from" className="text-sm">From</Label>
                  <Input id="bk-from" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="bk-to" className="text-sm">To</Label>
                  <Input id="bk-to" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
                </div>
              </div>
            )}
          </div>

          <Button onClick={handleBackup} disabled={running}>
            {running ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
            {running ? "Generating backup…" : "Generate & download backup"}
          </Button>

          {running && <Progress value={pct} className="h-2" />}

          {progress.length > 0 && (
            <div className="space-y-2 rounded-md border border-border p-3">
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium text-foreground">
                  {lastFile ? "Backup complete" : "Collecting data…"}
                </span>
                <span className="text-muted-foreground">{totalRows.toLocaleString()} records</span>
              </div>
              <div className="grid gap-1.5 sm:grid-cols-2">
                {progress.map((p) => (
                  <div key={p.table} className="flex items-center justify-between text-xs">
                    <span className="flex items-center gap-1.5 text-muted-foreground">
                      {p.ok ? (
                        <CheckCircle2 className="h-3.5 w-3.5 text-success" />
                      ) : (
                        <XCircle className="h-3.5 w-3.5 text-destructive" />
                      )}
                      {p.label}
                    </span>
                    <span className="text-foreground">{p.ok ? p.count.toLocaleString() : "skipped"}</span>
                  </div>
                ))}
              </div>
              {lastFile && (
                <p className="pt-1 text-xs text-muted-foreground">
                  Saved as <span className="font-medium text-foreground">{lastFile}</span>
                </p>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </>
  );
}

/* --------------------------------- Restore ------------------------------- */

function RestorePanel() {
  const fileRef = useRef<HTMLInputElement>(null);
  const [parsed, setParsed] = useState<ParsedBackup | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [mode, setMode] = useState<RestoreMode>("merge");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [running, setRunning] = useState(false);
  const [results, setResults] = useState<RestoreResult[] | null>(null);

  const marketing = useMemo(() => (parsed ? marketingCount(parsed.doc) : 0), [parsed]);

  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setResults(null);
    setParsed(null);
    setFileName(file.name);
    try {
      const text = await file.text();
      const p = parseBackup(text);
      setParsed(p);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not read backup file.");
      setFileName(null);
    } finally {
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function doRestore(doc: BackupDocument) {
    setConfirmOpen(false);
    setRunning(true);
    setResults(null);
    try {
      const res = await restoreBackup(doc, mode, () => {});
      setResults(res);
      const restored = res.reduce((acc, r) => acc + r.restored, 0);
      const failed = res.filter((r) => !r.ok);
      await logActivity({
        action: "restore",
        entityType: "report",
        entityLabel: `Restore (${mode})`,
        metadata: { restored, mode, failed: failed.length, file: fileName },
      });
      if (failed.length) {
        toast.warning(`Restore finished with ${failed.length} table(s) reporting issues.`);
      } else {
        toast.success(`Restore complete — ${restored.toLocaleString()} records applied.`);
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Restore failed.");
    } finally {
      setRunning(false);
    }
  }

  return (
    <>
      <Card className="border-warning/40 bg-warning/5">
        <CardContent className="flex items-start gap-3 py-4">
          <AlertTriangle className="h-5 w-5 shrink-0 text-warning" />
          <p className="text-sm text-muted-foreground">
            Restore re-applies data from a backup file. <strong className="text-foreground">Merge</strong>{" "}
            keeps existing records and updates matches; <strong className="text-foreground">Replace</strong>{" "}
            clears each table first. User accounts and roles are always merged (never deleted) to
            avoid losing access. This action is logged in the audit trail.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Upload className="h-4 w-4 text-brand" />
            Restore from backup
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <div>
            <input
              ref={fileRef}
              type="file"
              accept="application/json,.json"
              className="hidden"
              onChange={onPick}
            />
            <Button variant="outline" onClick={() => fileRef.current?.click()} disabled={running}>
              <Upload className="h-4 w-4" />
              {fileName ? "Choose a different file" : "Select backup file"}
            </Button>
            {fileName && <span className="ml-3 text-sm text-muted-foreground">{fileName}</span>}
          </div>

          {parsed && (
            <>
              <div className="space-y-2 rounded-md border border-border p-3">
                <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                  <span className="font-medium text-foreground">Backup preview</span>
                  <span className="text-muted-foreground">
                    {parsed.totalRows.toLocaleString()} records ·{" "}
                    {new Date(parsed.doc.meta.generatedAt).toLocaleString()}
                  </span>
                </div>
                <div className="grid gap-1.5 sm:grid-cols-2">
                  {parsed.summary.map((s) => (
                    <div key={s.key} className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">
                        {s.label}
                        {s.key === "expenses" && marketing > 0 && (
                          <span className="ml-1 text-muted-foreground/70">(incl. {marketing} marketing)</span>
                        )}
                      </span>
                      <Badge variant="secondary" className="font-normal">{s.count.toLocaleString()}</Badge>
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-3">
                <Label className="text-sm">Restore mode</Label>
                <RadioGroup value={mode} onValueChange={(v) => setMode(v as RestoreMode)} className="grid gap-3 sm:grid-cols-2">
                  <label htmlFor="m-merge" className="flex cursor-pointer items-start gap-3 rounded-md border border-border p-3 has-[:checked]:border-brand has-[:checked]:bg-brand-gradient-soft">
                    <RadioGroupItem id="m-merge" value="merge" className="mt-0.5" />
                    <span>
                      <span className="block text-sm font-medium text-foreground">Merge data</span>
                      <span className="block text-xs text-muted-foreground">Add new and update existing records. Keeps current data.</span>
                    </span>
                  </label>
                  <label htmlFor="m-replace" className="flex cursor-pointer items-start gap-3 rounded-md border border-border p-3 has-[:checked]:border-destructive has-[:checked]:bg-destructive/5">
                    <RadioGroupItem id="m-replace" value="replace" className="mt-0.5" />
                    <span>
                      <span className="block text-sm font-medium text-foreground">Replace existing data</span>
                      <span className="block text-xs text-muted-foreground">Clear tables first, then insert. Destructive.</span>
                    </span>
                  </label>
                </RadioGroup>
              </div>

              <Button
                variant={mode === "replace" ? "destructive" : "default"}
                onClick={() => setConfirmOpen(true)}
                disabled={running}
              >
                {running ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCcw className="h-4 w-4" />}
                {running ? "Restoring…" : `Restore (${mode})`}
              </Button>
            </>
          )}

          {results && (
            <div className="space-y-2 rounded-md border border-border p-3">
              <p className="text-sm font-medium text-foreground">Restore results</p>
              <div className="grid gap-1.5 sm:grid-cols-2">
                {results
                  .filter((r) => r.attempted > 0)
                  .map((r) => (
                    <div key={r.table} className="flex items-center justify-between text-xs">
                      <span className="flex items-center gap-1.5 text-muted-foreground">
                        {r.ok ? (
                          <CheckCircle2 className="h-3.5 w-3.5 text-success" />
                        ) : (
                          <XCircle className="h-3.5 w-3.5 text-destructive" />
                        )}
                        {r.label}
                      </span>
                      <span className="text-foreground">
                        {r.restored}/{r.attempted}
                      </span>
                    </div>
                  ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {mode === "replace" ? "Replace existing data?" : "Merge backup data?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {mode === "replace"
                ? "This will clear the affected tables and insert the records from the backup. Existing data not in the backup will be lost (user accounts and roles are preserved). This cannot be undone."
                : "This will add new records and update existing ones from the backup file. Current data is preserved."}
              {" "}The action will be recorded in the audit trail.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className={mode === "replace" ? "bg-destructive text-destructive-foreground hover:bg-destructive/90" : ""}
              onClick={() => parsed && doRestore(parsed.doc)}
            >
              {mode === "replace" ? "Replace data" : "Merge data"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

/* -------------------------------- Guidance ------------------------------- */

function GuidancePanel() {
  return (
    <>
      <Card className="border-warning/40 bg-warning/5">
        <CardContent className="flex items-start gap-3 py-4">
          <AlertTriangle className="h-5 w-5 shrink-0 text-warning" />
          <p className="text-sm text-muted-foreground">
            The managed database is also backed up automatically at the platform level. The backups
            on this page are exportable JSON snapshots you control directly.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Critical data areas</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2">
          {CRITICAL_AREAS.map((a) => (
            <div key={a.label} className="flex items-start gap-3 rounded-md border border-border p-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-brand-gradient-soft text-brand">
                <a.icon className="h-4 w-4" />
              </span>
              <div>
                <p className="text-sm font-medium text-foreground">{a.label}</p>
                <p className="text-xs text-muted-foreground">{a.detail}</p>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Recovery process</CardTitle>
        </CardHeader>
        <CardContent>
          <ol className="space-y-3">
            {RECOVERY_STEPS.map((step, i) => (
              <li key={i} className="flex gap-3 text-sm text-muted-foreground">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-gradient-soft text-xs font-semibold text-brand">
                  {i + 1}
                </span>
                <span className="pt-0.5">{step}</span>
              </li>
            ))}
          </ol>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Download className="h-4 w-4 text-brand" />
            Backup recommendations
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2">
            {RECOMMENDATIONS.map((r, i) => (
              <li key={i} className="flex gap-2 text-sm text-muted-foreground">
                <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-brand" />
                <span>{r}</span>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </>
  );
}