"use client";
import { useState, useTransition } from "react";
import { createVideoIdea, advanceIdeaStage, approveIdea } from "@/modules/video-idea/actions";

type Option = { id: number; name?: string; title?: string };
type Idea = { id: number; title: string | null; ideaStage: string | null; pitch: string | null; intendedFormat: string | null; clientId: number | null };

// Wave 4G: Video Idea/Pitch, reusing the existing Video model (status
// PLANNED) rather than a separate object -- IDEA -> PROPOSED -> APPROVED,
// approving just clears ideaStage (the row was a real video the whole
// time).
export function VideoIdeaPanel({ clients, ideas }: { clients: Option[]; ideas: Idea[] }) {
  const [title, setTitle] = useState("");
  const [clientId, setClientId] = useState("");
  const [pitch, setPitch] = useState("");
  const [format, setFormat] = useState("");
  const [pending, startTransition] = useTransition();

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4 space-y-3">
      <p className="text-sm font-semibold text-white">Video Ideas / Pitches</p>
      <div className="flex gap-1.5">
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Idea title" className="min-w-0 flex-1 rounded-lg border border-zinc-700 bg-zinc-950 px-2 py-1.5 text-xs text-white" />
        <select value={clientId} onChange={(e) => setClientId(e.target.value)} className="w-40 rounded-lg border border-zinc-700 bg-zinc-950 px-2 py-1.5 text-xs text-white">
          <option value="">Client…</option>
          {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </div>
      <input value={pitch} onChange={(e) => setPitch(e.target.value)} placeholder="Pitch (why this video?)" className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-2 py-1.5 text-xs text-white" />
      <input value={format} onChange={(e) => setFormat(e.target.value)} placeholder="Intended format" className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-2 py-1.5 text-xs text-white" />
      <button
        disabled={pending || !title || !clientId}
        onClick={() => startTransition(async () => {
          await createVideoIdea({ title, clientId: Number(clientId), pitch: pitch || undefined, intendedFormat: format || undefined });
          setTitle(""); setPitch(""); setFormat("");
        })}
        className="w-full rounded-lg bg-violet-600 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-40"
      >
        Capture Idea
      </button>
      <ul className="space-y-1.5">
        {ideas.map((idea) => (
          <li key={idea.id} className="rounded-lg border border-zinc-800 bg-zinc-950/50 p-2 flex items-center justify-between gap-2">
            <div>
              <p className="text-xs text-white">{idea.title ?? `Untitled #${idea.id}`} <span className="text-[10px] text-zinc-500">[{idea.ideaStage}]</span></p>
              {idea.pitch && <p className="text-[10px] text-zinc-500">{idea.pitch}</p>}
            </div>
            <div className="flex gap-1 shrink-0">
              {idea.ideaStage !== "APPROVED" && (
                <button disabled={pending} onClick={() => startTransition(async () => { await advanceIdeaStage(idea.id); })} className="rounded-md bg-zinc-700 px-2 py-0.5 text-[10px] text-white">Advance</button>
              )}
              <button disabled={pending} onClick={() => startTransition(async () => { await approveIdea(idea.id); })} className="rounded-md bg-emerald-800 px-2 py-0.5 text-[10px] text-emerald-200">Approve</button>
            </div>
          </li>
        ))}
        {ideas.length === 0 && <li className="text-xs text-zinc-500">No ideas captured yet.</li>}
      </ul>
    </div>
  );
}
