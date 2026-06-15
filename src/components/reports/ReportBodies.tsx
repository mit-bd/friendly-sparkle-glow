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

/* Mobile card primitives (hidden in print + on md+). */
const mobileWrap = "report-mobile-cards space-y-2 md:hidden";
const desktopWrap = "report-desktop-table hidden md:block";
const cardCls = "rounded-lg border border-border bg-card/60 p-3";
const rowCls = "flex items-center justify-between gap-3 text-sm";
const labelCls = "text-xs text-muted-foreground";

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
  const totalCount = rows.reduce((a, r) => a + r.count, 0);
  return (
    <>
      <div className={desktopWrap}>
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
              <td className={num + " font-semibold"}>{totalCount}</td>
              <td className={num + " font-semibold"}>{formatCurrency(grandTotal)}</td>
              <td className={num + " font-semibold"}>100.0%</td>
            </tr>
          </tfoot>
        </table>
      </div>

      <div className={mobileWrap}>
        {rows.map((r) => (
          <div key={r.id ?? r.name} className={cardCls}>
            <div className="flex items-start justify-between gap-3">
              <span className="text-sm font-semibold text-foreground">{r.name}</span>
              <span className="text-sm font-semibold tabular-nums">{formatCurrency(r.total)}</span>
            </div>
            <div className="mt-1 flex items-center justify-between text-xs text-muted-foreground">
              <span>{r.count} item{r.count === 1 ? "" : "s"}</span>
              <span>{r.percentage.toFixed(1)}%</span>
            </div>
          </div>
        ))}
        <div className={cardCls + " border-foreground/40 bg-muted/40"}>
          <div className={rowCls}>
            <span className="font-semibold">Grand Total ({totalCount})</span>
            <span className="font-semibold tabular-nums">{formatCurrency(grandTotal)}</span>
          </div>
        </div>
      </div>
    </>
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

          <div className={desktopWrap}>
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

          <div className={mobileWrap + " mt-2"}>
            {cat.subcategories.map((s) => (
              <div key={s.id ?? s.name} className={cardCls}>
                <div className="flex items-start justify-between gap-3">
                  <span className="text-sm font-medium text-foreground">{s.name}</span>
                  <span className="text-sm font-semibold tabular-nums">{formatCurrency(s.total)}</span>
                </div>
                <p className={labelCls + " mt-1"}>{s.count} item{s.count === 1 ? "" : "s"}</p>
              </div>
            ))}
          </div>
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

          <div className={desktopWrap}>
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

          <div className={mobileWrap + " mt-2"}>
            {sc.expenses.map((e) => (
              <div key={e.id} className={cardCls}>
                <div className="flex items-start justify-between gap-3">
                  <span className="text-sm font-medium text-foreground">{e.expense_number}</span>
                  <span className="text-sm font-semibold tabular-nums">{formatCurrency(e.amount)}</span>
                </div>
                <p className={labelCls + " mt-0.5"}>{formatDate(e.expense_date)}</p>
                <p className="mt-1 text-sm text-foreground">{e.description || "—"}</p>
              </div>
            ))}
          </div>
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
    <>
      <div className={desktopWrap}>
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
      </div>

      <div className={mobileWrap}>
        {rows.map((e) => (
          <div key={e.id} className={cardCls}>
            <div className="flex items-start justify-between gap-3">
              <span className="text-sm font-semibold text-foreground">{e.expense_number}</span>
              <span className="text-sm font-semibold tabular-nums">{formatCurrency(e.amount)}</span>
            </div>
            <p className={labelCls + " mt-0.5"}>{formatDate(e.expense_date)}</p>
            <p className="mt-1 text-sm text-foreground">{e.description || "—"}</p>
            <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 border-t border-border/60 pt-2 text-xs">
              <span className={labelCls}>Category</span>
              <span className="text-right text-foreground">{e.category_id ? cat.get(e.category_id) ?? "—" : "—"}</span>
              <span className={labelCls}>Subcategory</span>
              <span className="text-right text-foreground">{e.subcategory_id ? sub.get(e.subcategory_id) ?? "—" : "—"}</span>
              <span className={labelCls}>Approved by</span>
              <span className="text-right text-foreground">{e.approved_by ? userNames[e.approved_by] ?? "—" : "—"}</span>
              <span className={labelCls}>Approval date</span>
              <span className="text-right text-foreground">{formatDate(e.approved_at)}</span>
            </div>
          </div>
        ))}
        <div className={cardCls + " border-foreground/40 bg-muted/40"}>
          <div className={rowCls}>
            <span className="font-semibold">Grand Total ({rows.length})</span>
            <span className="font-semibold tabular-nums">{formatCurrency(total)}</span>
          </div>
        </div>
      </div>
    </>
  );
}
