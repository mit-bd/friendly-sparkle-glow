import { createFileRoute } from "@tanstack/react-router";
import { Clock } from "lucide-react";

import { ModulePlaceholder } from "@/components/ModulePlaceholder";

export const Route = createFileRoute("/_authenticated/expenses/pending")({
  head: () => ({ meta: [{ title: "Pending Approvals — Expense Management System" }] }),
  component: () => (
    <ModulePlaceholder
      title="Pending Approvals"
      description="Review and approve expenses awaiting sign-off."
      icon={Clock}
    />
  ),
});