import { useMemo, useState } from "react";
import { Loader2, ShieldCheck, Check, X } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { PasswordInput } from "@/components/ui/password-input";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { logActivity } from "@/lib/audit";
import { assessPassword, PASSWORD_RULES, STRENGTH_META } from "@/lib/password";
import { cn } from "@/lib/utils";

export function ChangePasswordCard() {
  const { user } = useAuth();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [saving, setSaving] = useState(false);

  const assessment = useMemo(() => assessPassword(next), [next]);
  const meta = STRENGTH_META[assessment.strength];
  const confirmMismatch = confirm.length > 0 && confirm !== next;
  const reusesCurrent = next.length > 0 && next === current;

  const canSubmit =
    !!current && assessment.valid && confirm === next && confirm.length > 0 && !reusesCurrent;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!user?.email) {
      toast.error("No account email found for this session.");
      return;
    }
    if (!assessment.valid) {
      toast.error("New password does not meet the strength requirements.");
      return;
    }
    if (next !== confirm) {
      toast.error("New password and confirmation do not match.");
      return;
    }
    if (reusesCurrent) {
      toast.error("New password must be different from your current password.");
      return;
    }

    setSaving(true);
    // 1) Re-authenticate to verify the CURRENT password before allowing a change.
    const { error: verifyError } = await supabase.auth.signInWithPassword({
      email: user.email,
      password: current,
    });
    if (verifyError) {
      setSaving(false);
      toast.error("Your current password is incorrect.");
      return;
    }

    // 2) Update to the new password. This keeps the current session valid.
    const { error: updateError } = await supabase.auth.updateUser({ password: next });
    if (updateError) {
      setSaving(false);
      toast.error(updateError.message);
      return;
    }

    // 3) Audit log + refresh the session token so it reflects the change.
    await logActivity({
      action: "password_change",
      entityType: "user",
      entityId: user.id,
      entityLabel: user.email,
      metadata: { event: "password_change" },
    });
    await supabase.auth.refreshSession();

    setSaving(false);
    setCurrent("");
    setNext("");
    setConfirm("");
    toast.success("Password changed successfully.");
  }

  return (
    <Card className="max-w-2xl">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <ShieldCheck className="h-4 w-4 text-brand" />
          Change password
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="current-password">Current password</Label>
            <PasswordInput
              id="current-password"
              autoComplete="current-password"
              value={current}
              onChange={(e) => setCurrent(e.target.value)}
              placeholder="Enter your current password"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="new-password">New password</Label>
            <PasswordInput
              id="new-password"
              autoComplete="new-password"
              value={next}
              onChange={(e) => setNext(e.target.value)}
              placeholder="Choose a strong password"
            />

            {next.length > 0 && (
              <div className="space-y-2 pt-1">
                <div className="flex items-center gap-2">
                  <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                    <div
                      className={cn("h-full rounded-full transition-all", meta.bar)}
                      style={{ width: `${assessment.score}%` }}
                    />
                  </div>
                  <span className={cn("text-xs font-medium", meta.text)}>{meta.label}</span>
                </div>
                <ul className="grid gap-1 sm:grid-cols-2">
                  {PASSWORD_RULES.map((rule) => {
                    const ok = rule.test(next);
                    return (
                      <li
                        key={rule.label}
                        className={cn(
                          "flex items-center gap-1.5 text-xs",
                          ok ? "text-chart-2" : "text-muted-foreground",
                        )}
                      >
                        {ok ? <Check className="h-3.5 w-3.5" /> : <X className="h-3.5 w-3.5" />}
                        {rule.label}
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}
            {reusesCurrent && (
              <p className="text-xs text-destructive">
                New password must be different from your current password.
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirm-password">Confirm new password</Label>
            <PasswordInput
              id="confirm-password"
              autoComplete="new-password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              placeholder="Re-enter the new password"
            />
            {confirmMismatch && (
              <p className="text-xs text-destructive">Passwords do not match.</p>
            )}
          </div>

          <Button type="submit" disabled={!canSubmit || saving}>
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            Update password
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}