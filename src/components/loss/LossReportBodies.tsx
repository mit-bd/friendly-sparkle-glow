import { formatDate } from "@/lib/expenses";
import {
  formatTk,
  type DamageRecord,
  type DamageType,
  type ReasonSummaryRow,
  type ReturnReason,
  type ReturnRecord,
  type TypeSummaryRow,
  type MonthlyPoint,
} from "@/lib/loss";

const th = "px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wide text-muted-foreground";
const td = "px-3 py-2 text-sm text-foreground align-top";
const num = "px-3 py-2 text-sm text-foreground text-right tabular-nums align-top";

const mobileWrap = "report-mobile-cards space-y-2 md:hidden";
const desktopWrap = "report-desktop-table hidden md:block";
const cardCls = "rounded-lg border border-border bg-card/60 p-3";
const labelCls = "text-xs text-muted-foreground";

function MetaGrid({ items }: { items: [string, string][] }) {
  return (
    <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 border-t border-border/60 pt-2 text-xs">
      {items.map(([k, v]) => (
        <div key={k} className="contents">
          <span className={labelCls}>{k}</span>
          <span className="text-right text-foreground">{v}</span>
        </div>
      ))}
    </div>
  );
}

export function EmptyReportNote() {
  return (
    <p className="rounded-md border border-dashed border-border py-10 text-center text-sm text-muted-foreground">
      No approved records found for the selected criteria.
    </p>
  );
}

export function ReasonSummaryBody({ rows, grandNetLoss }: { rows: ReasonSummaryRow[]; grandNetLoss: number }) {
  if (rows.length === 0) return <EmptyReportNote />;
  return (
    <>
      <div className={desktopWrap}>
        <table className="report-table w-full border-collapse">
          <thead><tr className="border-b-2 border-border">
            <th className={th}>Return Reason</th><th className={th + " text-right"}>Count</th><th className={th + " text-right"}>Loss</th><th className={th + " text-right"}>Recoverable</th><th className={th + " text-right"}>Net Loss</th><th className={th + " text-right"}>%</th></tr></thead>
          <tbody>{rows.map((r) => (<tr key={r.id ?? r.name} className="border-b border-border"><td className={td}>{r.name}</td><td className={num}>{r.count}</td><td className={num}>{formatTk(r.loss)}</td><td className={num}>{formatTk(r.recoverable)}</td><td className={num}>{formatTk(r.netLoss)}</td><td className={num}>{r.percentage.toFixed(1)}%</td></tr>))}</tbody>
          <tfoot><tr className="border-t-2 border-foreground/70 font-semibold"><td className={td + " font-semibold"}>Grand Total</td><td className={num + " font-semibold"}>{rows.reduce((a, r) => a + r.count, 0)}</td><td className={num + " font-semibold"}>{formatTk(rows.reduce((a, r) => a + r.loss, 0))}</td><td className={num + " font-semibold"}>{formatTk(rows.reduce((a, r) => a + r.recoverable, 0))}</td><td className={num + " font-semibold"}>{formatTk(grandNetLoss)}</td><td className={num + " font-semibold"}>100.0%</td></tr></tfoot>
        </table>
      </div>
      <div className={mobileWrap}>
        {rows.map((r) => (
          <div key={r.id ?? r.name} className={cardCls}>
            <div className="flex items-start justify-between gap-3">
              <span className="text-sm font-semibold text-foreground">{r.name}</span>
              <span className="text-sm font-semibold tabular-nums">{formatTk(r.netLoss)}</span>
            </div>
            <MetaGrid items={[["Count", String(r.count)], ["Loss", formatTk(r.loss)], ["Recoverable", formatTk(r.recoverable)], ["% of total", `${r.percentage.toFixed(1)}%`]]} />
          </div>
        ))}
        <div className={cardCls + " border-foreground/40 bg-muted/40"}>
          <div className="flex items-center justify-between text-sm"><span className="font-semibold">Grand Net Loss</span><span className="font-semibold tabular-nums">{formatTk(grandNetLoss)}</span></div>
        </div>
      </div>
    </>
  );
}

