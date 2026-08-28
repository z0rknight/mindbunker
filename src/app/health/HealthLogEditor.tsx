"use client";

import { updateHealthLog } from "@/modules/health/actions";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

type EditableHealthLog = {
  id: number;
  date: string;
  sleepHours: number | null;
  caffeineMg: number | null;
  substancesNotes: string | null;
  screenTimeHours: number | null;
  cyclingKm: number | null;
  cyclingMinutes: number | null;
  walkingMinutes: number | null;
};

const inputClassName =
  "min-h-11 w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white outline-none focus:border-cyan-500";

function fieldValue(value: number | null) {
  return value === null ? "" : String(value);
}

function nullableNumber(value: string): number | null {
  return value.trim() === "" ? null : Number(value);
}

export function HealthLogEditor({
  log,
  todayISODate,
}: {
  log: EditableHealthLog;
  todayISODate: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [date, setDate] = useState(log.date);
  const [sleepHours, setSleepHours] = useState(fieldValue(log.sleepHours));
  const [caffeineMg, setCaffeineMg] = useState(fieldValue(log.caffeineMg));
  const [screenTimeHours, setScreenTimeHours] = useState(
    fieldValue(log.screenTimeHours),
  );
  const [cyclingKm, setCyclingKm] = useState(fieldValue(log.cyclingKm));
  const [cyclingMinutes, setCyclingMinutes] = useState(
    fieldValue(log.cyclingMinutes),
  );
  const [walkingMinutes, setWalkingMinutes] = useState(
    fieldValue(log.walkingMinutes),
  );
  const [notes, setNotes] = useState(log.substancesNotes ?? "");
  const [error, setError] = useState<string | null>(null);

  function openEditor() {
    setDate(log.date);
    setSleepHours(fieldValue(log.sleepHours));
    setCaffeineMg(fieldValue(log.caffeineMg));
    setScreenTimeHours(fieldValue(log.screenTimeHours));
    setCyclingKm(fieldValue(log.cyclingKm));
    setCyclingMinutes(fieldValue(log.cyclingMinutes));
    setWalkingMinutes(fieldValue(log.walkingMinutes));
    setNotes(log.substancesNotes ?? "");
    setError(null);
    setOpen(true);
  }

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await updateHealthLog(log.id, {
        date,
        sleepHours: nullableNumber(sleepHours),
        caffeineMg: nullableNumber(caffeineMg),
        screenTimeHours: nullableNumber(screenTimeHours),
        cyclingKm: nullableNumber(cyclingKm),
        cyclingMinutes: nullableNumber(cyclingMinutes),
        walkingMinutes: nullableNumber(walkingMinutes),
        substancesNotes: notes.trim() || null,
      });
      if (!result.success) {
        setError(result.error);
        return;
      }
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={openEditor}
        className="inline-flex min-h-10 items-center rounded-lg border border-zinc-700 px-3 text-xs font-bold text-zinc-300 hover:border-cyan-700 hover:text-cyan-300"
      >
        Edit
      </button>

      {open && (
        <div
          className="fixed inset-0 z-[70] flex items-end justify-center bg-black/75 backdrop-blur-sm sm:items-center"
          onClick={(event) => event.target === event.currentTarget && setOpen(false)}
        >
          <section className="safe-sheet max-h-[92dvh] w-full overflow-y-auto rounded-t-3xl border border-zinc-700 bg-zinc-900 p-5 shadow-2xl sm:mx-4 sm:max-w-lg sm:rounded-2xl sm:p-6">
            <div className="mb-5 flex items-center justify-between gap-3">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-cyan-300">
                  Historical fact
                </p>
                <h2 className="mt-1 text-lg font-black text-white">Edit health log</h2>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close"
                className="flex min-h-11 min-w-11 items-center justify-center rounded-full bg-zinc-800 text-xl text-zinc-300"
              >
                ×
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <label className="block text-xs font-bold text-zinc-400">
                Happened on
                <input
                  type="date"
                  value={date}
                  max={todayISODate}
                  onChange={(event) => setDate(event.target.value)}
                  onInput={(event) => setDate(event.currentTarget.value)}
                  required
                  className={`${inputClassName} mt-1.5`}
                />
              </label>

              <div className="grid grid-cols-2 gap-3">
                <MetricField label="Sleep (hours)" value={sleepHours} onChange={setSleepHours} step="0.25" max="24" />
                <MetricField label="Caffeine (mg)" value={caffeineMg} onChange={setCaffeineMg} step="1" />
                <MetricField label="Screen time (hours)" value={screenTimeHours} onChange={setScreenTimeHours} step="0.25" max="24" />
                <MetricField label="Cycling (km)" value={cyclingKm} onChange={setCyclingKm} step="0.1" />
                <MetricField label="Cycling (minutes)" value={cyclingMinutes} onChange={setCyclingMinutes} step="1" />
                <MetricField label="Walking (minutes)" value={walkingMinutes} onChange={setWalkingMinutes} step="1" />
              </div>

              <label className="block text-xs font-bold text-zinc-400">
                Notes
                <textarea
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                  maxLength={2_000}
                  rows={3}
                  className={`${inputClassName} mt-1.5 resize-y`}
                />
              </label>

              <p className="text-[11px] leading-5 text-zinc-600">
                This corrects the same record. Its original creation time is preserved.
              </p>
              {error && <p role="alert" className="text-xs text-red-300">{error}</p>}
              <button
                type="submit"
                disabled={isPending}
                className="min-h-12 w-full rounded-xl bg-cyan-700 px-4 text-sm font-black text-white hover:bg-cyan-600 disabled:opacity-60"
              >
                {isPending ? "Saving…" : "Save correction"}
              </button>
            </form>
          </section>
        </div>
      )}
    </>
  );
}

function MetricField({
  label,
  value,
  onChange,
  step,
  max,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  step: string;
  max?: string;
}) {
  return (
    <label className="block text-xs font-bold text-zinc-400">
      {label}
      <input
        type="number"
        inputMode="decimal"
        min="0"
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className={`${inputClassName} mt-1.5`}
      />
    </label>
  );
}
