"use client";

import { useEffect, useState, type FormEvent } from "react";
import { AlertTriangle, ArrowRight, Beaker, CheckCircle2, Gauge as GaugeIcon, Info, ShieldAlert } from "lucide-react";
import { apiFetch, ApiError } from "@/lib/api";
import { Badge, Button, ErrorState, PageHeader, Panel } from "@/components/ui";

const FALLBACK_CATEGORIES = [
  "entertainment", "food_dining", "gas_transport", "grocery_net", "grocery_pos",
  "health_fitness", "home", "kids_pets", "misc_net", "misc_pos",
  "personal_care", "shopping_net", "shopping_pos", "travel",
];
const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

interface Meta { threshold: number; categories: string[]; model_status?: string }
interface ScoreResult {
  probability: number;
  threshold: number;
  is_fraud: boolean;
  risk_tier: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  factors: { factor: string; value: string; signal: string }[];
}

const SAMPLE = {
  amount: 925, category: "grocery_pos", hour: 2, day_of_week: 6, month: 11, distance_from_home_km: 450,
  customer_prior_count: 6, customer_prior_avg_amount: 48, customer_merchant_prior_count: 0, city_pop: 1200,
};
const ROUTINE = {
  amount: 42, category: "food_dining", hour: 13, day_of_week: 2, month: 6, distance_from_home_km: 6,
  customer_prior_count: 120, customer_prior_avg_amount: 55, customer_merchant_prior_count: 12, city_pop: 80000,
};
type ScoreForm = { [K in keyof typeof SAMPLE]: (typeof SAMPLE)[K] | "" };
type NumericField = Exclude<keyof ScoreForm, "category">;

const tierTone = { LOW: "success", MEDIUM: "warning", HIGH: "danger", CRITICAL: "danger" } as const;
const inputCls = "focus-ring min-h-[46px] w-full rounded-xl border border-line bg-bg/50 px-3.5 py-2.5 text-sm text-fg transition placeholder:text-fg-subtle/70 hover:border-line-strong focus:border-brand/60 disabled:opacity-60";
const labelCls = "mb-2 block text-sm font-medium text-fg-muted";

