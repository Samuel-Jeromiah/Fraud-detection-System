"use client";

/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useState } from "react";
import { Activity, BarChart3, Boxes, Gauge, Info, X } from "lucide-react";
import Plot from "@/components/Plot";
import { apiFetch, ApiError } from "@/lib/api";
import { ErrorState, PageHeader, Panel, Skeleton, StatCard } from "@/components/ui";

interface Meta {
  model_status: string;
  threshold: number;
  n_features: number;
  features: string[];
  categories: string[];
  feature_importance: Record<string, number>;
  final_test_metrics?: {
    roc_auc: number;
    average_precision: number;
    brier_score: number;
    precision: number;
    recall: number;
  } | null;
}

export default function ModelPage() {
  const [meta, setMeta] = useState<Meta | null>(null);
  const [error, setError] = useState<string | null>(null);

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
        <PageHeader eyebrow="Insights" title="Model" />
        <ErrorState message={error} onRetry={load} icon={X} />
      </div>
    );
  }

  if (!meta) {
    return (
      <div>
        <PageHeader eyebrow="Insights" title="Model" />
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-28" />)}</div>
        <Skeleton className="mt-6 h-[460px]" />
      </div>
    );
  }

  const ranked = Object.entries(meta.feature_importance)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 15);
  const importancePlot: any[] = [{
    type: "bar",
    orientation: "h",
    x: ranked.map(([, v]) => v).reverse(),
    y: ranked.map(([k]) => k.replace(/_/g, " ")).reverse(),
    marker: { color: "#10b981" },
    hovertemplate: "%{y}: %{x:.3f}<extra></extra>",
  }];
  const finalMetrics = meta.final_test_metrics
    ? [
      { label: "ROC-AUC", value: meta.final_test_metrics.roc_auc.toFixed(4) },
      { label: "PR-AUC", value: meta.final_test_metrics.average_precision.toFixed(4) },
      { label: "Brier score", value: meta.final_test_metrics.brier_score.toFixed(4) },
      { label: "Precision", value: `${(meta.final_test_metrics.precision * 100).toFixed(1)}%` },
      { label: "Recall", value: `${(meta.final_test_metrics.recall * 100).toFixed(1)}%` },
    ]
    : [];

  return (
    <div>
      <PageHeader eyebrow="Insights" title="Model" description="Feature importance is read from the currently deployed artifact. It is a global training signal, not an explanation of one transaction." />

      <div className="mb-6 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <StatCard label="Model state" value={meta.model_status.replace(/_/g, " ")} icon={Boxes} />
        <StatCard label="Features" value={`${meta.n_features}`} icon={BarChart3} tone="accent" />
        <StatCard label="Decision threshold" value={`${(meta.threshold * 100).toFixed(1)}%`} icon={Gauge} tone="success" />
        <StatCard label="Categories" value={`${meta.categories.length}`} icon={Activity} />
      </div>

      <Panel className="mb-6 flex h-[520px] flex-col p-6">
        <h3 className="text-lg font-bold text-fg">Feature importance (top 15)</h3>
        <p className="mb-4 text-xs text-fg-muted">Gain-based importance from the deployed tree model. A high value means the feature often helped split training examples; it does not establish causation.</p>
        <div className="min-h-0 flex-1"><Plot data={importancePlot} layout={{ margin: { l: 150, r: 16, t: 8, b: 32 } }} /></div>
      </Panel>

      <Panel className="p-6">
        <div className="mb-4 flex items-center justify-between gap-3">
          <h3 className="text-lg font-bold text-fg">Evaluation status</h3>
        </div>
        <div className="mt-4 flex items-start gap-2 rounded-lg border border-line bg-white/5 p-3 text-xs text-fg-muted">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-fg-subtle" aria-hidden />
          <span>{meta.model_status.startsWith("rebuilt_")
            ? "This bundle was rebuilt with time-ordered probability checking and threshold selection. Keep its generated metrics.json and plots with the deployed artifact; it names whether a fitted calibrator improved the held-out calibration check."
            : "The currently deployed artifact is the legacy baseline. Its old notebook metrics are intentionally not displayed because the threshold was selected on the reported test data. Train and deploy the rebuilt bundle before using this page as a performance report."}
          </span>
        </div>
        {finalMetrics.length > 0 && (
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {finalMetrics.map((metric) => (
              <div key={metric.label} className="rounded-lg bg-white/5 p-4">
                <div className="nums text-xl font-semibold text-fg">{metric.value}</div>
                <div className="mt-1 text-xs text-fg-muted">{metric.label}</div>
              </div>
            ))}
          </div>
        )}
      </Panel>
    </div>
  );
}
