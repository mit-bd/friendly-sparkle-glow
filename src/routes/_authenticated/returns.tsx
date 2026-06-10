import { createFileRoute } from "@/lib/router";
import { Undo2 } from "lucide-react";

import { ModulePlaceholder } from "@/components/ModulePlaceholder";

export const Route = createFileRoute("/_authenticated/returns")({
  head: () => ({ meta: [{ title: "Returns — Motion IT BD" }] }),
  component: () => (
    <ModulePlaceholder
      title="Returns"
      description="Record and reconcile returned goods and refunds."
      icon={Undo2}
    />
  ),
});