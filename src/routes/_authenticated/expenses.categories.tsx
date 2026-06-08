import { createFileRoute } from "@tanstack/react-router";
import { Tags } from "lucide-react";

import { ModulePlaceholder } from "@/components/ModulePlaceholder";

export const Route = createFileRoute("/_authenticated/expenses/categories")({
  head: () => ({ meta: [{ title: "Categories — Expense Management System" }] }),
  component: () => (
    <ModulePlaceholder
      title="Expense Categories"
      description="Organize expenses with a structured category system."
      icon={Tags}
    />
  ),
});