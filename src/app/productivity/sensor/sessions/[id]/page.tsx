import Link from "next/link";
import { notFound } from "next/navigation";
import { getSensorSessionDetail } from "@/modules/sensor/data";
import { formatClosedDuration, type WorkSessionActivityType } from "@/modules/work-sessions/core";
import { getVideoOptionsForCorrection } from "@/modules/work-sessions/data";
import { SensorSessionDetailControls } from "./SensorSessionDetailControls";

export const dynamic = "force-dynamic";

function formatDateTime(seconds: number | null) {
  if (seconds === null) return "Open";
  return new Date(seconds * 1_000).toLocaleString("en-US", {
    timeZone: "America/Sao_Paulo",
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export default async function SensorSessionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: rawId } = await params;
  if (!/^\d+$/u.test(rawId)) notFound();
  const [data, videoOptions] = await Promise.all([
    getSensorSessionDetail(Number(rawId)),
    getVideoOptionsForCorrection(),
  ]);
  if (!data) notFound();
  const { session, apps, signals } = data;
  const duration = session.ended_at === null
    ? Math.max(0, Number(data.now) - Number(session.started_at))
    : Math.max(0, Number(session.ended_at) - Number(session.started_at));
  const facts = [
    ["Client", session.client_name ?? "—"],
    ["Project", session.project_name ?? "—"],
    ["Video", session.video_title],
    ["Activity", session.activity_type],
    ["Start", formatDateTime(session.started_at)],
    ["End", formatDateTime(session.ended_at)],
    ["Duration", formatClosedDuration(duration)],
    ["Source", session.source],
    ["Approval state", session.approval_state],
  ];

  return (
    <div className="mx-auto max-w-4xl px-4 py-5 sm:px-6 md:p-8">
      <Link href="/productivity/sensor" className="text-xs font-bold text-violet-300 hover:text-violet-200">
        ← Sensor Inbox
      </Link>
      <div className="mt-3 flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.16em] text-violet-400">Sensor session #{session.id}</p>
          <h1 className="mt-1 text-2xl font-black text-white">{session.video_title}</h1>
          <p className="mt-1 text-sm text-zinc-500">Raw intentional evidence from the Mac; independent passive observations are correlated below.</p>
        </div>
        <SensorSessionDetailControls
          sessionId={session.id}
          state={session.approval_state}
          approvedWorkSessionId={session.approved_work_session_id}
          videoId={session.video_id}
          startedAt={session.started_at}
          endedAt={session.ended_at}
          activityType={session.activity_type as WorkSessionActivityType}
          note={session.note}
          videoOptions={videoOptions}
        />
      </div>

      <section className="mt-6 rounded-2xl border border-zinc-800 bg-zinc-900/50 p-5">
        <h2 className="font-bold text-white">Session</h2>
        <dl className="mt-4 grid gap-4 sm:grid-cols-2">
          {facts.map(([label, value]) => (
            <div key={label}>
              <dt className="text-[10px] font-bold uppercase tracking-wide text-zinc-600">{label}</dt>
              <dd className="mt-1 text-sm font-semibold text-zinc-200">{value}</dd>
            </div>
          ))}
        </dl>
        {session.note && <p className="mt-5 border-t border-zinc-800 pt-4 text-sm leading-6 text-zinc-400">{session.note}</p>}
      </section>

      <section className="mt-6 rounded-2xl border border-zinc-800 bg-zinc-900/50 p-5">
        <h2 className="font-bold text-white">Observed during session</h2>
        <p className="mt-1 text-xs text-zinc-600">Derived by device identity and timestamp overlap; never written back into the Work Session.</p>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[360px] text-left text-sm">
            <thead className="text-[10px] uppercase tracking-wide text-zinc-600">
              <tr><th className="pb-2">Application</th><th className="pb-2 text-right">Active time</th></tr>
            </thead>
            <tbody>
              {apps.map((app) => (
                <tr key={app.app_name} className="border-t border-zinc-800/70">
                  <td className="py-3 text-zinc-300">{app.app_name}</td>
                  <td className="py-3 text-right font-semibold text-zinc-400">{formatClosedDuration(Number(app.active_seconds))}</td>
                </tr>
              ))}
              {apps.length === 0 && <tr><td colSpan={2} className="py-5 text-zinc-600">No uploaded observations overlap this session yet.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>

      <section className="mt-6 rounded-2xl border border-zinc-800 bg-zinc-900/50 p-5">
        <h2 className="font-bold text-white">Input signals</h2>
        <dl className="mt-4 grid gap-4 sm:grid-cols-3">
          <div><dt className="text-xs text-zinc-600">Keystrokes</dt><dd className="mt-1 text-xl font-black text-white">{signals.keystroke_count ?? "Not measured"}</dd></div>
          <div><dt className="text-xs text-zinc-600">Mouse movement</dt><dd className="mt-1 text-xl font-black text-white">{signals.mouse_movement_count ?? "Not measured"}</dd></div>
          <div><dt className="text-xs text-zinc-600">Idle time</dt><dd className="mt-1 text-xl font-black text-white">{formatClosedDuration(Number(signals.idle_seconds))}</dd></div>
        </dl>
        <p className="mt-3 text-[10px] text-zinc-600">{signals.observation_count} overlapping observation intervals. NULL remains “Not measured”; it is never displayed as zero.</p>
      </section>

      <div className="mt-6 flex flex-wrap gap-4 text-xs font-bold">
        <Link href={`/productivity?video=${session.video_id}`} className="text-cyan-400 hover:text-cyan-300">Open Video workspace →</Link>
        {session.approved_work_session_id !== null && (
          <Link href="/productivity/sessions" className="text-emerald-400 hover:text-emerald-300">Open canonical Ledger →</Link>
        )}
      </div>
    </div>
  );
}
