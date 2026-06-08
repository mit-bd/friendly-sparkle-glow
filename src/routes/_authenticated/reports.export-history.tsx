import { createFileRoute } from "@tanstack/react-router";
import { Download } from "lucide-react";

import { ModulePlaceholder } from "@/components/ModulePlaceholder";

export const Route = createFileRoute("/_authenticated/reports/export-history")({
  head: () => ({ meta: [{ title: "Export History — Expense Management System" }] }),
  component: () => (
    <ModulePlaceholder
      title="Export History"
      description="An audit trail of every generated export."
      icon={Download}
    />
  ),
});