"use client";
import { useState, useTransition } from "react";
import { getProjectEconomics, getClientEconomics } from "@/modules/economics/aggregate";
import { EvidenceDrawer } from "./EvidenceDrawer";

type Option = { id: number; name?: string; title?: string };
type ProjectAgg = Awaited<ReturnType<typeof getProjectEconomics>>;
type ClientAgg = Awaited<ReturnType<typeof getClientEconomics>>;

// Wave 4K/4L: Project-level and Client-level economics, both restrained --
// raw counts + tracked seconds + revision provenance, NEVER a combined
// USD/BRL total and NEVER a synthesized margin/Client Score. The single
// gate every total here already passed through is countsTowardRevenue
// (SAMPLE_VIDEO/INTERNAL videos are shown as their own separate count,
// excluded from every revenue-eligible aggregate).
export function EconomicsPanel({ clients, projects }: { clients: Option[]; projects: Option[] }) {
  const [mode, setMode] = useState<"PROJECT" | "CLIENT">("PROJECT");
  const [id, setId] = useState("");
  const [projectAgg, setProjectAgg] = useState<ProjectAgg | null>(null);
  const [clientAgg, setClientAgg] = useState<ClientAgg | null>(null);
  const [pending, startTransition] = useTransition();
  const options = mode === "PROJECT" ? projects : clients;
  const agg = mode === "PROJECT" ? projectAgg : clientAgg;

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4 space-y-3">
      <p className="text-sm font-semibold text-white">Economics (Project / Client)</p>
      <div className="flex gap-2">
        {(["PROJECT", "CLIENT"] as const).map((m) => (
          <button key={m} onClick={() => { setMode(m); setId(""); setProjectAgg(null); setClientAgg(null); }} className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${mode === m ? "bg-violet-600 text-white" : "bg-zinc-800 text-zinc-400"}`}>{m}</button>
        ))}
      </div>
      <select
        value={id}
        onChange={(e) => {
          setId(e.target.value);
          if (!e.target.value) { setProjectAgg(null); setClientAgg(null); return; }
          startTransition(async () => {
            if (mode === "PROJECT") setProjectAgg(await getProjectEconomics(Number(e.target.value)));
            else setClientAgg(await getClientEconomics(Number(e.target.value)));
          });
        }}
        className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-2 py-1.5 text-xs text-white"
      >
        <option value="">Select {mode.toLowerCase()}…</option>
        {options.map((o) => <option key={o.id} value={o.id}>{o.name ?? o.title}</option>)}
      </select>
      {pending && <p className="text-xs text-zinc-500">Loading…</p>}
      {agg && !pending && (
        <div className="text-xs text-zinc-300 space-y-1">
          <p>Videos: {agg.videoCount} total — {agg.revenueEligibleVideoCount} revenue-eligible, {agg.sampleOrInternalVideoCount} sample/internal (excluded)</p>
          <p>Delivered: {agg.deliveredCount}</p>
          <p>Tracked work (revenue-eligible only): {(agg.totalTrackedSeconds / 3600).toFixed(1)}h</p>
          <p>Revisions: {agg.ourErrorCount} our error, {agg.clientChangeCount} client change</p>
          {mode === "PROJECT" && projectAgg && (
            <p className="text-zinc-500">Contract: {projectAgg.contractType ?? "—"}{projectAgg.fixedPriceCents ? ` (${(projectAgg.fixedPriceCents / 100).toFixed(2)})` : ""}</p>
          )}
          <EvidenceDrawer
            label="economics aggregation"
            sources={[
              "FACT: per-video getVideoEconomics summed, gated by countsTowardRevenue(videoKind)",
              "No combined USD/BRL total -- currency mixing not attempted here",
              "No margin/profitability figure -- cost side is not modeled in the Lab",
            ]}
          />
        </div>
      )}
    </div>
  );
}
