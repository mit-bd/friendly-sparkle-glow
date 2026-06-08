import { createFileRoute } from "@tanstack/react-router";
import { FilePlus2 } from "lucide-react";

import { ModulePlaceholder } from "@/components/ModulePlaceholder";

export const Route = createFileRoute("/_authenticated/expenses/add")({
  head: () => ({ meta: [{ title: "Add Expense — Motion IT BD" }] }),
  component: () => (
    <ModulePlaceholder
      title="Add Expense"
      description="Submit a new expense for approval."
      icon={FilePlus2}
    />
  ),
});