export function ReturnLedgerBody({ rows, reasons }: { rows: ReturnRecord[]; reasons: ReturnReason[] }) {
  if (rows.length === 0) return <EmptyReportNote />;
  const reasonName = new Map(reasons.map((r) => [r.id, r.name]));
  const totalNet = rows.reduce((a, r) => a + Number(r.net_loss_amount || 0), 0);
  return (
    <>
      <div className={desktopWrap}>
        <table className="report-table w-full border-collapse">
          <thead><tr className="border-b-2 border-border"><th className={th}>Return No.</th><th className={th}>Date</th><th className={th}>Product</th><th className={th}>Reason</th><th className={th + " text-right"}>Qty</th><th className={th + " text-right"}>Loss</th><th className={th + " text-right"}>Recoverable</th><th className={th + " text-right"}>Net Loss</th></tr></thead>
          <tbody>{rows.map((r) => (<tr key={r.id} className="border-b border-border break-inside-avoid"><td className={td + " whitespace-nowrap font-medium"}>{r.return_number}</td><td className={td + " whitespace-nowrap"}>{formatDate(r.return_date)}</td><td className={td}>{r.product_name || "—"}</td><td className={td}>{r.reason_id ? reasonName.get(r.reason_id) ?? "—" : "—"}</td><td className={num}>{r.quantity}</td><td className={num}>{formatTk(r.loss_amount)}</td><td className={num}>{formatTk(r.recoverable_amount)}</td><td className={num}>{formatTk(r.net_loss_amount)}</td></tr>))}</tbody>
          <tfoot><tr className="border-t-2 border-foreground/70 font-semibold"><td className={td + " font-semibold"} colSpan={7}>Grand Total ({rows.length})</td><td className={num + " font-semibold"}>{formatTk(totalNet)}</td></tr></tfoot>
        </table>
      </div>
      <div className={mobileWrap}>
        {rows.map((r) => (
          <div key={r.id} className={cardCls}>
            <div className="flex items-start justify-between gap-3">
              <span className="text-sm font-semibold text-foreground">{r.return_number}</span>
              <span className="text-sm font-semibold tabular-nums">{formatTk(r.net_loss_amount)}</span>
            </div>
            <p className={labelCls + " mt-0.5"}>{formatDate(r.return_date)}</p>
            <p className="mt-1 text-sm text-foreground">{r.product_name || "—"}</p>
            <MetaGrid items={[["Reason", r.reason_id ? reasonName.get(r.reason_id) ?? "—" : "—"], ["Qty", String(r.quantity)], ["Loss", formatTk(r.loss_amount)], ["Recoverable", formatTk(r.recoverable_amount)]]} />
          </div>
        ))}
        <div className={cardCls + " border-foreground/40 bg-muted/40"}>
          <div className="flex items-center justify-between text-sm"><span className="font-semibold">Grand Net Loss ({rows.length})</span><span className="font-semibold tabular-nums">{formatTk(totalNet)}</span></div>
        </div>
      </div>
    </>
  );
}

export function TypeSummaryBody({ rows, grandValue }: { rows: TypeSummaryRow[]; grandValue: number }) {
  if (rows.length === 0) return <EmptyReportNote />;
  return (
    <>
      <div className={desktopWrap}>
        <table className="report-table w-full border-collapse">
          <thead><tr className="border-b-2 border-border"><th className={th}>Damage Type</th><th className={th + " text-right"}>Count</th><th className={th + " text-right"}>Damage Value</th><th className={th + " text-right"}>%</th></tr></thead>
          <tbody>{rows.map((r) => (<tr key={r.id ?? r.name} className="border-b border-border"><td className={td}>{r.name}</td><td className={num}>{r.count}</td><td className={num}>{formatTk(r.value)}</td><td className={num}>{r.percentage.toFixed(1)}%</td></tr>))}</tbody>
          <tfoot><tr className="border-t-2 border-foreground/70 font-semibold"><td className={td + " font-semibold"}>Grand Total</td><td className={num + " font-semibold"}>{rows.reduce((a, r) => a + r.count, 0)}</td><td className={num + " font-semibold"}>{formatTk(grandValue)}</td><td className={num + " font-semibold"}>100.0%</td></tr></tfoot>
        </table>
      </div>
      <div className={mobileWrap}>
        {rows.map((r) => (
          <div key={r.id ?? r.name} className={cardCls}>
            <div className="flex items-start justify-between gap-3">
              <span className="text-sm font-semibold text-foreground">{r.name}</span>
              <span className="text-sm font-semibold tabular-nums">{formatTk(r.value)}</span>
            </div>
            <div className="mt-1 flex items-center justify-between text-xs text-muted-foreground"><span>{r.count} item{r.count === 1 ? "" : "s"}</span><span>{r.percentage.toFixed(1)}%</span></div>
          </div>
        ))}
        <div className={cardCls + " border-foreground/40 bg-muted/40"}>
          <div className="flex items-center justify-between text-sm"><span className="font-semibold">Grand Total</span><span className="font-semibold tabular-nums">{formatTk(grandValue)}</span></div>
        </div>
      </div>
    </>
  );
}

