"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { loadEntityInspection } from "@/modules/entity-inspection/actions";
import {
  inspectionLabel,
  type EntityInspection,
  type EntityInspectionResult,
  type InspectionAction,
  type InspectionClientIdentity,
} from "@/modules/entity-inspection/core";
import { startWork, endWorkSession } from "@/modules/work-sessions/actions";
import {
  DEFAULT_WORK_SESSION_ACTIVITY,
  WORK_SESSION_ACTIVITY_LABELS,
  formatClosedDuration,
} from "@/modules/work-sessions/core";
import { formatCurrency, formatDate } from "@/utils/date";
import { EntityInspectionTrigger, useEntityInspection } from "./EntityDrawerProvider";

const focusableSelector = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  '[tabindex]:not([tabindex="-1"])',
].join(",");

function toneClass(tone: EntityInspection["tone"]) {
  if (tone === "live") return "border-emerald-500/40 bg-emerald-500/[0.08] text-emerald-300";
  if (tone === "attention") return "border-red-500/40 bg-red-500/[0.08] text-red-300";
  if (tone === "complete") return "border-cyan-500/30 bg-cyan-500/[0.07] text-cyan-300";
  return "border-zinc-700 bg-zinc-900 text-zinc-300";
}

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString("en-US", {
    timeZone: "America/Sao_Paulo",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-[9px] font-black uppercase tracking-[0.16em] text-zinc-600">{label}</dt>
      <dd className="mt-1 text-sm text-zinc-300">{children}</dd>
    </div>
  );
}

function ClientIdentity({ client }: { client: InspectionClientIdentity }) {
  return (
    <EntityInspectionTrigger
      entity={{ type: "client", id: client.id }}
      className="text-left text-sm font-bold text-cyan-300 hover:text-cyan-200"
    >
      {client.name}
      {client.aliasContext && <span className="mt-0.5 block text-[11px] font-normal text-zinc-600">{client.aliasContext}</span>}
    </EntityInspectionTrigger>
  );
}

function InspectionActionButton({ action, onChanged }: { action: InspectionAction; onChanged: () => void }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");
  if (action.kind === "NONE") return null;
  if (action.kind === "BLOCKED") {
    return (
      <div className="rounded-xl border border-amber-800/40 bg-amber-950/15 p-3">
        <p className="text-xs font-black text-amber-300">{action.label}</p>
        <p className="mt-1 text-xs leading-5 text-zinc-500">{action.reason}</p>
      </div>
    );
  }
  const actionable = action;

  function run() {
    setError("");
    startTransition(async () => {
      const result = actionable.kind === "START_WORK"
        ? await startWork(actionable.videoId, DEFAULT_WORK_SESSION_ACTIVITY)
        : await endWorkSession(actionable.videoId);
      if (!result.success) {
        setError(result.error);
        return;
      }
      router.refresh();
      onChanged();
    });
  }

  return (
    <div>
      <button
        type="button"
        onClick={run}
        disabled={pending}
        className={`min-h-11 w-full rounded-xl px-4 py-3 text-sm font-black transition disabled:opacity-50 ${
          action.kind === "START_WORK"
            ? "bg-emerald-600 text-white hover:bg-emerald-500"
            : "bg-zinc-100 text-zinc-950 hover:bg-white"
        }`}
      >
        {pending ? "Working…" : action.label}
      </button>
      {error && <p aria-live="polite" className="mt-2 text-xs text-red-300">{error}</p>}
    </div>
  );
}

