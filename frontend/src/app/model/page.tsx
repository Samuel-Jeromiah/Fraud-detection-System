"use client";

import { useEffect, useState } from "react";
import { ArrowDown, ArrowRight, BarChart3, CheckCircle2, Info, Layers3, X } from "lucide-react";
import { apiFetch, ApiError } from "@/lib/api";
import { Badge, Button, ErrorState, PageHeader, Panel, Skeleton } from "@/components/ui";

interface Meta {
  model_status: string;
  threshold: number;
  n_features: number;
  categories: string[];
  calibration_method?: string;
  feature_importance: Record<string, number>;
  final_test_metrics?: {
    roc_auc: number;
    average_precision: number;
    brier_score: number;
    precision: number;
    recall: number;
    confusion_matrix?: { tn: number; fp: number; fn: number; tp: number };
  } | null;
}

const FEATURE_LABELS: Record<string, string> = {
  amount_log: "Transaction amount (log)",
  city_pop_log: "City population (log)",
  distance_from_home_km: "Distance from home",
  transaction_hour: "Transaction hour",
  day_of_week: "Day of the week",
  is_weekend: "Weekend transaction",
  month: "Month of the year",
  customer_prior_count: "Previous transactions",
  customer_prior_avg_amount: "Previous average spend",
  amount_to_customer_avg: "Amount vs. usual spend",
  customer_merchant_prior_count: "Previous merchant visits",
  is_new_to_merchant: "First visit to merchant",
};

const CATEGORY_LABELS: Record<string, string> = {
  entertainment: "Entertainment",
  food_dining: "Food & dining",
  gas_transport: "Gas & transport",
  grocery_net: "Groceries · online",
  grocery_pos: "Groceries · in-store",
  health_fitness: "Health & fitness",
  home: "Home",
  kids_pets: "Kids & pets",
  misc_net: "Other · online",
  misc_pos: "Other · in-store",
  personal_care: "Personal care",
  shopping_net: "Shopping · online",
  shopping_pos: "Shopping · in-store",
  travel: "Travel",
};

function featureLabel(name: string) {
  const feature = name.split("__").at(-1) ?? name;
  if (feature.startsWith("category_")) {
    const category = feature.slice("category_".length);
    return CATEGORY_LABELS[category] ?? category.replaceAll("_", " ");
  }
  return FEATURE_LABELS[feature] ?? feature.replaceAll("_", " ");
}

const formatCount = (value: number) => value.toLocaleString("en-US");

