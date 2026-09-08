"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { getClientById } from "@/modules/crm/actions";
import { updateOpportunity } from "@/modules/gateway/actions";

// P0.3: reuses the existing canonical follow-up fact (clients.nextAction /
// nextActionDate, written through modules/gateway's updateOpportunity --
// the same action CRM's Opportunity panel already calls) rather than
// inventing a Task/FollowUp table. Only rendered when a video has a client
// (natural context) -- see OperationalMemoryPanel. updateOpportunity takes
// the whole opportunity record at once, so this control loads the client's
// CURRENT stage/serviceInterest/qualificationNotes first and resubmits them
// unchanged alongside the new follow-up fields -- it must never blank out
// facts the operator isn't looking at right now.
const inputClass =
  "min-h-11 w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 text-sm text-white outline-none focus:border-violet-500";
const smallButton =
  "min-h-10 rounded-xl border border-zinc-700 bg-zinc-900 px-3 text-xs font-black text-zinc-200 hover:border-violet-500/60 disabled:opacity-40";

function pad(value: number) {
  return value.toString().padStart(2, "0");
}

// Pure calendar-day arithmetic on a UTC-anchored Date used only as a day
// counter -- never read as a real instant/timezone, so this is safe
// regardless of the browser's own timezone.
function todayPlusDays(days: number) {
  const now = new Date();
  const d = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
  d.setUTCDate(d.getUTCDate() + days);
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}

type Client = Awaited<ReturnType<typeof getClientById>>;

export function FollowUpControl({ clientId }: { clientId: number }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [client, setClient] = useState<Client | null>(null);
  const [pending, startTransition] = useTransition();
  const [nextAction, setNextAction] = useState("");
  const [nextActionDate, setNextActionDate] = useState("");
  const [feedback, setFeedback] = useState("");
  const [error, setError] = useState("");

  // loading is deliberately not its own state: it's always exactly
  // `open && !client` (open, still waiting on the fetch below). Modeling
  // it as separate state would need a setState call synchronously inside
  // this effect body just to flip it true before the fetch starts.
  useEffect(() => {
    if (!open || client) return;
    let cancelled = false;
    getClientById(clientId).then((result) => {
      if (cancelled) return;
      setClient(result);
      setNextAction(result?.nextAction ?? "");
      setNextActionDate(result?.nextActionDate ?? "");
    });
    return () => {
      cancelled = true;
    };
  }, [open, client, clientId]);

  function save() {
    if (!client) return;
    setError("");
    setFeedback("");
    startTransition(async () => {
      const result = await updateOpportunity(clientId, {
        stage: client.opportunityStage,
        serviceInterest: client.serviceInterest ?? "",
        nextAction,
        nextActionDate,
        qualificationNotes: client.qualificationNotes ?? "",
      });
      if (!result.success) {
        setError(result.error);
        return;
      }
      setFeedback("Follow-up saved.");
      setClient({ ...client, nextAction: nextAction || null, nextActionDate: nextActionDate || null });
      router.refresh();
    });
  }

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className={smallButton}>
        Client follow-up
      </button>
    );
  }

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-950/35 p-3">
      <p className="text-[10px] font-black uppercase tracking-wider text-zinc-300">Client follow-up</p>
      {!client && <p className="mt-2 text-xs text-zinc-500">Loading…</p>}
      {client && (
        <div className="mt-2 space-y-2">
          <input
            value={nextAction}
            onChange={(event) => setNextAction(event.target.value)}
            placeholder="What's the next step with this client?"
            maxLength={500}
            className={inputClass}
          />
          <div className="flex flex-wrap gap-2">
            {[
              { label: "Tomorrow", value: todayPlusDays(1) },
              { label: "In 3 days", value: todayPlusDays(3) },
              { label: "Next week", value: todayPlusDays(7) },
            ].map((preset) => (
              <button
                key={preset.label}
                type="button"
                disabled={pending}
                onClick={() => setNextActionDate(preset.value)}
                className={smallButton}
              >
                {preset.label}
              </button>
            ))}
            <input
              aria-label="Follow-up date"
              type="date"
              value={nextActionDate}
              onChange={(event) => setNextActionDate(event.target.value)}
              className={`${inputClass} w-auto`}
            />
          </div>
          {error && <p className="text-xs text-red-300" aria-live="assertive">{error}</p>}
          {feedback && <p className="text-xs text-emerald-300" aria-live="polite">{feedback}</p>}
          <div className="flex gap-2">
            <button type="button" disabled={pending} onClick={save} className={smallButton}>
              {pending ? "Saving…" : "Save follow-up"}
            </button>
            <button type="button" disabled={pending} onClick={() => setOpen(false)} className={smallButton}>
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