export function DamageLedgerBody({ rows, types }: { rows: DamageRecord[]; types: DamageType[] }) {
  if (rows.length === 0) return <EmptyReportNote />;
  const typeName = new Map(types.map((t) => [t.id, t.name]));
  const total = rows.reduce((a, r) => a + Number(r.damage_value || 0), 0);
  return (
    <>
      <div className={desktopWrap}>
        <table className="report-table w-full border-collapse">
          <thead><tr className="border-b-2 border-border"><th className={th}>Damage No.</th><th className={th}>Date</th><th className={th}>Product</th><th className={th}>Type</th><th className={th + " text-right"}>Qty</th><th className={th + " text-right"}>Damage Value</th></tr></thead>
          <tbody>{rows.map((r) => (<tr key={r.id} className="border-b border-border break-inside-avoid"><td className={td + " whitespace-nowrap font-medium"}>{r.damage_number}</td><td className={td + " whitespace-nowrap"}>{formatDate(r.damage_date)}</td><td className={td}>{r.product_name || "—"}</td><td className={td}>{r.type_id ? typeName.get(r.type_id) ?? "—" : "—"}</td><td className={num}>{r.quantity}</td><td className={num}>{formatTk(r.damage_value)}</td></tr>))}</tbody>
          <tfoot><tr className="border-t-2 border-foreground/70 font-semibold"><td className={td + " font-semibold"} colSpan={5}>Grand Total ({rows.length})</td><td className={num + " font-semibold"}>{formatTk(total)}</td></tr></tfoot>
        </table>
      </div>
      <div className={mobileWrap}>
        {rows.map((r) => (
          <div key={r.id} className={cardCls}>
            <div className="flex items-start justify-between gap-3">
              <span className="text-sm font-semibold text-foreground">{r.damage_number}</span>
              <span className="text-sm font-semibold tabular-nums">{formatTk(r.damage_value)}</span>
            </div>
            <p className={labelCls + " mt-0.5"}>{formatDate(r.damage_date)}</p>
            <p className="mt-1 text-sm text-foreground">{r.product_name || "—"}</p>
            <MetaGrid items={[["Type", r.type_id ? typeName.get(r.type_id) ?? "—" : "—"], ["Qty", String(r.quantity)]]} />
          </div>
        ))}
        <div className={cardCls + " border-foreground/40 bg-muted/40"}>
          <div className="flex items-center justify-between text-sm"><span className="font-semibold">Grand Total ({rows.length})</span><span className="font-semibold tabular-nums">{formatTk(total)}</span></div>
        </div>
      </div>
    </>
  );
}

export function MonthlyBody({ points, label }: { points: MonthlyPoint[]; label: string }) {
  if (points.length === 0) return <EmptyReportNote />;
  const total = points.reduce((a, p) => a + p.total, 0);
  return (
    <>
      <div className={desktopWrap}>
        <table className="report-table w-full border-collapse">
          <thead><tr className="border-b-2 border-border"><th className={th}>Month</th><th className={th + " text-right"}>{label}</th></tr></thead>
          <tbody>{points.map((p) => (<tr key={p.key} className="border-b border-border"><td className={td}>{p.label}</td><td className={num}>{formatTk(p.total)}</td></tr>))}</tbody>
          <tfoot><tr className="border-t-2 border-foreground/70 font-semibold"><td className={td + " font-semibold"}>Grand Total</td><td className={num + " font-semibold"}>{formatTk(total)}</td></tr></tfoot>
        </table>
      </div>
      <div className={mobileWrap}>
        {points.map((p) => (
          <div key={p.key} className={cardCls + " flex items-center justify-between"}>
            <span className="text-sm font-medium text-foreground">{p.label}</span>
            <span className="text-sm font-semibold tabular-nums">{formatTk(p.total)}</span>
          </div>
        ))}
        <div className={cardCls + " border-foreground/40 bg-muted/40 flex items-center justify-between"}>
          <span className="text-sm font-semibold">Grand Total</span>
          <span className="text-sm font-semibold tabular-nums">{formatTk(total)}</span>
        </div>
      </div>
    </>
  );
}

export function LossAnalysisBody({ returnNetLoss, damageValue }: { returnNetLoss: number; damageValue: number }) {
  const combined = returnNetLoss + damageValue;
  const pctOf = (v: number) => (combined > 0 ? ((v / combined) * 100).toFixed(1) : "0.0");
  const items: [string, number][] = [["Net Return Loss", returnNetLoss], ["Damage Loss", damageValue]];
  return (
    <>
      <div className={desktopWrap}>
        <table className="report-table w-full border-collapse">
          <thead><tr className="border-b-2 border-border"><th className={th}>Loss Source</th><th className={th + " text-right"}>Amount</th><th className={th + " text-right"}>% of Combined</th></tr></thead>
          <tbody>
            <tr className="border-b border-border"><td className={td}>Net Return Loss</td><td className={num}>{formatTk(returnNetLoss)}</td><td className={num}>{pctOf(returnNetLoss)}%</td></tr>
            <tr className="border-b border-border"><td className={td}>Damage Loss</td><td className={num}>{formatTk(damageValue)}</td><td className={num}>{pctOf(damageValue)}%</td></tr>
          </tbody>
          <tfoot><tr className="border-t-2 border-foreground/70 font-semibold"><td className={td + " font-semibold"}>Combined Loss</td><td className={num + " font-semibold"}>{formatTk(combined)}</td><td className={num + " font-semibold"}>100.0%</td></tr></tfoot>
        </table>
      </div>
      <div className={mobileWrap}>
        {items.map(([k, v]) => (
          <div key={k} className={cardCls}>
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium text-foreground">{k}</span>
              <span className="font-semibold tabular-nums">{formatTk(v)}</span>
            </div>
            <p className={labelCls + " mt-0.5"}>{pctOf(v)}% of combined</p>
          </div>
        ))}
        <div className={cardCls + " border-foreground/40 bg-muted/40 flex items-center justify-between"}>
          <span className="text-sm font-semibold">Combined Loss</span>
          <span className="text-sm font-semibold tabular-nums">{formatTk(combined)}</span>
        </div>
      </div>
    </>
  );
}