function ClientBody({ inspection }: { inspection: Extract<EntityInspection, { kind: "client" }> }) {
  return (
    <div className="space-y-5">
      <dl className="grid grid-cols-2 gap-4">
        <Fact label="Relationship">{inspection.relationshipStatus}</Fact>
        <Fact label="Active projects">{inspection.activeProjectCount}</Fact>
      </dl>
      {inspection.aliases.length > 0 && (
        <section>
          <h3 className="text-[10px] font-black uppercase tracking-[0.16em] text-zinc-500">Operational context</h3>
          <div className="mt-2 space-y-1">
            {inspection.aliases.map((alias) => (
              <p key={alias.id} className="text-sm text-zinc-300">{alias.name} <span className="text-xs text-cyan-500">· {alias.workMode}</span></p>
            ))}
          </div>
        </section>
      )}
      {inspection.nextAction && (
        <section className="rounded-xl border border-red-900/40 bg-red-950/10 p-3">
          <h3 className="text-[10px] font-black uppercase tracking-[0.16em] text-red-400">Next relationship action</h3>
          <p className="mt-1 text-sm font-bold text-white">{inspection.nextAction.label}</p>
          {inspection.nextAction.dueDate && <p className="mt-1 text-xs text-zinc-500">Due {formatDate(inspection.nextAction.dueDate)}</p>}
        </section>
      )}
      {inspection.activeProjects.length > 0 && (
        <section>
          <h3 className="text-[10px] font-black uppercase tracking-[0.16em] text-zinc-500">Active projects</h3>
          <div className="mt-2 space-y-1.5">
            {inspection.activeProjects.map((project) => (
              <EntityInspectionTrigger key={project.id} entity={{ type: "project", id: project.id }} className="flex w-full items-center justify-between rounded-lg border border-zinc-800 bg-black/20 px-3 py-2 text-left text-sm text-zinc-200 hover:border-cyan-800">
                <span>{project.name}</span><span className="text-[10px] uppercase text-zinc-600">{project.status}</span>
              </EntityInspectionTrigger>
            ))}
          </div>
        </section>
      )}
      {inspection.openWork.length > 0 && (
        <section>
          <h3 className="text-[10px] font-black uppercase tracking-[0.16em] text-zinc-500">Open work</h3>
          <div className="mt-2 space-y-1.5">
            {inspection.openWork.map((video) => (
              <EntityInspectionTrigger key={video.id} entity={{ type: "video", id: video.id }} className="flex w-full items-center justify-between rounded-lg border border-zinc-800 bg-black/20 px-3 py-2 text-left text-sm text-zinc-200 hover:border-cyan-800">
                <span className="truncate">{video.title}</span><span className="ml-2 shrink-0 text-[9px] uppercase text-zinc-600">{video.status}</span>
              </EntityInspectionTrigger>
            ))}
          </div>
        </section>
      )}
      {inspection.receivedByCurrency.length > 0 && (
        <section>
          <h3 className="text-[10px] font-black uppercase tracking-[0.16em] text-zinc-500">Received · Finance truth</h3>
          <p className="mt-2 font-mono text-sm font-bold text-emerald-300">
            {inspection.receivedByCurrency.map((row) => formatCurrency(row.amount, row.currency)).join(" · ")}
          </p>
        </section>
      )}
      {inspection.lastRelationshipEvent && (
        <section className="border-t border-zinc-800 pt-4">
          <h3 className="text-[10px] font-black uppercase tracking-[0.16em] text-zinc-500">Last relationship event</h3>
          <p className="mt-2 text-sm leading-5 text-zinc-300">{inspection.lastRelationshipEvent.description}</p>
          <p className="mt-1 text-[10px] text-zinc-600">{formatDateTime(inspection.lastRelationshipEvent.occurredAt)}</p>
        </section>
      )}
    </div>
  );
}

