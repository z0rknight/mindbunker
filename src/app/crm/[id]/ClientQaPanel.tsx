"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  createExportReminder,
  createProtectedTerm,
  deleteExportReminder,
  deleteProtectedTerm,
  updateExportReminder,
  updateProtectedTerm,
  type ClientQaActionState,
} from "@/modules/client-qa/actions";
import {
  MAX_EXPORT_REMINDERS_PER_CLIENT,
  PROTECTED_TERM_KINDS,
  PROTECTED_TERM_KIND_LABELS,
  type ProtectedTermKind,
} from "@/modules/client-qa/config";

// Lightweight operator management for a client's protected terms and export
// reminders. Two plain lists with inline add/edit/delete: no modal, no bulk
// editor, no settings page. These feed the read-only "Before you export"
// card in the Video Workspace; nothing here can affect a video's status.

type Term = { id: number; term: string; kind: ProtectedTermKind | null; note: string | null };
type Reminder = { id: number; text: string };

const inputClass =
  "w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-xs text-white outline-none focus:border-cyan-500";
const labelClass = "mb-1 block text-[10px] font-black uppercase tracking-wide text-zinc-500";
const smallBtn =
  "rounded border border-zinc-700 px-2 py-1 text-[11px] font-bold text-zinc-300 hover:text-cyan-300 disabled:opacity-60";

function Err({ message }: { message?: string }) {
  return message ? <p role="alert" className="mt-1 text-[11px] text-red-300">{message}</p> : null;
}

function useSubmit(onDone: () => void) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState("");
  function run(action: () => Promise<ClientQaActionState>) {
    startTransition(async () => {
      const result = await action();
      if (!result.success) {
        setErrors(result.errors ?? {});
        setMessage(result.message ?? "");
        return;
      }
      router.refresh();
      onDone();
    });
  }
  return { pending, errors, message, run };
}

function TermForm({ clientId, term, onDone }: { clientId: number; term: Term | null; onDone: () => void }) {
  const { pending, errors, message, run } = useSubmit(onDone);
  return (
    <form
      action={(formData) => {
        const values = Object.fromEntries(formData.entries());
        run(() => (term ? updateProtectedTerm(clientId, term.id, values) : createProtectedTerm(clientId, values)));
      }}
      className="space-y-2 rounded-lg border border-cyan-900/40 bg-zinc-950 p-3"
    >
      <div className="grid gap-2 sm:grid-cols-[2fr_1fr]">
        <div>
          <label className={labelClass} htmlFor={`pt-term-${term?.id ?? "new"}`}>Exact term *</label>
          <input id={`pt-term-${term?.id ?? "new"}`} name="term" defaultValue={term?.term ?? ""} maxLength={120} className={inputClass} />
          <Err message={errors.term} />
        </div>
        <div>
          <label className={labelClass} htmlFor={`pt-kind-${term?.id ?? "new"}`}>Kind</label>
          <select id={`pt-kind-${term?.id ?? "new"}`} name="kind" defaultValue={term?.kind ?? ""} className={inputClass}>
            <option value="">Not recorded</option>
            {PROTECTED_TERM_KINDS.map((kind) => (
              <option key={kind} value={kind}>{PROTECTED_TERM_KIND_LABELS[kind]}</option>
            ))}
          </select>
          <Err message={errors.kind} />
        </div>
      </div>
      <div>
        <label className={labelClass} htmlFor={`pt-note-${term?.id ?? "new"}`}>Note (optional)</label>
        <input id={`pt-note-${term?.id ?? "new"}`} name="note" defaultValue={term?.note ?? ""} maxLength={300} className={inputClass} />
      </div>
      {message && <p role="alert" className="text-xs text-red-300">{message}</p>}
      <div className="flex gap-2">
        <button type="submit" disabled={pending} className="rounded-lg bg-cyan-600 px-3 py-1.5 text-xs font-black text-black hover:bg-cyan-500 disabled:opacity-60">
          {pending ? "Saving…" : term ? "Save" : "Add term"}
        </button>
        <button type="button" onClick={onDone} className={smallBtn}>Cancel</button>
      </div>
    </form>
  );
}

function ReminderForm({ clientId, reminder, onDone }: { clientId: number; reminder: Reminder | null; onDone: () => void }) {
  const { pending, errors, message, run } = useSubmit(onDone);
  return (
    <form
      action={(formData) => {
        const values = Object.fromEntries(formData.entries());
        run(() => (reminder ? updateExportReminder(clientId, reminder.id, values) : createExportReminder(clientId, values)));
      }}
      className="space-y-2 rounded-lg border border-cyan-900/40 bg-zinc-950 p-3"
    >
      <div>
        <label className={labelClass} htmlFor={`er-text-${reminder?.id ?? "new"}`}>Reminder *</label>
        <input id={`er-text-${reminder?.id ?? "new"}`} name="text" defaultValue={reminder?.text ?? ""} maxLength={200} className={inputClass} />
        <Err message={errors.text} />
      </div>
      {message && <p role="alert" className="text-xs text-red-300">{message}</p>}
      <div className="flex gap-2">
        <button type="submit" disabled={pending} className="rounded-lg bg-cyan-600 px-3 py-1.5 text-xs font-black text-black hover:bg-cyan-500 disabled:opacity-60">
          {pending ? "Saving…" : reminder ? "Save" : "Add reminder"}
        </button>
        <button type="button" onClick={onDone} className={smallBtn}>Cancel</button>
      </div>
    </form>
  );
}

