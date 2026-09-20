"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { attributeRegisteredTime, removeAttribution } from "@/modules/finance/attribution-actions";
import { formatMinutesAsHours } from "@/modules/finance/core";
import type { EvidenceAttributionView } from "@/modules/finance/attribution-data";

// External registered time -> work attribution. Deliberately quiet: no
// required action, no reconciliation workflow, no nagging. "Unallocated" is a
// normal, valid state and nothing is ever spread across videos automatically.
// Attributing records WHICH WORK the time belonged to; it is not a payment,
// not an invoice and not revenue, and it touches no status or session.

const inputClass =
  "w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-xs text-white outline-none focus:border-cyan-500";

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div>
      <dt className="text-[10px] uppercase tracking-widest text-zinc-500">{label}</dt>
      <dd className="mt-0.5 font-mono text-sm text-white">{value}</dd>
      {hint && <dd className="text-[10px] text-zinc-600">{hint}</dd>}
    </div>
  );
}

export function AttributionPanel({ view }: { view: EvidenceAttributionView }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");
  const { summary } = view;

  function submit(formData: FormData) {
    setError("");
    const raw = String(formData.get("target") ?? "");
    const [kind, idText] = raw.split(":");
    startTransition(async () => {
      const result = await attributeRegisteredTime({
        billingEvidenceId: view.evidence.id,
        targetType: kind === "ORDER" ? "PRODUCTION_ORDER" : "VIDEO",
        targetId: Number(idText),
        hours: formData.get("hours"),
        minutes: formData.get("minutes"),
        notes: formData.get("notes"),
      });
      if (!result.success) {
        setError(result.error);
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5" data-testid="attribution-panel">
      <h2 className="text-zinc-400 text-xs font-semibold uppercase tracking-widest">Registered time · attribution</h2>
      <p className="mt-1 mb-4 text-[11px] text-zinc-600">
        External registered time is not an invoice or a payment. Attribute it only when you know which work it was for;
        leaving it unallocated is fine. Nothing is spread across videos automatically.
      </p>

      <dl className="grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-4" data-testid="attribution-summary">
        <Stat label="Registered" value={formatMinutesAsHours(summary.registeredMinutes)} />
        <Stat label="Attributed by you" value={formatMinutesAsHours(summary.explicitMinutes)} />
        <Stat
          label="Historical (derived)"
          value={formatMinutesAsHours(summary.historicalDerivedMinutes)}
          hint={summary.historicalDerivedMinutes > 0 ? "proportional estimate, kept as history" : undefined}
        />
        <Stat label="Unallocated" value={formatMinutesAsHours(summary.unallocatedMinutes)} />
      </dl>
      {summary.amountOnlyRows > 0 && (
        <p className="mt-2 text-[10px] text-zinc-600">
          {summary.amountOnlyRows} allocation(s) carry an amount but no minutes, so they don&apos;t reduce the unallocated time.
        </p>
      )}

      {view.allocations.length > 0 && (
        <ul className="mt-4 space-y-1.5" data-testid="attribution-list">
          {view.allocations.map((row) => (
            <li key={row.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-zinc-800 bg-zinc-950/50 px-3 py-2 text-xs">
              <span className="min-w-0 text-zinc-300">
                {row.target ? (row.target.kind === "ORDER" ? `Batch: ${row.target.label}` : row.target.label) : "No target (unattributed)"}
                <span className="ml-2 text-zinc-500">
                  {row.minutes !== null ? formatMinutesAsHours(row.minutes) : "amount only"}
                  {" · "}
                  {row.method === "DERIVED_PROPORTION" ? "historical, derived" : "attributed by you"}
                </span>
              </span>
              {row.method === "MANUAL_MINUTES" && (
                <button
                  type="button"
                  disabled={pending}
                  onClick={() =>
                    startTransition(async () => {
                      await removeAttribution(row.id);
                      router.refresh();
                    })
                  }
                  className="rounded border border-zinc-800 px-2 py-1 text-[11px] font-bold text-zinc-500 hover:border-red-900 hover:text-red-300 disabled:opacity-60"
                >
                  Remove
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      {summary.unallocatedMinutes > 0 && (view.orderOptions.length > 0 || view.videoOptions.length > 0) && (
        <form action={submit} className="mt-4 grid gap-2 sm:grid-cols-[2fr_auto_auto]" data-testid="attribution-form">
          <select name="target" defaultValue="" required className={inputClass} aria-label="Attribute to">
            <option value="" disabled>Attribute some of this time to…</option>
            {view.orderOptions.length > 0 && (
              <optgroup label="Production Orders (batch)">
                {view.orderOptions.map((o) => (
                  <option key={`o${o.id}`} value={`ORDER:${o.id}`}>{o.label} · {o.state.toLowerCase()}</option>
                ))}
              </optgroup>
            )}
            {view.videoOptions.length > 0 && (
              <optgroup label="A single video">
                {view.videoOptions.map((v) => (
                  <option key={`v${v.id}`} value={`VIDEO:${v.id}`}>{v.title}</option>
                ))}
              </optgroup>
            )}
          </select>
          <div className="flex items-center gap-1">
            <input name="hours" type="number" min={0} step={1} placeholder="h" className={`${inputClass} w-16`} aria-label="Hours" />
            <input name="minutes" type="number" min={0} step={1} placeholder="min" className={`${inputClass} w-16`} aria-label="Minutes" />
          </div>
          <button type="submit" disabled={pending} className="rounded-lg bg-cyan-600 px-3 py-2 text-xs font-black text-black hover:bg-cyan-500 disabled:opacity-60">
            {pending ? "Saving…" : "Attribute"}
          </button>
          <input name="notes" maxLength={500} placeholder="Note (optional)" className={`${inputClass} sm:col-span-3`} aria-label="Note" />
        </form>
      )}
      {error && <p role="alert" className="mt-2 text-xs text-red-300">{error}</p>}
    </div>
  );
}
