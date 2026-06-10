import { createFileRoute } from "@/lib/router"
import { createFileRoute, useNavigate, Link } from "@/lib/router";
import { ArrowLeft } from "lucide-react";

import { PageHeader } from "@/components/PageHeader";
import { NoAccess } from "@/components/NoAccess";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { BudgetForm } from "@/components/budgets/BudgetForm";
import { useAuth } from "@/lib/auth-context";

export const Route = createFileRoute("/_authenticated/budgets/create")({
  head: () => ({ meta: [{ title: "Create Budget — Motion IT BD" }] }),
  component: CreateBudget,
});

function CreateBudget() {
  const { can, isAdmin } = useAuth();
  const navigate = useNavigate();
  const canEdit = isAdmin || can("budgets", "edit");

  if (!canEdit) return (<div className="space-y-8"><PageHeader title="Create Budget" /><NoAccess /></div>);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Create Budget"
        description="Define a budget, its period, target and alert thresholds. Spending is tracked from approved records only."
        actions={<Button variant="outline" asChild><Link to="/budgets"><ArrowLeft className="h-4 w-4" />Back</Link></Button>}
      />
      <Card>
        <CardContent className="pt-6">
          <BudgetForm mode="create" onSaved={(id) => navigate({ to: "/budgets/$id", params: { id } })} onCancel={() => navigate({ to: "/budgets" })} />
        </CardContent>
      </Card>
    </div>
  );
}
