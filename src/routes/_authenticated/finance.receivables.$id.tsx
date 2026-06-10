import { createFileRoute } from '@tanstack/react-router'
import { createFileRoute } from "@/lib/router";
import { FinanceDetailView } from "@/components/finance/FinanceDetailView";

export const Route = createFileRoute("/_authenticated/finance/receivables/$id")({
  head: () => ({ meta: [{ title: "Receivable Details — Motion IT BD" }] }),
  component: ReceivableDetail,
});

function ReceivableDetail() {
  const { id } = Route.useParams();
  return <FinanceDetailView kind="receivable" id={id} />;
}