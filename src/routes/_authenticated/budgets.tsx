import { createFileRoute, Outlet } from "@/lib/router";

export const Route = createFileRoute("/_authenticated/budgets")({
  component: () => <Outlet />,
});
