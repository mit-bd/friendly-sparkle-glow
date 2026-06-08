import { formatCurrency, formatDate, type ExpenseCategory, type ExpenseSubcategory } from "@/lib/expenses";
import type {
  CategoryReportRow,
  ReportExpense,
  SubcategoryReportRow,
  SummaryRow,
} from "@/lib/reports";

const th = "px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wide text-muted-foreground";
const td = "px-3 py-2 text-sm text-foreground align-top";
const num = "px-3 py-2 text-sm text-foreground text-right tabular-nums align-top";

function nameMaps(categories: ExpenseCategory[], subcategories: ExpenseSubcategory[]) {
  return {
    cat: new Map(categories.map((c) => [c.id, c.name])),
    sub: new Map(subcategories.map((s) => [s.id, s.name])),
  };
}

export function EmptyReportNote() {
  return (
    <p className="rounded-md border border-dashed border-border py-10 text-center text-sm text-muted-foreground">
      No approved expenses found for the selected criteria.
    </p>
  );
}

/* ---------------------------------------------------- Expense Summary */
export function SummaryBody({ rows, grandTotal }: { rows: SummaryRow[]; grandTotal: number }) {
  if (rows.length === 0) return <EmptyReportNote />;
  return (
    <table className="report-table w-full border-collapse">
      <thead>
        <tr className="border-b-2 border-border">
          <th className={th}>Category</th>
          <th className={th + " text-right"}>Count</th>
          <th className={th + " text-right"}>Total Expense</th>
          <th className={th + " text-right"}>Percentage</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.id ?? r.name} className="border-b border-border">
            <td className={td}>{r.name}</td>
            <td className={num}>{r.count}</td>
            <td className={num}>{formatCurrency(r.total)}</td>
            <td className={num}>{r.percentage.toFixed(1)}%</td>
          </tr>
        ))}
      </tbody>
      <tfoot>
        <tr className="border-t-2 border-foreground/70 font-semibold">
          <td className={td + " font-semibold"}>Grand Total</td>
          <td className={num + " font-semibold"}>{rows.reduce((a, r) => a + r.count, 0)}</td>
          <td className={num + " font-semibold"}>{formatCurrency(grandTotal)}</td>
          <td className={num + " font-semibold"}>100.0%</td>
        </tr>
      </tfoot>
    </table>
  );
}

