import { createFileRoute } from '@tanstack/react-router'
import { createFileRoute } from "@/lib/router";
import { FinanceListView } from "@/components/finance/FinanceListView";

export const Route = createFileRoute("/_authenticated/finance/payables")({
  head: () => ({ meta: [{ title: "Payables — Motion IT BD" }] }),
  component: () => <FinanceListView kind="payable" />,
});