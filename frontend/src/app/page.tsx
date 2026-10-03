import Link from "next/link";
import {
  ArrowRight,
  BarChart3,
  Boxes,
  Gauge,
  Layers,
  ScanSearch,
  ShieldCheck,
  Workflow,
} from "lucide-react";
import { Panel } from "@/components/ui";

const stats = [
  { label: "Encoded features", value: "26" },
  { label: "Model", value: "XGBoost" },
  { label: "Decision threshold", value: "18.91%" },
  { label: "Transaction categories", value: "14" },
];

const steps = [
  { icon: Boxes, title: "Split", body: "1,296,675 development transactions are split chronologically; 555,719 later transactions are held out for the final test." },
  { icon: Layers, title: "Engineer", body: "12 numeric signals plus 14 one-hot category features. Customer and merchant history uses earlier transactions, excluding the current event and fraud labels." },
  { icon: ShieldCheck, title: "Train", body: "XGBoost fits on the earliest 778,005 rows with fraud-class weighting and a separate early-stopping window. No SMOTE is used." },
  { icon: Gauge, title: "Calibrate & score", body: "Isotonic calibration adjusts the scores. A later validation window selects the 18.91% alert threshold before the untouched test is evaluated." },
];

const features = [
  { icon: ScanSearch, title: "Interactive risk scoring", body: "Enter a transaction and its prior history to get a calibrated probability and alert decision. Displayed input signals provide context, not an explanation of each model prediction." },
  { icon: BarChart3, title: "Model feature importance", body: "The Model page reads global feature importance from the live XGBoost model. These values describe model-wide associations, not the cause of an individual score." },
  { icon: ShieldCheck, title: "Threshold-aware", body: "The threshold maximises validation precision while meeting an 80% recall target. On the final test, recall is 80.56% and precision is 35.07%, making the false-alert tradeoff visible." },
  { icon: Workflow, title: "Reproducible pipeline", body: "Chronological splits, past-only history, class weighting, calibration checks, and a held-out final evaluation are documented and saved with the model." },
];

const tech = ["Next.js 16", "Tailwind v4", "FastAPI", "XGBoost", "scikit-learn", "Plotly"];

export default function Home() {
  return (
    <div className="space-y-16 pb-8">
      <section className="pt-6 sm:pt-10">
        <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-line bg-white/5 px-3 py-1 font-mono text-xs text-fg-muted">
          <span className="h-1.5 w-1.5 rounded-full bg-success" /> Fraud Detection · XGBoost + FastAPI
        </div>
        <h1 className="max-w-3xl text-4xl font-bold leading-[1.1] text-fg sm:text-5xl">
          Explore transaction fraud <span className="text-gradient">with calibrated risk scores.</span>
        </h1>
        <p className="mt-5 max-w-2xl text-lg leading-relaxed text-fg-muted">
          FraudGuard is an academic demo built on synthetic credit-card transactions. A gradient-boosted
          model combines 26 encoded features into a calibrated fraud-risk score, with results measured on
          555,719 later transactions held out from model development.
        </p>
        <div className="mt-8 flex flex-wrap items-center gap-3">
          <Link
            href="/scorecard"
            className="focus-ring inline-flex min-h-[44px] items-center gap-2 rounded-lg bg-brand px-6 py-3 text-sm font-semibold text-[#04130d] shadow-lg shadow-brand/20 transition hover:bg-accent"
          >
            <Gauge className="h-4 w-4" aria-hidden /> Try the Risk Scorecard
          </Link>
          <Link
            href="/model"
            className="focus-ring inline-flex min-h-[44px] items-center gap-2 rounded-lg border border-line px-6 py-3 text-sm font-medium text-fg-muted transition hover:border-line-strong hover:text-fg"
          >
            Explore the model <ArrowRight className="h-4 w-4" aria-hidden />
          </Link>
        </div>
      </section>

      <section className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        {stats.map((s) => (
          <Panel key={s.label} className="p-5" hover>
            <div className="nums text-2xl font-semibold text-fg">{s.value}</div>
            <div className="mt-1 text-sm text-fg-muted">{s.label}</div>
          </Panel>
        ))}
      </section>

      <section>
        <h2 className="mb-6 text-xl font-bold text-fg">How it works</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {steps.map((step, i) => (
            <Panel key={step.title} className="relative p-6" hover>
              <span className="nums absolute right-5 top-5 text-sm text-fg-subtle">0{i + 1}</span>
              <div className="mb-4 grid h-11 w-11 place-items-center rounded-xl bg-brand/10 text-brand">
                <step.icon className="h-5 w-5" aria-hidden />
              </div>
              <h3 className="font-semibold text-fg">{step.title}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-fg-muted">{step.body}</p>
            </Panel>
          ))}
        </div>
      </section>

      <section>
        <h2 className="mb-6 text-xl font-bold text-fg">What makes it trustworthy</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {features.map((f) => (
            <Panel key={f.title} className="flex gap-4 p-6" hover>
              <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-accent/10 text-accent">
                <f.icon className="h-5 w-5" aria-hidden />
              </div>
              <div>
                <h3 className="font-semibold text-fg">{f.title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-fg-muted">{f.body}</p>
              </div>
            </Panel>
          ))}
        </div>
      </section>

      <section className="flex flex-wrap items-center gap-2">
        <span className="mr-2 text-sm text-fg-subtle">Built with</span>
        {tech.map((t) => (
          <span key={t} className="nums rounded-full border border-line bg-white/5 px-3 py-1 text-xs text-fg-muted">
            {t}
          </span>
        ))}
      </section>
    </div>
  );
}
