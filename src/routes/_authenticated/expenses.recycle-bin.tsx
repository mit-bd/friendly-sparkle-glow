import { createFileRoute } from "@tanstack/react-router";
import { Trash2 } from "lucide-react";

import { ModulePlaceholder } from "@/components/ModulePlaceholder";

export const Route = createFileRoute("/_authenticated/expenses/recycle-bin")({
  head: () => ({ meta: [{ title: "Recycle Bin — Expense Management System" }] }),
  component: () => (
    <ModulePlaceholder
      title="Recycle Bin"
      description="Restore or permanently remove deleted records (Admin)."
      icon={Trash2}
      note="Soft-deleted records will appear here. Admins can restore or permanently delete them once the Expenses module is active."
    />
  ),
});