"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { archiveClient, reactivateClient } from "@/modules/crm/actions";
import { revokeGatewayInvitation } from "@/modules/gateway/actions";

function formatArchivedDate(value: string | null) {
  if (!value) return "an unknown date";
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeZone: "America/Sao_Paulo",
  }).format(new Date(value));
}

export function GeladeiraControl({
  clientId,
  archivalState,
  archivedAt,
  invitation,
}: {
  clientId: number;
  archivalState: "ACTIVE_SURFACE" | "GELADEIRA";
  archivedAt: string | null;
  invitation: { id: number; status: "active" | "expired" | "revoked" } | null;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState("");
  const hasActiveCapability = invitation?.status === "active";

  function archive() {
    if (
      !confirm(
        "Move this contact to Geladeira? It disappears from your default CRM, Projects, and Productivity views, but nothing is deleted — Projects, Videos, revenue, and history all stay exactly as they are.",
      )
    ) {
      return;
    }
    setFeedback("");
    startTransition(async () => {
      const result = await archiveClient(clientId);
      setFeedback(result.success ? result.message : result.error);
      if (result.success) router.refresh();
    });
  }

  function reactivate() {
    setFeedback("");
    startTransition(async () => {
      const result = await reactivateClient(clientId);
      setFeedback(result.success ? result.message : result.error);
      if (result.success) router.refresh();
    });
  }

  function revokeAccess() {
    if (!invitation || !confirm("Revoke this Gateway/Vault link now?")) return;
    setFeedback("");
    startTransition(async () => {
      const result = await revokeGatewayInvitation(clientId, invitation.id);
      setFeedback(result.success ? "Gateway link revoked." : result.error);
      if (result.success) router.refresh();
    });
  }

  if (archivalState === "GELADEIRA") {
    return (
      <section className="mb-6 rounded-2xl border border-cyan-900/50 bg-cyan-950/10 p-4 sm:p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <span className="rounded-full border border-cyan-500/30 bg-cyan-500/10 px-2.5 py-1 text-xs font-black uppercase tracking-wide text-cyan-300">
              🧊 Geladeira
            </span>
            <p className="mt-2 text-sm text-zinc-400">
              Archived since {formatArchivedDate(archivedAt)}. Hidden from
              CRM, Projects, and Productivity by default — nothing was
              deleted.
            </p>
          </div>
          <button
            type="button"
            onClick={reactivate}
            disabled={isPending}
            className="min-h-11 shrink-0 rounded-xl bg-cyan-600 px-4 text-sm font-black text-white transition hover:bg-cyan-500 disabled:opacity-60"
          >
            {isPending ? "Working…" : "Reactivate"}
          </button>
        </div>
        {feedback && (
          <p aria-live="polite" className="mt-3 text-xs font-medium text-zinc-400">
            {feedback}
          </p>
        )}
      </section>
    );
  }

  return (
    <section className="mb-6 rounded-2xl border border-zinc-800 bg-zinc-900/60 p-4 sm:p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-bold text-white">Move to Geladeira</p>
          <p className="mt-1 text-xs leading-5 text-zinc-500">
            Removes this relationship from your default CRM, Projects, and
            Productivity views without deleting anything.
          </p>
        </div>
        <button
          type="button"
          onClick={archive}
          disabled={isPending}
          className="min-h-11 shrink-0 rounded-xl border border-zinc-700 px-4 text-sm font-bold text-zinc-300 transition hover:border-cyan-500/40 hover:text-cyan-300 disabled:opacity-60"
        >
          {isPending ? "Working…" : "Move to Geladeira"}
        </button>
      </div>
      {hasActiveCapability && (
        <div className="mt-3 flex flex-col gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs leading-5 text-amber-200">
            This client still has active private access. Archiving does not
            revoke it.
          </p>
          <button
            type="button"
            onClick={revokeAccess}
            disabled={isPending}
            className="min-h-9 shrink-0 rounded-lg border border-amber-500/40 px-3 text-xs font-bold text-amber-200 transition hover:bg-amber-500/10 disabled:opacity-60"
          >
            Revoke access
          </button>
        </div>
      )}
      {feedback && (
        <p aria-live="polite" className="mt-3 text-xs font-medium text-zinc-400">
          {feedback}
        </p>
      )}
    </section>
  );
}
