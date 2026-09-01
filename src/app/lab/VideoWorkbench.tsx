"use client";

import { useState, useTransition } from "react";
import { getVideoWorkbenchData } from "./video-workbench-actions";
import { advanceLifecycleStage } from "@/modules/video-lifecycle/actions";
import { LIFECYCLE_STAGES } from "@/modules/video-lifecycle/core";
import { submitQaCheck } from "@/modules/qa-gate/actions";
import { QA_CHECKS } from "@/modules/qa-gate/core";
import { recordDelivery } from "@/modules/deliveries/actions";
import { logFrictionEvent } from "@/modules/friction/actions";
import { FRICTION_CATEGORIES } from "@/modules/friction/core";
import { setVideoNextAction } from "@/modules/next-action/actions";
import { WAITING_ON_VALUES } from "@/modules/next-action/core";
import { completeCommitment } from "@/modules/commitments/actions";
import { EvidenceDrawer } from "./EvidenceDrawer";
import { buildVideoContextText } from "./copy-context-actions";
import { upsertAssetItem, flagMissingAsset } from "@/modules/asset-readiness/actions";
import { ASSET_ITEM_TYPES, ASSET_STATUSES } from "@/modules/asset-readiness/core";
import { openBlocker, resolveBlocker } from "@/modules/blockers/actions";
import { BLOCKER_CATEGORIES } from "@/modules/blockers/core";
import { toggleChecklistStep } from "@/modules/production-checklist/actions";
import { PRODUCTION_STEPS } from "@/modules/production-checklist/core";
import { setVideoKind } from "@/modules/video-classification/actions";
import { VIDEO_KINDS } from "@/modules/video-classification/core";
import { setPublishedUrl } from "@/modules/delivery-outcome/actions";
import { addVideoLocalTag, removeVideoTag } from "@/modules/tags/actions";

type VideoOption = { id: number; title: string; clientName: string | null; projectName: string | null };
type WorkbenchData = Awaited<ReturnType<typeof getVideoWorkbenchData>>;

function fmtSeconds(s: number) {
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return `${h}h ${m}m`;
}

