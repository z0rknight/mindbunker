"use client";

import { useTransition } from "react";
import { completeCommitment, cancelCommitment } from "@/modules/commitments/actions";
import { isCommitmentOverdue, COMMITMENT_OWNER_LABELS } from "@/modules/commitments/core";
import type { CommitmentWithOwnerLabel } from "@/modules/commitments/data";

export function CommitmentList({ commitments }: { commitments: CommitmentWithOwnerLabel[] }) {
  const [pending, startTransition] = useTransition();

  if (commitments.length === 0) {
    return <p className="text-sm text-zinc-500">No open commitments. Clean.</p>;
  }

  return (
    <ul className="space-y-2">
      {commitments.map((c) => {
        const overdue = isCommitmentOverdue(c);
        return (
          <li
            key={c.id}
            className={`flex items-center justify-between gap-3 rounded-lg border px-3 py-2 ${
              overdue ? "border-red-800 bg-red-950/40" : "border-zinc-800 bg-zinc-900/50"
            }`}
          >
            <div className="min-w-0">
              <p className="truncate text-sm text-white">{c.description}</p>
              <p className="text-xs text-zinc-500">
                {COMMITMENT_OWNER_LABELS[c.ownerType]}: {c.ownerLabel}
                {c.dueAt && (
                  <span className={overdue ? "text-red-400 font-semibold" : ""}>
                    {" · due "}
                    {new Date(c.dueAt).toLocaleDateString()}
                  </span>
                )}
              </p>
            </div>
            <div className="flex shrink-0 gap-1.5">
              <button
                type="button"
                disabled={pending}
                onClick={() => startTransition(() => { void completeCommitment(c.id); })}
                className="rounded-md bg-emerald-700 px-2 py-1 text-xs font-semibold text-white disabled:opacity-50"
              >
                Done
              </button>
              <button
                type="button"
                disabled={pending}
                onClick={() => startTransition(() => { void cancelCommitment(c.id); })}
                className="rounded-md bg-zinc-700 px-2 py-1 text-xs font-semibold text-white disabled:opacity-50"
              >
                Cancel
              </button>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
