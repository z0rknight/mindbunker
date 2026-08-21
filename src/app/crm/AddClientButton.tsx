"use client";

import { useState, useTransition } from "react";
import { addClient } from "@/modules/crm/actions";

export function AddClientButton() {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [name, setName] = useState("");
  const [status, setStatus] = useState<"lead" | "active">("lead");
  const [email, setEmail] = useState("");
  const [source, setSource] = useState("");
  const [instagramUsername, setInstagramUsername] = useState("");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    startTransition(async () => {
      await addClient({
        name,
        status,
        email: email || undefined,
        source: source || undefined,
        instagramUsername: instagramUsername || undefined,
      });
      setName("");
      setEmail("");
      setSource("");
      setInstagramUsername("");
      setOpen(false);
    });
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-blue-700 px-4 py-2.5 text-sm font-bold text-white transition-colors hover:bg-blue-600 sm:w-auto cursor-pointer"
      >
        <span>+</span> Add Contact
      </button>

      {open && (
        <div
          className="fixed inset-0 z-[60] flex items-end justify-center bg-black/70 backdrop-blur-sm sm:items-center"
          onClick={(e) => e.target === e.currentTarget && setOpen(false)}
        >
          <div className="safe-sheet max-h-[92dvh] w-full overflow-y-auto rounded-t-3xl border border-zinc-700 bg-zinc-900 p-5 shadow-2xl sm:mx-4 sm:max-w-sm sm:rounded-2xl sm:p-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-white font-bold text-base">Add Contact</h2>
              <button type="button" onClick={() => setOpen(false)} aria-label="Close" className="flex min-h-11 min-w-11 items-center justify-center rounded-full text-zinc-500 hover:bg-zinc-800 hover:text-white text-xl leading-none cursor-pointer">×</button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="text-zinc-400 text-xs uppercase tracking-wider block mb-1">Name *</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Client name"
                  required
                  autoFocus
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-violet-500"
                />
              </div>
              <div>
                <label className="text-zinc-400 text-xs uppercase tracking-wider block mb-1">Status</label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value as "lead" | "active")}
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-violet-500"
                >
                  <option value="lead">Lead</option>
                  <option value="active">Active Client</option>
                </select>
              </div>
              <div>
                <label className="text-zinc-400 text-xs uppercase tracking-wider block mb-1">Email (optional)</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="email@example.com"
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-violet-500"
                />
              </div>
              <div>
                <label className="text-zinc-400 text-xs uppercase tracking-wider block mb-1">Instagram (optional)</label>
                <input
                  type="text"
                  value={instagramUsername}
                  onChange={(e) => setInstagramUsername(e.target.value)}
                  placeholder="@username"
                  autoCapitalize="none"
                  autoCorrect="off"
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-violet-500"
                />
              </div>
              <div>
                <label className="text-zinc-400 text-xs uppercase tracking-wider block mb-1">Source (optional)</label>
                <input
                  type="text"
                  value={source}
                  onChange={(e) => setSource(e.target.value)}
                  placeholder="Instagram, Referral..."
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-violet-500"
                />
              </div>
              <button
                type="submit"
                disabled={isPending}
                className="w-full bg-blue-700 hover:bg-blue-600 text-white font-bold py-2.5 rounded-lg text-sm transition-colors disabled:opacity-60"
              >
                {isPending ? "Saving..." : "Add Contact"}
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
