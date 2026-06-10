import { createFileRoute, Outlet } from "@/lib/router";

export const Route = createFileRoute("/_authenticated/fixed-costs")({
  component: () => <Outlet />,
});
