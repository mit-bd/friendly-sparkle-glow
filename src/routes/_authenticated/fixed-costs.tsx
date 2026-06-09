import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/fixed-costs")({
  component: () => <Outlet />,
});
