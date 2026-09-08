"use client";

import { useRouter } from "next/navigation";
import { formatDate } from "@/utils/date";

export function BackfillDateField({ date, today }: { date: string; today: string }) {
  const router = useRouter();
  return (
    <div className="mb-6 flex flex-wrap items-center gap-3 rounded-2xl border border-zinc-800 bg-zinc-900/50 p-4">
      <label htmlFor="backfill-date" className="text-xs font-black uppercase tracking-wide text-zinc-500">
        Date
      </label>
      <input
        id="backfill-date"
        type="date"
        value={date}
        max={today}
        onChange={(event) => {
          if (!event.target.value) return;
          router.push(`/productivity/backfill?date=${event.target.value}`);
        }}
        className="min-h-11 rounded-xl border border-zinc-700 bg-zinc-950 px-3 text-sm text-white outline-none focus:border-violet-500"
      />
      <span className="text-sm font-bold text-zinc-300">{formatDate(date)}</span>
    </div>
  );
}
