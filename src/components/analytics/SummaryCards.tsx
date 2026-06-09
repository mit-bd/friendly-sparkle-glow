import {
  Wallet,
  Building2,
  Megaphone,
  Package,
  Undo2,
  PackageX,
  Clock,
  CheckCircle2,
  type LucideIcon,
} from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCurrency } from "@/lib/expenses";
import {
  sumAmount,
  sumByCategoryKeywords,
  sumBySubcategoryKeywords,
  type AnalyticsExpense,
  type StatusCounts,
} from "@/lib/analytics";
import type { ExpenseCategory, ExpenseSubcategory } from "@/lib/expenses";

interface SummaryCardsProps {
  rows: AnalyticsExpense[] | undefined;
  counts: StatusCounts | undefined;
  categories: ExpenseCategory[];
  subcategories: ExpenseSubcategory[];
  loading: boolean;
}

interface CardDef {
  label: string;
  value: string;
  hint: string;
  icon: LucideIcon;
  currency: boolean;
}

export function SummaryCards({
  rows,
  counts,
  categories,
  subcategories,
  loading,
}: SummaryCardsProps) {
  const r = rows ?? [];
  const cards: CardDef[] = [
    {
      label: "Total Expense",
      value: formatCurrency(sumAmount(r)),
      hint: "Approved, in range",
      icon: Wallet,
      currency: true,
    },
    {
      label: "Fixed Cost",
      value: formatCurrency(sumByCategoryKeywords(r, categories, ["fixed"])),
      hint: "Approved fixed costs",
      icon: Building2,
      currency: true,
    },
    {
      label: "Marketing Cost",
      value: formatCurrency(sumByCategoryKeywords(r, categories, ["marketing"])),
      hint: "Approved marketing spend",
      icon: Megaphone,
      currency: true,
    },
    {
      label: "Product Cost",
      value: formatCurrency(sumByCategoryKeywords(r, categories, ["product"])),
      hint: "Approved product costs",
      icon: Package,
      currency: true,
    },
    {
      label: "Return Loss",
      value: formatCurrency(sumBySubcategoryKeywords(r, subcategories, ["return", "refund"])),
      hint: "Approved returns & refunds",
      icon: Undo2,
      currency: true,
    },
    {
      label: "Damage Loss",
      value: formatCurrency(sumBySubcategoryKeywords(r, subcategories, ["damage"])),
      hint: "Approved damage costs",
      icon: PackageX,
      currency: true,
    },
    {
      label: "Pending Approvals",
      value: String(counts?.pending ?? 0),
      hint: "Awaiting review",
      icon: Clock,
      currency: false,
    },
    {
      label: "Approved Expenses",
      value: String(counts?.approvedInRange ?? 0),
      hint: "Count in range",
      icon: CheckCircle2,
      currency: false,
    },
  ];

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {cards.map((c) => (
        <Card key={c.label} className="transition-shadow hover:shadow-pop">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {c.label}
            </CardTitle>
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-gradient-soft text-brand">
              <c.icon className="h-4 w-4" />
            </span>
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-9 w-24" />
            ) : (
              <div className="text-[1.75rem] font-bold leading-tight tracking-tight tabular-nums">
                {c.value}
              </div>
            )}
            <p className="mt-1.5 text-small text-muted-foreground">{c.hint}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}