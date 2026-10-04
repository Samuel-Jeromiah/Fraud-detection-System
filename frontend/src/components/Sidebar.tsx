"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  Gauge,
  LayoutDashboard,
  Menu,
  ShieldCheck,
  Workflow,
  X,
} from "lucide-react";
import clsx from "clsx";

type NavItem = { name: string; href: string; icon: typeof Gauge };
type NavGroup = { label: string; items: NavItem[] };

const groups: NavGroup[] = [
  { label: "Overview", items: [{ name: "Home", href: "/", icon: LayoutDashboard }] },
  { label: "Live demo", items: [{ name: "Risk Scorecard", href: "/scorecard", icon: Gauge }] },
  {
    label: "Insights",
    items: [
      { name: "Model", href: "/model", icon: BarChart3 },
      { name: "Pipeline", href: "/pipeline", icon: Workflow },
    ],
  },
];

function Brand() {
  return (
    <Link href="/" className="focus-ring flex items-center gap-2.5 rounded-lg">
      <span className="grid h-9 w-9 place-items-center rounded-xl border border-brand/20 bg-brand/10">
        <ShieldCheck className="h-5 w-5 text-brand" aria-hidden />
      </span>
      <span className="text-lg font-semibold tracking-tight text-fg">
        FraudGuard<span className="text-brand">.</span>
      </span>
    </Link>
  );
}

function NavLinks({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  return (
    <nav className="flex flex-col gap-5" aria-label="Primary">
      {groups.map((group) => (
        <div key={group.label}>
          <div className="mb-2 px-2 font-mono text-[10px] font-medium uppercase tracking-widest text-fg-subtle">
            {group.label}
          </div>
          <div className="flex flex-col gap-1">
            {group.items.map(({ name, href, icon: Icon }) => {
              const active = pathname === href;
              return (
                <Link
                  key={href}
                  href={href}
                  onClick={onNavigate}
                  aria-current={active ? "page" : undefined}
                  className={clsx(
                    "focus-ring flex min-h-12 items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium transition",
                    active
                      ? "border border-brand/15 bg-brand/[0.07] text-brand"
                      : "border border-transparent text-fg-muted hover:bg-white/5 hover:text-fg",
                  )}
                >
                  <Icon className={clsx("h-4 w-4 shrink-0", active ? "text-brand" : "text-fg-subtle")} aria-hidden />
                  {name}
                </Link>
              );
            })}
          </div>
        </div>
      ))}
    </nav>
  );
}

function Footer() {
  return (
    <div className="border-t border-line px-5 py-6">
      <div className="mb-5 rounded-xl border border-line bg-white/[0.02] p-4">
        <p className="eyebrow text-brand">Built to learn</p>
        <p className="mt-2 text-xs leading-5 text-fg-muted">An end-to-end exploration of transaction fraud.</p>
        <a href="https://github.com/Samuel-Jeromiah/Fraud-detection-System" target="_blank" rel="noreferrer" className="focus-ring mt-2 inline-flex min-h-9 items-center rounded text-xs text-fg hover:text-brand">View source ↗</a>
      </div>
      <div className="text-xs font-medium text-fg">
        Samuel Jeromiah
      </div>
      <div className="mt-1 text-[11px] text-fg-subtle">Foundations of Artificial Intelligence</div>
    </div>
  );
}

export default function Sidebar() {
  const [open, setOpen] = useState(false);
  const navigationDialog = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    if (open) navigationDialog.current?.showModal();
    else navigationDialog.current?.close();
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  return (
    <>
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-60 flex-col border-r border-line bg-[#101718] lg:flex">
        <div className="flex h-20 items-center px-5">
          <Brand />
        </div>
        <div className="flex-1 overflow-y-auto scrollbar-thin px-3 pt-7">
          <NavLinks />
        </div>
        <Footer />
      </aside>

      <header className="fixed inset-x-0 top-0 z-40 flex h-16 items-center justify-between border-b border-line bg-surface/80 px-4 backdrop-blur-xl lg:hidden">
        <Brand />
        <button
          onClick={() => setOpen(true)}
          aria-label="Open navigation menu"
          aria-expanded={open}
          className="focus-ring grid h-11 w-11 cursor-pointer place-items-center rounded-lg text-fg-muted hover:bg-white/5 hover:text-fg"
        >
          <Menu className="h-5 w-5" aria-hidden />
        </button>
      </header>

      <dialog ref={navigationDialog} aria-label="Navigation" onClose={() => setOpen(false)} className="fixed inset-y-0 left-0 m-0 h-dvh max-h-none w-72 max-w-[85vw] border-r border-line bg-surface p-0 text-fg backdrop:bg-black/60 backdrop:backdrop-blur-sm">
          <div className="flex h-full flex-col shadow-2xl">
            <div className="flex items-center justify-between border-b border-line p-5">
              <Brand />
              <button
                onClick={() => setOpen(false)}
                aria-label="Close navigation menu"
                className="focus-ring grid h-11 w-11 cursor-pointer place-items-center rounded-lg text-fg-muted hover:bg-white/5 hover:text-fg"
              >
                <X className="h-5 w-5" aria-hidden />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto scrollbar-thin p-4">
              <NavLinks onNavigate={() => setOpen(false)} />
            </div>
            <Footer />
          </div>
      </dialog>
    </>
  );
}
