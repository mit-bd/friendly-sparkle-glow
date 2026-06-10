import { createFileRoute } from '@tanstack/react-router'
import { createFileRoute, redirect } from "@/lib/router";

// The former "Detailed Reports" placeholder is superseded by the Reports Center,
// which generates every report type (incl. the line-item Approved Expense report).
export const Route = createFileRoute("/_authenticated/reports/detailed")({
  beforeLoad: () => {
    throw redirect({ to: "/reports/summary", search: {} });
  },
});