function DeleteButton({ label, run }: { label: string; run: () => Promise<ClientQaActionState> }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => {
        if (!window.confirm(`Delete "${label}"?`)) return;
        startTransition(async () => {
          await run();
          router.refresh();
        });
      }}
      className="rounded border border-zinc-800 px-2 py-1 text-[11px] font-bold text-zinc-500 hover:border-red-900 hover:text-red-300 disabled:opacity-60"
    >
      Delete
    </button>
  );
}

export function ClientQaPanel({
  clientId,
  terms,
  reminders,
}: {
  clientId: number;
  terms: Term[];
  reminders: Reminder[];
}) {
  const [editingTerm, setEditingTerm] = useState<number | "new" | null>(null);
  const [editingReminder, setEditingReminder] = useState<number | "new" | null>(null);

  return (
    <section id="pre-export-reminders" className="mb-6 rounded-2xl border border-zinc-800 bg-zinc-950/35 p-4" data-testid="client-qa-panel">
      <h2 className="text-xs font-black uppercase tracking-[0.16em] text-zinc-400">Before-you-export reminders</h2>
      <p className="mb-4 mt-1 text-[11px] text-zinc-600">
        Shown read-only in this client&apos;s Video Workspace. Operator-only; never blocks a status.
      </p>

      <div className="mb-5">
        <div className="mb-2 flex items-center justify-between gap-3">
          <h3 className="text-[10px] font-black uppercase tracking-wide text-zinc-500">Protected terms</h3>
          {editingTerm === null && (
            <button type="button" onClick={() => setEditingTerm("new")} className={smallBtn}>+ Add term</button>
          )}
        </div>
        {editingTerm === "new" && (
          <div className="mb-2"><TermForm clientId={clientId} term={null} onDone={() => setEditingTerm(null)} /></div>
        )}
        {terms.length === 0 && editingTerm !== "new" && (
          <p className="rounded-lg border border-zinc-800 p-3 text-xs text-zinc-600">No protected terms recorded.</p>
        )}
        <ul className="space-y-1.5">
          {terms.map((term) =>
            editingTerm === term.id ? (
              <li key={term.id}><TermForm clientId={clientId} term={term} onDone={() => setEditingTerm(null)} /></li>
            ) : (
              <li key={term.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-zinc-800 bg-zinc-900/40 px-3 py-2">
                <div className="min-w-0">
                  <span className="text-sm font-bold text-zinc-100">{term.term}</span>
                  <span className="ml-2 text-[11px] text-zinc-500">
                    {[term.kind ? PROTECTED_TERM_KIND_LABELS[term.kind] : null, term.note].filter(Boolean).join(" · ")}
                  </span>
                </div>
                <div className="flex gap-2">
                  <button type="button" onClick={() => setEditingTerm(term.id)} className={smallBtn}>Edit</button>
                  <DeleteButton label={term.term} run={() => deleteProtectedTerm(clientId, term.id)} />
                </div>
              </li>
            ),
          )}
        </ul>
      </div>

      <div>
        <div className="mb-2 flex items-center justify-between gap-3">
          <h3 className="text-[10px] font-black uppercase tracking-wide text-zinc-500">
            Export reminders ({reminders.length}/{MAX_EXPORT_REMINDERS_PER_CLIENT})
          </h3>
          {editingReminder === null && reminders.length < MAX_EXPORT_REMINDERS_PER_CLIENT && (
            <button type="button" onClick={() => setEditingReminder("new")} className={smallBtn}>+ Add reminder</button>
          )}
        </div>
        {editingReminder === "new" && (
          <div className="mb-2"><ReminderForm clientId={clientId} reminder={null} onDone={() => setEditingReminder(null)} /></div>
        )}
        {reminders.length === 0 && editingReminder !== "new" && (
          <p className="rounded-lg border border-zinc-800 p-3 text-xs text-zinc-600">No client-specific reminders recorded.</p>
        )}
        <ul className="space-y-1.5">
          {reminders.map((reminder) =>
            editingReminder === reminder.id ? (
              <li key={reminder.id}><ReminderForm clientId={clientId} reminder={reminder} onDone={() => setEditingReminder(null)} /></li>
            ) : (
              <li key={reminder.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-zinc-800 bg-zinc-900/40 px-3 py-2">
                <span className="min-w-0 text-xs text-zinc-200">{reminder.text}</span>
                <div className="flex gap-2">
                  <button type="button" onClick={() => setEditingReminder(reminder.id)} className={smallBtn}>Edit</button>
                  <DeleteButton label={reminder.text} run={() => deleteExportReminder(clientId, reminder.id)} />
                </div>
              </li>
            ),
          )}
        </ul>
      </div>
    </section>
  );
}
