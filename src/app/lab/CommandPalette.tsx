"use client";

import { useEffect, useState } from "react";

type Item = { id: number; title?: string; name?: string; kind: "client" | "project" | "video" };

const STATIC_COMMANDS = [
  { key: "workbench", label: "Go to Video Workbench" },
  { key: "factory", label: "Go to Factory State" },
  { key: "timeline", label: "Go to Timeline" },
  { key: "crm", label: "Go to CRM Operator View" },
  { key: "morning", label: "Go to Morning Brief" },
  { key: "weekly", label: "Go to Weekly Factory Report" },
];

// Wave 3R: ⌘K / Ctrl+K. Simple keyboard filter, no fuzzy-search library --
// per the brief, trivial is the point.
export function CommandPalette({ items }: { items: Item[] }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((v) => !v);
      }
      if (e.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  if (!open) return null;

  const q = query.trim().toLowerCase();
  const filteredCommands = STATIC_COMMANDS.filter((c) => c.label.toLowerCase().includes(q));
  const filteredItems = q ? items.filter((i) => (i.title ?? i.name ?? "").toLowerCase().includes(q)).slice(0, 8) : [];

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/60 pt-24" onClick={() => setOpen(false)}>
      <div className="w-full max-w-md rounded-xl border border-zinc-700 bg-zinc-900 p-3" onClick={(e) => e.stopPropagation()}>
        <input
          autoFocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Type a command or search Client/Project/Video…"
          className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-white mb-2"
        />
        <ul className="text-xs text-zinc-300 space-y-1 max-h-72 overflow-y-auto">
          {filteredCommands.map((c) => (
            <li key={c.key}>
              <a href={`#${c.key}`} onClick={() => setOpen(false)} className="block rounded-md px-2 py-1.5 hover:bg-zinc-800">{c.label}</a>
            </li>
          ))}
          {filteredItems.map((i) => (
            <li key={`${i.kind}-${i.id}`} className="rounded-md px-2 py-1.5 text-zinc-500">
              {i.kind.toUpperCase()}: {i.title ?? i.name} — select it in the relevant panel above
            </li>
          ))}
          {filteredCommands.length === 0 && filteredItems.length === 0 && <li className="px-2 py-1.5 text-zinc-600">No matches.</li>}
        </ul>
        <p className="text-[10px] text-zinc-600 mt-2">⌘K / Ctrl+K to toggle · Esc to close</p>
      </div>
    </div>
  );
}
