import Link from "next/link";
import { formatClosedDuration } from "@/modules/work-sessions/core";
import {
  getSensorDashboard,
  getLongSessionCandidates,
  getApplicationUsage,
  type SensorSessionListRow,
} from "@/modules/sensor/data";
import {
  LONG_SESSION_THRESHOLD_SECONDS,
  resolveSensorConnectivityStatus,
  type SensorConnectivityStatus,
} from "@/modules/sensor/core";
import { APP_KEY_LABELS, type TimeWindowKind } from "@/modules/sensor/app-intelligence";
import { getWorkSessionOverview } from "@/modules/work-sessions/data";
import { SensorDeviceManager } from "./SensorDeviceManager";
import { SensorSessionActions } from "./SensorSessionActions";

// Tuesday Reality Patch A2: connectivity (is a device phoning home?) and
// canonical work state (is a Work Session open?) are two separate facts
// -- SENSOR ≠ WORK SESSION stays true. This only decides which of four
// truthful labels to show; it never infers or starts a session.
function connectivityCopy(status: SensorConnectivityStatus, hasOpenSession: boolean) {
  if (status === "NO_DEVICE") {
    return {
      label: "NO DEVICE REGISTERED",
      sublabel: "Create a credential below and pair the native app to start monitoring.",
      className: "border-zinc-700 bg-zinc-900 text-zinc-400",
    };
  }
  if (status === "OFFLINE") {
    return {
      label: "SENSOR OFFLINE",
      sublabel: "No contact from any device in the last 10 minutes.",
      className: "border-red-800/60 bg-red-950/20 text-red-300",
    };
  }
  if (hasOpenSession) {
    return {
      label: "SENSOR CONNECTED · ACTIVE WORK SESSION OPEN",
      sublabel: "Monitoring, and a Work Session is currently open.",
      className: "border-emerald-800/60 bg-emerald-950/20 text-emerald-300",
    };
  }
  return {
    label: "SENSOR CONNECTED · IDLE",
    sublabel: "Monitoring — no active Work Session right now. That's expected between recordings.",
    className: "border-emerald-800/60 bg-emerald-950/20 text-emerald-300",
  };
}

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

// Sensor Operational Ledger Patch §24: ARCHIVED is the correct durable DB
// state for completed non-CLIENT work, but the word itself reads as
// disposal to a person -- this is display-only, the stored value is
// unchanged.
function approvalStateLabel(approvalState: string, isClient: boolean): string {
  if (!isClient && approvalState === "ARCHIVED") return "Completed · operational history";
  return approvalState;
}

function SessionCard({ session, review = false }: { session: SensorSessionListRow; review?: boolean }) {
  const duration = session.ended_at === null
    ? null
    : Math.max(0, Number(session.ended_at) - Number(session.started_at));
  const isClient = session.context_type === "CLIENT";
  const title = isClient ? (session.video_title ?? "Untitled session") : session.context_type;
  const subtitle = isClient
    ? [session.client_name, session.project_name].filter(Boolean).join(" / ")
    : (session.context_label ?? "No label");
  return (
    <article className="rounded-xl border border-zinc-800 bg-black/20 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link
            href={`/productivity/sensor/sessions/${session.id}`}
            className="font-bold text-zinc-100 hover:text-violet-300"
          >
            {title}
          </Link>
          <p className="mt-1 text-xs text-zinc-500">
            {subtitle} · {session.activity_type}
          </p>
          <p className="mt-1 text-[10px] text-zinc-600">
            {formatDateTime(session.started_at)} · {duration === null ? "Open" : formatClosedDuration(duration)} · {approvalStateLabel(session.approval_state, isClient)}
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
            contextType={session.context_type}
            approvedWorkSessionId={session.approved_work_session_id}
          />
        </div>
      )}
    </article>
  );
}

const APP_WINDOW_OPTIONS: Array<{ kind: TimeWindowKind; label: string }> = [
  { kind: "TODAY", label: "Today" },
  { kind: "LAST_3_DAYS", label: "3D" },
  { kind: "LAST_7_DAYS", label: "7D" },
  { kind: "LAST_WEEK", label: "Last week" },
  { kind: "THIS_MONTH", label: "This month" },
];

function isTimeWindowKind(value: string | undefined): value is TimeWindowKind {
  return APP_WINDOW_OPTIONS.some((option) => option.kind === value);
}

