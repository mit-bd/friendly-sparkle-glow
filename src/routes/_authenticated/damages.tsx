import { createFileRoute } from '@tanstack/react-router'
import { createFileRoute } from "@/lib/router";
import { PackageX } from "lucide-react";

import { ModulePlaceholder } from "@/components/ModulePlaceholder";

export const Route = createFileRoute("/_authenticated/damages")({
  head: () => ({ meta: [{ title: "Damages — Motion IT BD" }] }),
  component: () => (
    <ModulePlaceholder
      title="Damages"
      description="Log damaged inventory and associated write-offs."
      icon={PackageX}
    />
  ),
});