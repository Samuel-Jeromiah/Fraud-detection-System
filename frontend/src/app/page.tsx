import Link from "next/link";
import { ArrowRight, ArrowUpRight, BarChart3, Boxes, Gauge, Layers, ShieldCheck } from "lucide-react";
import { Panel } from "@/components/ui";

const steps = [
  { icon: Boxes, title: "Keep time in order", body: "Separate periods for training, calibration, validation, and the final test." },
  { icon: Layers, title: "Build the signals", body: "Transaction details and past-only customer history become 26 model inputs." },
  { icon: ShieldCheck, title: "Learn and calibrate", body: "Class-weighted XGBoost learns patterns. Isotonic calibration adjusts its scores." },
  { icon: Gauge, title: "Set an alert policy", body: "A validation-selected threshold balances catching fraud with false alerts." },
];

export default function Home() {
  return (
    <div className="space-y-10">
      <section className="grid items-center gap-10 pb-2 pt-2 xl:grid-cols-[1.15fr_1fr] xl:gap-12">
        <div>
          <div className="eyebrow mb-5 flex items-center gap-2 text-brand">
            <span className="h-1.5 w-1.5 rounded-full bg-brand" aria-hidden /> Applied machine learning
          </div>
          <h1 className="max-w-xl text-[2.5rem] font-semibold leading-[1.12] tracking-[-0.045em] text-fg sm:text-5xl xl:text-[3.25rem]">
            Every transaction<br className="hidden sm:block" /> tells a story.<br /><span className="text-brand">Explore the risk.</span>
          </h1>
          <p className="mt-6 max-w-lg text-[15px] leading-7 text-fg-muted">
            A hands-on fraud detection project. Explore a transaction, see its calibrated risk score, and understand how the model performs.
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
            <Link href="/scorecard" className="focus-ring inline-flex min-h-12 items-center gap-3 rounded-xl bg-brand px-5 text-sm font-semibold text-[#0d2119] transition hover:bg-accent">
              Try the scorecard <ArrowRight className="h-4 w-4" aria-hidden />
            </Link>
            <Link href="/model" className="focus-ring inline-flex min-h-12 items-center gap-2 rounded-xl border border-line-strong px-5 text-sm font-medium text-fg-muted transition hover:border-brand/40 hover:text-fg">
              Explore the model
            </Link>
          </div>
          <p className="mt-5 text-xs text-fg-subtle">Synthetic transaction data · Academic demonstration</p>
        </div>

        <Panel className="relative overflow-hidden p-6 sm:p-7">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="eyebrow text-fg-subtle">Evaluation snapshot</p>
              <h2 className="mt-2 text-lg font-medium text-fg">Measured on unseen data</h2>
            </div>
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-line bg-white/[0.03] text-brand"><BarChart3 className="h-5 w-5" aria-hidden /></span>
          </div>
          <div className="my-7 flex items-center gap-5 sm:gap-7">
            <svg viewBox="0 0 120 120" className="h-28 w-28 shrink-0 -rotate-90 sm:h-32 sm:w-32" role="img" aria-label="80.56 percent of fraud caught in the final test">
              <circle cx="60" cy="60" r="49" fill="none" stroke="var(--color-danger)" strokeOpacity="0.25" strokeWidth="9" />
              <circle cx="60" cy="60" r="49" fill="none" stroke="var(--color-brand)" strokeWidth="9" strokeLinecap="round" strokeDasharray="248.023 307.876" />
            </svg>
            <div>
              <p className="nums text-3xl font-medium tracking-tight text-fg sm:text-4xl">80.56<span className="text-xl text-fg-subtle">%</span></p>
              <p className="mt-2 text-sm text-fg-muted">of fraudulent transactions caught</p>
              <p className="mt-3 flex items-center gap-2 text-xs text-fg-subtle"><span className="h-1.5 w-1.5 rounded-full bg-brand" aria-hidden />1,728 caught <span className="px-1">/</span> 417 missed</p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-5 border-y border-line py-5">
            <div><p className="text-xs text-fg-subtle">Alert precision</p><p className="nums mt-2 text-xl text-fg">35.07%</p><p className="mt-1 text-[11px] text-fg-muted">True fraud among alerts</p></div>
            <div className="border-l border-line pl-5"><p className="text-xs text-fg-subtle">ROC-AUC</p><p className="nums mt-2 text-xl text-fg">0.9907</p><p className="mt-1 text-[11px] text-fg-muted">Overall ranking quality</p></div>
          </div>
          <Link href="/model" className="focus-ring mt-5 flex items-center justify-between gap-3 rounded text-xs text-fg-muted hover:text-brand">
            <span>Final test · 555,719 transactions</span><ArrowUpRight className="h-4 w-4 shrink-0" aria-hidden />
          </Link>
        </Panel>
      </section>

      <section aria-label="Model configuration" className="grid grid-cols-2 gap-y-6 rounded-2xl border border-line bg-surface/50 px-6 py-6 sm:grid-cols-4">
        {[
          ["26", "Encoded features"],
          ["14", "Spending categories"],
          ["18.91%", "Alert threshold"],
          ["XGBoost", "Calibrated with isotonic"],
        ].map(([value, label], index) => (
          <div key={label} className={`min-w-0 ${index % 2 ? "border-l border-line pl-5" : ""} ${index === 2 ? "sm:border-l sm:border-line sm:pl-5" : ""}`}>
            <p className="nums text-xl font-medium text-fg">{value}</p>
            <p className="mt-2 text-xs text-fg-subtle">{label}</p>
          </div>
        ))}
      </section>

      <section>
        <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
          <div><p className="eyebrow mb-2 text-fg-subtle">The approach</p><h2 className="text-xl font-semibold text-fg">From data to a decision</h2></div>
          <Link href="/pipeline" className="focus-ring inline-flex min-h-10 items-center gap-2 rounded text-xs text-brand">Walk through the pipeline <ArrowRight className="h-3.5 w-3.5" aria-hidden /></Link>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {steps.map(({ icon: Icon, title, body }, i) => (
            <Panel key={title} className="p-5">
              <div className="mb-6 flex items-center justify-between"><Icon className="h-5 w-5 text-brand" aria-hidden /><span className="nums text-xs text-fg-subtle">0{i + 1}</span></div>
              <h3 className="text-sm font-medium text-fg">{title}</h3>
              <p className="mt-2 text-xs leading-6 text-fg-muted">{body}</p>
            </Panel>
          ))}
        </div>
      </section>

      <section className="flex flex-col justify-between gap-5 rounded-2xl border border-brand/15 bg-brand/[0.035] p-6 sm:flex-row sm:items-center">
        <div className="max-w-xl">
          <h2 className="text-base font-medium text-fg">Try a small change. See a different score.</h2>
          <p className="mt-2 text-sm leading-6 text-fg-muted">Start with a sample transaction and explore how amount, timing, and prior history affect the estimate.</p>
        </div>
        <Link href="/scorecard" className="focus-ring inline-flex min-h-11 shrink-0 items-center gap-2 self-start rounded-xl border border-brand/25 px-4 text-sm font-medium text-brand hover:bg-brand/10 sm:self-auto">Open scorecard <ArrowUpRight className="h-4 w-4" aria-hidden /></Link>
      </section>
    </div>
  );
}
