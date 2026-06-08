import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  CheckCircle2,
  Circle,
  ChevronRight,
  Rocket,
  RefreshCw,
  Loader2,
} from "lucide-react";

import { PageHeader } from "@/components/PageHeader";
import { NoAccess } from "@/components/NoAccess";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/lib/auth-context";
import { fetchReadiness } from "@/lib/readiness";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/readiness")({
  head: () => ({ meta: [{ title: "System Readiness — Motion IT BD" }] }),
  component: ReadinessPage,
});

function ReadinessPage() {
  const { isAdmin } = useAuth();
  const { data, isLoading, isFetching, refetch } = useQuery({
    queryKey: ["readiness"],
    queryFn: fetchReadiness,
    enabled: isAdmin,
    staleTime: 30_000,
  });

  if (!isAdmin) {
    return (
      <div className="space-y-6">
        <PageHeader title="System Readiness" description="Admin-only setup overview." />
        <NoAccess />
      </div>
    );
  }

  const checks = data ?? [];
  const done = checks.filter((c) => c.done).length;
  const total = checks.length;
  const pct = total ? Math.round((done / total) * 100) : 0;
  const ready = total > 0 && done === total;

  return (
    <div className="space-y-6">
      <PageHeader
        title="System Readiness"
        description="Complete the setup checklist to prepare Motion IT BD for production use."
        actions={
          <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
            {isFetching ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            Refresh
          </Button>
        }
      />

      {isLoading ? (
        <div className="space-y-4">
          <Skeleton className="h-28 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      ) : (
        <>
          <Card>
            <CardContent className="flex flex-col gap-4 py-5 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-3">
                <span
                  className={cn(
                    "flex h-11 w-11 items-center justify-center rounded-md",
                    ready ? "bg-chart-2/15 text-chart-2" : "bg-brand-gradient-soft text-brand",
                  )}
                >
                  <Rocket className="h-5 w-5" />
                </span>
                <div>
                  <p className="text-sm font-medium text-foreground">
                    {ready ? "System ready for production" : "Setup in progress"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {done} of {total} essential steps complete.
                  </p>
                </div>
              </div>
              <div className="w-full sm:w-64">
                <div className="mb-1 flex items-center justify-between text-xs text-muted-foreground">
                  <span>Progress</span>
                  <span>{pct}%</span>
                </div>
                <Progress value={pct} />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Admin setup checklist</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {checks.map((c) => (
                <Link
                  key={c.key}
                  to={c.to}
                  className="group flex items-center gap-3 rounded-md border border-border p-3 transition-colors hover:border-brand/40 hover:bg-accent/50"
                >
                  {c.done ? (
                    <CheckCircle2 className="h-5 w-5 shrink-0 text-chart-2" />
                  ) : (
                    <Circle className="h-5 w-5 shrink-0 text-muted-foreground" />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="flex items-center gap-2 font-medium text-foreground">
                      {c.label}
                      {c.done && (
                        <Badge variant="outline" className="bg-chart-2/15 text-xs text-chart-2">
                          Done
                        </Badge>
                      )}
                    </p>
                    <p className="text-xs text-muted-foreground">{c.description}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground/80">{c.detail}</p>
                  </div>
                  <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
                </Link>
              ))}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}