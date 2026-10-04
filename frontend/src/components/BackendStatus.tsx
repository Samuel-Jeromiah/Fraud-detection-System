"use client";

import { useCallback, useEffect, useState } from "react";
import { AlertTriangle, Loader2, RefreshCw } from "lucide-react";
import { checkHealth } from "@/lib/api";

type Status = "checking" | "online" | "offline";

/**
 * Probes /api/health on mount and surfaces a friendly banner when the free-tier
 * backend is asleep/unreachable - so data pages explain the blank state instead
 * of silently failing. Hitting Retry also nudges the service awake.
 */
export default function BackendStatus() {
  const [status, setStatus] = useState<Status>("checking");

  const run = useCallback(async () => {
    setStatus("checking");
    setStatus((await checkHealth()) ? "online" : "offline");
  }, []);

  useEffect(() => {
    let active = true;
    checkHealth().then((online) => {
      if (active) setStatus(online ? "online" : "offline");
    });
    return () => { active = false; };
  }, []);

  if (status === "online") return (
    <div role="status" className="inline-flex items-center gap-2 rounded-full border border-line bg-surface px-3 py-1.5 text-xs text-brand">
      <span className="h-1.5 w-1.5 rounded-full bg-brand" aria-hidden /> Scoring API connected
    </div>
  );

  if (status === "checking") {
    return (
      <div role="status" className="flex items-center gap-2 rounded-full border border-line bg-surface px-3 py-1.5 text-xs text-fg-muted">
        <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
        Connecting to scoring API
      </div>
    );
  }

  return (
    <div
      role="status"
      className="flex flex-wrap items-center gap-3 rounded-xl border border-warning/20 bg-warning/5 px-3 py-2"
    >
      <div className="flex items-start gap-2 text-xs">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" aria-hidden />
        <span className="text-fg-muted">
          <span className="font-medium text-warning">API unavailable.</span> The free service may be waking up.
        </span>
      </div>
      <button
        onClick={run}
        className="focus-ring inline-flex shrink-0 cursor-pointer items-center gap-2 self-start rounded-lg border border-warning/40 px-3 py-1.5 text-xs font-medium text-warning transition hover:bg-warning/10 sm:self-auto"
      >
        <RefreshCw className="h-3.5 w-3.5" aria-hidden /> Retry
      </button>
    </div>
  );
}
