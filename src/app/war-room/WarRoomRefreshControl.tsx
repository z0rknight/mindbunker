"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { ActionButton, usePendingGate } from "@/components/os";
import { formatOperatorTime } from "@/utils/date";

const REFRESH_INTERVAL_MS = 30_000;

export function WarRoomRefreshControl({ generatedAt }: { generatedAt: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [lastRefreshAt, setLastRefreshAt] = useState(generatedAt);
  const refreshing = useRef(false);
  // RMEDIA OS M1 proof surface: "Refreshing" only shows for waits that are
  // actually noticeable (>~150ms), so the 30s auto-refresh stays silent.
  const showRefreshing = usePendingGate(isPending);

  const refresh = useCallback(() => {
    if (refreshing.current || document.visibilityState !== "visible") return;
    refreshing.current = true;
    startTransition(() => {
      router.refresh();
      setLastRefreshAt(new Date().toISOString());
      refreshing.current = false;
    });
  }, [router]);

  useEffect(() => {
    const interval = window.setInterval(refresh, REFRESH_INTERVAL_MS);
    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") refresh();
    };
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [refresh]);

  return (
    <div className="flex items-center gap-2 text-right">
      <div>
        <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-600">
          {showRefreshing ? "Refreshing" : "Live · 30s"}
        </p>
        <p className="font-mono text-xs text-zinc-400">
          {/* Global Health Audit — War Room hydration P0 root cause: this
              used to call toLocaleTimeString() with no explicit timeZone,
              which resolves to the RUNTIME's own default -- UTC on the
              Cloudflare Worker during SSR, the browser's local timezone
              during client hydration. That produced two different text
              nodes for the same initial render (a real ~3h shift for
              America/Sao_Paulo) and React production error #418.
              formatOperatorTime always uses the explicit canonical
              America/Sao_Paulo timezone, so server and client compute the
              exact same string regardless of either runtime's own default. */}
          {formatOperatorTime(lastRefreshAt)}
        </p>
      </div>
      <ActionButton
        onClick={refresh}
        pending={isPending}
        className="flex min-h-11 min-w-11 items-center justify-center rounded-xl border border-zinc-700 bg-zinc-900 text-zinc-300 transition hover:border-cyan-600 hover:text-cyan-300 disabled:opacity-50"
        aria-label="Refresh War Room"
        title="Refresh now"
      >
        ↻
      </ActionButton>
    </div>
  );
}
