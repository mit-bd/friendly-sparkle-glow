import { createFileRoute, Link } from "@/lib/router";
import {
  Building2,
  PenLine,
  Bell,
  ShieldCheck,
  Megaphone,
  TrendingDown,
  SlidersHorizontal,
  ChevronRight,
  Rocket,
  DatabaseBackup,
  Activity,
  Repeat,
  ClipboardCheck,
  type LucideIcon,
} from "lucide-react";

import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { useAuth } from "@/lib/auth-context";

export const Route = createFileRoute("/_authenticated/settings/")({
  head: () => ({ meta: [{ title: "Settings — Motion IT BD" }] }),
  component: SettingsHubPage,
});

interface SettingLink {
  label: string;
  description: string;
  to: string;
  icon: LucideIcon;
  adminOnly?: boolean;
}

const GROUPS: { heading: string; items: SettingLink[] }[] = [
  {
    heading: "Organisation",
    items: [
      { label: "Company Profile", description: "Branding, contact details and letterhead.", to: "/settings/company", icon: Building2 },
      { label: "Signatories", description: "Authorised approvers shown on reports.", to: "/settings/signatories", icon: PenLine },
    ],
  },
  {
    heading: "Modules",
    items: [
      { label: "Marketing Settings", description: "Platforms and currencies for marketing costs.", to: "/settings/marketing", icon: Megaphone },
      { label: "Fixed Cost Management", description: "Recurring monthly cost templates and auto-generation.", to: "/settings/fixed-costs", icon: Repeat, adminOnly: true },
      { label: "Loss Settings", description: "Return reasons and damage types.", to: "/settings/loss", icon: TrendingDown },
    ],
  },
  {
    heading: "System",
    items: [
      { label: "Notification Settings", description: "Control in-app notification delivery.", to: "/settings/notifications", icon: Bell },
      { label: "Permissions", description: "Role-based access for every module.", to: "/settings/permissions", icon: ShieldCheck, adminOnly: true },
      { label: "User Preferences", description: "Theme, date range and table page size.", to: "/settings/preferences", icon: SlidersHorizontal },
    ],
  },
  {
    heading: "Production",
    items: [
      { label: "System Readiness", description: "Setup checklist and go-live status.", to: "/readiness", icon: Rocket, adminOnly: true },
      { label: "QA Validation", description: "Business validation checklist: tested, issues, resolutions.", to: "/qa", icon: ClipboardCheck, adminOnly: true },
      { label: "System Health", description: "Live status of core platform services.", to: "/system", icon: Activity, adminOnly: true },
      { label: "Backup & Recovery", description: "Operational guidance for data protection.", to: "/backup", icon: DatabaseBackup, adminOnly: true },
    ],
  },
];

function SettingsHubPage() {
  const { isAdmin } = useAuth();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Settings"
        description="Configure your organisation, modules and personal preferences."
      />

      {GROUPS.map((group) => {
        const items = group.items.filter((i) => !i.adminOnly || isAdmin);
        if (items.length === 0) return null;
        return (
          <section key={group.heading} className="space-y-3">
            <h2 className="text-sm font-semibold text-muted-foreground">{group.heading}</h2>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {items.map((item) => (
                <Link key={item.to} to={item.to} className="group">
                  <Card className="h-full transition-colors hover:border-brand/40 hover:bg-accent/50">
                    <CardContent className="flex items-start gap-3 py-4">
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-brand-gradient-soft text-brand">
                        <item.icon className="h-5 w-5" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="flex items-center justify-between font-medium text-foreground">
                          {item.label}
                          <ChevronRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
                        </p>
                        <p className="text-xs text-muted-foreground">{item.description}</p>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}