export default function ScorecardPage() {
  const [categories, setCategories] = useState<string[]>(FALLBACK_CATEGORIES);
  const [form, setForm] = useState<ScoreForm>({ ...SAMPLE });
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ScoreResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiFetch<Meta>("/api/metadata")
      .then((m) => m.categories?.length && setCategories(m.categories))
      .catch(() => {});
  }, []);

  const set = <K extends keyof ScoreForm>(key: K, value: ScoreForm[K]) => {
    setForm((current) => ({ ...current, [key]: value }));
    setResult(null);
    setError(null);
  };

  const loadSample = (sample: typeof SAMPLE) => {
    setForm({ ...sample });
    setResult(null);
    setError(null);
  };

  const submit = async (event?: FormEvent) => {
    event?.preventDefault();
    if (loading) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      setResult(await apiFetch<ScoreResult>("/api/score", { method: "POST", body: JSON.stringify(form) }));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Scoring failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const numberField = (key: NumericField, label: string, hint?: string, step: number | "any" = "any") => (
    <div>
      <label htmlFor={key} className={labelCls}>{label}</label>
      <input
        id={key}
        name={key}
        type="number"
        min={0}
        step={step}
        required
        inputMode={step === 1 ? "numeric" : "decimal"}
        value={form[key]}
        aria-describedby={hint ? `${key}-hint` : undefined}
        onChange={(event) => set(key, Number.isNaN(event.target.valueAsNumber) ? "" : event.target.valueAsNumber)}
        className={inputCls}
      />
      {hint && <p id={`${key}-hint`} className="mt-1.5 text-xs leading-relaxed text-fg-subtle">{hint}</p>}
    </div>
  );

  return (
    <div>
      <PageHeader
        eyebrow="Interactive demo"
        title="Explore a transaction."
        description="See how transaction details and prior customer history translate into a fraud-risk estimate. Start with a sample, then make it your own."
        actions={
          <>
            <Button variant="subtle" type="button" disabled={loading} onClick={() => loadSample(SAMPLE)}>
              <Beaker className="h-4 w-4" aria-hidden /> Unusual sample
            </Button>
            <Button variant="ghost" type="button" disabled={loading} onClick={() => loadSample(ROUTINE)}>
              Routine sample
            </Button>
          </>
        }
      />

      <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-[minmax(0,1fr)_350px]">
        <Panel className="overflow-hidden">
          <div className="flex items-center justify-between gap-3 border-b border-line px-5 py-4 sm:px-6">
            <h2 className="font-semibold text-fg">Transaction details</h2>
            <Badge tone="neutral">Demo inputs</Badge>
          </div>
          <form onSubmit={submit} className="p-5 sm:p-6" aria-busy={loading}>
            <fieldset disabled={loading}>
              <legend className="mb-5 flex items-center gap-3 text-sm font-semibold text-fg">
                <span className="nums grid h-7 w-7 place-items-center rounded-lg bg-brand/10 text-xs text-brand" aria-hidden>01</span>
                The transaction
              </legend>
              <div className="grid grid-cols-1 gap-x-5 gap-y-5 sm:grid-cols-2">
                {numberField("amount", "Amount ($)")}
                <div>
                  <label htmlFor="category" className={labelCls}>Spending category</label>
                  <select id="category" name="category" value={form.category} onChange={(event) => set("category", event.target.value)} className={inputCls}>
                    {categories.map((category) => <option key={category} value={category}>{category.replace(/_/g, " ")}</option>)}
                  </select>
                </div>
                <div>
                  <label htmlFor="hour" className={`${labelCls} flex items-center justify-between gap-2`}>
                    Time of day <span className="nums rounded-md bg-white/5 px-2 py-0.5 text-xs text-fg">{String(form.hour).padStart(2, "0")}:00</span>
                  </label>
                  <input id="hour" name="hour" type="range" min={0} max={23} step={1} value={form.hour} onChange={(event) => set("hour", Number(event.target.value))} aria-valuetext={`${form.hour}:00`} className="focus-ring h-[46px] w-full cursor-pointer accent-[var(--color-brand)]" />
                </div>
                <div>
                  <label htmlFor="dow" className={labelCls}>Day of week</label>
                  <select id="dow" name="day_of_week" value={form.day_of_week} onChange={(event) => set("day_of_week", Number(event.target.value))} className={inputCls}>
                    {DAYS.map((day, i) => <option key={day} value={i}>{day}</option>)}
                  </select>
                </div>
                <div>
                  <label htmlFor="month" className={labelCls}>Month</label>
                  <select id="month" name="month" value={form.month} onChange={(event) => set("month", Number(event.target.value))} className={inputCls}>
                    {MONTHS.map((month, i) => <option key={month} value={i + 1}>{month}</option>)}
                  </select>
                </div>
                {numberField("distance_from_home_km", "Distance from home (km)")}
              </div>
            </fieldset>

            <fieldset disabled={loading} className="mt-7 border-t border-line pt-6">
              <legend className="float-left mb-2 flex w-full items-center gap-3 text-sm font-semibold text-fg">
                <span className="nums grid h-7 w-7 place-items-center rounded-lg bg-white/5 text-xs text-fg-muted" aria-hidden>02</span>
                Customer history
              </legend>
              <p className="clear-both mb-5 text-xs leading-relaxed text-fg-subtle">Use only history available before this transaction. In a live system, these values would come from stored customer activity.</p>
              <div className="grid grid-cols-1 gap-x-5 gap-y-5 sm:grid-cols-2">
                {numberField("customer_prior_avg_amount", "Average prior spend ($)", "Average amount across earlier transactions.")}
                {numberField("customer_prior_count", "Prior transactions", "Total earlier transactions for this customer.", 1)}
                {numberField("customer_merchant_prior_count", "Prior visits to merchant", "Use 0 for a first visit.", 1)}
                {numberField("city_pop", "City population", undefined, 1)}
              </div>
            </fieldset>

            <div className="mt-7 border-t border-line pt-5">
              <Button type="submit" loading={loading} className="w-full">
                {!loading && <GaugeIcon className="h-4 w-4" aria-hidden />}
                {loading ? "Analyzing transaction…" : "Analyze transaction"}
                {!loading && <ArrowRight className="ml-auto h-4 w-4" aria-hidden />}
              </Button>
              <p className="mt-3 text-center text-xs leading-relaxed text-fg-subtle">Academic demo · A risk estimate is not proof of fraud.</p>
            </div>
          </form>
        </Panel>

        <section className="min-w-0 xl:sticky xl:top-8" aria-label="Scoring result" aria-live="polite" aria-atomic="true" aria-busy={loading}>
          {error ? (
            <ErrorState title="Couldn’t score this transaction" message={error} icon={AlertTriangle} onRetry={() => submit()} />
          ) : result ? (
            <Panel className="overflow-hidden">
              <div className="flex items-center justify-between gap-3 border-b border-line px-5 py-4">
                <h2 className="text-sm font-semibold text-fg">Risk assessment</h2>
                <Badge tone={tierTone[result.risk_tier]}>{result.risk_tier.toLowerCase()} risk</Badge>
              </div>
              <div className="flex flex-col items-center px-5 pb-5 pt-6">
                <Gauge probability={result.probability} tier={result.risk_tier} />
                <div className={`mt-5 flex w-full items-center justify-center gap-2 rounded-xl border py-3 text-sm font-semibold ${result.is_fraud ? "border-danger/25 bg-danger/10 text-danger" : "border-success/25 bg-success/10 text-success"}`}>
                  {result.is_fraud ? <ShieldAlert className="h-4 w-4" aria-hidden /> : <CheckCircle2 className="h-4 w-4" aria-hidden />}
                  {result.is_fraud ? "Flagged for review" : "Below alert threshold"}
                </div>
                <p className="mt-3 text-center text-xs leading-relaxed text-fg-muted">
                  {result.is_fraud ? "This estimate meets the model’s threshold for an alert." : "This estimate does not trigger an alert. Fraud can still be missed."}
                </p>
                <div className="mt-5 flex w-full items-center justify-between rounded-xl bg-bg/50 px-3.5 py-3 text-sm">
                  <span className="text-fg-muted">Alert threshold</span>
                  <span className="nums font-medium text-fg">{(result.threshold * 100).toFixed(2)}%</span>
                </div>
              </div>
              <div className="border-t border-line p-5">
                <h3 className="text-sm font-semibold text-fg">Input context</h3>
                <p className="mt-1 text-xs leading-relaxed text-fg-subtle">Simple checks on your inputs, not an explanation of the model’s prediction.</p>
                <dl className="mt-4 space-y-3.5">
                  {result.factors.map((factor) => (
                    <div key={factor.factor} className="flex items-start justify-between gap-4 text-xs">
                      <dt className="text-fg-muted">{factor.factor}</dt>
                      <dd className="flex max-w-[58%] items-start gap-2 text-right text-fg">
                        <span className="nums leading-relaxed">{factor.value}</span>
                        <span className={`mt-1 h-1.5 w-1.5 shrink-0 rounded-full ${factor.signal === "high" ? "bg-danger" : factor.signal === "medium" ? "bg-warning" : "bg-fg-subtle"}`} aria-hidden />
                        <span className="sr-only">{factor.signal} input signal</span>
                      </dd>
                    </div>
                  ))}
                </dl>
              </div>
            </Panel>
          ) : (
            <Panel className="overflow-hidden">
              <div className="border-b border-line px-5 py-4">
                <h2 className="text-sm font-semibold text-fg">Risk assessment</h2>
              </div>
              <div className="flex min-h-[360px] flex-col items-center justify-center px-6 py-10 text-center">
                <div className={`mb-6 grid h-28 w-28 place-items-center rounded-full border border-dashed border-brand/30 bg-brand/5 ${loading ? "animate-pulse" : ""}`}>
                  <div className="grid h-16 w-16 place-items-center rounded-full border border-line bg-surface text-brand">
                    <GaugeIcon className="h-7 w-7" aria-hidden />
                  </div>
                </div>
                <h3 className="text-lg font-semibold text-fg">{loading ? "Reading the signals…" : "Ready when you are"}</h3>
                <p className="mt-2 max-w-[250px] text-sm leading-relaxed text-fg-muted">
                  {loading ? "The model is estimating risk from this transaction and its prior history." : "Choose a sample or enter your details, then analyze the transaction to see its risk estimate."}
                </p>
                {loading && <p className="mt-4 text-xs text-fg-subtle">The first request may take longer while the API wakes up.</p>}
              </div>
              <div className="flex gap-2.5 border-t border-line bg-white/[0.02] px-5 py-4 text-xs leading-relaxed text-fg-subtle">
                <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                <span>Sample transactions are illustrative. Their labels do not establish whether they are actually fraudulent.</span>
              </div>
            </Panel>
          )}
        </section>
      </div>
    </div>
  );
}

