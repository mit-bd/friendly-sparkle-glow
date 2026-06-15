import { createFileRoute } from "@/lib/router";
import { useCallback, useEffect, useState } from "react";
import { Loader2, Search } from "lucide-react";
import { toast } from "sonner";

import { PageHeader } from "@/components/PageHeader";
import { NoAccess } from "@/components/NoAccess";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { MobileRecordCard } from "@/components/app/MobileRecordCard";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAuth } from "@/lib/auth-context";
import {
  fetchActivityLogs,
  ACTIVITY_ACTION_LABELS,
  ACTIVITY_ENTITY_LABELS,
  ACTIVITY_TONE,
  type ActivityLog,
} from "@/lib/audit";

export const Route = createFileRoute("/_authenticated/owner/audit")({
  head: () => ({ meta: [{ title: "Owner Audit Center — Motion IT BD" }] }),
  component: OwnerAuditPage,
});

const GOVERNANCE_ENTITIES = ["company", "registration_request", "user", "owner", "permission", "session"];
const PAGE_SIZE = 25;

function OwnerAuditPage() {
  const { isOwner } = useAuth();
  const [rows, setRows] = useState<ActivityLog[]>([]);
  const [count, setCount] = useState(0);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [entityType, setEntityType] = useState("all");

  const load = useCallback(() => {
    setLoading(true);
    fetchActivityLogs(
      { search: search || undefined, entityType: entityType === "all" ? undefined : entityType },
      page,
      PAGE_SIZE,
    )
      .then(({ rows, count }) => {
        setRows(rows);
        setCount(count);
      })
      .catch((e) => toast.error(e.message))
      .finally(() => setLoading(false));
  }, [search, entityType, page]);

  useEffect(() => {
    if (isOwner) load();
  }, [isOwner, load]);

  if (!isOwner) {
    return (
      <div className="space-y-8">
        <PageHeader title="Owner Audit Center" />
        <NoAccess />
      </div>
    );
  }

  const totalPages = Math.max(1, Math.ceil(count / PAGE_SIZE));

  return (
    <div className="space-y-8">
      <PageHeader title="Owner Audit Center" description="Immutable record of governance actions across the platform." />

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative max-w-sm flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={search} onChange={(e) => { setPage(0); setSearch(e.target.value); }} placeholder="Search by label…" className="pl-9" />
        </div>
        <Select value={entityType} onValueChange={(v) => { setPage(0); setEntityType(v); }}>
          <SelectTrigger className="w-[200px]"><SelectValue placeholder="Entity" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All activity</SelectItem>
            {GOVERNANCE_ENTITIES.map((e) => (
              <SelectItem key={e} value={e}>{ACTIVITY_ENTITY_LABELS[e] ?? e}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="space-y-3 p-4 md:hidden">
              {rows.length === 0 ? (
                <p className="py-8 text-center text-sm text-muted-foreground">No activity found.</p>
              ) : (
                rows.map((r) => (
                  <MobileRecordCard key={r.id}
                    title={r.entity_label || "—"}
                    subtitle={ACTIVITY_ENTITY_LABELS[r.entity_type] ?? r.entity_type}
                    footer={<><Badge variant="outline" className={`border-transparent ${ACTIVITY_TONE[r.action] ?? "bg-muted text-muted-foreground"}`}>{ACTIVITY_ACTION_LABELS[r.action] ?? r.action}</Badge><span className="text-xs text-muted-foreground">{new Date(r.created_at).toLocaleString()}</span></>} />
                ))
              )}
            </div>
            <Table className="hidden md:table">
              <TableHeader>
                <TableRow>
                  <TableHead>Action</TableHead>
                  <TableHead>Entity</TableHead>
                  <TableHead>Label</TableHead>
                  <TableHead>When</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="py-12 text-center text-sm text-muted-foreground">No activity found.</TableCell>
                  </TableRow>
                ) : (
                  rows.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell>
                        <Badge variant="outline" className={`border-transparent ${ACTIVITY_TONE[r.action] ?? "bg-muted text-muted-foreground"}`}>
                          {ACTIVITY_ACTION_LABELS[r.action] ?? r.action}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground">{ACTIVITY_ENTITY_LABELS[r.entity_type] ?? r.entity_type}</TableCell>
                      <TableCell className="font-medium">{r.entity_label || "—"}</TableCell>
                      <TableCell className="text-muted-foreground">{new Date(r.created_at).toLocaleString()}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {count > PAGE_SIZE && (
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>Page {page + 1} of {totalPages}</span>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>Previous</Button>
            <Button variant="outline" size="sm" disabled={page + 1 >= totalPages} onClick={() => setPage((p) => p + 1)}>Next</Button>
          </div>
        </div>
      )}
    </div>
  );
}