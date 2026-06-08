import { createFileRoute } from "@tanstack/react-router";
import { Receipt } from "lucide-react";

import { ModulePlaceholder } from "@/components/ModulePlaceholder";

export const Route = createFileRoute("/_authenticated/expenses/")({
  head: () => ({ meta: [{ title: "All Expenses — Expense Management System" }] }),
  component: () => (
    <ModulePlaceholder
      title="All Expenses"
      description="Browse, filter, and manage every recorded expense."
      icon={Receipt}
    />
  ),
});