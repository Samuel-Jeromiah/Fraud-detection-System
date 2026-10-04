import { Boxes, Gauge, Layers, Scale, ShieldCheck } from "lucide-react";
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
  ["Charts", "Accessible HTML & SVG"],
];

export default function PipelinePage() {
  return (
    <div>
      <PageHeader
        eyebrow="The methodology"
        title="From signals to scores."
        description="How synthetic transaction data becomes a calibrated risk score, with separate periods for fitting, calibration, threshold selection, and final testing."
      />

      <Panel className="mb-6 p-6">
        <h3 className="mb-5 text-lg font-bold text-fg">Training pipeline</h3>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5">
          {steps.map((s, i) => (
            <div key={s.title} className="min-w-0">
              <div className="flex h-full flex-col items-start gap-3 rounded-xl border border-line bg-white/[0.02] p-4">
                <span className="nums text-[10px] text-fg-subtle">STEP 0{i + 1}</span>
                <div className="grid h-10 w-10 place-items-center rounded-lg bg-brand/10 text-brand"><s.icon className="h-5 w-5" aria-hidden /></div>
                <div className="text-sm font-semibold text-fg">{s.title}</div>
                <div className="text-xs text-fg-subtle">{s.detail}</div>
              </div>
            </div>
          ))}
        </div>
        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4" aria-label="Development data split">
          {[["60%", "Model fitting"], ["10%", "Early stopping"], ["15%", "Calibration"], ["15%", "Threshold validation"]].map(([share, label]) => (
            <div key={label} className="border-t-2 border-brand/40 pt-3"><div className="nums text-xl text-fg">{share}</div><div className="mt-1 text-xs text-fg-muted">{label}</div></div>
          ))}
        </div>
        <details className="group mt-6 border-t border-line pt-4">
          <summary className="focus-ring cursor-pointer rounded text-sm font-medium text-brand">How we keep evaluation separate</summary>
        <div className="mt-4 space-y-3 text-sm leading-7 text-fg-muted">
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
        </details>
      </Panel>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Panel className="overflow-x-auto p-6 scrollbar-thin">
          <h3 className="mb-4 text-lg font-bold text-fg">Feature groups (26 encoded features)</h3>
          <table className="w-full table-fixed text-left text-sm">
            <thead className="border-b border-line bg-white/5 text-xs uppercase tracking-wide text-fg-subtle">
              <tr><th className="w-[30%] px-2 py-3">Group</th><th className="w-[18%] px-2 py-3">Count</th><th className="px-2 py-3">Examples</th></tr>
            </thead>
            <tbody>
              {featureGroups.map((g) => (
                <tr key={g.group} className="border-b border-line">
                  <td className="px-2 py-4 text-xs font-medium text-fg">{g.group}</td>
                  <td className="nums px-2 py-4 text-fg-muted">{g.count}</td>
                  <td className="break-words px-2 py-4 text-xs leading-5 text-fg-subtle">{g.examples.replaceAll("_", " ")}</td>
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
