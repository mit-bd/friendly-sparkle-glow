import { createFileRoute } from "@tanstack/react-router";
import { Megaphone } from "lucide-react";

import { ModulePlaceholder } from "@/components/ModulePlaceholder";

export const Route = createFileRoute("/_authenticated/marketing")({
  head: () => ({ meta: [{ title: "Marketing — Expense Management System" }] }),
  component: () => (
    <ModulePlaceholder
      title="Marketing"
      description="Track marketing spend and campaign-related costs."
      icon={Megaphone}
    />
  ),
});