export default function ModelPage() {
  const [meta, setMeta] = useState<Meta | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showAllFeatures, setShowAllFeatures] = useState(false);

  const load = async () => {
    setError(null);
    setMeta(null);
    try {
      setMeta(await apiFetch<Meta>("/api/metadata"));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to load model metadata.");
    }
  };

  useEffect(() => {
    let active = true;
    apiFetch<Meta>("/api/metadata")
      .then((data) => {
        if (active) setMeta(data);
      })
      .catch((err) => {
        if (active) setError(err instanceof ApiError ? err.message : "Failed to load model metadata.");
      });
    return () => { active = false; };
  }, []);

  if (error) {
    return (
      <div>
        <PageHeader eyebrow="Model insights" title="Behind the prediction" />
        <ErrorState message={error} onRetry={load} icon={X} />
      </div>
    );
  }

  if (!meta) {
    return (
      <div aria-busy="true" aria-label="Loading model performance">
        <PageHeader eyebrow="Model insights" title="Behind the prediction" />
        <Skeleton className="mb-5 h-28" />
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">{[0, 1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-32" />)}</div>
        <Skeleton className="mt-5 h-[460px]" />
      </div>
    );
  }

  const allRanked = Object.entries(meta.feature_importance).sort(([, a], [, b]) => b - a);
  const ranked = allRanked.slice(0, showAllFeatures ? 15 : 10);
  const maxImportance = allRanked[0]?.[1] || 1;
  const rebuilt = meta.model_status.startsWith("rebuilt_");
  const calibrated = meta.model_status === "rebuilt_calibrated";
  const modelLabel = calibrated ? "Calibrated model" : rebuilt ? "Probability checked" : "Legacy baseline";
  const matrix = meta.final_test_metrics?.confusion_matrix;
  const testCount = matrix ? matrix.tn + matrix.fp + matrix.fn + matrix.tp : null;
  const finalMetrics = meta.final_test_metrics
    ? [
      { label: "Fraud caught", value: `${(meta.final_test_metrics.recall * 100).toFixed(1)}%`, detail: "Recall · of all actual fraud", highlight: true },
      { label: "Alert precision", value: `${(meta.final_test_metrics.precision * 100).toFixed(1)}%`, detail: "Of flagged transactions, how many were fraud", highlight: false },
      { label: "ROC-AUC", value: meta.final_test_metrics.roc_auc.toFixed(4), detail: "Ranking quality · higher is better", highlight: false },
      { label: "PR-AUC (AP)", value: meta.final_test_metrics.average_precision.toFixed(4), detail: "Precision–recall quality · higher is better", highlight: false },
      { label: "Brier score", value: meta.final_test_metrics.brier_score.toFixed(4), detail: "Probability error · lower is better", highlight: false },
    ]
    : [];

  return (
    <div>
      <PageHeader
        eyebrow="Model insights"
        title="Behind the prediction"
        description="See how the deployed model performs, which signals it uses, and where it makes mistakes."
        actions={<Badge tone={calibrated ? "success" : "neutral"}><span className={`h-1.5 w-1.5 rounded-full ${calibrated ? "bg-success" : "bg-fg-muted"}`} />{modelLabel}</Badge>}
      />

      <Panel className="mb-7 flex flex-col gap-6 p-5 sm:p-6 xl:flex-row xl:items-center xl:justify-between">
        <div className="flex items-center gap-4">
          <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-brand/20 bg-brand/10 text-brand"><Layers3 className="h-5 w-5" aria-hidden /></div>
          <div>
            <h2 className="text-base font-semibold text-fg">XGBoost fraud detection</h2>
            <p className="mt-1 text-xs leading-relaxed text-fg-muted">{calibrated ? `${meta.calibration_method === "isotonic" ? "Isotonic calibration" : "Probability calibration"} · Time-ordered evaluation` : rebuilt ? "Time-ordered evaluation" : "Legacy model artifact"}</p>
          </div>
        </div>
        <dl className="grid grid-cols-3 gap-4 border-t border-line pt-5 xl:min-w-[380px] xl:border-l xl:border-t-0 xl:pl-7 xl:pt-0">
          <div><dt className="text-xs text-fg-muted">Alert threshold</dt><dd className="nums mt-2 text-xl font-medium text-fg">{(meta.threshold * 100).toFixed(1)}%</dd></div>
          <div><dt className="text-xs text-fg-muted">Model inputs</dt><dd className="nums mt-2 text-xl font-medium text-fg">{meta.n_features}</dd></div>
          <div><dt className="text-xs text-fg-muted">Categories</dt><dd className="nums mt-2 text-xl font-medium text-fg">{meta.categories.length}</dd></div>
        </dl>
      </Panel>

      {finalMetrics.length > 0 && (
        <section className="mb-7" aria-labelledby="evaluation-title">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <h2 id="evaluation-title" className="text-base font-semibold text-fg">Performance on unseen data</h2>
            <span className="text-xs text-fg-muted">{testCount !== null ? `${formatCount(testCount)} test transactions` : "Final held-out test set"}</span>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
            {finalMetrics.map((metric) => (
              <Panel key={metric.label} className={`p-4 sm:p-5 ${metric.highlight ? "border-brand/30 bg-brand/5" : ""}`}>
                <div className="text-xs font-medium text-fg-muted">{metric.label}</div>
                <div className={`nums mt-3 text-2xl font-medium tracking-tight ${metric.highlight ? "text-brand" : "text-fg"}`}>{metric.value}</div>
                <p className="mt-2 text-xs leading-relaxed text-fg-subtle">{metric.detail}</p>
              </Panel>
            ))}
          </div>
        </section>
      )}

      <div className="grid items-start gap-5 xl:grid-cols-[1.1fr_1fr]">
        <Panel className="min-w-0 p-5 sm:p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-base font-semibold text-fg">What the model learns from</h2>
              <p className="mt-1.5 text-xs leading-relaxed text-fg-muted">Top {ranked.length} inputs by gain-based importance.</p>
            </div>
            <BarChart3 className="mt-0.5 h-5 w-5 shrink-0 text-fg-subtle" aria-hidden />
          </div>
          <ol id="feature-importance" className="mt-6 space-y-4">
            {ranked.map(([name, value], index) => (
              <li key={name}>
                <div className="mb-2 flex items-baseline justify-between gap-3 text-xs">
                  <span className="min-w-0 leading-relaxed text-fg"><span className="nums mr-2.5 text-[10px] text-fg-subtle" aria-hidden>{String(index + 1).padStart(2, "0")}</span>{featureLabel(name)}</span>
                  <span className="nums shrink-0 text-fg-muted">{(value * 100).toFixed(1)}%</span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-white/5" aria-hidden>
                  <div className={`h-full rounded-full ${index < 3 ? "bg-brand" : "bg-brand/45"}`} style={{ width: `${Math.max(0, Math.min(100, value / maxImportance * 100))}%` }} />
                </div>
              </li>
            ))}
          </ol>
          {allRanked.length > 10 && <Button className="mt-5 w-full" variant="ghost" aria-expanded={showAllFeatures} aria-controls="feature-importance" onClick={() => setShowAllFeatures(!showAllFeatures)}>{showAllFeatures ? "Show top 10 inputs" : `Show top ${Math.min(15, allRanked.length)} inputs`}</Button>}
          <p className="mt-5 border-t border-line pt-4 text-xs leading-relaxed text-fg-subtle">Percentages show the share of total feature importance; bar lengths are relative to the strongest input. This is a global training signal, not an explanation for an individual transaction or evidence of causation.</p>
        </Panel>

        <div className="min-w-0 space-y-5">
          {matrix && (
            <Panel className="p-5 sm:p-6">
              <h2 className="text-base font-semibold text-fg">Where predictions land</h2>
              <p className="mt-1.5 text-xs leading-relaxed text-fg-muted">Confusion matrix at the {(meta.threshold * 100).toFixed(1)}% alert threshold.</p>
              <div className="mt-6 flex items-center justify-between gap-2 text-[10px] font-medium uppercase tracking-wider text-fg-subtle">
                <span className="inline-flex items-center gap-1">Actual <ArrowDown className="h-3 w-3" aria-hidden /></span>
                <span className="inline-flex items-center gap-1">Predicted <ArrowRight className="h-3 w-3" aria-hidden /></span>
              </div>
              <table className="mt-2 w-full table-fixed border-separate border-spacing-1 text-left">
                <caption className="sr-only">Confusion matrix. Rows are actual classes; columns are model predictions.</caption>
                <thead><tr><th scope="col" className="w-[23%]"><span className="sr-only">Actual class</span></th><th scope="col" className="pb-2 text-center text-xs font-medium text-fg-muted">Clear</th><th scope="col" className="pb-2 text-center text-xs font-medium text-fg-muted">Flagged</th></tr></thead>
                <tbody>
                  <tr>
                    <th scope="row" className="pr-1 text-[11px] font-medium text-fg-muted">Legitimate</th>
                    <td className="rounded-lg border border-brand/15 bg-brand/[0.07] px-1 py-5 text-center"><span className="nums block text-base font-medium text-fg sm:text-xl">{formatCount(matrix.tn)}</span><span className="mt-1.5 block text-[10px] text-fg-muted">Correctly cleared</span></td>
                    <td className="rounded-lg border border-warning/15 bg-warning/5 px-1 py-5 text-center"><span className="nums block text-base font-medium text-warning sm:text-xl">{formatCount(matrix.fp)}</span><span className="mt-1.5 block text-[10px] text-fg-muted">False alerts</span></td>
                  </tr>
                  <tr>
                    <th scope="row" className="pr-1 text-[11px] font-medium text-fg-muted">Fraudulent</th>
                    <td className="rounded-lg border border-danger/15 bg-danger/5 px-1 py-5 text-center"><span className="nums block text-base font-medium text-danger sm:text-xl">{formatCount(matrix.fn)}</span><span className="mt-1.5 block text-[10px] text-fg-muted">Missed fraud</span></td>
                    <td className="rounded-lg border border-brand/15 bg-brand/[0.07] px-1 py-5 text-center"><span className="nums block text-base font-medium text-brand sm:text-xl">{formatCount(matrix.tp)}</span><span className="mt-1.5 block text-[10px] text-fg-muted">Fraud caught</span></td>
                  </tr>
                </tbody>
              </table>
              <p className="mt-4 text-xs leading-relaxed text-fg-subtle">A flagged transaction needs review. False alerts are legitimate transactions that the model flagged; missed fraud was incorrectly cleared.</p>
            </Panel>
          )}

          <Panel className="p-5 sm:p-6">
            <div className="flex items-center gap-2.5"><CheckCircle2 className="h-4 w-4 text-brand" aria-hidden /><h2 className="text-base font-semibold text-fg">How to read these results</h2></div>
            <p className="mt-4 text-sm leading-relaxed text-fg-muted">{rebuilt
              ? "The model was trained on earlier transactions. Probability calibration and the alert threshold were selected using later validation data, before the final test evaluation."
              : "This is the legacy baseline. Its old notebook metrics are omitted because its threshold was selected on the reported test data. Deploy the rebuilt model for a reliable performance report."}
            </p>
            <div className="mt-5 flex items-start gap-2.5 rounded-xl border border-line bg-white/[0.02] p-3.5">
              <Info className="mt-0.5 h-4 w-4 shrink-0 text-fg-subtle" aria-hidden />
              <p className="text-xs leading-relaxed text-fg-muted">Academic demonstration using synthetic transaction data. These results describe this test set and do not establish real-world fraud detection performance.</p>
            </div>
          </Panel>
        </div>
      </div>
    </div>
  );
}
