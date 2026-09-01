"use client";
import { useState, useTransition } from "react";
import { getVideoFinanceContext } from "./finance-context-data";

type Option = { id: number; title: string };
type Context = Awaited<ReturnType<typeof getVideoFinanceContext>>;

// Wave 4M: read-only Finance <-> Production context for a selected video.
// Deliberately preserves custody semantics -- contracts, income
// transactions, and tracked work are shown as separate counts, never
// merged into one "revenue" number here (Economics panels own that, and
// even there only for CLIENT_WORK/OTHER videos).
export function FinanceContextPanel({ videos }: { videos: Option[] }) {
  const [videoId, setVideoId] = useState("");
  const [context, setContext] = useState<Context | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4 space-y-3">
      <p className="text-sm font-semibold text-white">Finance ↔ Production Context</p>
      <select
        value={videoId}
        onChange={(e) => {
          setVideoId(e.target.value);
          if (e.target.value) startTransition(async () => setContext(await getVideoFinanceContext(Number(e.target.value))));
          else setContext(null);
        }}
        className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-2 py-1.5 text-xs text-white"
      >
        <option value="">Select a video…</option>
        {videos.map((v) => <option key={v.id} value={v.id}>{v.title}</option>)}
      </select>
      {pending && <p className="text-xs text-zinc-500">Loading…</p>}
      {context && !pending && (
        context.unattributed ? (
          <p className="text-xs text-amber-400">No contracts or income transactions attributed to this client yet — genuinely unknown, not zero.</p>
        ) : (
          <ul className="text-xs text-zinc-300 space-y-1">
            <li>Contracts for this client: {context.contracts.length}</li>
            <li>Income transactions for this client: {context.incomeTransactionCount}</li>
            {context.incomeTransactions?.slice(0, 5).map((t) => (
              <li key={t.id} className="text-zinc-500">— {t.currency} {t.amount} on {t.date}</li>
            ))}
          </ul>
        )
      )}
      <p className="text-[10px] text-zinc-500">Cash ≠ sale ≠ billed ≠ tracked work. This panel never sums across those.</p>
    </div>
  );
}
