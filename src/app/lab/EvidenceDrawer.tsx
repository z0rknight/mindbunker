"use client";
import { useState } from "react";

// Wave 3C: reusable "where did this number come from" block. FACT/DERIVED/
// HYPOTHESIS/UNKNOWN labeling lives at the call site (each metric already
// knows its own provenance); this component just renders it collapsibly.
export function EvidenceDrawer({ label, sources }: { label: string; sources: string[] }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="mt-1">
      <button type="button" onClick={() => setOpen((v) => !v)} className="text-[10px] text-zinc-500 hover:text-zinc-300 underline decoration-dotted">
        {open ? "Hide" : "Show"} evidence: {label}
      </button>
      {open && (
        <ul className="mt-1 text-[10px] text-zinc-500 space-y-0.5 border-l border-zinc-800 pl-2">
          {sources.map((s, i) => <li key={i}>{s}</li>)}
        </ul>
      )}
    </div>
  );
}
