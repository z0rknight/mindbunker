// Pending-visibility gate (Train M1). Turns a raw "an action is in flight"
// boolean into a "show a loading indicator" boolean that never flickers:
//   * a wait shorter than delayMs never becomes visible;
//   * once visible it stays for at least minVisibleMs.
// Pure, timer-injectable, and free of React so it can be tested directly.
// It owns no business truth: it only decides when to *show* pending.

export type GateTimers = {
  setTimeout: (fn: () => void, ms: number) => unknown;
  clearTimeout: (handle: unknown) => void;
  now: () => number;
};

const defaultTimers: GateTimers = {
  setTimeout: (fn, ms) => setTimeout(fn, ms),
  clearTimeout: (handle) => clearTimeout(handle as ReturnType<typeof setTimeout>),
  now: () => Date.now(),
};

export type PendingGate = {
  set: (pending: boolean) => void;
  isVisible: () => boolean;
  dispose: () => void;
};

export function createPendingGate(options: {
  delayMs?: number;
  minVisibleMs?: number;
  onChange: (visible: boolean) => void;
  timers?: GateTimers;
}): PendingGate {
  const delayMs = options.delayMs ?? 150;
  const minVisibleMs = options.minVisibleMs ?? 300;
  const timers = options.timers ?? defaultTimers;

  let wanted = false;
  let visible = false;
  let disposed = false;
  let shownAt = 0;
  let showTimer: unknown;
  let hasShowTimer = false;
  let hideTimer: unknown;
  let hasHideTimer = false;

  const clearShow = () => {
    if (hasShowTimer) timers.clearTimeout(showTimer);
    hasShowTimer = false;
  };
  const clearHide = () => {
    if (hasHideTimer) timers.clearTimeout(hideTimer);
    hasHideTimer = false;
  };
  const show = () => {
    hasShowTimer = false;
    if (disposed || !wanted) return;
    visible = true;
    shownAt = timers.now();
    options.onChange(true);
  };
  const hide = () => {
    hasHideTimer = false;
    if (disposed) return;
    visible = false;
    options.onChange(false);
  };

  return {
    set(next) {
      if (disposed || next === wanted) return;
      wanted = next;
      if (next) {
        clearHide(); // still visible from a previous wait: simply stay visible
        if (!visible && !hasShowTimer) {
          hasShowTimer = true;
          showTimer = timers.setTimeout(show, delayMs);
        }
        return;
      }
      if (hasShowTimer) {
        clearShow(); // finished before the delay: it was never shown, no flicker
        return;
      }
      if (visible && !hasHideTimer) {
        const remaining = minVisibleMs - (timers.now() - shownAt);
        if (remaining <= 0) hide();
        else {
          hasHideTimer = true;
          hideTimer = timers.setTimeout(hide, remaining);
        }
      }
    },
    isVisible: () => visible,
    dispose() {
      disposed = true;
      clearShow();
      clearHide();
    },
  };
}
