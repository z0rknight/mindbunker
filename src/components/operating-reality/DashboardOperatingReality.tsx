import { EntityInspectionTrigger } from "@/components/entity-inspection/EntityDrawerProvider";
import { PixelIcon } from "@/components/ui/PixelVisuals";
import type { InspectableEntity } from "@/lib/entity-navigation";
import type { OperatingReality, RealityProvenance } from "@/modules/operating-reality/core";
import { PROJECT_STATUS_LABELS } from "@/modules/projects/config";
import { formatClosedDuration, formatLastActive } from "@/modules/work-sessions/core";
import { formatCurrency, formatMonthKey, OPERATOR_TIME_ZONE } from "@/utils/date";
import { APP_KEY_LABELS } from "@/modules/sensor/app-intelligence";
import Link from "next/link";

function coverageClass(coverage: RealityProvenance["coverage"]) {
  if (coverage === "COMPLETE") return "border-emerald-500/30 bg-emerald-500/10 text-emerald-300";
  if (coverage === "PARTIAL") return "border-amber-500/30 bg-amber-500/10 text-amber-300";
  return "border-zinc-700 bg-zinc-900 text-zinc-500";
}

function Provenance({ value }: { value: RealityProvenance }) {
  return (
    <details className="mt-3 text-[10px] text-zinc-600">
      <summary className="cursor-pointer select-none font-bold uppercase tracking-wide">Source & coverage</summary>
      <p className="mt-1.5 leading-4"><strong className="text-zinc-400">{value.owner}</strong> · {value.source}</p>
      <p className="leading-4">{value.note}</p>
    </details>
  );
}

function SectionHeader({
  eyebrow,
  title,
  provenance,
  href,
  linkLabel,
}: {
  eyebrow: string;
  title: string;
  provenance: RealityProvenance;
  href: string;
  linkLabel: string;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <p className="text-[10px] font-black uppercase tracking-[0.18em] text-cyan-400/80">{eyebrow}</p>
        <h2 className="mt-1 text-base font-black text-white">{title}</h2>
      </div>
      <div className="flex items-center gap-2">
        <span className={`rounded-full border px-2 py-1 text-[9px] font-black uppercase tracking-wide ${coverageClass(provenance.coverage)}`}>
          {provenance.coverage.replace("_", " ")}
        </span>
        <Link href={href} className="text-xs font-black text-cyan-400 hover:text-cyan-300">{linkLabel} →</Link>
      </div>
    </div>
  );
}

function Metric({ label, value, note }: { label: string; value: string; note: string }) {
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-950/55 p-3">
      <p className="text-[9px] font-black uppercase tracking-wide text-zinc-600">{label}</p>
      <p className="mt-1 text-lg font-black text-zinc-100">{value}</p>
      <p className="mt-1 text-[10px] leading-4 text-zinc-600">{note}</p>
    </div>
  );
}

function EmptyFact({ children }: { children: React.ReactNode }) {
  return <p className="rounded-xl border border-dashed border-zinc-800 bg-zinc-950/30 px-4 py-5 text-sm text-zinc-600">{children}</p>;
}

