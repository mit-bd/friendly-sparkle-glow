import { createFileRoute } from "@tanstack/react-router";
import { PackageX } from "lucide-react";

import { ModulePlaceholder } from "@/components/ModulePlaceholder";

export const Route = createFileRoute("/_authenticated/damages")({
  head: () => ({ meta: [{ title: "Damages — Expense Management System" }] }),
  component: () => (
    <ModulePlaceholder
      title="Damages"
      description="Log damaged inventory and associated write-offs."
      icon={PackageX}
    />
  ),
});