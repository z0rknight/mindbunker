"use client";
import { useState, useTransition } from "react";
import { recordIngestionEvent } from "@/modules/asset-readiness/ingestion-actions";

type Option = { id: number; title: string };
type Event = {
  id: number;
  videoId: number;
  source: string | null;
  destination: string | null;
  startedAt: Date;
  completedAt: Date | null;
  operatorMinutes: number | null;
  machineMinutes: number | null;
  blockedWork: boolean;
};

// Wave 4T: closes the Wave 3 gap -- an actual UI for recording an
// ingestion event. Deliberately no queueing/automation: this just records
// what happened, and keeps operator-minutes and machine-minutes as two
// separate numbers, never summed (the brief's own distinction: machine
// time != human work time).
export function IngestEventPanel({ videos, events }: { videos: Option[]; events: Event[] }) {
  const [videoId, setVideoId] = useState("");
  const [source, setSource] = useState("");
  const [destination, setDestination] = useState("");
  const [operatorMinutes, setOperatorMinutes] = useState("");
  const [machineMinutes, setMachineMinutes] = useState("");
  const [blockedWork, setBlockedWork] = useState(false);
  const [pending, startTransition] = useTransition();

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4 space-y-3">
      <p className="text-sm font-semibold text-white">Ingestion Events</p>
      <select value={videoId} onChange={(e) => setVideoId(e.target.value)} className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-2 py-1.5 text-xs text-white">
        <option value="">Select video…</option>
        {videos.map((v) => <option key={v.id} value={v.id}>{v.title}</option>)}
      </select>
      <div className="flex gap-1.5">
        <input value={source} onChange={(e) => setSource(e.target.value)} placeholder="Source (e.g. SD card, camera)" className="min-w-0 flex-1 rounded-lg border border-zinc-700 bg-zinc-950 px-2 py-1.5 text-xs text-white" />
        <input value={destination} onChange={(e) => setDestination(e.target.value)} placeholder="Destination (e.g. TrueNAS)" className="min-w-0 flex-1 rounded-lg border border-zinc-700 bg-zinc-950 px-2 py-1.5 text-xs text-white" />
      </div>
      <div className="flex gap-1.5">
        <input value={operatorMinutes} onChange={(e) => setOperatorMinutes(e.target.value)} type="number" placeholder="Operator minutes" className="min-w-0 flex-1 rounded-lg border border-zinc-700 bg-zinc-950 px-2 py-1.5 text-xs text-white" />
        <input value={machineMinutes} onChange={(e) => setMachineMinutes(e.target.value)} type="number" placeholder="Machine minutes" className="min-w-0 flex-1 rounded-lg border border-zinc-700 bg-zinc-950 px-2 py-1.5 text-xs text-white" />
      </div>
      <label className="flex items-center gap-1.5 text-xs text-zinc-400">
        <input type="checkbox" checked={blockedWork} onChange={(e) => setBlockedWork(e.target.checked)} /> Work was blocked waiting on this ingest
      </label>
      <button
        disabled={pending || !videoId}
        onClick={() => startTransition(async () => {
          await recordIngestionEvent({
            videoId: Number(videoId),
            source: source || undefined,
            destination: destination || undefined,
            operatorMinutes: operatorMinutes ? Number(operatorMinutes) : undefined,
            machineMinutes: machineMinutes ? Number(machineMinutes) : undefined,
            blockedWork,
          });
          setSource(""); setDestination(""); setOperatorMinutes(""); setMachineMinutes(""); setBlockedWork(false);
        })}
        className="w-full rounded-lg bg-violet-600 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-40"
      >
        Record Ingestion Event
      </button>
      <ul className="text-xs text-zinc-300 space-y-1">
        {events.slice(0, 8).map((e) => (
          <li key={e.id} className="text-zinc-400">
            video #{e.videoId}: {e.source ?? "?"} → {e.destination ?? "?"} — operator {e.operatorMinutes ?? "—"}min / machine {e.machineMinutes ?? "—"}min{e.blockedWork ? " (blocked work)" : ""}
          </li>
        ))}
        {events.length === 0 && <li className="text-zinc-500">None recorded yet.</li>}
      </ul>
    </div>
  );
}
