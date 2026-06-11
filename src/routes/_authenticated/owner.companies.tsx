import { createFileRoute, Link } from "@/lib/router";
import { useCallback, useEffect, useState } from "react";
import { Loader2, Search, Building2 } from "lucide-react";
import { toast } from "sonner";

import { PageHeader } from "@/components/PageHeader";
import { NoAccess } from "@/components/NoAccess";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useAuth } from "@/lib/auth-context";
import {
  fetchCompanies,
  COMPANY_STATUS_LABELS,
  PLAN_LABELS,
  type Company,
  type CompanyStatus,
} from "@/lib/owner";

export const Route = createFileRoute("/_authenticated/owner/companies")({
  head: () => ({ meta: [{ title: "Companies — Motion IT BD" }] }),
  component: CompaniesPage,
});

const STATUS_TONE: Record<CompanyStatus, string> = {
  active: "bg-chart-2/15 text-chart-2",
  suspended: "bg-warning/15 text-warning",
  deleted: "bg-destructive/15 text-destructive",
};

function CompaniesPage() {
  const { isOwner } = useAuth();
  const [rows, setRows] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  const load = useCallback(() => {
    setLoading(true);
    fetchCompanies(search)
      .then(setRows)
      .catch((e) => toast.error(e.message))
      .finally(() => setLoading(false));
  }, [search]);

  useEffect(() => {
    if (!isOwner) return;
    const t = setTimeout(load, 250);
    return () => clearTimeout(t);
  }, [isOwner, load]);

  if (!isOwner) {
    return (
      <div className="space-y-8">
        <PageHeader title="Companies" />
        <NoAccess />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <PageHeader title="Companies" description="All companies on the platform." />

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search companies…"
          className="pl-9"
        />
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Company</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Plan</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Created</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="py-12 text-center text-sm text-muted-foreground">
                      No companies found.
                    </TableCell>
                  </TableRow>
                ) : (
                  rows.map((c) => (
                    <TableRow key={c.id} className="cursor-pointer">
                      <TableCell className="font-medium">
                        <Link to="/owner/companies/$id" params={{ id: c.id }} className="flex items-center gap-2 hover:underline">
                          <Building2 className="h-4 w-4 text-muted-foreground" />
                          {c.name}
                          {c.is_primary && <Badge variant="outline" className="ml-1 text-[10px]">Primary</Badge>}
                        </Link>
                      </TableCell>
                      <TableCell className="text-muted-foreground">{c.email || "—"}</TableCell>
                      <TableCell>{PLAN_LABELS[c.plan]}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className={`border-transparent ${STATUS_TONE[c.status]}`}>
                          {COMPANY_STATUS_LABELS[c.status]}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground">{new Date(c.created_at).toLocaleDateString()}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}