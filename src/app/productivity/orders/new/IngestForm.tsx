"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ingestProductionOrder } from "@/modules/production-orders/actions";
import { todayISO } from "@/utils/date";
import type {
  IngestClientOption,
  IngestProjectOption,
} from "@/modules/production-orders/data";

type ItemRow = { key: number; title: string };

let nextKey = 1;
function emptyRow(): ItemRow {
  return { key: nextKey++, title: "" };
}

// RMEDIA LET'S COOK — Wave 1 ingest form (brief §8). The one client-side
// idempotency guarantee this depends on: `ingestKey` is generated exactly
// once per mount (lazy useState initializer, never regenerated on
// re-render or on a failed/retried submit) and resent unchanged on every
// call to ingestProductionOrder -- so a double-click or a network retry
// of the same submit can never create two orders. See
// modules/production-orders/actions.ts for the server-side half of that
// guarantee.
export function IngestForm({
  clients,
  projects,
}: {
  clients: IngestClientOption[];
  projects: IngestProjectOption[];
}) {
  const router = useRouter();
  const [ingestKey] = useState(() =>
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `lc-${Date.now()}-${Math.random().toString(36).slice(2)}`,
  );
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [clientId, setClientId] = useState<number | "">("");
  const [projectId, setProjectId] = useState<number | "">("");
  const [label, setLabel] = useState("");
  const [channel, setChannel] = useState("");
  const [pricingModel, setPricingModel] = useState<"" | "HOURLY" | "FIXED" | "OTHER">("");
  const [expectedValue, setExpectedValue] = useState("");
  const [currency, setCurrency] = useState<"USD" | "BRL">("USD");
  const [receivedAt, setReceivedAt] = useState(() => todayISO());
  const [notes, setNotes] = useState("");
  const [rows, setRows] = useState<ItemRow[]>([emptyRow(), emptyRow(), emptyRow()]);

  const projectsForClient = useMemo(
    () => projects.filter((p) => p.clientId === clientId),
    [projects, clientId],
  );

  function updateRow(key: number, title: string) {
    setRows((prev) => prev.map((r) => (r.key === key ? { ...r, title } : r)));
  }
  function addRow() {
    setRows((prev) => [...prev, emptyRow()]);
  }
  function removeRow(key: number) {
    setRows((prev) => (prev.length <= 1 ? prev : prev.filter((r) => r.key !== key)));
  }

  // Solo-Operator Health round (brief §5/§13): a real 6-video batch is the
  // named target ("< 60 seconds"). Typing six titles one field at a time
  // is the main thing standing in the way of that when the operator
  // already has a title list ready (e.g. copied from a client message) --
  // pasting one is treated as a paste-a-list gesture only when it actually
  // contains multiple lines; an ordinary single-line paste still just
  // fills the one field it landed in, unchanged from before.
  function handleTitlePaste(rowIndex: number, e: React.ClipboardEvent<HTMLInputElement>) {
    const text = e.clipboardData.getData("text");
    const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
    if (lines.length <= 1) return;
    e.preventDefault();
    setRows((prev) => {
      const next = [...prev];
      lines.forEach((line, offset) => {
        const idx = rowIndex + offset;
        if (idx < next.length) {
          next[idx] = { ...next[idx], title: line };
        } else {
          next.push({ key: nextKey++, title: line });
        }
      });
      return next;
    });
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (clientId === "" || projectId === "") {
      setError("Choose a client and project.");
      return;
    }
    const items = rows
      .map((r) => ({ title: r.title.trim() }))
      .filter((r) => r.title.length > 0);
    if (items.length === 0) {
      setError("Add at least one video to this order.");
      return;
    }

    const expectedValueCents =
      expectedValue.trim() === "" ? null : Math.round(parseFloat(expectedValue) * 100);
    if (expectedValueCents !== null && !Number.isFinite(expectedValueCents)) {
      setError("Expected value must be a number.");
      return;
    }

    startTransition(async () => {
      const result = await ingestProductionOrder({
        clientId: clientId as number,
        projectId: projectId as number,
        label,
        channel: channel.trim() || null,
        pricingModel: pricingModel || null,
        expectedValueCents,
        currency: expectedValueCents !== null ? currency : null,
        notes: notes.trim() || null,
        receivedAt,
        ingestKey,
        items,
      });
      if (!result.success) {
        setError(result.error);
        return;
      }
      router.push(`/productivity/orders/${result.orderId}`);
    });
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-6 rounded-xl border border-emerald-900/40 bg-black p-5 font-mono"
    >
      {error && (
        <div className="rounded-lg border border-red-800 bg-red-950/40 px-3 py-2 text-sm text-red-300">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <label className="block text-xs text-emerald-500">
          CLIENT
          <select
            value={clientId}
            onChange={(e) => {
              setClientId(e.target.value ? Number(e.target.value) : "");
              setProjectId("");
            }}
            className="mt-1 w-full rounded border border-emerald-900/60 bg-zinc-950 px-3 py-2 text-sm text-emerald-100"
          >
            <option value="">Select client…</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>

        <label className="block text-xs text-emerald-500">
          PROJECT
          <select
            value={projectId}
            onChange={(e) => setProjectId(e.target.value ? Number(e.target.value) : "")}
            disabled={clientId === ""}
            className="mt-1 w-full rounded border border-emerald-900/60 bg-zinc-950 px-3 py-2 text-sm text-emerald-100 disabled:opacity-40"
          >
            <option value="">Select project…</option>
            {projectsForClient.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>
      </div>

      <label className="block text-xs text-emerald-500">
        ORDER LABEL
        <input
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder='e.g. "Content Waterfall — Batch 1"'
          className="mt-1 w-full rounded border border-emerald-900/60 bg-zinc-950 px-3 py-2 text-sm text-emerald-100 placeholder:text-zinc-600"
        />
      </label>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <label className="block text-xs text-emerald-500">
          CHANNEL
          <input
            value={channel}
            onChange={(e) => setChannel(e.target.value)}
            placeholder="Instagram, YouTube…"
            className="mt-1 w-full rounded border border-emerald-900/60 bg-zinc-950 px-3 py-2 text-sm text-emerald-100 placeholder:text-zinc-600"
          />
        </label>
        <label className="block text-xs text-emerald-500">
          RECEIVED
          <input
            type="date"
            value={receivedAt}
            onChange={(e) => setReceivedAt(e.target.value)}
            className="mt-1 w-full rounded border border-emerald-900/60 bg-zinc-950 px-3 py-2 text-sm text-emerald-100"
          />
        </label>
        <label className="block text-xs text-emerald-500">
          PRICING MODEL
          <select
            value={pricingModel}
            onChange={(e) => setPricingModel(e.target.value as typeof pricingModel)}
            className="mt-1 w-full rounded border border-emerald-900/60 bg-zinc-950 px-3 py-2 text-sm text-emerald-100"
          >
            <option value="">Unset</option>
            <option value="HOURLY">Hourly</option>
            <option value="FIXED">Fixed price</option>
            <option value="OTHER">Other</option>
          </select>
        </label>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <label className="block text-xs text-emerald-500">
          EXPECTED VALUE (optional — an expectation, never billed value)
          <input
            value={expectedValue}
            onChange={(e) => setExpectedValue(e.target.value)}
            placeholder="0.00"
            inputMode="decimal"
            className="mt-1 w-full rounded border border-emerald-900/60 bg-zinc-950 px-3 py-2 text-sm text-emerald-100 placeholder:text-zinc-600"
          />
        </label>
        <label className="block text-xs text-emerald-500">
          CURRENCY
          <select
            value={currency}
            onChange={(e) => setCurrency(e.target.value as "USD" | "BRL")}
            className="mt-1 w-full rounded border border-emerald-900/60 bg-zinc-950 px-3 py-2 text-sm text-emerald-100"
          >
            <option value="USD">USD</option>
            <option value="BRL">BRL</option>
          </select>
        </label>
      </div>

      <label className="block text-xs text-emerald-500">
        NOTES
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={2}
          className="mt-1 w-full rounded border border-emerald-900/60 bg-zinc-950 px-3 py-2 text-sm text-emerald-100"
        />
      </label>

      <div>
        <p className="mb-1 text-xs text-emerald-500">
          VIDEOS IN THIS ORDER ({rows.filter((r) => r.title.trim()).length})
        </p>
        <p className="mb-2 text-[11px] text-zinc-600">
          Tip: paste a multi-line list into any title field to fill several rows at once.
        </p>
        <div className="space-y-2">
          {rows.map((row, i) => (
            <div key={row.key} className="flex items-center gap-2">
              <span className="w-6 shrink-0 text-right text-xs text-zinc-600">{i + 1}</span>
              <input
                value={row.title}
                onChange={(e) => updateRow(row.key, e.target.value)}
                onPaste={(e) => handleTitlePaste(i, e)}
                placeholder={`Video ${i + 1} title`}
                className="w-full rounded border border-emerald-900/60 bg-zinc-950 px-3 py-2 text-sm text-emerald-100 placeholder:text-zinc-600"
              />
              <button
                type="button"
                onClick={() => removeRow(row.key)}
                disabled={rows.length <= 1}
                className="shrink-0 rounded border border-red-900/60 px-2 py-2 text-xs text-red-400 disabled:opacity-30"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
        <button
          type="button"
          onClick={addRow}
          className="mt-2 rounded border border-emerald-900/60 px-3 py-1.5 text-xs text-emerald-400 hover:border-emerald-600"
        >
          + Add video
        </button>
      </div>

      <button
        type="submit"
        disabled={isPending}
        className="w-full rounded-lg bg-emerald-600 px-4 py-3 text-sm font-black uppercase tracking-widest text-black hover:bg-emerald-500 disabled:opacity-50"
      >
        {isPending ? "Firing order…" : "Fire order 🔥"}
      </button>
    </form>
  );
}