function ProjectBody({ inspection }: { inspection: Extract<EntityInspection, { kind: "project" }> }) {
  return (
    <div className="space-y-5">
      <dl className="grid grid-cols-2 gap-4">
        <Fact label="Client"><ClientIdentity client={inspection.client} /></Fact>
        <Fact label="Work class">{inspection.workClass}</Fact>
        <Fact label="Lifecycle">{inspection.status}</Fact>
        <Fact label="Condition">{inspection.condition}</Fact>
        <Fact label="Progress">{inspection.progress.done}/{inspection.progress.total} · {inspection.progress.percent}%</Fact>
        <Fact label="Explicit batches">{inspection.explicitBatchCount}</Fact>
        <Fact label="Deadline">{inspection.deadline ? formatDate(inspection.deadline) : "Not set"}</Fact>
        <Fact label="Recorded time">{formatClosedDuration(inspection.recordedSeconds)}</Fact>
      </dl>
      {(inspection.nextMilestone || inspection.blocker) && (
        <section className="rounded-xl border border-zinc-800 bg-black/20 p-3">
          {inspection.nextMilestone && <p className="text-sm font-bold text-white">Next: {inspection.nextMilestone}</p>}
          {inspection.blocker && <p className="mt-1 text-xs font-bold text-red-300">Blocked: {inspection.blocker}</p>}
        </section>
      )}
      {inspection.recommendedVideo && (
        <section>
          <h3 className="text-[10px] font-black uppercase tracking-[0.16em] text-zinc-500">Execution projection</h3>
          <EntityInspectionTrigger entity={{ type: "video", id: inspection.recommendedVideo.id }} className="mt-2 w-full rounded-lg border border-cyan-900/40 bg-cyan-950/10 px-3 py-2 text-left text-sm font-bold text-cyan-300 hover:border-cyan-700">
            Recommended: {inspection.recommendedVideo.title}
          </EntityInspectionTrigger>
        </section>
      )}
      {inspection.activeDeliverables.length > 0 && (
        <section>
          <h3 className="text-[10px] font-black uppercase tracking-[0.16em] text-zinc-500">Active deliverables</h3>
          <div className="mt-2 space-y-1.5">
            {inspection.activeDeliverables.map((video) => (
              <EntityInspectionTrigger key={video.id} entity={{ type: "video", id: video.id }} className="flex w-full items-center justify-between rounded-lg border border-zinc-800 bg-black/20 px-3 py-2 text-left text-sm text-zinc-200 hover:border-cyan-800">
                <span className="truncate">{video.title}</span><span className="ml-2 shrink-0 text-[9px] uppercase text-zinc-600">{video.status}</span>
              </EntityInspectionTrigger>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function VideoBody({ inspection, onChanged }: { inspection: Extract<EntityInspection, { kind: "video" }>; onChanged: () => void }) {
  return (
    <div className="space-y-5">
      <dl className="grid grid-cols-2 gap-4">
        {inspection.client && <Fact label="Client"><ClientIdentity client={inspection.client} /></Fact>}
        {inspection.project && <Fact label="Project"><EntityInspectionTrigger entity={{ type: "project", id: inspection.project.id }} className="text-left font-bold text-cyan-300 hover:text-cyan-200">{inspection.project.name}</EntityInspectionTrigger></Fact>}
        <Fact label="Type">{inspection.contentType ?? inspection.videoKind}</Fact>
        <Fact label="Recorded time">{formatClosedDuration(inspection.recordedSeconds)}</Fact>
        <Fact label="Deadline">{inspection.deadline ? formatDateTime(inspection.deadline) : "No open commitment"}</Fact>
        <Fact label="Execution">{inspection.recommendationRelationship.toLowerCase()}</Fact>
        {inspection.queuePosition !== null && <Fact label="Queue position">{inspection.queuePosition}</Fact>}
      </dl>
      <section className="rounded-xl border border-zinc-800 bg-black/20 p-3">
        <h3 className="text-[10px] font-black uppercase tracking-[0.16em] text-zinc-500">Action / next</h3>
        <p className="mt-1 text-sm font-bold text-white">{inspection.nextAction}</p>
        {inspection.blocker && <p className="mt-1 text-xs font-bold text-red-300">Blocked: {inspection.blocker}</p>}
        {inspection.currentSession && (
          <EntityInspectionTrigger entity={{ type: "session", id: inspection.currentSession.id }} className="mt-2 text-left text-xs font-bold text-emerald-300 hover:text-emerald-200">
            Current Session · {formatClosedDuration(inspection.currentSession.elapsedSeconds)} →
          </EntityInspectionTrigger>
        )}
      </section>
      <InspectionActionButton action={inspection.action} onChanged={onChanged} />
      {inspection.notes && (
        <details className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-3">
          <summary className="cursor-pointer text-xs font-bold text-zinc-400">Notes</summary>
          <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-zinc-300">{inspection.notes}</p>
        </details>
      )}
      {inspection.links.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {inspection.links.map((link) => <a key={link.label} href={link.href} target="_blank" rel="noreferrer" className="text-xs font-bold text-cyan-300 hover:text-cyan-200">{link.label} ↗</a>)}
        </div>
      )}
    </div>
  );
}

function SessionBody({ inspection, onChanged }: { inspection: Extract<EntityInspection, { kind: "session" }>; onChanged: () => void }) {
  const activityLabel = WORK_SESSION_ACTIVITY_LABELS[inspection.activityType as keyof typeof WORK_SESSION_ACTIVITY_LABELS] ?? inspection.activityType;
  return (
    <div className="space-y-5">
      <dl className="grid grid-cols-2 gap-4">
        <Fact label="Started">{formatDateTime(inspection.startedAt)}</Fact>
        <Fact label="Ended">{inspection.endedAt ? formatDateTime(inspection.endedAt) : "Running"}</Fact>
        <Fact label="Duration">{formatClosedDuration(inspection.durationSeconds)}</Fact>
        <Fact label="Classification">{activityLabel}</Fact>
        <Fact label="Source">{inspection.source}</Fact>
        {inspection.sensorEvidence && <Fact label="Sensor evidence">{inspection.sensorEvidence.deviceName}</Fact>}
      </dl>
      <section className="rounded-xl border border-zinc-800 bg-black/20 p-3">
        <h3 className="text-[10px] font-black uppercase tracking-[0.16em] text-zinc-500">Recorded against</h3>
        <EntityInspectionTrigger entity={{ type: "video", id: inspection.video.id }} className="mt-2 block text-left text-sm font-bold text-cyan-300 hover:text-cyan-200">{inspection.video.title}</EntityInspectionTrigger>
        {inspection.project && <EntityInspectionTrigger entity={{ type: "project", id: inspection.project.id }} className="mt-1 block text-left text-xs text-zinc-400 hover:text-zinc-200">{inspection.project.name}</EntityInspectionTrigger>}
        {inspection.client && <div className="mt-1"><ClientIdentity client={inspection.client} /></div>}
      </section>
      <InspectionActionButton action={inspection.action} onChanged={onChanged} />
      {inspection.note && <p className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-3 text-sm italic leading-6 text-zinc-400">“{inspection.note}”</p>}
    </div>
  );
}

function ReadyInspection({ inspection, onChanged }: { inspection: EntityInspection; onChanged: () => void }) {
  if (inspection.kind === "client") return <ClientBody inspection={inspection} />;
  if (inspection.kind === "project") return <ProjectBody inspection={inspection} />;
  if (inspection.kind === "video") return <VideoBody inspection={inspection} onChanged={onChanged} />;
  return <SessionBody inspection={inspection} onChanged={onChanged} />;
}

export function EntityDrawerHost() {
  const { entity, closeEntity } = useEntityInspection();
  const [loaded, setLoaded] = useState<{ key: string; result: EntityInspectionResult } | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const panelRef = useRef<HTMLElement | null>(null);
  const closeRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (!entity) return;
    let cancelled = false;
    const key = `${entity.type}:${entity.id}:${reloadKey}`;
    loadEntityInspection(entity).then((next) => {
      if (!cancelled) setLoaded({ key, result: next });
    });
    return () => { cancelled = true; };
  }, [entity, reloadKey]);

  useEffect(() => {
    if (!entity) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.setTimeout(() => closeRef.current?.focus(), 0);
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        closeEntity();
        return;
      }
      if (event.key !== "Tab" || !panelRef.current) return;
      const focusables = Array.from(panelRef.current.querySelectorAll<HTMLElement>(focusableSelector));
      if (focusables.length === 0) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [entity, closeEntity]);

  if (!entity) return null;
  const expectedKey = `${entity.type}:${entity.id}:${reloadKey}`;
  const result = loaded?.key === expectedKey ? loaded.result : null;
  const inspection = result?.status === "ready" ? result.inspection : null;

  return (
    <div className="fixed inset-0 z-[100]" aria-live="polite">
      <button type="button" aria-label="Close entity inspection" onClick={() => closeEntity()} className="absolute inset-0 cursor-default bg-black/65 backdrop-blur-[2px]" />
      <aside
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="entity-drawer-title"
        data-enter="true"
        className="os-arrive absolute inset-x-0 bottom-0 flex max-h-[88dvh] flex-col rounded-t-2xl border-t border-red-950/80 bg-[#09090b] shadow-2xl shadow-black/80 sm:inset-y-0 sm:left-auto sm:right-0 sm:max-h-none sm:w-[420px] sm:max-w-[94vw] sm:rounded-none sm:border-l sm:border-t-0"
      >
        <header className="shrink-0 border-b border-zinc-800 px-4 py-4 sm:px-5">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="text-[9px] font-black uppercase tracking-[0.2em] text-red-500">{inspectionLabel(entity.type)}</p>
              <h2 id="entity-drawer-title" className="mt-1 truncate text-xl font-black text-white">{inspection?.title ?? "Inspecting…"}</h2>
              {inspection?.subtitle && <p className="mt-1 truncate text-xs text-zinc-500">{inspection.subtitle}</p>}
            </div>
            <button ref={closeRef} type="button" onClick={() => closeEntity()} aria-label="Close" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-zinc-800 text-zinc-500 hover:border-zinc-600 hover:text-white">✕</button>
          </div>
          {inspection && <div className={`mt-4 rounded-lg border px-3 py-2 text-xs font-black uppercase tracking-wide ${toneClass(inspection.tone)}`}>{inspection.primaryState}</div>}
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-5 sm:px-5">
          {!result && <div className="space-y-3" aria-label="Loading inspection"><div className="h-4 w-2/3 animate-pulse rounded bg-zinc-800" /><div className="h-20 animate-pulse rounded-xl bg-zinc-900" /><div className="h-28 animate-pulse rounded-xl bg-zinc-900" /></div>}
          {result && result.status !== "ready" && <div className="rounded-xl border border-amber-900/50 bg-amber-950/10 p-4"><p className="text-sm font-black text-amber-300">Inspection unavailable</p><p className="mt-2 text-sm leading-6 text-zinc-400">{result.message}</p></div>}
          {inspection && (
            <>
              {inspection.inactive && <p className="mb-4 rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-xs font-bold text-zinc-400">This entity is archived, inactive, cancelled, or otherwise outside active operation.</p>}
              {inspection.integrityIssues.length > 0 && <div className="mb-5 rounded-xl border border-red-900/50 bg-red-950/10 p-3"><p className="text-[10px] font-black uppercase tracking-wide text-red-400">Integrity issue</p>{inspection.integrityIssues.map((issue) => <p key={issue} className="mt-1 text-xs leading-5 text-red-200">{issue}</p>)}</div>}
              <ReadyInspection inspection={inspection} onChanged={() => setReloadKey((key) => key + 1)} />
            </>
          )}
        </div>

        {inspection && (
          <footer className="shrink-0 border-t border-zinc-800 bg-zinc-950/95 p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] sm:px-5">
            <Link href={inspection.fullPageHref} onClick={() => closeEntity("replace")} className="flex min-h-11 items-center justify-center rounded-xl border border-zinc-700 bg-zinc-900 px-4 text-sm font-black text-zinc-200 hover:border-red-800/70 hover:text-white">Open full page →</Link>
          </footer>
        )}
      </aside>
    </div>
  );
}