function Gauge({ probability, tier }: { probability: number; tier: string }) {
  const pct = (probability * 100).toFixed(1);
  const radius = 56;
  const circumference = 2 * Math.PI * radius;
  const color = tier === "LOW" ? "var(--color-success)" : tier === "MEDIUM" ? "var(--color-warning)" : "var(--color-danger)";
  return (
    <div className="relative h-44 w-44" role="img" aria-label={`Estimated fraud probability ${pct} percent`}>
      <svg viewBox="0 0 128 128" className="h-full w-full -rotate-90" aria-hidden>
        <circle cx="64" cy="64" r={radius} fill="none" stroke="rgba(148,163,184,0.12)" strokeWidth="7" />
        <circle cx="64" cy="64" r={radius} fill="none" stroke={color} strokeWidth="7" strokeLinecap="round" strokeDasharray={circumference} strokeDashoffset={circumference * (1 - probability)} style={{ transition: "stroke-dashoffset 0.6s ease" }} />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center" aria-hidden>
        <span className="nums text-3xl font-semibold tracking-tight text-fg">{pct}<span className="ml-0.5 text-lg text-fg-muted">%</span></span>
        <span className="mt-1 text-xs text-fg-subtle">estimated fraud risk</span>
      </div>
    </div>
  );
}
