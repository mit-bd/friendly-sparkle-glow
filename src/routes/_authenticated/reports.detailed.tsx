import { createFileRoute } from "@tanstack/react-router";
import { FileText } from "lucide-react";

import { ModulePlaceholder } from "@/components/ModulePlaceholder";

export const Route = createFileRoute("/_authenticated/reports/detailed")({
  head: () => ({ meta: [{ title: "Detailed Reports — Expense Management System" }] }),
  component: () => (
    <ModulePlaceholder
      title="Detailed Reports"
      description="Line-item level reporting with branded export headers."
      icon={FileText}
    />
  ),
});