/* ---------------------------------------------------- Category Report */
export function CategoryBody({ rows, grandTotal }: { rows: CategoryReportRow[]; grandTotal: number }) {
  if (rows.length === 0) return <EmptyReportNote />;
  return (
    <div className="space-y-5">
      {rows.map((cat) => (
        <div key={cat.id ?? cat.name} className="report-block break-inside-avoid">
          <div className="flex items-end justify-between border-b border-border pb-1.5">
            <h3 className="text-sm font-semibold text-foreground">{cat.name}</h3>
            <span className="text-xs text-muted-foreground">
              {cat.count} item{cat.count === 1 ? "" : "s"} · {formatCurrency(cat.total)}
            </span>
          </div>
          <table className="report-table mt-2 w-full border-collapse">
            <thead>
              <tr className="border-b border-border">
                <th className={th}>Subcategory</th>
                <th className={th + " text-right"}>Count</th>
                <th className={th + " text-right"}>Total</th>
              </tr>
            </thead>
            <tbody>
              {cat.subcategories.map((s) => (
                <tr key={s.id ?? s.name} className="border-b border-border/60">
                  <td className={td}>{s.name}</td>
                  <td className={num}>{s.count}</td>
                  <td className={num}>{formatCurrency(s.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}
      <div className="flex justify-between border-t-2 border-foreground/70 pt-2 text-sm font-semibold">
        <span>Grand Total</span>
        <span className="tabular-nums">{formatCurrency(grandTotal)}</span>
      </div>
    </div>
  );
}

/* ---------------------------------------------------- Subcategory Report */
export function SubcategoryBody({
  rows,
  grandTotal,
  categories,
  subcategories,
}: {
  rows: SubcategoryReportRow[];
  grandTotal: number;
  categories: ExpenseCategory[];
  subcategories: ExpenseSubcategory[];
}) {
  if (rows.length === 0) return <EmptyReportNote />;
  const { cat } = nameMaps(categories, subcategories);
  return (
    <div className="space-y-5">
      {rows.map((sc) => (
        <div key={sc.id ?? sc.name} className="report-block break-inside-avoid">
          <div className="flex items-end justify-between border-b border-border pb-1.5">
            <div>
              <h3 className="text-sm font-semibold text-foreground">{sc.name}</h3>
              <p className="text-[11px] text-muted-foreground">Category: {sc.categoryName}</p>
            </div>
            <span className="text-xs text-muted-foreground">
              {sc.count} item{sc.count === 1 ? "" : "s"} · {formatCurrency(sc.total)}
            </span>
          </div>
          <table className="report-table mt-2 w-full border-collapse">
            <thead>
              <tr className="border-b border-border">
                <th className={th}>Expense No.</th>
                <th className={th}>Date</th>
                <th className={th}>Description</th>
                <th className={th + " text-right"}>Amount</th>
              </tr>
            </thead>
            <tbody>
              {sc.expenses.map((e) => (
                <tr key={e.id} className="border-b border-border/60">
                  <td className={td + " whitespace-nowrap font-medium"}>{e.expense_number}</td>
                  <td className={td + " whitespace-nowrap"}>{formatDate(e.expense_date)}</td>
                  <td className={td}>{e.description || "—"}</td>
                  <td className={num}>{formatCurrency(e.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}
      <div className="flex justify-between border-t-2 border-foreground/70 pt-2 text-sm font-semibold">
        <span>Grand Total</span>
        <span className="tabular-nums">{formatCurrency(grandTotal)}</span>
      </div>
    </div>
  );
}

/* ---------------------------------------------------- Approved / Selected ledger */
export function LedgerBody({
  rows,
  categories,
  subcategories,
  userNames,
}: {
  rows: ReportExpense[];
  categories: ExpenseCategory[];
  subcategories: ExpenseSubcategory[];
  userNames: Record<string, string>;
}) {
  if (rows.length === 0) return <EmptyReportNote />;
  const { cat, sub } = nameMaps(categories, subcategories);
  const total = rows.reduce((a, r) => a + Number(r.amount || 0), 0);
  return (
    <table className="report-table w-full border-collapse">
      <thead>
        <tr className="border-b-2 border-border">
          <th className={th}>Expense No.</th>
          <th className={th}>Date</th>
          <th className={th}>Category</th>
          <th className={th}>Subcategory</th>
          <th className={th}>Description</th>
          <th className={th + " text-right"}>Amount</th>
          <th className={th}>Approved By</th>
          <th className={th}>Approval Date</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((e) => (
          <tr key={e.id} className="border-b border-border break-inside-avoid">
            <td className={td + " whitespace-nowrap font-medium"}>{e.expense_number}</td>
            <td className={td + " whitespace-nowrap"}>{formatDate(e.expense_date)}</td>
            <td className={td}>{e.category_id ? cat.get(e.category_id) ?? "—" : "—"}</td>
            <td className={td}>{e.subcategory_id ? sub.get(e.subcategory_id) ?? "—" : "—"}</td>
            <td className={td}>{e.description || "—"}</td>
            <td className={num}>{formatCurrency(e.amount)}</td>
            <td className={td}>{e.approved_by ? userNames[e.approved_by] ?? "—" : "—"}</td>
            <td className={td + " whitespace-nowrap"}>{formatDate(e.approved_at)}</td>
          </tr>
        ))}
      </tbody>
      <tfoot>
        <tr className="border-t-2 border-foreground/70 font-semibold">
          <td className={td + " font-semibold"} colSpan={5}>
            Grand Total ({rows.length} item{rows.length === 1 ? "" : "s"})
          </td>
          <td className={num + " font-semibold"}>{formatCurrency(total)}</td>
          <td className={td} colSpan={2} />
        </tr>
      </tfoot>
    </table>
  );
}
