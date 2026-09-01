"use client";

import { useState, useTransition } from "react";
import { createCommitment } from "@/modules/commitments/actions";
import type { CommitmentOwnerType } from "@/modules/commitments/core";

type Option = { id: number; name?: string; title?: string };

export function CommitmentForm({
  clients,
  projects,
  videos,
}: {
  clients: Option[];
  projects: Option[];
  videos: Option[];
}) {
  const [ownerType, setOwnerType] = useState<CommitmentOwnerType>("CLIENT");
  const [ownerId, setOwnerId] = useState<string>("");
  const [description, setDescription] = useState("");
  const [dueAt, setDueAt] = useState("");
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, startTransition] = useTransition();

  const options = ownerType === "CLIENT" ? clients : ownerType === "PROJECT" ? projects : videos;

  return (
    <form
      className="space-y-3 rounded-xl border border-zinc-800 bg-zinc-900/50 p-4"
      onSubmit={(e) => {
        e.preventDefault();
        startTransition(async () => {
          const result = await createCommitment({
            ownerType,
            ownerId: ownerId ? Number(ownerId) : undefined,
            description,
            dueAtIso: dueAt ? new Date(dueAt).toISOString() : undefined,
          });
          setMessage({ ok: result.success, text: result.success ? result.message : result.error });
          if (result.success) {
            setDescription("");
            setDueAt("");
          }
        });
      }}
    >
      <p className="text-sm font-semibold text-white">New commitment</p>
      <div className="flex gap-2">
        {(["CLIENT", "PROJECT", "VIDEO"] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => {
              setOwnerType(t);
              setOwnerId("");
            }}
            className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${
              ownerType === t
                ? "bg-violet-600 text-white"
                : "bg-zinc-800 text-zinc-400 hover:text-white"
            }`}
          >
            {t}
          </button>
        ))}
      </div>
      <select
        value={ownerId}
        onChange={(e) => setOwnerId(e.target.value)}
        className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-white"
        required
      >
        <option value="">Select {ownerType.toLowerCase()}…</option>
        {options.map((o) => (
          <option key={o.id} value={o.id}>
            {o.name ?? o.title}
          </option>
        ))}
      </select>
      <input
        type="text"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        placeholder="What did you promise?"
        className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-white"
        required
      />
      <input
        type="date"
        value={dueAt}
        onChange={(e) => setDueAt(e.target.value)}
        className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-white"
      />
      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-lg bg-violet-600 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"
      >
        {pending ? "Saving…" : "Log commitment"}
      </button>
      {message && (
        <p className={`text-xs ${message.ok ? "text-emerald-400" : "text-red-400"}`}>{message.text}</p>
      )}
    </form>
  );
}
