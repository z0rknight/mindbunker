"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { useState, useTransition } from "react";
import {
  generateGatewayInvitation,
  revokeGatewayInvitation,
  updateOpportunity,
} from "@/modules/gateway/actions";
import {
  OPPORTUNITY_STAGES,
  OPPORTUNITY_STAGE_LABELS,
  SERVICE_INTEREST_OPTIONS,
  type OpportunityStage,
} from "@/modules/gateway/config";

type InvitationSummary = {
  id: number;
  status: "active" | "expired" | "revoked";
  expiresAt: string;
  openedAt: string | null;
} | null;

type BookingSummary = {
  status: "confirmed" | "cancelled";
  startsAt: string;
  endsAt: string;
} | null;

const fieldClassName =
  "w-full rounded-xl border border-zinc-700 bg-zinc-950/70 px-3.5 py-2.5 text-base text-white outline-none transition focus:border-violet-500 focus:ring-4 focus:ring-violet-500/10 md:text-sm";

export function OpportunityPanel({
  client,
  invitation,
  briefingSubmitted,
  booking,
  bookingTimezone,
}: {
  client: {
    id: number;
    opportunityStage: OpportunityStage;
    serviceInterest: string | null;
    nextAction: string | null;
    nextActionDate: string | null;
    qualificationNotes: string | null;
  };
  invitation: InvitationSummary;
  briefingSubmitted: boolean;
  booking: BookingSummary;
  bookingTimezone: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [stage, setStage] = useState(client.opportunityStage);
  const [serviceInterest, setServiceInterest] = useState(
    client.serviceInterest ?? "",
  );
  const [nextAction, setNextAction] = useState(client.nextAction ?? "");
  const [nextActionDate, setNextActionDate] = useState(
    client.nextActionDate ?? "",
  );
  const [qualificationNotes, setQualificationNotes] = useState(
    client.qualificationNotes ?? "",
  );
  const [gatewayUrl, setGatewayUrl] = useState("");
  const [feedback, setFeedback] = useState("");

  function saveOpportunity() {
    setFeedback("");
    startTransition(async () => {
      const result = await updateOpportunity(client.id, {
        stage,
        serviceInterest,
        nextAction,
        nextActionDate,
        qualificationNotes,
      });
      setFeedback(result.success ? "Opportunity saved." : result.error);
      if (result.success) router.refresh();
    });
  }

  function generateGateway() {
    if (
      invitation?.status === "active" &&
      !confirm("Replace the current Gateway link? The existing link will stop working.")
    ) {
      return;
    }

    setFeedback("");
    startTransition(async () => {
      const result = await generateGatewayInvitation(client.id);
      if (!result.success) {
        setFeedback(result.error);
        return;
      }
      if (result.path) {
        setGatewayUrl(`${window.location.origin}${result.path}`);
      }
      if (stage === "new" || stage === "qualified") {
        setStage("invited");
      }
      setFeedback("Private Gateway link created. Copy it now.");
      router.refresh();
    });
  }

  function revokeGateway() {
    if (!invitation || !confirm("Revoke this Gateway link now?")) return;

    setFeedback("");
    startTransition(async () => {
      const result = await revokeGatewayInvitation(client.id, invitation.id);
      setFeedback(result.success ? "Gateway link revoked." : result.error);
      if (result.success) {
        setGatewayUrl("");
        router.refresh();
      }
    });
  }

  async function copyGateway() {
    if (!gatewayUrl) return;
    try {
      await navigator.clipboard.writeText(gatewayUrl);
      setFeedback("Gateway link copied.");
    } catch {
      setFeedback("Copy failed. Select and copy the link below.");
    }
  }

  const gatewayStatus = invitation?.status ?? "not_created";
  const statusClasses = {
    active: "border-emerald-500/30 bg-emerald-500/10 text-emerald-300",
    expired: "border-amber-500/30 bg-amber-500/10 text-amber-300",
    revoked: "border-red-500/30 bg-red-500/10 text-red-300",
    not_created: "border-zinc-700 bg-zinc-800 text-zinc-400",
  }[gatewayStatus];

  return (
    <section className="mb-6 overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900 shadow-xl shadow-black/10">
      <div className="border-b border-zinc-800 bg-gradient-to-r from-violet-500/10 via-transparent to-cyan-500/5 p-4 sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-violet-300">
              What happens next?
            </p>
            <p className="mt-2 text-xl font-black text-white">
              {nextAction || "Choose the next action"}
            </p>
            <p className="mt-1 text-sm text-zinc-500">
              {nextActionDate
                ? `Due ${new Intl.DateTimeFormat("en", {
                    dateStyle: "medium",
                    timeZone: "UTC",
                  }).format(new Date(`${nextActionDate}T00:00:00Z`))}`
                : "No date set"}
            </p>
          </div>
          <span className="w-fit rounded-full border border-violet-500/30 bg-violet-500/10 px-3 py-1.5 text-xs font-bold text-violet-300">
            {OPPORTUNITY_STAGE_LABELS[stage]}
          </span>
        </div>
      </div>

      <div className="grid gap-0 lg:grid-cols-[1.2fr_0.8fr]">
        <div className="space-y-4 border-b border-zinc-800 p-4 sm:p-6 lg:border-b-0 lg:border-r">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-black text-white">Opportunity</h2>
              <p className="mt-1 text-xs text-zinc-500">
                Keep only the facts that make the next decision easier.
              </p>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="opportunityStage" className="mb-1.5 block text-xs font-bold text-zinc-500">
                Stage
              </label>
              <select
                id="opportunityStage"
                value={stage}
                onChange={(event) =>
                  setStage(event.target.value as OpportunityStage)
                }
                className={fieldClassName}
              >
                {OPPORTUNITY_STAGES.map((value) => (
                  <option key={value} value={value}>
                    {OPPORTUNITY_STAGE_LABELS[value]}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="serviceInterest" className="mb-1.5 block text-xs font-bold text-zinc-500">
                Service interest
              </label>
              <select
                id="serviceInterest"
                value={serviceInterest}
                onChange={(event) => setServiceInterest(event.target.value)}
                className={fieldClassName}
              >
                <option value="">Not known yet</option>
                {SERVICE_INTEREST_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-[1fr_11rem]">
            <div>
              <label htmlFor="nextAction" className="mb-1.5 block text-xs font-bold text-zinc-500">
                Next action
              </label>
              <input
                id="nextAction"
                value={nextAction}
                onChange={(event) => setNextAction(event.target.value)}
                maxLength={500}
                placeholder="Review brief, send follow-up…"
                className={fieldClassName}
              />
            </div>
            <div>
              <label htmlFor="nextActionDate" className="mb-1.5 block text-xs font-bold text-zinc-500">
                Date
              </label>
              <input
                id="nextActionDate"
                type="date"
                value={nextActionDate}
                onChange={(event) => setNextActionDate(event.target.value)}
                onInput={(event) => setNextActionDate(event.currentTarget.value)}
                className={fieldClassName}
              />
            </div>
          </div>

          <div>
            <label htmlFor="qualificationNotes" className="mb-1.5 block text-xs font-bold text-zinc-500">
              Qualification notes
            </label>
            <textarea
              id="qualificationNotes"
              value={qualificationNotes}
              onChange={(event) => setQualificationNotes(event.target.value)}
              rows={3}
              maxLength={2000}
              placeholder="Fit, context, constraints, buying signal…"
              className={`${fieldClassName} resize-y`}
            />
          </div>

          <button
            type="button"
            onClick={saveOpportunity}
            disabled={isPending}
            className="min-h-12 w-full rounded-xl bg-zinc-100 px-4 text-sm font-black text-zinc-950 transition hover:bg-white disabled:opacity-60 sm:w-auto"
          >
            {isPending ? "Saving…" : "Save opportunity"}
          </button>
        </div>

        <div className="space-y-5 p-4 sm:p-6">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="font-black text-white">Client Gateway</h2>
              <p className="mt-1 text-xs leading-5 text-zinc-500">
                One private link for this person&apos;s briefing and call.
              </p>
            </div>
            <div className="flex flex-col items-end gap-2">
              <span className={`rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide ${statusClasses}`}>
                {gatewayStatus.replace("_", " ")}
              </span>
              <Link href="/crm/availability" className="text-[11px] font-bold text-cyan-400 hover:text-cyan-300">
                Edit availability →
              </Link>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2 text-xs">
            <div className="rounded-xl bg-zinc-800/60 p-3">
              <p className="text-zinc-600">Opened</p>
              <p className="mt-1 font-bold text-zinc-300">
                {invitation?.openedAt ? "Yes" : "Not yet"}
              </p>
            </div>
            <div className="rounded-xl bg-zinc-800/60 p-3">
              <p className="text-zinc-600">Briefing</p>
              <p className={`mt-1 font-bold ${briefingSubmitted ? "text-emerald-300" : "text-zinc-300"}`}>
                {briefingSubmitted ? "Received" : "Waiting"}
              </p>
            </div>
            <div className="rounded-xl bg-zinc-800/60 p-3">
              <p className="text-zinc-600">Call</p>
              <p className={`mt-1 font-bold ${booking?.status === "confirmed" ? "text-cyan-300" : "text-zinc-300"}`}>
                {booking?.status === "confirmed"
                  ? "Booked"
                  : booking?.status === "cancelled"
                    ? "Cancelled"
                    : "Not booked"}
              </p>
            </div>
          </div>

          {booking?.status === "confirmed" && (
            <div className="rounded-xl border border-cyan-500/20 bg-cyan-500/5 p-3">
              <p className="text-[10px] font-bold uppercase tracking-wide text-cyan-400">Scheduled call</p>
              <p className="mt-1.5 text-sm font-black text-white">
                {new Intl.DateTimeFormat("en", {
                  dateStyle: "medium",
                  timeStyle: "short",
                  timeZone: bookingTimezone,
                }).format(new Date(booking.startsAt))}
              </p>
            </div>
          )}

          {gatewayUrl ? (
            <div className="space-y-2">
              <label htmlFor="generatedGatewayUrl" className="text-xs font-bold text-zinc-500">
                Copy this link now
              </label>
              <textarea
                id="generatedGatewayUrl"
                readOnly
                value={gatewayUrl}
                rows={3}
                className="w-full resize-none rounded-xl border border-violet-500/30 bg-violet-500/5 p-3 text-xs leading-5 text-violet-200 outline-none"
              />
              <button
                type="button"
                onClick={copyGateway}
                className="min-h-12 w-full rounded-xl bg-violet-600 px-4 text-sm font-black text-white transition hover:bg-violet-500 active:scale-[0.99]"
              >
                Copy Gateway link
              </button>
            </div>
          ) : (
            <p className="rounded-xl border border-zinc-800 bg-zinc-950/50 p-3 text-xs leading-5 text-zinc-500">
              For security, a complete link is shown only when it is generated.
              Generate a new one if you need to copy it again.
            </p>
          )}

          <div className="grid gap-2">
            <button
              type="button"
              onClick={generateGateway}
              disabled={isPending}
              className="min-h-12 rounded-xl bg-violet-600 px-4 text-sm font-black text-white transition hover:bg-violet-500 disabled:opacity-60"
            >
              {invitation?.status === "active"
                ? "Generate new link"
                : "Generate Gateway"}
            </button>
            {invitation?.status === "active" && (
              <button
                type="button"
                onClick={revokeGateway}
                disabled={isPending}
                className="min-h-12 rounded-xl border border-red-900/70 px-4 text-sm font-bold text-red-300 transition hover:bg-red-950/40 disabled:opacity-60"
              >
                Revoke Gateway
              </button>
            )}
          </div>
        </div>
      </div>

      {feedback && (
        <p aria-live="polite" className="border-t border-zinc-800 px-4 py-3 text-xs font-medium text-zinc-400 sm:px-6">
          {feedback}
        </p>
      )}
    </section>
  );
}
