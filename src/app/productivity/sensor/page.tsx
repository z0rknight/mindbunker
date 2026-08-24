import Link from "next/link";
import { formatClosedDuration } from "@/modules/work-sessions/core";
import {
  getSensorDashboard,
  type SensorSessionListRow,
} from "@/modules/sensor/data";
import { SensorDeviceManager } from "./SensorDeviceManager";
import { SensorSessionActions } from "./SensorSessionActions";

export const dynamic = "force-dynamic";

function formatDateTime(seconds: number) {
  return new Date(seconds * 1_000).toLocaleString("en-US", {
    timeZone: "America/Sao_Paulo",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function SessionCard({ session, review = false }: { session: SensorSessionListRow; review?: boolean }) {
  const duration = session.ended_at === null
    ? null
    : Math.max(0, Number(session.ended_at) - Number(session.started_at));
  return (
    <article className="rounded-xl border border-zinc-800 bg-black/20 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link
            href={`/productivity/sensor/sessions/${session.id}`}
            className="font-bold text-zinc-100 hover:text-violet-300"
          >
            {session.video_title}
          </Link>
          <p className="mt-1 text-xs text-zinc-500">
            {[session.client_name, session.project_name].filter(Boolean).join(" / ")} · {session.activity_type}
          </p>
          <p className="mt-1 text-[10px] text-zinc-600">
            {formatDateTime(session.started_at)} · {duration === null ? "Open" : formatClosedDuration(duration)} · {session.approval_state}
          </p>
        </div>
        <Link
          href={`/productivity/sensor/sessions/${session.id}`}
          className="text-xs font-bold text-violet-300 hover:text-violet-200"
        >
          Session detail →
        </Link>
      </div>
      {review && (
        <div className="mt-4 border-t border-zinc-800 pt-4">
          <SensorSessionActions
            id={session.id}
            state={session.approval_state}
            approvedWorkSessionId={session.approved_work_session_id}
          />
        </div>
      )}
    </article>
  );
}

export default async function SensorActivityPage() {
  const data = await getSensorDashboard();
  return (
    <div className="mx-auto max-w-6xl px-4 py-5 sm:px-6 md:p-8">
      <Link href="/productivity/sessions" className="text-xs font-bold text-cyan-400">← Work Session Ledger</Link>
      <h1 className="mt-2 text-2xl font-black text-white">🛰️ Sensor Activity</h1>
      <p className="mt-1 text-sm text-zinc-500">
        Passive observations are evidence. Sensor sessions enter the canonical Ledger only after explicit approval.
      </p>

      <section className="mt-6 grid gap-3 sm:grid-cols-3">
        {[
          ["Screen Time", data.totals.screen_seconds],
          ["Active Time", data.totals.active_seconds],
          ["Idle Time", data.totals.idle_seconds],
        ].map(([label, seconds]) => (
          <div key={String(label)} className="rounded-2xl border border-zinc-800 bg-zinc-900/55 p-4">
            <p className="text-xs font-bold uppercase tracking-wide text-zinc-500">{label}</p>
            <p className="mt-2 text-2xl font-black text-white">{formatClosedDuration(Number(seconds))}</p>
          </div>
        ))}
      </section>

      <section className="mt-6 rounded-2xl border border-violet-800/50 bg-violet-950/10 p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-bold text-white">Sensor Inbox / Review</h2>
            <p className="mt-1 text-xs text-zinc-500">Completed Mac sessions awaiting an operator decision.</p>
          </div>
          <span className="rounded-full bg-violet-500/10 px-3 py-1 text-xs font-bold text-violet-300">
            {data.inbox.length} pending
          </span>
        </div>
        <div className="mt-4 space-y-3">
          {data.inbox.length === 0 && <p className="text-sm text-zinc-600">Inbox clear.</p>}
          {data.inbox.map((session) => <SessionCard key={session.id} session={session} review />)}
        </div>
      </section>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <section className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-5">
          <h2 className="font-bold text-white">Top applications today</h2>
          <div className="mt-4 space-y-3">
            {data.apps.length === 0 && <p className="text-sm text-zinc-600">No uploaded observations today.</p>}
            {data.apps.map((app) => (
              <div key={app.app_name} className="flex items-center justify-between gap-4 text-sm">
                <span className="truncate text-zinc-300">{app.app_name}</span>
                <span className="shrink-0 text-zinc-500">
                  {formatClosedDuration(Number(app.active_seconds))} active · {formatClosedDuration(Number(app.idle_seconds))} idle
                </span>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-5">
          <h2 className="font-bold text-white">Sync diagnostics</h2>
          <dl className="mt-4 grid grid-cols-2 gap-4 text-sm">
            <div><dt className="text-zinc-600">Uploaded</dt><dd className="mt-1 font-bold text-white">{data.diagnostics.uploadedObservations}</dd></div>
            <div><dt className="text-zinc-600">Pending review</dt><dd className="mt-1 font-bold text-white">{data.diagnostics.pendingReview}</dd></div>
            <div><dt className="text-zinc-600">Approved</dt><dd className="mt-1 font-bold text-white">{data.diagnostics.approvedSessions}</dd></div>
            <div><dt className="text-zinc-600">Archived</dt><dd className="mt-1 font-bold text-white">{data.diagnostics.archivedSessions}</dd></div>
            <div className="col-span-2">
              <dt className="text-zinc-600">Last successful device contact</dt>
              <dd className="mt-1 font-bold text-white">
                {data.diagnostics.lastSuccessfulUpload
                  ? data.diagnostics.lastSuccessfulUpload.toLocaleString("en-US", { timeZone: "America/Sao_Paulo" })
                  : "Never"}
              </dd>
            </div>
            <div><dt className="text-zinc-600">Keystrokes today</dt><dd className="mt-1 font-bold text-white">{data.totals.keystroke_observation_count > 0 ? data.totals.keystroke_count : "Not measured"}</dd></div>
            <div><dt className="text-zinc-600">Mouse movement today</dt><dd className="mt-1 font-bold text-white">{data.totals.mouse_observation_count > 0 ? data.totals.mouse_movement_count : "Not measured"}</dd></div>
          </dl>
          <p className="mt-3 text-[10px] leading-4 text-zinc-600">
            Local totals, pending uploads and rejected batches live in the native app because the server cannot infer data it has not received.
          </p>
        </section>
      </div>

      {data.approvedHistory.length > 0 && (
        <section className="mt-6 rounded-2xl border border-zinc-800 bg-zinc-900/50 p-5">
          <h2 className="font-bold text-white">Approved Sensor evidence</h2>
          <div className="mt-4 space-y-3">
            {data.approvedHistory.map((session) => <SessionCard key={session.id} session={session} />)}
          </div>
        </section>
      )}

      {data.archivedHistory.length > 0 && (
        <details className="mt-6 rounded-2xl border border-zinc-800 bg-zinc-950/40 p-5">
          <summary className="cursor-pointer text-sm font-bold text-zinc-500">
            Archived Sensor evidence ({data.archivedHistory.length})
          </summary>
          <p className="mt-2 text-xs text-zinc-600">Hidden from active review. Evidence remains available for explicit inspection or manual deletion.</p>
          <div className="mt-4 space-y-3">
            {data.archivedHistory.map((session) => <SessionCard key={session.id} session={session} />)}
          </div>
        </details>
      )}

      <div className="mt-6"><SensorDeviceManager devices={data.devices} /></div>
    </div>
  );
}
