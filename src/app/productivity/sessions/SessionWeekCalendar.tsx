"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { formatClosedDuration } from "@/modules/work-sessions/core";
import { buildWeeklyOperatingSummary, type SessionTimelineItem } from "@/modules/work-sessions/timeline";
import { pixelFont } from "./fonts";

const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export function SessionWeekCalendar({ items, mondayKey, nowIso }: {
  items: SessionTimelineItem[];
  mondayKey: string;
  nowIso: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const days = buildWeeklyOperatingSummary(items, mondayKey, nowIso);
  const weekSeconds = days.reduce((sum, day) => sum + day.totalSeconds, 0);
  const weekSessions = days.reduce((sum, day) => sum + day.sessionCount, 0);
  const activeDays = days.filter((day) => day.sessionCount > 0).length;
  const exceptionDays = days.filter((day) => day.longSessionCount > 0 || day.overlapCount > 0).length;

  function goToDay(dateKey: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("view", "timeline");
    params.set("date", dateKey);
    router.push(`${pathname}?${params.toString()}`);
  }

  return (
    <div>
      <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Summary label="Intentional time" value={formatClosedDuration(weekSeconds)} />
        <Summary label="Sessions" value={String(weekSessions)} />
        <Summary label="Active days" value={`${activeDays}/7`} />
        <Summary label="Exception days" value={String(exceptionDays)} warning={exceptionDays > 0} />
      </div>

      <div className="space-y-2">
        {days.map((day, index) => {
          const [, , dayNumber] = day.dayKey.split("-");
          const total = Math.max(1, day.totalSeconds);
          return (
            <button
              key={day.dayKey}
              type="button"
              onClick={() => goToDay(day.dayKey)}
              className={`grid w-full grid-cols-[58px_minmax(0,1fr)_64px] items-center gap-3 rounded-xl border bg-[#0A0A0A] px-3 py-3 text-left transition sm:grid-cols-[78px_minmax(0,1fr)_90px] ${day.sessionCount === 0 ? "border-zinc-900 opacity-55" : "border-zinc-800 hover:border-cyan-800/60"}`}
            >
              <span className={`${pixelFont.className} text-[8px] uppercase tracking-wide text-zinc-400`}>
                {DAY_LABELS[index]} {Number(dayNumber)}
              </span>
              <span className="min-w-0">
                {day.sessionCount === 0 ? (
                  <span className="text-xs text-zinc-700">No recorded session</span>
                ) : (
                  <>
                    <span className="flex h-2 overflow-hidden rounded-full bg-zinc-900">
                      <span className="bg-cyan-500" style={{ width: `${(day.clientSeconds / total) * 100}%` }} />
                      <span className="bg-violet-500" style={{ width: `${(day.internalSeconds / total) * 100}%` }} />
                      <span className="bg-amber-500" style={{ width: `${(day.adminSeconds / total) * 100}%` }} />
                    </span>
                    <span className="mt-1.5 flex flex-wrap gap-x-2 gap-y-1 text-[10px] text-zinc-600">
                      {day.clientSeconds > 0 && <span>Client {formatClosedDuration(day.clientSeconds)}</span>}
                      {day.internalSeconds > 0 && <span>Internal {formatClosedDuration(day.internalSeconds)}</span>}
                      {day.adminSeconds > 0 && <span>Admin {formatClosedDuration(day.adminSeconds)}</span>}
                      {day.sensorLinkedCount > 0 && <span>Sensor {day.sensorLinkedCount}</span>}
                      {day.manualCount > 0 && <span>Manual {day.manualCount}</span>}
                      {day.longSessionCount > 0 && <span className="text-red-300">Long {day.longSessionCount}</span>}
                      {day.overlapCount > 0 && <span className="text-red-300">Overlap {day.overlapCount}</span>}
                    </span>
                  </>
                )}
              </span>
              <span className="text-right">
                <span className="block text-xs font-black text-cyan-300">{day.totalSeconds > 0 ? formatClosedDuration(day.totalSeconds) : "—"}</span>
                <span className="mt-0.5 block text-[10px] text-zinc-600">{day.sessionCount} sessions</span>
              </span>
            </button>
          );
        })}
      </div>
      <div className="mt-3 flex flex-wrap gap-3 text-[10px] text-zinc-600">
        <span><i className="mr-1 inline-block h-1.5 w-3 rounded bg-cyan-500" />Client</span>
        <span><i className="mr-1 inline-block h-1.5 w-3 rounded bg-violet-500" />Internal</span>
        <span><i className="mr-1 inline-block h-1.5 w-3 rounded bg-amber-500" />Admin</span>
      </div>
    </div>
  );
}

function Summary({ label, value, warning = false }: { label: string; value: string; warning?: boolean }) {
  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2">
      <p className="text-[9px] font-black uppercase tracking-wide text-zinc-600">{label}</p>
      <p className={`mt-1 text-sm font-black ${warning ? "text-red-300" : "text-zinc-200"}`}>{value}</p>
    </div>
  );
}
