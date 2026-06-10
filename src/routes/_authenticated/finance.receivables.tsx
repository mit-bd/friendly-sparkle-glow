import { createFileRoute } from "@/lib/router"
import { createFileRoute } from "@/lib/router";
import { FinanceListView } from "@/components/finance/FinanceListView";

export const Route = createFileRoute("/_authenticated/finance/receivables")({
  head: () => ({ meta: [{ title: "Receivables — Motion IT BD" }] }),
  component: () => <FinanceListView kind="receivable" />,
});