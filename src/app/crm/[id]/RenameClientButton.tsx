"use client";

// Monday Real-Operation Pre-Freeze §7 — client rename. `updateClient`
// already supported a `name` field; nothing on the CRM surface actually
// called it with one. This is the fix: an inline rename control next to
// the client header, using the SAME action and the SAME row (client.id
// never changes), so renaming never touches any child record (projects,
// videos, contracts, transactions all keep referencing the same clientId).
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateClient } from "@/modules/crm/actions";

export function RenameClientButton({
  clientId,
  currentName,
}: {
  clientId: number;
  currentName: string;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(currentName);
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();

  if (!editing) {
    return (
      <button
        onClick={() => {
          setName(currentName);
          setError("");
          setEditing(true);
        }}
        className="shrink-0 rounded-lg border border-zinc-700 px-2 py-1 text-xs font-semibold text-zinc-400 transition hover:border-cyan-500/40 hover:text-cyan-300"
        aria-label="Rename client"
        title="Rename client"
      >
        ✎ Rename
      </button>
    );
  }

  function save() {
    const trimmed = name.trim();
    if (!trimmed) {
      setError("Name cannot be empty.");
      return;
    }
    setError("");
    startTransition(async () => {
      try {
        await updateClient(clientId, { name: trimmed });
        setEditing(false);
        router.refresh();
      } catch {
        setError("Could not save. Try again.");
      }
    });
  }

  return (
    <div className="flex min-w-0 flex-1 items-center gap-2">
      <input
        autoFocus
        value={name}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") save();
          if (e.key === "Escape") setEditing(false);
        }}
        className="min-w-0 flex-1 rounded-lg border border-zinc-700 bg-zinc-950 px-2 py-1 text-lg font-bold text-white focus:border-cyan-500 focus:outline-none"
      />
      <button
        onClick={save}
        disabled={isPending}
        className="shrink-0 rounded-lg bg-cyan-600 px-3 py-1 text-xs font-bold text-white transition hover:bg-cyan-500 disabled:opacity-50"
      >
        {isPending ? "Saving…" : "Save"}
      </button>
      <button
        onClick={() => setEditing(false)}
        className="shrink-0 rounded-lg border border-zinc-700 px-3 py-1 text-xs font-semibold text-zinc-400 hover:text-zinc-200"
      >
        Cancel
      </button>
      {error && <span className="shrink-0 text-xs text-red-400">{error}</span>}
    </div>
  );
}
