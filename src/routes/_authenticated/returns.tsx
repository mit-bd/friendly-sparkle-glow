import { createFileRoute } from "@tanstack/react-router";
import { Undo2 } from "lucide-react";

import { ModulePlaceholder } from "@/components/ModulePlaceholder";

export const Route = createFileRoute("/_authenticated/returns")({
  head: () => ({ meta: [{ title: "Returns — Expense Management System" }] }),
  component: () => (
    <ModulePlaceholder
      title="Returns"
      description="Record and reconcile returned goods and refunds."
      icon={Undo2}
    />
  ),
});