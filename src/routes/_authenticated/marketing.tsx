import { createFileRoute } from "@/lib/router"
import { createFileRoute, Outlet } from "@/lib/router";

export const Route = createFileRoute("/_authenticated/marketing")({
  component: () => <Outlet />,
});
