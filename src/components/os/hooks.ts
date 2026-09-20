"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { OS_FLASH_HOLD_MS, OS_PENDING } from "@/lib/os/motion";
import { createPendingGate, type PendingGate } from "@/lib/os/pending-gate";
import type { FlashTone } from "@/lib/os/feedback";

/**
 * Raw "in flight" boolean -> flicker-free "show loading" boolean.
 * Under ~150ms nothing is shown; once shown it stays >= 300ms.
 */
export function usePendingGate(
  pending: boolean,
  options: { delayMs?: number; minVisibleMs?: number } = {},
): boolean {
  const delayMs = options.delayMs ?? OS_PENDING.delayMs;
  const minVisibleMs = options.minVisibleMs ?? OS_PENDING.minVisibleMs;
  const [visible, setVisible] = useState(false);
  const gate = useRef<PendingGate | null>(null);

  useEffect(() => {
    const created = createPendingGate({ delayMs, minVisibleMs, onChange: setVisible });
    gate.current = created;
    return () => {
      created.dispose();
      gate.current = null;
    };
  }, [delayMs, minVisibleMs]);

  useEffect(() => {
    gate.current?.set(pending);
  }, [pending, delayMs, minVisibleMs]);

  return visible;
}

/**
 * Wraps an existing async action with pending bookkeeping only. It does NOT
 * own the mutation, its success, navigation, revalidation or any domain
 * status: it returns whatever the wrapped action returns (or throws) and the
 * caller decides what that means. A second call while one is in flight
 * returns the in-flight promise (no double submit).
 */
export function useAction<Args extends unknown[], Result>(
  action: (...args: Args) => Promise<Result>,
  options?: { delayMs?: number; minVisibleMs?: number },
) {
  const [pending, setPending] = useState(false);
  const loading = usePendingGate(pending, options);
  const latest = useRef(action);
  const inflight = useRef<Promise<Result> | null>(null);
  const mounted = useRef(true);

  useEffect(() => {
    latest.current = action;
  });
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const run = useCallback((...args: Args): Promise<Result> => {
    if (inflight.current) return inflight.current;
    setPending(true);
    const promise = (async () => {
      try {
        return await latest.current(...args);
      } finally {
        inflight.current = null;
        if (mounted.current) setPending(false);
      }
    })();
    inflight.current = promise;
    return promise;
  }, []);

  return { run, pending, loading, state: loading ? "loading" : pending ? "pending" : "idle" } as const;
}

/**
 * Returns a transient flash tone whenever `changeKey` changes after mount,
 * then returns to undefined after `holdMs`. Not fired on first render.
 * Apply as: className="os-flash" data-flash={flash}.
 */
export function useUpdateFlash(
  changeKey: unknown,
  options: { tone?: FlashTone; holdMs?: number } = {},
): FlashTone | undefined {
  const tone = options.tone ?? "brand";
  const holdMs = options.holdMs ?? OS_FLASH_HOLD_MS;
  const [seen, setSeen] = useState(changeKey);
  const [flash, setFlash] = useState<FlashTone | undefined>(undefined);

  if (!Object.is(seen, changeKey)) {
    setSeen(changeKey);
    setFlash(tone);
  }

  useEffect(() => {
    if (!flash) return;
    const timer = setTimeout(() => setFlash(undefined), holdMs);
    return () => clearTimeout(timer);
  }, [flash, seen, holdMs]);

  return flash;
}