export function VideoWorkbench({
  videos,
  videoId,
  onVideoIdChange,
}: {
  videos: VideoOption[];
  videoId: string;
  onVideoIdChange: (id: string) => void;
}) {
  const [data, setData] = useState<WorkbenchData | null>(null);
  const [checklist, setChecklist] = useState<Record<string, boolean>>({});
  const [overrideReason, setOverrideReason] = useState("");
  const [frictionCategory, setFrictionCategory] = useState<(typeof FRICTION_CATEGORIES)[number]>("FILES");
  const [frictionNote, setFrictionNote] = useState("");
  const [deliveryUrl, setDeliveryUrl] = useState("");
  const [nextAction, setNextAction] = useState("");
  const [waitingOn, setWaitingOn] = useState("NONE");
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [blockerCategory, setBlockerCategory] = useState<(typeof BLOCKER_CATEGORIES)[number]>("CLIENT");
  const [blockerNote, setBlockerNote] = useState("");
  const [liveUrlInput, setLiveUrlInput] = useState("");
  const [newTag, setNewTag] = useState("");

  function load(id: string) {
    onVideoIdChange(id);
    setMessage(null);
    if (!id) {
      setData(null);
      return;
    }
    startTransition(async () => {
      const d = await getVideoWorkbenchData(Number(id));
      setData(d);
      setNextAction(d.video?.nextAction ?? "");
      setWaitingOn(d.video?.waitingOn ?? "NONE");
      setChecklist({});
      setOverrideReason("");
    });
  }

  function refresh() {
    if (videoId) load(videoId);
  }

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4 space-y-4">
      <p className="text-sm font-semibold text-white">Video Workbench</p>
      <div className="flex gap-2">
        <select
          value={videoId}
          onChange={(e) => load(e.target.value)}
          className="min-w-0 flex-1 rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-white"
        >
          <option value="">Select a video…</option>
          {videos.map((v) => (
            <option key={v.id} value={v.id}>
              {v.title} {v.clientName ? `(${v.clientName})` : ""}
            </option>
          ))}
        </select>
        {videoId && (
          <button
            type="button"
            disabled={pending}
            onClick={() =>
              startTransition(async () => {
                const text = await buildVideoContextText(Number(videoId));
                try {
                  await navigator.clipboard.writeText(text);
                  setMessage("Context copied to clipboard.");
                } catch {
                  setMessage("Could not access clipboard -- text is in the console.");
                  console.log(text);
                }
              })
            }
            className="shrink-0 rounded-lg bg-zinc-800 px-3 py-2 text-xs font-semibold text-white"
          >
            Copy Context
          </button>
        )}
      </div>

      {message && <p className="text-xs text-emerald-400">{message}</p>}

      {data && (
        <div className="space-y-5">
          {/* ===================== VIDEO ===================== */}
          <details open className="space-y-3">
            <summary className="cursor-pointer text-[11px] font-bold uppercase tracking-widest text-zinc-600 mb-2">▸ Video</summary>
            <div className="space-y-3 pl-1">
              <div className="rounded-lg border border-zinc-800 p-3">
                <div className="flex gap-3">
                  <div className="h-16 w-16 shrink-0 rounded-md bg-zinc-800 flex items-center justify-center overflow-hidden">
                    {data.coverUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={data.coverUrl} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <span className="text-[9px] text-zinc-600">no cover</span>
                    )}
                  </div>
                  <div className="flex-1 space-y-1.5">
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] text-zinc-500">Classification:</span>
                      <select
                        value={data.video?.videoKind ?? "CLIENT_WORK"}
                        onChange={(e) => startTransition(async () => { await setVideoKind(Number(videoId), e.target.value); refresh(); })}
                        className="rounded-md border border-zinc-700 bg-zinc-950 px-1.5 py-0.5 text-[11px] text-white"
                      >
                        {VIDEO_KINDS.map((k) => <option key={k} value={k}>{k}</option>)}
                      </select>
                      {data.video?.videoKind === "SAMPLE_VIDEO" && <span className="text-[10px] text-amber-400">excluded from revenue</span>}
                    </div>
                    <div className="flex flex-wrap items-center gap-1">
                      {data.tags.map((t) => (
                        <span key={t} className="flex items-center gap-1 rounded bg-zinc-800 px-1.5 py-0.5 text-[10px] text-zinc-400">
                          {t}
                          <button type="button" onClick={() => startTransition(async () => { await removeVideoTag(Number(videoId), t); refresh(); })} className="text-zinc-600 hover:text-red-400">×</button>
                        </span>
                      ))}
                      <input
                        value={newTag}
                        onChange={(e) => setNewTag(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && newTag.trim()) {
                            startTransition(async () => { await addVideoLocalTag(Number(videoId), newTag); setNewTag(""); refresh(); });
                          }
                        }}
                        placeholder="+ tag"
                        className="w-16 rounded-md border border-zinc-700 bg-zinc-950 px-1.5 py-0.5 text-[10px] text-white"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Lifecycle */}
              <div className="rounded-lg border border-zinc-800 p-3">
                <p className="text-xs font-bold uppercase tracking-wider text-zinc-500 mb-2">Lifecycle</p>
                <p className="text-sm text-white mb-1">
                  Current: <span className="text-violet-400 font-semibold">{data.lifecycle.currentStage ?? "—"}</span>
                  {data.lifecycle.secondsInCurrentStage !== null && (
                    <span className="text-zinc-500"> · {fmtSeconds(data.lifecycle.secondsInCurrentStage)} in stage</span>
                  )}
                </p>
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {LIFECYCLE_STAGES.map((stage) => (
                    <button
                      key={stage}
                      type="button"
                      disabled={pending}
                      onClick={() =>
                        startTransition(async () => {
                          const r = await advanceLifecycleStage(Number(videoId), stage);
                          setMessage(r.success ? r.message : r.error);
                          refresh();
                        })
                      }
                      className={`rounded-md px-2 py-1 text-[11px] font-semibold ${
                        data.lifecycle.currentStage === stage ? "bg-violet-600 text-white" : "bg-zinc-800 text-zinc-400 hover:text-white"
                      }`}
                    >
                      {stage}
                    </button>
                  ))}
                </div>
              </div>

              {/* Next action / waiting on */}
              <div className="rounded-lg border border-zinc-800 p-3">
                <p className="text-xs font-bold uppercase tracking-wider text-zinc-500 mb-2">Next Action / Waiting On</p>
                <input
                  type="text"
                  value={nextAction}
                  onChange={(e) => setNextAction(e.target.value)}
                  placeholder="What's next?"
                  className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-2 py-1.5 text-xs text-white mb-2"
                />
                <select
                  value={waitingOn}
                  onChange={(e) => setWaitingOn(e.target.value)}
                  className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-2 py-1.5 text-xs text-white mb-2"
                >
                  {WAITING_ON_VALUES.map((w) => (
                    <option key={w} value={w}>{w}</option>
                  ))}
                </select>
                <button
                  type="button"
                  disabled={pending}
                  onClick={() =>
                    startTransition(async () => {
                      const r = await setVideoNextAction(Number(videoId), nextAction, waitingOn);
                      setMessage(r.success ? r.message : r.error);
                      refresh();
                    })
                  }
                  className="w-full rounded-lg bg-violet-600 px-3 py-1.5 text-xs font-semibold text-white"
                >
                  Save
                </button>
              </div>

              {/* Commitments on this video */}
              {data.commitments.length > 0 && (
                <div className="rounded-lg border border-zinc-800 p-3">
                  <p className="text-xs font-bold uppercase tracking-wider text-zinc-500 mb-2">Commitments / Deadline (this video)</p>
                  <ul className="space-y-1">
                    {data.commitments.map((c) => (
                      <li key={c.id} className="flex items-center justify-between text-xs text-zinc-300">
                        <span>{c.description}{c.dueAt ? ` — due ${new Date(c.dueAt).toISOString().slice(0, 10)}` : ""}</span>
                        {c.status === "OPEN" && (
                          <button
                            type="button"
                            onClick={() => startTransition(async () => { await completeCommitment(c.id); refresh(); })}
                            className="rounded-md bg-emerald-700 px-2 py-0.5 text-[11px] font-semibold text-white"
                          >
                            Done
                          </button>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </details>

          {/* ===================== WORK ===================== */}
          <details open className="space-y-3">
            <summary className="cursor-pointer text-[11px] font-bold uppercase tracking-widest text-zinc-600 mb-2">▸ Work</summary>
            <div className="space-y-3 pl-1">
              <div className="rounded-lg border border-zinc-800 p-3">
                <p className="text-xs font-bold uppercase tracking-wider text-zinc-500 mb-2">Active / Recent Sessions</p>
                <p className="text-[11px] text-zinc-500 mb-1">Start/switch/stop from Current Work (above) or Work Session Guardian.</p>
                {data.recentSessions.length === 0 ? (
                  <p className="text-xs text-zinc-500">No sessions yet.</p>
                ) : (
                  <ul className="space-y-0.5">
                    {data.recentSessions.map((rs) => (
                      <li key={rs.id} className="text-[11px] text-zinc-500 flex items-center gap-1.5">
                        <span>{rs.activityType}</span>
                        <span>{rs.endedAt ? `${new Date(rs.startedAt).toLocaleDateString()} · ${fmtSeconds((rs.endedAt.getTime() - rs.startedAt.getTime()) / 1000)}` : "open"}</span>
                        {rs.integrityState !== "NORMAL" && <span className="text-amber-400">{rs.integrityState}</span>}
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {/* Activity Overlay */}
              {data.activityOverlay && (
                <div className="rounded-lg border border-zinc-800 p-3">
                  <p className="text-xs font-bold uppercase tracking-wider text-zinc-500 mb-2">Activity Overlay (OBSERVED / DERIVED / EXPERIMENTAL)</p>
                  <p className="text-xs text-zinc-300">
                    app-switches: {data.activityOverlay.appSwitchCount} · production-tool ratio: {data.activityOverlay.productionToolRatio !== null ? `${Math.round(data.activityOverlay.productionToolRatio * 100)}%` : "—"} · context-drift: {data.activityOverlay.contextDriftMinutes}m
                  </p>
                  <EvidenceDrawer
                    label="activity overlay"
                    sources={[
                      `OBSERVED: ${fmtSeconds(data.activityOverlay.coverageSeconds)} of device activity in this window`,
                      "DERIVED: app-switch count, production-tool ratio, context-drift minutes computed from OBSERVED rows",
                      "EXPERIMENTAL: comparison only — not a judgment of whether time was 'wasted'",
                    ]}
                  />
                </div>
              )}
            </div>
          </details>

          {/* ===================== INPUTS ===================== */}
          <details open className="space-y-3">
            <summary className="cursor-pointer text-[11px] font-bold uppercase tracking-widest text-zinc-600 mb-2">▸ Inputs</summary>
            <div className="space-y-3 pl-1">
              {/* Asset Readiness */}
              <div className="rounded-lg border border-zinc-800 p-3">
                <p className="text-xs font-bold uppercase tracking-wider text-zinc-500 mb-2">
                  Input Readiness — {data.readyToProduce ? <span className="text-emerald-400">READY TO PRODUCE</span> : <span className="text-amber-400">NOT READY</span>}
                </p>
                <div className="space-y-1">
                  {ASSET_ITEM_TYPES.map((t) => {
                    const existing = data.assetChecklist.find((a) => a.itemType === t);
                    const status = existing?.status ?? "MISSING";
                    return (
                      <div key={t} className="flex items-center justify-between gap-2 text-[11px]">
                        <span className="text-zinc-400">{t}</span>
                        <div className="flex items-center gap-1">
                          {status === "MISSING" && (
                            <button
                              type="button"
                              disabled={pending}
                              onClick={() =>
                                startTransition(async () => {
                                  await flagMissingAsset("VIDEO", Number(videoId), t);
                                  refresh();
                                })
                              }
                              title="Log this as a FILES friction event"
                              className="rounded-md bg-red-900 px-1.5 py-0.5 text-[10px] font-semibold text-red-200"
                            >
                              Flag → friction
                            </button>
                          )}
                          <select
                            value={status}
                            onChange={(e) =>
                              startTransition(async () => {
                                await upsertAssetItem("VIDEO", Number(videoId), t, e.target.value);
                                refresh();
                              })
                            }
                            className="rounded-md border border-zinc-700 bg-zinc-950 px-1.5 py-0.5 text-white"
                          >
                            {ASSET_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                          </select>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Blockers on this video */}
              <div className="rounded-lg border border-zinc-800 p-3">
                <p className="text-xs font-bold uppercase tracking-wider text-zinc-500 mb-2">Blockers</p>
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {BLOCKER_CATEGORIES.map((c) => (
                    <button key={c} type="button" onClick={() => setBlockerCategory(c)} className={`rounded-md px-2 py-1 text-[11px] font-semibold ${blockerCategory === c ? "bg-red-700 text-white" : "bg-zinc-800 text-zinc-400"}`}>{c}</button>
                  ))}
                </div>
                <div className="flex gap-2">
                  <input value={blockerNote} onChange={(e) => setBlockerNote(e.target.value)} placeholder="What's blocking?" className="min-w-0 flex-1 rounded-lg border border-zinc-700 bg-zinc-950 px-2 py-1.5 text-xs text-white" />
                  <button
                    type="button"
                    disabled={pending || !blockerNote}
                    onClick={() =>
                      startTransition(async () => {
                        await openBlocker({ category: blockerCategory, ownerType: "VIDEO", ownerId: Number(videoId), note: blockerNote });
                        setBlockerNote("");
                        refresh();
                      })
                    }
                    className="shrink-0 rounded-lg bg-red-800 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-40"
                  >
                    Open
                  </button>
                </div>
                {data.blockers.filter((b) => !b.resolvedAt).length > 0 && (
                  <ul className="mt-2 space-y-1">
                    {data.blockers.filter((b) => !b.resolvedAt).map((b) => (
                      <li key={b.id} className="flex items-center justify-between text-[11px] text-zinc-400">
                        <span>{b.category}{b.note ? `: ${b.note}` : ""}</span>
                        <button type="button" onClick={() => startTransition(async () => { await resolveBlocker(b.id); refresh(); })} className="rounded-md bg-emerald-700 px-2 py-0.5 text-[10px] font-semibold text-white">Resolve</button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {/* Production Checklist */}
              <div className="rounded-lg border border-zinc-800 p-3">
                <p className="text-xs font-bold uppercase tracking-wider text-zinc-500 mb-2">Production Checklist</p>
                <div className="space-y-1">
                  {PRODUCTION_STEPS.map((step) => {
                    const existing = data.checklist.find((c) => c.step === step);
                    const status = existing?.status ?? "NOT_STARTED";
                    return (
                      <div key={step} className="flex items-center justify-between gap-2 text-[11px]">
                        <span className={status === "DONE" ? "text-emerald-400" : "text-zinc-400"}>{step}</span>
                        <select
                          value={status}
                          onChange={(e) => startTransition(async () => { await toggleChecklistStep(Number(videoId), step, e.target.value); refresh(); })}
                          className="rounded-md border border-zinc-700 bg-zinc-950 px-1.5 py-0.5 text-white"
                        >
                          <option value="NOT_STARTED">NOT_STARTED</option>
                          <option value="DONE">DONE</option>
                          <option value="NOT_REQUIRED">NOT_REQUIRED</option>
                        </select>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Friction for this video */}
              <div className="rounded-lg border border-zinc-800 p-3">
                <p className="text-xs font-bold uppercase tracking-wider text-zinc-500 mb-2">Friction</p>
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {FRICTION_CATEGORIES.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setFrictionCategory(c)}
                      className={`rounded-md px-2 py-1 text-[11px] font-semibold ${
                        frictionCategory === c ? "bg-violet-600 text-white" : "bg-zinc-800 text-zinc-400"
                      }`}
                    >
                      {c}
                    </button>
                  ))}
                </div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={frictionNote}
                    onChange={(e) => setFrictionNote(e.target.value)}
                    placeholder="e.g. MISSING asset for EP3"
                    className="min-w-0 flex-1 rounded-lg border border-zinc-700 bg-zinc-950 px-2 py-1.5 text-xs text-white"
                  />
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() =>
                      startTransition(async () => {
                        const r = await logFrictionEvent({ category: frictionCategory, videoId: Number(videoId), note: frictionNote });
                        setMessage(r.success ? r.message : r.error);
                        setFrictionNote("");
                        refresh();
                      })
                    }
                    className="shrink-0 rounded-lg bg-violet-600 px-3 py-1.5 text-xs font-semibold text-white"
                  >
                    Log
                  </button>
                </div>
                {data.friction.length > 0 && (
                  <ul className="mt-2 space-y-1">
                    {data.friction.slice(0, 5).map((f) => (
                      <li key={f.id} className="text-[11px] text-zinc-500">
                        {f.category}{f.note ? ` — ${f.note}` : ""}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </details>

          {/* ===================== QUALITY ===================== */}
          <details open className="space-y-3">
            <summary className="cursor-pointer text-[11px] font-bold uppercase tracking-widest text-zinc-600 mb-2">▸ Quality</summary>
            <div className="space-y-3 pl-1">
              {/* QA Gate */}
              <div className="rounded-lg border border-zinc-800 p-3">
                <p className="text-xs font-bold uppercase tracking-wider text-zinc-500 mb-2">Quality Gate</p>
                <div className="grid grid-cols-2 gap-1.5 mb-2">
                  {QA_CHECKS.map((c) => (
                    <label key={c.key} className="flex items-center gap-1.5 text-xs text-zinc-300">
                      <input
                        type="checkbox"
                        checked={checklist[c.key] === true}
                        onChange={(e) => setChecklist((prev) => ({ ...prev, [c.key]: e.target.checked }))}
                      />
                      {c.label}
                    </label>
                  ))}
                </div>
                <input
                  type="text"
                  value={overrideReason}
                  onChange={(e) => setOverrideReason(e.target.value)}
                  placeholder="Override reason (only if some checks failed)"
                  className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-2 py-1.5 text-xs text-white mb-2"
                />
                <div className="flex gap-2">
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() =>
                      startTransition(async () => {
                        const r = await submitQaCheck(Number(videoId), checklist);
                        setMessage(r.success ? r.message : r.error);
                        refresh();
                      })
                    }
                    className="rounded-lg bg-emerald-700 px-3 py-1.5 text-xs font-semibold text-white"
                  >
                    Pass QA
                  </button>
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() =>
                      startTransition(async () => {
                        const r = await submitQaCheck(Number(videoId), checklist, { overrideReason, causedBy: "OUR_ERROR" });
                        setMessage(r.success ? r.message : r.error);
                        refresh();
                      })
                    }
                    className="rounded-lg bg-amber-700 px-3 py-1.5 text-xs font-semibold text-white"
                  >
                    Override & Deliver
                  </button>
                </div>
                {data.qa.length > 0 && (
                  <ul className="mt-2 space-y-1">
                    {data.qa.slice(0, 5).map((q) => (
                      <li key={q.id} className="text-[11px] text-zinc-500">
                        {q.result} {q.causedBy ? `· ${q.causedBy}` : ""} · {new Date(q.createdAt).toLocaleString()}
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {/* Revision provenance */}
              <div className="rounded-lg border border-zinc-800 p-3">
                <p className="text-xs font-bold uppercase tracking-wider text-zinc-500 mb-2">Revisions (OUR_ERROR / CLIENT_CHANGE)</p>
                {data.revisions.length === 0 ? (
                  <p className="text-xs text-zinc-500">None logged.</p>
                ) : (
                  <ul className="space-y-1">
                    {data.revisions.map((r) => (
                      <li key={r.id} className="text-xs text-zinc-300">
                        <span
                          className={
                            r.causedBy === "OUR_ERROR" ? "text-red-400 font-semibold" : r.causedBy === "CLIENT_CHANGE" ? "text-blue-400" : "text-zinc-500"
                          }
                        >
                          {r.causedBy}
                        </span>
                        {r.category ? ` · ${r.category}` : ""}
                        {r.note ? ` — ${r.note}` : ""}
                        {r.minutesRework ? ` (${r.minutesRework}m)` : ""}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </details>

          {/* ===================== DELIVERY ===================== */}
          <details open className="space-y-3">
            <summary className="cursor-pointer text-[11px] font-bold uppercase tracking-widest text-zinc-600 mb-2">▸ Delivery</summary>
            <div className="space-y-3 pl-1">
              <div className="rounded-lg border border-zinc-800 p-3">
                <p className="text-xs font-bold uppercase tracking-wider text-zinc-500 mb-2">Delivery Ledger</p>
                <div className="flex gap-2 mb-2">
                  <input
                    type="text"
                    value={deliveryUrl}
                    onChange={(e) => setDeliveryUrl(e.target.value)}
                    placeholder="delivery URL"
                    className="min-w-0 flex-1 rounded-lg border border-zinc-700 bg-zinc-950 px-2 py-1.5 text-xs text-white"
                  />
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() =>
                      startTransition(async () => {
                        const openCommitment = data.commitments.find((c) => c.status === "OPEN");
                        const r = await recordDelivery({
                          videoId: Number(videoId),
                          deliveryUrl,
                          commitmentId: openCommitment?.id ?? null,
                        });
                        setMessage(r.success ? r.message : r.error);
                        setDeliveryUrl("");
                        refresh();
                      })
                    }
                    className="shrink-0 rounded-lg bg-violet-600 px-3 py-1.5 text-xs font-semibold text-white"
                  >
                    Record delivery
                  </button>
                </div>
                {data.deliveries.length > 0 && (
                  <ul className="space-y-1">
                    {data.deliveries.map((d) => {
                      const commitment = d.commitmentId ? data.commitments.find((c) => c.id === d.commitmentId) : null;
                      const delta = commitment?.dueAt ? Math.round((new Date(d.deliveredAt).getTime() - new Date(commitment.dueAt).getTime()) / 86400000) : null;
                      return (
                        <li key={d.id} className="text-[11px] text-zinc-500">
                          v{d.version} · {d.status} · {new Date(d.deliveredAt).toLocaleString()}
                          {delta !== null && (
                            <span className={delta > 0 ? "text-red-400" : "text-emerald-400"}> · {delta > 0 ? `${delta}d late` : delta === 0 ? "on due date" : `${-delta}d early`}</span>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>

              <div className="rounded-lg border border-zinc-800 p-3">
                <p className="text-xs font-bold uppercase tracking-wider text-zinc-500 mb-2">Live URL (Outcome)</p>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={liveUrlInput || data.video?.publishedUrl || ""}
                    onChange={(e) => setLiveUrlInput(e.target.value)}
                    placeholder="https://..."
                    className="min-w-0 flex-1 rounded-lg border border-zinc-700 bg-zinc-950 px-2 py-1.5 text-xs text-white"
                  />
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => startTransition(async () => { const r = await setPublishedUrl(Number(videoId), liveUrlInput); setMessage(r.success ? r.message : r.error); refresh(); })}
                    className="shrink-0 rounded-lg bg-zinc-700 px-3 py-1.5 text-xs font-semibold text-white"
                  >
                    Save
                  </button>
                </div>
                {data.video?.publishedUrl && (
                  <a href={data.video.publishedUrl} target="_blank" rel="noreferrer" className="mt-1 inline-block text-[11px] text-blue-400 underline">SEE LIVE CONTENT</a>
                )}
              </div>
            </div>
          </details>

          {/* ===================== ECONOMICS ===================== */}
          <details open className="space-y-3">
            <summary className="cursor-pointer text-[11px] font-bold uppercase tracking-widest text-zinc-600 mb-2">▸ Economics</summary>
            <div className="space-y-3 pl-1">
              <div className="rounded-lg border border-zinc-800 p-3">
                <p className="text-xs font-bold uppercase tracking-wider text-zinc-500 mb-2">Economics</p>
                <p className="text-xs text-zinc-300">
                  Tracked: {fmtSeconds(data.economics.totalTrackedSeconds)} · Revisions: {data.economics.revisionsCount} · Avoidable QA: {data.economics.avoidableQaCount}
                </p>
                <p className="text-xs text-zinc-500 mt-1">
                  Coverage: <span className={data.economics.dataCoverage === "LOW" ? "text-amber-400" : "text-zinc-400"}>{data.economics.dataCoverage}</span>
                  {" "}({data.economics.closedSessionCount} closed sessions, {data.economics.staleOrInvalidCount} stale/invalid)
                </p>
                <EvidenceDrawer
                  label="data coverage"
                  sources={[
                    `DERIVED: ${data.economics.closedSessionCount} valid closed session(s), ${fmtSeconds(data.economics.totalTrackedSeconds)} attributed`,
                    `FACT: ${data.economics.staleOrInvalidCount} stale/invalid session(s) present`,
                    "Rule: 3+ sessions AND 3+ hours AND no integrity flags = HIGH; 0.5h+ = MEDIUM; else LOW. Not a confidence interval.",
                  ]}
                />
                {data.economics.contractType === "FIXED" && data.economics.effectiveRatePerHour !== null && (
                  <>
                    <p className="text-xs text-zinc-300 mt-1">
                      Fixed price · observed effective rate: ${data.economics.effectiveRatePerHour.toFixed(2)}/hr
                    </p>
                    <EvidenceDrawer
                      label="effective rate"
                      sources={[
                        `FACT: $${(data.economics.fixedPriceCents! / 100).toFixed(2)} fixed-price agreement (project.fixedPriceCents)`,
                        `FACT: ${fmtSeconds(data.economics.totalTrackedSeconds)} closed Work Sessions`,
                        `DERIVED: price ÷ tracked hours`,
                      ]}
                    />
                  </>
                )}
                {Object.keys(data.economics.activityBreakdown).length > 0 && (
                  <ul className="mt-2 space-y-0.5">
                    {Object.entries(data.economics.activityBreakdown).map(([k, v]) => (
                      <li key={k} className="text-[11px] text-zinc-500">{k}: {fmtSeconds(v)}</li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </details>
        </div>
      )}
    </div>
  );
}
