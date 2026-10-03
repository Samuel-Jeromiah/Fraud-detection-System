import { ArrowRight, Boxes, Gauge, Layers, Scale, ShieldCheck } from "lucide-react";
import { PageHeader, Panel } from "@/components/ui";

const steps = [
  { icon: Boxes, title: "Split by time", detail: "separate development and test periods" },
  { icon: Layers, title: "Engineer", detail: "26 encoded features; past-only history" },
  { icon: ShieldCheck, title: "Fit XGBoost", detail: "class weighting and early stopping" },
  { icon: Scale, title: "Calibrate", detail: "isotonic selected by Brier score" },
  { icon: Gauge, title: "Validate & test", detail: "select 0.1891 threshold, then test" },
];

const featureGroups = [
  { group: "Transaction", count: 2, examples: "amount_log, amount_to_customer_avg" },
  { group: "Temporal", count: 4, examples: "transaction_hour, day_of_week, is_weekend, month" },
  { group: "Geographic", count: 2, examples: "distance_from_home_km, city_pop_log" },
  { group: "Customer history", count: 2, examples: "customer_prior_count, customer_prior_avg_amount" },
  { group: "Merchant history", count: 2, examples: "customer_merchant_prior_count, is_new_to_merchant" },
  { group: "Category", count: 14, examples: "one-hot indicators for the 14 transaction categories" },
];

const stack = [
  ["Model", "XGBoost (gradient-boosted trees)"],
  ["Class imbalance", "Fraud-class weighting; no SMOTE"],
  ["Calibration", "Isotonic regression"],
  ["Serving API", "FastAPI on Render"],
  ["Frontend", "Next.js + Tailwind on Vercel"],
  ["Charts", "Plotly"],
];

export default function PipelinePage() {
  return (
    <div>
      <PageHeader
        eyebrow="Insights"
        title="Pipeline"
        description="How synthetic transaction data becomes a calibrated risk score, with separate periods for fitting, calibration, threshold selection, and final testing."
      />

      <Panel className="mb-6 p-6">
        <h3 className="mb-5 text-lg font-bold text-fg">Training pipeline</h3>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-stretch">
          {steps.map((s, i) => (
            <div key={s.title} className="flex flex-1 items-center gap-3 sm:flex-col sm:gap-3">
              <div className="flex w-full flex-1 flex-col items-center gap-2 rounded-xl border border-line bg-white/5 p-4 text-center">
                <div className="grid h-10 w-10 place-items-center rounded-lg bg-brand/10 text-brand"><s.icon className="h-5 w-5" aria-hidden /></div>
                <div className="text-sm font-semibold text-fg">{s.title}</div>
                <div className="text-xs text-fg-subtle">{s.detail}</div>
              </div>
              {i < steps.length - 1 && <ArrowRight className="hidden h-5 w-5 shrink-0 text-fg-subtle sm:block" aria-hidden />}
            </div>
          ))}
        </div>
        <div className="mt-5 space-y-3 text-sm leading-relaxed text-fg-muted">
          <p>
            The 1,296,675 development rows are kept in time order: 60% (778,005) fit the model,
            10% (129,667) guide early stopping, 15% (194,501) calibrate probabilities, and
            15% (194,502) select the decision threshold. Preprocessing is fitted only on the model-fit window.
          </p>
          <p>
            Calibration candidates are fitted on the earlier two thirds of the calibration window and
            compared on its later third using Brier score. Isotonic calibration wins and is then refitted
            on that full window. The separate threshold-validation window selects 0.1891 to maximise
            precision while meeting an 80% recall target.
          </p>
          <p>
            Finally, the fixed model, calibrator, and threshold are evaluated on 555,719 later external
            test transactions, which were not used to fit or select them. History features use earlier
            transactions only, including earlier test events as time advances, without their fraud labels.
          </p>
        </div>
      </Panel>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Panel className="overflow-x-auto p-6 scrollbar-thin">
          <h3 className="mb-4 text-lg font-bold text-fg">Feature groups (26 encoded features)</h3>
          <table className="w-full text-left text-sm">
            <thead className="border-b border-line bg-white/5 text-xs uppercase tracking-wide text-fg-subtle">
              <tr><th className="px-4 py-3">Group</th><th className="px-4 py-3">Count</th><th className="px-4 py-3">Examples</th></tr>
            </thead>
            <tbody>
              {featureGroups.map((g) => (
                <tr key={g.group} className="border-b border-line">
                  <td className="px-4 py-3 font-medium text-fg">{g.group}</td>
                  <td className="nums px-4 py-3 text-fg-muted">{g.count}</td>
                  <td className="nums px-4 py-3 text-xs text-fg-subtle">{g.examples}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-4 text-xs leading-relaxed text-fg-muted">
            The model uses 12 numeric features and 14 category indicators. Customer averages and visit
            counts exclude the current transaction. Categories use one-hot encoding; merchant history
            uses prior counts, with no target encoding or demographic features.
          </p>
        </Panel>

        <Panel className="p-6">
          <h3 className="mb-4 text-lg font-bold text-fg">Tech stack</h3>
          <dl className="divide-y divide-line">
            {stack.map(([k, v]) => (
              <div key={k} className="flex items-center justify-between gap-4 py-3 text-sm">
                <dt className="text-fg-muted">{k}</dt>
                <dd className="text-right font-medium text-fg">{v}</dd>
              </div>
            ))}
          </dl>
          <div className="mt-4 rounded-lg border border-warning/30 bg-warning/10 p-3 text-xs text-fg-muted">
            <span className="font-medium text-warning">Note on imbalance:</span> fraud is 0.58% of development
            transactions and 0.39% of the final test. At the selected threshold, test recall is 80.56% and
            precision is 35.07%. This academic demo still produces false alerts and is not a production
            fraud decision system.
          </div>
        </Panel>
      </div>
    </div>
  );
}
