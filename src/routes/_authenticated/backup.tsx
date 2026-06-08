import { createFileRoute } from "@tanstack/react-router";
import {
  Database,
  HardDrive,
  ShieldCheck,
  History,
  FileBarChart,
  Download,
  AlertTriangle,
  type LucideIcon,
} from "lucide-react";

import { PageHeader } from "@/components/PageHeader";
import { NoAccess } from "@/components/NoAccess";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/lib/auth-context";

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
  const { isAdmin } = useAuth();

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
        description="Operational guidance for protecting and recovering critical business data."
      />

      <Card className="border-amber-500/30 bg-amber-500/5">
        <CardContent className="flex items-start gap-3 py-4">
          <AlertTriangle className="h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400" />
          <p className="text-sm text-muted-foreground">
            The managed database is backed up automatically at the platform level. This page is
            operational guidance only — it does not perform automated backups itself.
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
    </div>
  );
}