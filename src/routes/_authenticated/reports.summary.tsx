import { createFileRoute } from "@tanstack/react-router";
import { FileBarChart } from "lucide-react";

import { ModulePlaceholder } from "@/components/ModulePlaceholder";

export const Route = createFileRoute("/_authenticated/reports/summary")({
  head: () => ({ meta: [{ title: "Summary Reports — Expense Management System" }] }),
  component: () => (
    <ModulePlaceholder
      title="Summary Reports"
      description="High-level spend summaries across periods and categories."
      icon={FileBarChart}
    />
  ),
});