"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { formatCurrency, formatDate } from "@/utils/date";
import { assignTransactionAttribution, type UnattributedTransaction } from "@/modules/finance/actions";
import { classifyCashMovement, type AmbiguousCashMovement } from "@/modules/cash-accounts/actions";
import { recordReconciliationNote } from "@/modules/finance/actions";
import { formatMinutesAsHours } from "@/modules/finance/core";

// Tuesday Patch Completion Round §A: "Each inline action must mutate the
// real canonical record / evidence / attribution state that Finance
// already uses." Every mutation here is the same one a full navigation
// to Accounting details / the contract page / Wise reconciliation would
// eventually call -- these are just that same write, done without
// leaving Finance Overview. Test per item: resolve inline -> canonical
// data changes -> item disappears after refresh (router.refresh()).

const cardClass = "rounded-xl border border-amber-900/40 bg-amber-950/10 p-3";
const chipButton =
  "min-h-9 rounded-lg border border-zinc-700 bg-zinc-900 px-2.5 text-[11px] font-black text-zinc-200 hover:border-amber-500/60 disabled:opacity-40";

export function AttributionResolveList({
  transactions,
  clients,
}: {
  transactions: UnattributedTransaction[];
  clients: Array<{ id: number; name: string }>;
}) {
  if (transactions.length === 0) return null;
  return (
    <div className="space-y-2">
      {transactions.map((tx) => (
        <AttributionResolveRow key={tx.id} transaction={tx} clients={clients} />
      ))}
    </div>
  );
}

function AttributionResolveRow({
  transaction,
  clients,
}: {
  transaction: UnattributedTransaction;
  clients: Array<{ id: number; name: string }>;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [pickerOpen, setPickerOpen] = useState(false);
  const [error, setError] = useState("");
  // First few clients as quick-pick chips (whoever is most likely) plus a
  // full dropdown for anyone else -- matches the brief's own mockup
  // ([Taryn] [Dave] [Other]) without hardcoding which two clients those are.
  const quickPicks = clients.slice(0, 2);

  function assign(clientId: number) {
    setError("");
    startTransition(async () => {
      const result = await assignTransactionAttribution(transaction.id, clientId);
      if (!result.success) {
        setError(result.error);
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className={cardClass}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-sm font-bold text-white">
            {formatCurrency(transaction.amount, transaction.currency)} · {transaction.category}
          </p>
          <p className="text-xs text-zinc-500">{formatDate(transaction.date)} · Who was this for?</p>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          {quickPicks.map((client) => (
            <button key={client.id} type="button" disabled={isPending} onClick={() => assign(client.id)} className={chipButton}>
              {client.name}
            </button>
          ))}
          {!pickerOpen ? (
            <button type="button" disabled={isPending} onClick={() => setPickerOpen(true)} className={chipButton}>
              Other…
            </button>
          ) : (
            <select
              disabled={isPending}
              defaultValue=""
              onChange={(event) => {
                const id = Number(event.target.value);
                if (id) assign(id);
              }}
              className="min-h-9 rounded-lg border border-zinc-700 bg-zinc-900 px-2 text-[11px] font-bold text-zinc-200"
            >
              <option value="" disabled>
                Choose client…
              </option>
              {clients.map((client) => (
                <option key={client.id} value={client.id}>
                  {client.name}
                </option>
              ))}
            </select>
          )}
        </div>
      </div>
      {error && <p className="mt-1.5 text-xs text-red-300">{error}</p>}
    </div>
  );
}

export function AmbiguousTransferResolveList({ movements }: { movements: AmbiguousCashMovement[] }) {
  if (movements.length === 0) return null;
  return (
    <div className="space-y-2">
      {movements.map((movement) => (
        <AmbiguousTransferResolveRow key={movement.id} movement={movement} />
      ))}
    </div>
  );
}

function AmbiguousTransferResolveRow({ movement }: { movement: AmbiguousCashMovement }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState("");

  function classify(newState: "INTERNAL_TRANSFER" | "EXTERNAL_TRANSFER" | "IGNORE") {
    setError("");
    startTransition(async () => {
      const result = await classifyCashMovement(movement.id, newState);
      if (!result.success) {
        setError(result.error);
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className={cardClass}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-sm font-bold text-white">
            {formatCurrency(movement.amount, movement.currency)} · {movement.accountLabel}
          </p>
          <p className="text-xs text-zinc-500">
            {formatDate(movement.date)} · {movement.description}
            {movement.counterparty ? ` · ${movement.counterparty}` : ""}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <button type="button" disabled={isPending} onClick={() => classify("INTERNAL_TRANSFER")} className={chipButton}>
            Confirm transfer
          </button>
          <button type="button" disabled={isPending} onClick={() => classify("EXTERNAL_TRANSFER")} className={chipButton}>
            Not mine
          </button>
          <button type="button" disabled={isPending} onClick={() => classify("IGNORE")} className={chipButton}>
            Ignore
          </button>
        </div>
      </div>
      {error && <p className="mt-1.5 text-xs text-red-300">{error}</p>}
    </div>
  );
}

export type ReconciliationAttentionRow = {
  contractId: number;
  clientName: string;
  platform: string;
  periodStart: string;
  periodEnd: string;
  differenceMinutesValue: number | null;
};

export function ReconciliationAcknowledgeList({ rows }: { rows: ReconciliationAttentionRow[] }) {
  if (rows.length === 0) return null;
  return (
    <div className="space-y-2">
      {rows.map((row) => (
        <ReconciliationAcknowledgeRow key={`${row.contractId}-${row.periodStart}-${row.periodEnd}`} row={row} />
      ))}
    </div>
  );
}

function ReconciliationAcknowledgeRow({ row }: { row: ReconciliationAttentionRow }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState("");

  function acknowledge() {
    setError("");
    startTransition(async () => {
      const result = await recordReconciliationNote({
        contractId: row.contractId,
        date: row.periodEnd,
        note: "Acknowledged from Finance Overview -- reviewed, no correction needed.",
      });
      if (!result.success) {
        setError(result.error);
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className={cardClass}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-sm font-bold text-white">
            {row.clientName} billing{" "}
            {row.differenceMinutesValue !== null
              ? `differs by ${formatMinutesAsHours(Math.abs(row.differenceMinutesValue))}`
              : "needs review"}
          </p>
          <p className="text-xs text-zinc-500">
            {row.platform} · {formatDate(row.periodStart)} – {formatDate(row.periodEnd)}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <a href={`/finance/contracts/${row.contractId}`} className={chipButton}>
            Review details
          </a>
          <button type="button" disabled={isPending} onClick={acknowledge} className={chipButton}>
            Acknowledge
          </button>
        </div>
      </div>
      {error && <p className="mt-1.5 text-xs text-red-300">{error}</p>}
    </div>
  );
}
