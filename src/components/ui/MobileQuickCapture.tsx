"use client";

import { useState } from "react";
import {
  AddExpenseButton,
  AddIncomeButton,
  AddRevisionButton,
  FinishedVideoButton,
  LogBikeRideButton,
  LogTodayButton,
  LogWalkButton,
} from "@/components/ui/QuickActions";

export function MobileQuickCapture() {
  const [open, setOpen] = useState(false);

  return (
    <div className="md:hidden">
      {!open && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Open quick log"
          className="quick-log-fab fixed right-4 z-30 flex min-h-12 items-center gap-2 rounded-full bg-violet-600 px-4 py-3 text-sm font-black text-white shadow-xl shadow-violet-950/60 active:scale-95"
        >
          <span className="text-lg">＋</span>
          Quick log
        </button>
      )}

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-end bg-black/70 backdrop-blur-sm"
          onClick={(event) => event.target === event.currentTarget && setOpen(false)}
        >
          <section className="safe-sheet max-h-[88dvh] w-full overflow-y-auto rounded-t-3xl border-t border-zinc-700 bg-zinc-900 px-4 pt-3 shadow-2xl">
            <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-zinc-700" />
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-black text-white">Quick log</h2>
                <p className="text-xs text-zinc-500">Capture it now. Add detail only when needed.</p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="flex min-h-11 min-w-11 items-center justify-center rounded-full bg-zinc-800 text-xl text-zinc-300"
                aria-label="Close quick log"
              >
                ×
              </button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <FinishedVideoButton />
              <AddRevisionButton />
              <AddIncomeButton />
              <AddExpenseButton />
              <LogTodayButton />
              <LogBikeRideButton />
              <LogWalkButton />
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
