import { createFileRoute } from "@/lib/router";
import { useCallback, useEffect, useState } from "react";
import { Loader2, Check, X, MessageSquareWarning, Mail, Phone } from "lucide-react";
import { toast } from "sonner";

import { PageHeader } from "@/components/PageHeader";
import { NoAccess } from "@/components/NoAccess";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { PasswordInput } from "@/components/ui/password-input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/lib/auth-context";
import {
  fetchRegistrationRequests,
  approveRegistration,
  rejectRegistration,
  requestRegistrationInfo,
  REGISTRATION_STATUS_LABELS,
  type RegistrationRequest,
  type RegistrationStatus,
} from "@/lib/owner";

export const Route = createFileRoute("/_authenticated/owner/registrations")({
  head: () => ({ meta: [{ title: "Registration Requests — Motion IT BD" }] }),
  component: RegistrationRequestsPage,
});

const STATUS_TONE: Record<RegistrationStatus, string> = {
  pending: "bg-warning/15 text-warning",
  approved: "bg-chart-2/15 text-chart-2",
  rejected: "bg-destructive/15 text-destructive",
  info_requested: "bg-chart-1/15 text-chart-1",
};

function RegistrationRequestsPage() {
  const { isOwner } = useAuth();
  const [rows, setRows] = useState<RegistrationRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<RegistrationStatus | "all">("pending");
  const [active, setActive] = useState<RegistrationRequest | null>(null);
  const [mode, setMode] = useState<"approve" | "reject" | "info" | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    fetchRegistrationRequests(filter)
      .then(setRows)
      .catch((e) => toast.error(e.message))
      .finally(() => setLoading(false));
  }, [filter]);

  useEffect(() => {
    if (isOwner) load();
  }, [isOwner, load]);

  if (!isOwner) {
    return (
      <div className="space-y-8">
        <PageHeader title="Registration Requests" />
        <NoAccess />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <PageHeader
        title="Registration Requests"
        description="Review and approve companies requesting access to the platform."
      />

      <Tabs value={filter} onValueChange={(v) => setFilter(v as RegistrationStatus | "all")}>
        <TabsList>
          <TabsTrigger value="pending">Pending</TabsTrigger>
          <TabsTrigger value="info_requested">Info Requested</TabsTrigger>
          <TabsTrigger value="approved">Approved</TabsTrigger>
          <TabsTrigger value="rejected">Rejected</TabsTrigger>
          <TabsTrigger value="all">All</TabsTrigger>
        </TabsList>
      </Tabs>

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : rows.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center text-sm text-muted-foreground">
            No registration requests in this view.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {rows.map((r) => (
            <Card key={r.id}>
              <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0 space-y-1.5">
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-semibold text-foreground">{r.company_name}</h3>
                    <Badge variant="outline" className={`border-transparent ${STATUS_TONE[r.status]}`}>
                      {REGISTRATION_STATUS_LABELS[r.status]}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">Contact: {r.contact_name}</p>
                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1"><Mail className="h-3 w-3" />{r.email}</span>
                    {r.phone && <span className="flex items-center gap-1"><Phone className="h-3 w-3" />{r.phone}</span>}
                    <span>{new Date(r.created_at).toLocaleString()}</span>
                  </div>
                  {r.address && <p className="text-xs text-muted-foreground">{r.address}</p>}
                  {r.message && <p className="rounded-md bg-muted/40 p-2 text-xs text-muted-foreground">{r.message}</p>}
                  {r.info_request_note && (
                    <p className="text-xs text-chart-1">Note: {r.info_request_note}</p>
                  )}
                </div>
                {(r.status === "pending" || r.status === "info_requested") && (
                  <div className="flex shrink-0 flex-wrap gap-2">
                    <Button size="sm" onClick={() => { setActive(r); setMode("approve"); }}>
                      <Check className="h-4 w-4" /> Approve
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => { setActive(r); setMode("info"); }}>
                      <MessageSquareWarning className="h-4 w-4" /> Request info
                    </Button>
                    <Button size="sm" variant="outline" className="text-destructive" onClick={() => { setActive(r); setMode("reject"); }}>
                      <X className="h-4 w-4" /> Reject
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <ReviewDialog
        request={active}
        mode={mode}
        onClose={() => { setActive(null); setMode(null); }}
        onDone={() => { setActive(null); setMode(null); load(); }}
      />
    </div>
  );
}

function ReviewDialog({
  request,
  mode,
  onClose,
  onDone,
}: {
  request: RegistrationRequest | null;
  mode: "approve" | "reject" | "info" | null;
  onClose: () => void;
  onDone: () => void;
}) {
  const [password, setPassword] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setPassword("");
    setNote("");
  }, [request, mode]);

  if (!request || !mode) return null;

  async function submit() {
    if (!request || !mode) return;
    setSaving(true);
    try {
      if (mode === "approve") {
        if (password.length < 8) {
          toast.error("Set an admin password of at least 8 characters.");
          setSaving(false);
          return;
        }
        await approveRegistration(request.id, password);
        toast.success(`${request.company_name} approved. Company admin account created.`);
      } else if (mode === "reject") {
        await rejectRegistration(request.id, note || undefined);
        toast.success("Request rejected.");
      } else {
        if (!note.trim()) {
          toast.error("Add a note describing what information is needed.");
          setSaving(false);
          return;
        }
        await requestRegistrationInfo(request.id, note.trim());
        toast.success("Information requested.");
      }
      onDone();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Action failed.");
    } finally {
      setSaving(false);
    }
  }

  const title =
    mode === "approve" ? "Approve registration" : mode === "reject" ? "Reject registration" : "Request more information";

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            {request.company_name} · {request.email}
          </DialogDescription>
        </DialogHeader>
        {mode === "approve" ? (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Approving creates the company and a <strong>Company Admin</strong> account for{" "}
              <strong>{request.email}</strong>. Set their initial password below and share it securely.
            </p>
            <div className="space-y-2">
              <Label htmlFor="reg-pw">Initial admin password</Label>
              <PasswordInput id="reg-pw" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="At least 8 characters" />
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            <Label htmlFor="reg-note">{mode === "info" ? "What do you need?" : "Reason (optional)"}</Label>
            <Textarea id="reg-note" value={note} onChange={(e) => setNote(e.target.value)} rows={3} />
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={submit} disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            Confirm
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}