import { Link } from "@/lib/router";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatCurrency, formatDate } from "@/lib/expenses";
import type { AnalyticsExpense } from "@/lib/analytics";

interface Props {
  rows: AnalyticsExpense[];
  categoryName?: (id: string | null) => string;
  subcategoryName?: (id: string | null) => string;
}

export function ExpenseMiniTable({ rows, categoryName, subcategoryName }: Props) {
  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Number</TableHead>
            <TableHead>Date</TableHead>
            {categoryName && <TableHead className="hidden sm:table-cell">Category</TableHead>}
            {subcategoryName && (
              <TableHead className="hidden md:table-cell">Subcategory</TableHead>
            )}
            <TableHead className="hidden lg:table-cell">Description</TableHead>
            <TableHead className="text-right">Amount</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((r) => (
            <TableRow key={r.id}>
              <TableCell className="font-medium">
                <Link
                  to="/expenses/$id"
                  params={{ id: r.id }}
                  className="text-brand hover:underline"
                >
                  {r.expense_number}
                </Link>
              </TableCell>
              <TableCell className="whitespace-nowrap">{formatDate(r.expense_date)}</TableCell>
              {categoryName && (
                <TableCell className="hidden sm:table-cell">
                  {categoryName(r.category_id)}
                </TableCell>
              )}
              {subcategoryName && (
                <TableCell className="hidden md:table-cell">
                  {subcategoryName(r.subcategory_id)}
                </TableCell>
              )}
              <TableCell className="hidden max-w-[280px] truncate lg:table-cell">
                {r.description || "—"}
              </TableCell>
              <TableCell className="text-right font-semibold tabular-nums">
                {formatCurrency(r.amount)}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}