function formatEventTime(iso: string) {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: OPERATOR_TIME_ZONE,
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

function SignalSubject({
  entity,
  children,
}: {
  entity: InspectableEntity | null;
  children: React.ReactNode;
}) {
  if (!entity) return <div className="rounded-xl border border-zinc-800 bg-zinc-950/45 px-3 py-3">{children}</div>;
  return (
    <EntityInspectionTrigger
      entity={entity}
      className="block w-full rounded-xl border border-zinc-800 bg-zinc-950/45 px-3 py-3 text-left transition hover:border-cyan-800"
    >
      {children}
    </EntityInspectionTrigger>
  );
}

export function DashboardOperatingReality({ reality }: { reality: OperatingReality }) {
  const operation = reality.currentOperation;
  const current = operation.current;
  const next = operation.recommendation;
  const hasInputTelemetry = reality.daily.inputObservationCount > 0;

  return (
    <div className="space-y-5" data-testid="dashboard-operating-reality">
      <section className={`pixel-frame rounded-2xl border p-4 sm:p-5 ${current ? "border-emerald-700/45 bg-emerald-950/10" : "border-cyan-900/45 bg-cyan-950/10"}`} data-testid={`operating-now-${operation.state.toLowerCase()}`}>
        <SectionHeader
          eyebrow="Operating now"
          title={current ? "Active work is already in motion" : "Idle — one explainable next move"}
          provenance={operation.provenance}
          href="/war-room"
          linkLabel="Open War Room"
        />
        {current ? (
          <div className="mt-4 grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
            <div>
              <EntityInspectionTrigger entity={{ type: "video", id: current.video.id }} className="text-left text-xl font-black text-white hover:text-cyan-200">
                {current.video.title}
              </EntityInspectionTrigger>
              <div className="mt-2 flex flex-wrap gap-2 text-xs text-zinc-400">
                {current.client && <EntityInspectionTrigger entity={{ type: "client", id: current.client.canonicalId }} className="font-bold hover:text-cyan-300">{current.client.canonicalName}</EntityInspectionTrigger>}
                {current.project && <><span>·</span><EntityInspectionTrigger entity={{ type: "project", id: current.project.id }} className="font-bold hover:text-cyan-300">{current.project.name}</EntityInspectionTrigger></>}
                <span>· {current.activityType.replaceAll("_", " ")}</span>
              </div>
              <p className="mt-3 text-xs text-zinc-500">Next domain action: <strong className="text-zinc-300">{current.nextAction}</strong>{current.blocker ? ` · ${current.blocker.category} blocker open` : ""}</p>
            </div>
            <div className="rounded-xl border border-emerald-800/40 bg-black/20 px-4 py-3 text-right">
              <EntityInspectionTrigger entity={{ type: "session", id: current.sessionId }} className="font-mono text-xl font-black text-emerald-300 hover:text-emerald-200">{formatClosedDuration(current.elapsedSeconds)}</EntityInspectionTrigger>
              <p className="mt-1 text-[10px] uppercase tracking-wide text-zinc-600">Session {current.source}{current.stale ? " · stale" : ""}</p>
            </div>
          </div>
        ) : next ? (
          <div className="mt-4">
            <EntityInspectionTrigger entity={{ type: "video", id: next.videoId }} className="text-left text-xl font-black text-white hover:text-cyan-200">{next.title}</EntityInspectionTrigger>
            <p className="mt-2 text-xs text-zinc-400">{[next.client?.canonicalName, next.project?.name].filter(Boolean).join(" · ") || "No linked Client / Project"}</p>
            <p className="mt-3 text-sm font-bold text-cyan-200">Why now: {next.signals[0]?.message ?? next.nextAction}</p>
          </div>
        ) : (
          <div className="mt-4"><EmptyFact>No active session and no executable recommendation is supported by current evidence.</EmptyFact></div>
        )}
        <Provenance value={operation.provenance} />
      </section>

      <section className="rounded-2xl border border-cyan-900/45 bg-cyan-950/10 p-4 sm:p-5" data-testid="daily-operating-reality">
        <SectionHeader eyebrow="Today" title="Intentional work and observed machine activity" provenance={reality.daily.provenance} href="/productivity/sensor?appWindow=TODAY" linkLabel="Inspect evidence" />
        <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Metric label="Canonical intentional" value={formatClosedDuration(reality.daily.recordedSeconds)} note={`${reality.daily.sessionCount} Work Session${reality.daily.sessionCount === 1 ? "" : "s"}`} />
          <Metric label="Observed active" value={formatClosedDuration(reality.daily.observedActiveSeconds)} note="Sensor foreground evidence" />
          <Metric label="Unsessioned observed" value={formatClosedDuration(reality.daily.unsessionedObservedSeconds)} note="Active observation outside Work Sessions" />
          <Metric
            label="Session coverage"
            value={reality.daily.recordedSeconds > 0 ? `${Math.round((reality.daily.sessionTelemetrySeconds / reality.daily.recordedSeconds) * 100)}%` : "No Session"}
            note={`${formatClosedDuration(reality.daily.sessionUncoveredSeconds)} intentional time without Sensor evidence`}
          />
        </div>
        <div className="mt-3 grid gap-3 lg:grid-cols-[1fr_1.2fr]">
          <div>
            <p className="text-[9px] font-black uppercase tracking-wide text-zinc-600">Canonical work mix</p>
            <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-5 lg:grid-cols-2 xl:grid-cols-5">
              {[
                ["Client", reality.daily.clientSeconds],
                ["Internal", reality.daily.internalSeconds],
                ["Admin", reality.daily.adminSeconds],
                ["Lead", reality.daily.leadSeconds],
                ["Unknown", reality.daily.unclassifiedSeconds],
              ].map(([label, seconds]) => (
                <div key={String(label)} className="rounded-lg border border-zinc-800 bg-black/20 px-3 py-2">
                  <p className="text-[9px] font-black uppercase tracking-wide text-zinc-600">{label}</p>
                  <p className="mt-1 text-xs font-bold text-zinc-300">{formatClosedDuration(Number(seconds))}</p>
                </div>
              ))}
            </div>
          </div>
          <div>
            <p className="text-[9px] font-black uppercase tracking-wide text-zinc-600">Observed apps</p>
            {reality.daily.apps.length > 0 ? (
              <div className="mt-2 flex flex-wrap gap-2">
                {reality.daily.apps.slice(0, 6).map((app) => (
                  <span key={`${app.appKey}-${app.surface ?? "native"}`} className="rounded-lg border border-zinc-800 bg-black/20 px-3 py-2 text-xs text-zinc-400">
                    <strong className="text-zinc-200">{APP_KEY_LABELS[app.appKey]}</strong>{app.surface ? ` · ${app.surface.replace("_WEB", " web")}` : ""} · {formatClosedDuration(app.seconds)}
                  </span>
                ))}
              </div>
            ) : <div className="mt-2"><EmptyFact>No Sensor app evidence today.</EmptyFact></div>}
          </div>
        </div>
        <p className="mt-3 text-[11px] leading-4 text-zinc-600">
          Observed idle {formatClosedDuration(reality.daily.observedIdleSeconds)} · Sensor-covered window {formatClosedDuration(reality.daily.observedCoverageSeconds)} · {hasInputTelemetry ? `Keyboard events ${reality.daily.keystrokeCount.toLocaleString("en-US")} · Mouse events ${reality.daily.mouseMovementCount.toLocaleString("en-US")}.` : "Input telemetry not captured."} Input counts describe telemetry, not effort, focus or quality.
        </p>
        <Provenance value={reality.daily.provenance} />
      </section>

      <div className="grid gap-5 xl:grid-cols-2">
        <section className="rounded-2xl border border-zinc-800 bg-zinc-900/35 p-4 sm:p-5" data-testid="money-reality">
          <SectionHeader eyebrow="Money reality" title={formatMonthKey(reality.money.monthKey)} provenance={reality.money.provenance} href="/finance" linkLabel="Open Finance" />
          {reality.money.rows.length > 0 ? (
            <div className="mt-4 space-y-3">
              {reality.money.rows.map((row) => (
                <div key={row.currency} className="grid grid-cols-3 gap-2">
                  <Metric label="Received" value={formatCurrency(row.received, row.currency)} note="Transactions · cash" />
                  <Metric label="Receivable" value={formatCurrency(row.receivable, row.currency)} note="Open payment requests" />
                  <Metric label="Expected / registered" value={formatCurrency(row.expectedRegistered, row.currency)} note="Billing evidence · not cash" />
                </div>
              ))}
            </div>
          ) : <div className="mt-4"><EmptyFact>No current-month money evidence.</EmptyFact></div>}
          <Provenance value={reality.money.provenance} />
        </section>

        <section className="rounded-2xl border border-zinc-800 bg-zinc-900/35 p-4 sm:p-5" data-testid="delivery-reality">
          <SectionHeader eyebrow="Delivery / commitments" title="What is structurally open" provenance={reality.delivery.provenance} href="/projects" linkLabel="Open Projects" />
          <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Metric label="Current Projects" value={String(reality.delivery.currentProjectCount)} note="Wave 4 membership" />
            <Metric label="Open deliverables" value={String(reality.delivery.openDeliverables)} note="Factual incomplete units" />
            <Metric label="Waiting" value={String(reality.delivery.waitingCount)} note="Review lifecycle" />
            <Metric label="Structural issues" value={String(reality.delivery.structuralIssueCount)} note="Integrity inbox" />
          </div>
          {reality.delivery.mostUrgentCommitment && (
            <EntityInspectionTrigger entity={{ type: "video", id: reality.delivery.mostUrgentCommitment.videoId }} className="mt-3 block w-full rounded-xl border border-amber-900/45 bg-amber-950/10 px-3 py-3 text-left hover:border-amber-700">
              <span className="text-[9px] font-black uppercase tracking-wide text-amber-500">Most urgent commitment</span>
              <span className="mt-1 block text-sm font-black text-zinc-100">{reality.delivery.mostUrgentCommitment.title}</span>
              <span className="mt-1 block text-[11px] text-zinc-500">Due {formatEventTime(reality.delivery.mostUrgentCommitment.dueAt)} · {[reality.delivery.mostUrgentCommitment.clientName, reality.delivery.mostUrgentCommitment.projectName].filter(Boolean).join(" / ")}</span>
            </EntityInspectionTrigger>
          )}
          {reality.delivery.currentProjects.length > 0 ? (
            <div className="mt-3 space-y-2">
              {reality.delivery.currentProjects.map((project) => (
                <EntityInspectionTrigger
                  key={project.id}
                  entity={{ type: "project", id: project.id }}
                  className="block w-full rounded-xl border border-zinc-800 bg-zinc-950/45 px-3 py-3 text-left transition hover:border-cyan-800"
                >
                  <span className="flex items-start justify-between gap-3">
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-black text-zinc-200">{project.name}</span>
                      <span className="mt-0.5 block truncate text-[10px] text-zinc-600">{project.canonicalClientName} · {PROJECT_STATUS_LABELS[project.status]}</span>
                    </span>
                    <span className="shrink-0 text-xs font-black text-zinc-300">{project.doneDeliverables}/{project.totalDeliverables} · {project.progress}%</span>
                  </span>
                  <span className="mt-2 block h-1.5 overflow-hidden rounded-full bg-zinc-800">
                    <span className="block h-full rounded-full bg-cyan-500" style={{ width: `${project.progress}%` }} />
                  </span>
                </EntityInspectionTrigger>
              ))}
            </div>
          ) : <div className="mt-3"><EmptyFact>No current Project is supported by the Wave 4 projection.</EmptyFact></div>}
          <Provenance value={reality.delivery.provenance} />
        </section>
      </div>

      <div className="grid gap-5 xl:grid-cols-[1.1fr_0.9fr]">
        <section className="rounded-2xl border border-zinc-800 bg-zinc-900/35 p-4 sm:p-5" data-testid="work-reality">
          <SectionHeader eyebrow="Work reality" title="Last 7 days" provenance={reality.work.provenance} href="/productivity/sessions" linkLabel="Open Sessions" />
          <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Metric label="Recorded work" value={formatClosedDuration(reality.work.recordedSeconds)} note={`${reality.work.sessionCount} closed Sessions`} />
            <Metric label="Observed active" value={formatClosedDuration(reality.work.observedActiveSeconds)} note="Sensor foreground evidence" />
            <Metric label="Telemetry coverage" value={formatClosedDuration(reality.work.observedCoverageSeconds)} note="Observed window union" />
            <Metric label="Uncovered intentional" value={formatClosedDuration(reality.work.sensorUncoveredSeconds)} note="Sensor session time without telemetry" />
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2 text-xs sm:grid-cols-5">
            {[
              ["Client", reality.work.clientSeconds],
              ["Internal", reality.work.internalSeconds],
              ["Admin", reality.work.adminSeconds],
              ["Lead", reality.work.leadSeconds],
              ["Unclassified", reality.work.unclassifiedSeconds],
            ].map(([label, seconds]) => (
              <div key={String(label)} className="rounded-lg border border-zinc-800 bg-black/20 px-3 py-2">
                <p className="text-[9px] font-black uppercase tracking-wide text-zinc-600">{label}</p>
                <p className="mt-1 font-bold text-zinc-300">{formatClosedDuration(Number(seconds))}</p>
              </div>
            ))}
          </div>
          {reality.work.excludedCount > 0 && <p className="mt-3 text-[11px] text-amber-500">{reality.work.excludedCount} implausible or synthetic interval{reality.work.excludedCount === 1 ? "" : "s"} excluded ({formatClosedDuration(reality.work.excludedSeconds)}).</p>}
          <p className="mt-3 text-[11px] leading-4 text-zinc-600">Recorded and observed values are intentionally separate. They are never summed into “total work.”</p>
          <Provenance value={reality.work.provenance} />
        </section>

        <section className="rounded-2xl border border-zinc-800 bg-zinc-900/35 p-4 sm:p-5" data-testid="output-reality">
          <SectionHeader eyebrow="Output" title="Timestamped transitions" provenance={reality.output.provenance} href="/projects?view=completed" linkLabel="Open history" />
          {reality.output.events.length > 0 ? (
            <div className="mt-4 space-y-2">
              {reality.output.events.map((event) => event.videoId ? (
                <EntityInspectionTrigger key={event.id} entity={{ type: "video", id: event.videoId }} className="flex w-full items-center justify-between gap-3 rounded-xl border border-zinc-800 bg-zinc-950/45 px-3 py-2.5 text-left hover:border-cyan-800">
                  <span className="min-w-0 truncate text-sm font-bold text-zinc-200">{event.title}</span>
                  <span className="shrink-0 text-[10px] text-zinc-600">{formatEventTime(event.occurredAt)}</span>
                </EntityInspectionTrigger>
              ) : (
                <div key={event.id} className="flex items-center justify-between gap-3 rounded-xl border border-zinc-800 bg-zinc-950/45 px-3 py-2.5">
                  <span className="min-w-0 truncate text-sm font-bold text-zinc-200">{event.title}</span>
                  <span className="shrink-0 text-[10px] text-zinc-600">{formatEventTime(event.occurredAt)}</span>
                </div>
              ))}
            </div>
          ) : <div className="mt-4"><EmptyFact>No timestamped completion transition in the last 7 days.</EmptyFact></div>}
          <Provenance value={reality.output.provenance} />
        </section>
      </div>

      <div className="grid gap-5 xl:grid-cols-2">
        <section className="rounded-2xl border border-zinc-800 bg-zinc-900/35 p-4 sm:p-5" data-testid="open-load">
          <SectionHeader eyebrow="Open workload" title="Load without a fake capacity score" provenance={reality.load.provenance} href="/projects?layout=rows" linkLabel="Inspect structure" />
          <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Metric label="Projects" value={String(reality.load.openProjects)} note="Current structure" />
            <Metric label="Deliverables" value={String(reality.load.openDeliverables)} note="Still open" />
            <Metric label="Waiting external" value={String(reality.load.waitingExternal)} note="Review stage" />
            <Metric label="Blocked Projects" value={String(reality.load.blockedProjects)} note="Open blockers" />
          </div>
          {reality.delivery.clientLoad.length > 0 ? (
            <div className="mt-3 space-y-2">
              {reality.delivery.clientLoad.map((client) => (
                <EntityInspectionTrigger key={client.clientId} entity={{ type: "client", id: client.clientId }} className="flex w-full items-center justify-between gap-3 rounded-lg border border-zinc-800 bg-black/20 px-3 py-2 text-left hover:border-cyan-800">
                  <span className="truncate text-xs font-bold text-zinc-300">{client.clientName}</span>
                  <span className="shrink-0 text-[10px] text-zinc-600">{client.projectCount} Project{client.projectCount === 1 ? "" : "s"} · {client.openDeliverables} open</span>
                </EntityInspectionTrigger>
              ))}
              {reality.delivery.internalProjectCount > 0 && <p className="text-[10px] text-zinc-600">Internal: {reality.delivery.internalProjectCount} current Project{reality.delivery.internalProjectCount === 1 ? "" : "s"}.</p>}
            </div>
          ) : <div className="mt-3"><EmptyFact>No client workload in the current Project projection.</EmptyFact></div>}
          <p className="mt-3 text-[11px] text-zinc-600">Availability: unknown. No explicit calendar or hours-available evidence exists.</p>
          <Provenance value={reality.load.provenance} />
        </section>

        <section className="rounded-2xl border border-zinc-800 bg-zinc-900/35 p-4 sm:p-5" data-testid="signal-reality">
          <SectionHeader eyebrow="Signals / exceptions" title={`${reality.signals.total} active signal${reality.signals.total === 1 ? "" : "s"}`} provenance={reality.signals.provenance} href="/war-room#active-signals" linkLabel="Resolve in War Room" />
          {reality.signals.items.length > 0 ? (
            <div className="mt-4 space-y-2">
              {reality.signals.items.map((signal) => {
                const entity: InspectableEntity | null = signal.context?.videoId
                  ? { type: "video", id: signal.context.videoId }
                  : signal.context?.projectId
                    ? { type: "project", id: signal.context.projectId }
                    : signal.context?.clientId
                      ? { type: "client", id: signal.context.clientId }
                      : null;
                return (
                  <SignalSubject key={signal.id} entity={entity}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-bold text-zinc-200">{signal.statement}</p>
                        <p className="mt-1 line-clamp-2 text-[11px] leading-4 text-zinc-600">{signal.evidence}</p>
                      </div>
                      <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[9px] font-black uppercase ${signal.severity === "ACTION" ? "border-red-800/50 text-red-400" : signal.severity === "WATCH" ? "border-amber-800/50 text-amber-400" : "border-zinc-700 text-zinc-500"}`}>{signal.severity}</span>
                    </div>
                  </SignalSubject>
                );
              })}
              {reality.signals.total > reality.signals.items.length && <p className="text-[10px] text-zinc-600">+{reality.signals.total - reality.signals.items.length} more in War Room.</p>}
            </div>
          ) : <div className="mt-4"><EmptyFact>No active canonical signal.</EmptyFact></div>}
          <Provenance value={reality.signals.provenance} />
        </section>
      </div>

      <p className="flex items-center gap-2 text-[10px] text-zinc-700"><PixelIcon name="shield" className="h-3 w-3" /> Refreshed {formatLastActive(reality.generatedAt, reality.generatedAt)} · Dashboard composes; canonical owners remain unchanged.</p>
    </div>
  );
}
