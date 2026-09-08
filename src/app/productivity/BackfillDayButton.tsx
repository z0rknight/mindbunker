"use client";

import { useQuickCapture } from "@/components/quick-capture/QuickCaptureProvider";

// Tuesday Patch Completion Round §I: Quick Capture's "Backfill Work Time"
// action was only discoverable via the keyboard-only Cmd/Ctrl+K shortcut --
// this is a visible entry point for the exact complaint that started
// this: "não logasse no dia 7... estranho não ter a opção de preencher
// essa informação."
export function BackfillDayButton() {
  const quickCapture = useQuickCapture();
  return (
    <button
      type="button"
      onClick={() => quickCapture.open()}
      className="min-h-11 rounded-xl border border-zinc-700 bg-zinc-900 px-4 text-xs font-black text-zinc-300 transition hover:border-violet-500/60 hover:text-white"
    >
      Backfill a day →
    </button>
  );
}
