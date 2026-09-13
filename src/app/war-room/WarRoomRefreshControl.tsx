"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";

const REFRESH_INTERVAL_MS = 30_000;

export function WarRoomRefreshControl({ generatedAt }: { generatedAt: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [lastRefreshAt, setLastRefreshAt] = useState(generatedAt);
  const refreshing = useRef(false);

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
          {isPending ? "Refreshing" : "Live · 30s"}
        </p>
        <p className="font-mono text-xs text-zinc-400">
          {new Date(lastRefreshAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
        </p>
      </div>
      <button
        type="button"
        onClick={refresh}
        disabled={isPending}
        className="flex min-h-11 min-w-11 items-center justify-center rounded-xl border border-zinc-700 bg-zinc-900 text-zinc-300 transition hover:border-cyan-600 hover:text-cyan-300 disabled:opacity-50"
        aria-label="Refresh War Room"
        title="Refresh now"
      >
        ↻
      </button>
    </div>
  );
}