export default async function SensorActivityPage({
  searchParams,
}: {
  searchParams: Promise<{ appWindow?: string; appMetric?: string }>;
}) {
  const query = await searchParams;
  const appWindowKind: TimeWindowKind = isTimeWindowKind(query.appWindow) ? query.appWindow : "TODAY";
  const appMetric: "ACTIVE" | "INTENTIONAL" = query.appMetric === "INTENTIONAL" ? "INTENTIONAL" : "ACTIVE";
  const [data, workSessionOverview, longSessionCandidates, applicationUsage] = await Promise.all([
    getSensorDashboard(),
    getWorkSessionOverview(),
    getLongSessionCandidates(),
    getApplicationUsage(appWindowKind),
  ]);
  // Sensor Operational Ledger Patch §8: ARCHIVED now means two different
  // things sharing one durable DB state -- an operator explicitly
  // archiving a CLIENT session (unchanged), and the automatic final state
  // every completed Internal/Admin/Lead session reaches on Stop (new).
  // Splitting the one query's results client-side (no second query, no
  // new table) keeps "hidden from review, delete if you want" framing
  // exclusive to CLIENT while giving non-CLIENT operational history its
  // own honest, non-collapsed section.
  const clientArchivedHistory = data.archivedHistory.filter((session) => session.context_type === "CLIENT");
  const operationalHistory = data.archivedHistory.filter((session) => session.context_type !== "CLIENT");
  const connectivity = resolveSensorConnectivityStatus(
    data.devices.length,
    data.diagnostics.lastSuccessfulUpload,
    new Date(),
  );
  const copy = connectivityCopy(connectivity, workSessionOverview.openSession !== null);
  return (
    <div className="mx-auto max-w-6xl px-4 py-5 sm:px-6 md:p-8">
      <Link href="/productivity/sessions" className="text-xs font-bold text-cyan-400">← Work Session Ledger</Link>
      <h1 className="mt-2 text-2xl font-black text-white">🛰️ Sensor Activity</h1>
      <p className="mt-1 text-sm text-zinc-500">
        Passive observations are evidence. Client Sensor sessions enter the canonical Work Session Ledger only after
        explicit approval; Internal, Admin, and Lead sessions become operational history automatically when stopped
        -- completed work, not a request for commercial approval.
      </p>

      <div className={`mt-4 flex flex-wrap items-center justify-between gap-2 rounded-xl border px-4 py-3 ${copy.className}`}>
        <span className="text-xs font-black uppercase tracking-wide">{copy.label}</span>
        <span className="text-[11px] font-normal opacity-80">{copy.sublabel}</span>
      </div>

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

      {longSessionCandidates.length > 0 && (
        <section className="mt-6 rounded-2xl border border-amber-800/50 bg-amber-950/10 p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="font-bold text-white">Long session review</h2>
              <p className="mt-1 text-xs text-zinc-500">
                Sessions longer than {formatClosedDuration(LONG_SESSION_THRESHOLD_SECONDS)} — display only, nothing
                here was auto-stopped, truncated, or deleted. Fix the ones that are wrong; leave the ones that
                aren&apos;t.
              </p>
            </div>
            <span className="rounded-full bg-amber-500/10 px-3 py-1 text-xs font-bold text-amber-300">
              {longSessionCandidates.length} flagged
            </span>
          </div>
          <div className="mt-4 space-y-2">
            {longSessionCandidates.map((candidate) => (
              <div
                key={`${candidate.kind}-${candidate.id}`}
                className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-zinc-800 bg-black/20 px-3 py-2.5"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-zinc-200">{candidate.target}</p>
                  <p className="mt-0.5 text-[11px] text-zinc-500">
                    {candidate.date} · {formatClosedDuration(candidate.durationSeconds)} · {candidate.kind}
                    {candidate.approved ? " · approved" : ""}
                    {candidate.editable ? " · editable" : " · not directly editable here"}
                  </p>
                </div>
                <Link
                  href={
                    candidate.kind === "STAGING"
                      ? `/productivity/sensor/sessions/${candidate.id}?returnTo=${encodeURIComponent("/productivity/sensor")}`
                      // Sep 18 Morning Congruence Patch: deep-linked to this
                      // candidate's own video instead of the bare, unfiltered
                      // ledger -- lands directly on the correction-capable
                      // row, not a full history the operator has to re-search.
                      : `/productivity/sessions?video=${candidate.videoId}`
                  }
                  className="shrink-0 text-xs font-bold text-amber-300 hover:text-amber-200"
                >
                  {candidate.kind === "STAGING" ? "Review Sensor session →" : "Open in Sessions →"}
                </Link>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="mt-6 rounded-2xl border border-zinc-800 bg-zinc-900/50 p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-bold text-white">Application usage</h2>
            <p className="mt-1 text-xs text-zinc-500">
              {appMetric === "ACTIVE"
                ? "During active computer use, how much time each app held the foreground."
                : "Of recorded intentional work (Client, Lead, Internal, Admin), how much time each app held the foreground."}
            </p>
          </div>
          <div className="flex flex-wrap gap-1">
            {APP_WINDOW_OPTIONS.map((option) => (
              <Link
                key={option.kind}
                href={`/productivity/sensor?appWindow=${option.kind}&appMetric=${appMetric}`}
                className={`rounded-lg px-2.5 py-1.5 text-[11px] font-bold ${
                  option.kind === appWindowKind
                    ? "bg-violet-500/20 text-violet-300"
                    : "text-zinc-500 hover:bg-zinc-800 hover:text-zinc-300"
                }`}
              >
                {option.label}
              </Link>
            ))}
          </div>
        </div>
        <div className="mt-3 flex gap-1">
          {(["ACTIVE", "INTENTIONAL"] as const).map((metric) => (
            <Link
              key={metric}
              href={`/productivity/sensor?appWindow=${appWindowKind}&appMetric=${metric}`}
              className={`rounded-lg px-2.5 py-1 text-[10px] font-black uppercase tracking-wide ${
                metric === appMetric
                  ? "bg-cyan-500/20 text-cyan-300"
                  : "text-zinc-600 hover:bg-zinc-800 hover:text-zinc-300"
              }`}
            >
              {metric === "ACTIVE" ? "Active" : "Intentional"}
            </Link>
          ))}
        </div>
        <div className="mt-4 space-y-2">
          {(appMetric === "ACTIVE" ? applicationUsage.observed : applicationUsage.intentional).length === 0 && (
            <p className="text-sm text-zinc-600">No observed application activity in this window.</p>
          )}
          {(appMetric === "ACTIVE" ? applicationUsage.observed : applicationUsage.intentional).map((row) => (
            <div key={`${row.appKey}-${row.surface ?? ""}`} className="flex items-center justify-between gap-3 text-sm">
              <span className="truncate text-zinc-300">
                {APP_KEY_LABELS[row.appKey]}
                {row.surface && <span className="ml-1 text-[10px] font-bold text-zinc-600">· {row.surface.replace("_WEB", " web")}</span>}
              </span>
              <span className="shrink-0 font-mono text-zinc-400">{formatClosedDuration(row.seconds)}</span>
            </div>
          ))}
        </div>
        <p className="mt-4 text-[10px] leading-4 text-zinc-600">
          Daily average this window: {formatClosedDuration(Math.round(applicationUsage.dailyAverageSeconds))}/day
          (includes zero-use days) · Observed during Sensor coverage: {formatClosedDuration(applicationUsage.coverageSeconds)} of{" "}
          {applicationUsage.window.label.toLowerCase()} — incomplete coverage is never presented as full history.
        </p>
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

      {operationalHistory.length > 0 && (
        <section className="mt-6 rounded-2xl border border-zinc-800 bg-zinc-900/50 p-5">
          <h2 className="font-bold text-white">Operational history</h2>
          <p className="mt-1 text-xs text-zinc-500">
            Completed Internal, Admin, and Lead work -- recorded automatically when stopped, not awaiting a
            decision. Corrections are available from each session&apos;s detail page.
          </p>
          <div className="mt-4 space-y-3">
            {operationalHistory.map((session) => <SessionCard key={session.id} session={session} />)}
          </div>
        </section>
      )}

      {clientArchivedHistory.length > 0 && (
        <details className="mt-6 rounded-2xl border border-zinc-800 bg-zinc-950/40 p-5">
          <summary className="cursor-pointer text-sm font-bold text-zinc-500">
            Archived Client Sensor evidence ({clientArchivedHistory.length})
          </summary>
          <p className="mt-2 text-xs text-zinc-600">Hidden from active review. Evidence remains available for explicit inspection or manual deletion.</p>
          <div className="mt-4 space-y-3">
            {clientArchivedHistory.map((session) => <SessionCard key={session.id} session={session} />)}
          </div>
        </details>
      )}

      <div className="mt-6"><SensorDeviceManager devices={data.devices} /></div>
    </div>
  );
}
