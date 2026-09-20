"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { OS_FLASH_HOLD_MS, OS_PENDING } from "@/lib/os/motion";
import { createPendingGate, type PendingGate } from "@/lib/os/pending-gate";
import type { FlashTone } from "@/lib/os/feedback";
import { changedKeys, goneIds, newIds, type Primitive } from "@/lib/os/change";

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

/**
 * Which canonical fields changed since the last render with different values,
 * held for `holdMs` and then cleared. Not fired on first render. Use with
 * flashTarget() to mark a single cell or a whole row.
 */
export function useChangedKeys(values: Record<string, Primitive>, holdMs: number = OS_FLASH_HOLD_MS): string[] {
  const [seen, setSeen] = useState(values);
  const [changed, setChanged] = useState<string[]>([]);
  const diff = changedKeys(seen, values);
  if (diff.length > 0) {
    setSeen(values);
    setChanged(diff);
  }
  useEffect(() => {
    if (changed.length === 0) return;
    const timer = setTimeout(() => setChanged([]), holdMs);
    return () => clearTimeout(timer);
  }, [changed, holdMs]);
  return changed;
}

/**
 * Ids that arrived after mount (present now, absent on the previous render),
 * each held as "new" for `holdMs`. The initial list is never new, and an
 * arrival stops being new by itself so it never stays louder than older rows.
 */
export function useArrivals(ids: readonly string[], holdMs = 8000): ReadonlySet<string> {
  const [seen, setSeen] = useState<readonly string[]>(ids);
  const [arrived, setArrived] = useState<ReadonlySet<string>>(new Set());
  const fresh = newIds(seen, ids);
  if (fresh.length > 0 || seen.length !== ids.length || ids.some((id, index) => seen[index] !== id)) {
    setSeen(ids);
    if (fresh.length > 0) setArrived(new Set([...arrived, ...fresh]));
  }
  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  useEffect(() => {
    const active = timers.current;
    for (const id of arrived) {
      if (active.has(id)) continue;
      active.set(
        id,
        setTimeout(() => {
          active.delete(id);
          setArrived((current) => {
            const next = new Set(current);
            next.delete(id);
            return next;
          });
        }, holdMs),
      );
    }
  }, [arrived, holdMs]);
  useEffect(() => {
    const active = timers.current;
    return () => {
      for (const timer of active.values()) clearTimeout(timer);
      active.clear();
    };
  }, []);
  return arrived;
}

/**
 * How many items LEFT a server-rendered queue since mount (refreshed server truth:
 * they are simply absent now), held for `holdMs` then cleared. The initial
 * list is never a departure. It reports absence; it does not claim why an item
 * left, so callers use neutral wording ("resolved").
 */
export function useDepartures(ids: readonly string[], holdMs = 2400): number {
  const [seen, setSeen] = useState<readonly string[]>(ids);
  const [departed, setDeparted] = useState(0);
  const gone = goneIds(seen, ids);
  const changed = gone.length > 0 || seen.length !== ids.length || ids.some((id, index) => seen[index] !== id);
  if (changed) {
    setSeen(ids);
    if (gone.length > 0) setDeparted(departed + gone.length);
  }
  useEffect(() => {
    if (departed === 0) return;
    const timer = setTimeout(() => setDeparted(0), holdMs);
    return () => clearTimeout(timer);
  }, [departed, holdMs]);
  return departed;
}
