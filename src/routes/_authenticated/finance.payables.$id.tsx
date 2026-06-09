import { createFileRoute } from "@tanstack/react-router";
import { FinanceDetailView } from "@/components/finance/FinanceDetailView";

export const Route = createFileRoute("/_authenticated/finance/payables/$id")({
  head: () => ({ meta: [{ title: "Payable Details — Motion IT BD" }] }),
  component: PayableDetail,
});

function PayableDetail() {
  const { id } = Route.useParams();
  return <FinanceDetailView kind="payable" id={id} />;
}