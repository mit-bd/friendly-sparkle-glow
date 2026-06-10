import { createFileRoute } from '@tanstack/react-router'
import { createFileRoute, Outlet } from "@/lib/router";

export const Route = createFileRoute("/_authenticated/budgets")({
  component: () => <Outlet />,
});
