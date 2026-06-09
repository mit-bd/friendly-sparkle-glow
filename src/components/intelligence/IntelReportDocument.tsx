import { ReportDocument } from "@/components/reports/ReportDocument";
import { formatCurrency } from "@/lib/expenses";
import {
  formatPct,
  type Anomaly,
  type CompositionSlice,
  type HealthScore,
  type Insight,
  type Kpi,
  type PerfRow,
  type IntelTotals,
} from "@/lib/intelligence";

export interface IntelReportModel {
  reportNumber: string;
  generatedAt: string;
  generatedBy: string;
  rangeLabel: string;
  totals: IntelTotals;
  kpis: Kpi[];
  composition: CompositionSlice[];
  categoryPerf: PerfRow[];
  anomalies: Anomaly[];
  insights: Insight[];
  health: HealthScore;
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="report-block space-y-2">
      <h2 className="text-sm font-bold uppercase tracking-wide text-brand">{title}</h2>
      {children}
    </div>
  );
}

export function IntelReportDocument({ model }: { model: IntelReportModel }) {
  return (
    <ReportDocument
      reportName="Executive Expense Intelligence Report"
      reportNumber={model.reportNumber}
      generatedAt={model.generatedAt}
      generatedBy={model.generatedBy}
      dateRangeLabel={model.rangeLabel}
    >
      <Section title="Key Performance Indicators">
        <table className="report-table w-full border-collapse text-xs">
          <thead>
            <tr className="border-b border-border text-left text-muted-foreground">
              <th className="py-1.5 pr-3 font-medium">Metric</th>
              <th className="py-1.5 pr-3 text-right font-medium">Current</th>
              <th className="py-1.5 pr-3 text-right font-medium">Previous</th>
              <th className="py-1.5 text-right font-medium">Change</th>
            </tr>
          </thead>
          <tbody>
            {model.kpis.map((k) => (
              <tr key={k.key} className="border-b border-border/60">
                <td className="py-1.5 pr-3 font-medium">{k.label}</td>
                <td className="py-1.5 pr-3 text-right tabular-nums">{formatCurrency(k.current)}</td>
                <td className="py-1.5 pr-3 text-right tabular-nums">{formatCurrency(k.previous)}</td>
                <td className="py-1.5 text-right tabular-nums">{formatPct(k.changePct)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Section>

      <Section title="Expense Composition">
        <table className="report-table w-full border-collapse text-xs">
          <thead>
            <tr className="border-b border-border text-left text-muted-foreground">
              <th className="py-1.5 pr-3 font-medium">Segment</th>
              <th className="py-1.5 pr-3 text-right font-medium">Amount</th>
              <th className="py-1.5 text-right font-medium">Share</th>
            </tr>
          </thead>
          <tbody>
            {model.composition.map((s) => (
              <tr key={s.key} className="border-b border-border/60">
                <td className="py-1.5 pr-3 font-medium">{s.name}</td>
                <td className="py-1.5 pr-3 text-right tabular-nums">{formatCurrency(s.value)}</td>
                <td className="py-1.5 text-right tabular-nums">{s.percentage.toFixed(1)}%</td>
              </tr>
            ))}
            <tr className="font-semibold">
              <td className="py-1.5 pr-3">Total Outflow</td>
              <td className="py-1.5 pr-3 text-right tabular-nums">{formatCurrency(model.totals.grandOutflow)}</td>
              <td className="py-1.5 text-right tabular-nums">100.0%</td>
            </tr>
          </tbody>
        </table>
      </Section>

      <Section title="Fixed vs Variable">
        <p className="text-xs">
          Fixed Cost: <strong>{formatCurrency(model.totals.fixed)}</strong> ·
          Variable Cost: <strong>{formatCurrency(model.totals.variable)}</strong>
        </p>
      </Section>

      <Section title="Top Categories">
        <table className="report-table w-full border-collapse text-xs">
          <thead>
            <tr className="border-b border-border text-left text-muted-foreground">
              <th className="py-1.5 pr-3 font-medium">Category</th>
              <th className="py-1.5 pr-3 text-right font-medium">Total</th>
              <th className="py-1.5 pr-3 text-right font-medium">Share</th>
              <th className="py-1.5 text-right font-medium">Growth</th>
            </tr>
          </thead>
          <tbody>
            {model.categoryPerf.slice(0, 10).map((c) => (
              <tr key={c.id ?? "none"} className="border-b border-border/60">
                <td className="py-1.5 pr-3 font-medium">{c.name}</td>
                <td className="py-1.5 pr-3 text-right tabular-nums">{formatCurrency(c.total)}</td>
                <td className="py-1.5 pr-3 text-right tabular-nums">{c.percentage.toFixed(1)}%</td>
                <td className="py-1.5 text-right tabular-nums">{formatPct(c.growthPct)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Section>

      <Section title="Anomalies Detected">
        {model.anomalies.length === 0 ? (
          <p className="text-xs">No abnormal cost movements detected.</p>
        ) : (
          <ul className="list-disc space-y-1 pl-5 text-xs">
            {model.anomalies.slice(0, 10).map((a) => (
              <li key={a.key}>
                {a.label} ({a.scope}): {a.direction === "increase" ? "abnormal increase" : "sharp drop"}{" "}
                {formatPct(a.changePct)} — avg {formatCurrency(a.average)}, current {formatCurrency(a.current)}
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section title="Management Summary">
        <ul className="list-disc space-y-1 pl-5 text-xs">
          {model.insights.map((ins, i) => (
            <li key={i}>{ins.text}</li>
          ))}
        </ul>
      </Section>

      <Section title="Expense Health Score">
        <p className="text-xs">
          Overall: <strong>{model.health.score}/100 ({model.health.band})</strong>
        </p>
        <ul className="list-disc space-y-0.5 pl-5 text-xs">
          {model.health.factors.map((f) => (
            <li key={f.label}>
              {f.label}: {f.score}/100 ({f.detail})
            </li>
          ))}
        </ul>
      </Section>
    </ReportDocument>
  );
}