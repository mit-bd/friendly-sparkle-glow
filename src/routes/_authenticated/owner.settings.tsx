import { createFileRoute } from "@/lib/router";
import { Crown, Mail, User as UserIcon } from "lucide-react";

import { PageHeader } from "@/components/PageHeader";
import { NoAccess } from "@/components/NoAccess";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChangePasswordCard } from "@/components/ChangePasswordCard";
import { ThemeToggle } from "@/components/app/ThemeToggle";
import { RoleBadge } from "@/components/RoleBadge";
import { useAuth } from "@/lib/auth-context";

export const Route = createFileRoute("/_authenticated/owner/settings")({
  head: () => ({ meta: [{ title: "Owner Settings — Motion IT BD" }] }),
  component: OwnerSettings,
});

function OwnerSettings() {
  const { isOwner, profile, user, primaryRole } = useAuth();

  if (!isOwner) {
    return (
      <div className="space-y-8">
        <PageHeader title="Settings" />
        <NoAccess />
      </div>
    );
  }

  const displayName = profile?.full_name?.trim() || user?.email || "Owner";

  return (
    <div className="space-y-8">
      <PageHeader
        title="Settings"
        description="Manage your platform owner account, security and appearance."
      />

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Crown className="h-4 w-4 text-brand" /> Owner account
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center gap-2 text-sm">
            <UserIcon className="h-4 w-4 text-muted-foreground" />
            <span className="font-medium text-foreground">{displayName}</span>
            {primaryRole && <RoleBadge role={primaryRole} />}
          </div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Mail className="h-4 w-4" />
            {user?.email}
          </div>
          <p className="text-xs text-muted-foreground/80">
            The platform owner governs companies and the platform — this account does not belong to
            any single company workspace.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Appearance</CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">Light / dark theme</span>
          <ThemeToggle />
        </CardContent>
      </Card>

      <ChangePasswordCard />
    </div>
  );
}
