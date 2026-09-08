"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { archiveClient, updateClient } from "@/modules/crm/actions";
import { createProject } from "@/modules/projects/actions";
import { ProjectForm, type ProjectFormValues } from "@/components/projects/ProjectForm";
import { QuoteCreateForm } from "@/components/crm/QuoteCreateForm";
import { QuickFollowUpForm } from "@/components/crm/QuickFollowUpForm";

// Tuesday Patch Priority 3, mini workbench (brief §3): "Ao clicar na
// pessoa: Email, Schedule call, Create quote, Add follow-up, Add note,
// Create project, Move to geladeira. O perfil completo continua existindo
// para profundidade." Every action here writes through the SAME
// canonical primitive the full client profile already uses -- this adds
// no new facts, just a faster door to the existing ones, so a CRM list
// row never needs a page navigation for a simple action.
export type WorkbenchClientData = {
  id: number;
  name: string;
  email: string | null;
  notes: string | null;
  opportunityStage: string;
  serviceInterest: string | null;
  qualificationNotes: string | null;
  nextAction: string | null;
  nextActionDate: string | null;
};

type Panel = "quote" | "followup" | "call" | "note" | "project" | null;

const chip =
  "min-h-9 rounded-lg border border-zinc-700 bg-zinc-900 px-2.5 text-[11px] font-black text-zinc-300 transition hover:border-cyan-500/60 hover:text-white disabled:opacity-40 disabled:hover:border-zinc-700 disabled:hover:text-zinc-300";

export function ClientWorkbench({ client }: { client: WorkbenchClientData }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [panel, setPanel] = useState<Panel>(null);
  const [isPending, startTransition] = useTransition();
  const [noteText, setNoteText] = useState(client.notes ?? "");

  function closePanel() {
    setPanel(null);
  }

  function refreshAndClose() {
    setPanel(null);
    router.refresh();
  }

  function saveNote() {
    startTransition(async () => {
      await updateClient(client.id, { notes: noteText });
      refreshAndClose();
    });
  }

  function moveToGeladeira() {
    if (!confirm(`Move ${client.name} to Geladeira? This only affects visibility -- nothing is deleted.`)) return;
    startTransition(async () => {
      await archiveClient(client.id);
      router.refresh();
    });
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="min-h-8 shrink-0 rounded-lg border border-zinc-800 px-2.5 text-[11px] font-black text-zinc-500 transition hover:border-zinc-600 hover:text-zinc-300"
      >
        Actions ▾
      </button>
    );
  }

  return (
    <div className="w-full rounded-xl border border-zinc-800 bg-zinc-950/40 p-2.5">
      <div className="flex flex-wrap items-center gap-1.5">
        {client.email ? (
          <a href={`mailto:${client.email}`} className={chip}>
            Email
          </a>
        ) : (
          <span className={`${chip} cursor-default opacity-40`} title="No email on file">
            Email
          </span>
        )}
        <button type="button" className={chip} onClick={() => setPanel(panel === "call" ? null : "call")}>
          Schedule call
        </button>
        <button type="button" className={chip} onClick={() => setPanel(panel === "quote" ? null : "quote")}>
          Create quote
        </button>
        <button type="button" className={chip} onClick={() => setPanel(panel === "followup" ? null : "followup")}>
          Add follow-up
        </button>
        <button type="button" className={chip} onClick={() => setPanel(panel === "note" ? null : "note")}>
          Add note
        </button>
        <button type="button" className={chip} onClick={() => setPanel(panel === "project" ? null : "project")}>
          Create project
        </button>
        <button type="button" disabled={isPending} className={chip} onClick={moveToGeladeira}>
          Move to Geladeira
        </button>
        <button type="button" className={`${chip} ml-auto`} onClick={() => setOpen(false)}>
          Close
        </button>
      </div>

      {panel === "call" && (
        <div className="mt-2">
          <QuickFollowUpForm
            clientId={client.id}
            currentStage={client.opportunityStage}
            currentServiceInterest={client.serviceInterest}
            currentQualificationNotes={client.qualificationNotes}
            initialNextAction={client.nextAction ?? `Call ${client.name}`}
            initialNextActionDate={client.nextActionDate ?? ""}
            onDone={refreshAndClose}
            onCancel={closePanel}
          />
        </div>
      )}

      {panel === "followup" && (
        <div className="mt-2">
          <QuickFollowUpForm
            clientId={client.id}
            currentStage={client.opportunityStage}
            currentServiceInterest={client.serviceInterest}
            currentQualificationNotes={client.qualificationNotes}
            initialNextAction={client.nextAction ?? ""}
            initialNextActionDate={client.nextActionDate ?? ""}
            onDone={refreshAndClose}
            onCancel={closePanel}
          />
        </div>
      )}

      {panel === "quote" && (
        <div className="mt-2">
          <QuoteCreateForm clientId={client.id} onDone={refreshAndClose} onCancel={closePanel} />
        </div>
      )}

      {panel === "note" && (
        <div className="mt-2 space-y-2 rounded-xl border border-zinc-800 bg-zinc-900/60 p-3">
          <textarea
            value={noteText}
            onChange={(event) => setNoteText(event.target.value)}
            rows={3}
            maxLength={5000}
            placeholder="Note about this contact…"
            className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-xs text-white placeholder:text-zinc-600 focus:border-violet-500 focus:outline-none"
          />
          <div className="flex gap-2">
            <button type="button" disabled={isPending} onClick={saveNote} className="flex-1 rounded-lg bg-violet-600 px-3 py-2 text-xs font-bold text-white hover:bg-violet-500 disabled:opacity-50">
              {isPending ? "Saving…" : "Save note"}
            </button>
            <button type="button" disabled={isPending} onClick={closePanel} className="rounded-lg border border-zinc-700 px-3 py-2 text-xs font-bold text-zinc-300 hover:bg-zinc-800 disabled:opacity-50">
              Cancel
            </button>
          </div>
        </div>
      )}

      {panel === "project" && (
        <div className="mt-2 rounded-xl border border-zinc-800 bg-zinc-900/60 p-3">
          <QuickCreateProjectForm clientId={client.id} onDone={refreshAndClose} onCancel={closePanel} />
        </div>
      )}
    </div>
  );
}

function QuickCreateProjectForm({
  clientId,
  onDone,
  onCancel,
}: {
  clientId: number;
  onDone: () => void;
  onCancel: () => void;
}) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState("");

  function submit(values: ProjectFormValues) {
    setError("");
    startTransition(async () => {
      const result = await createProject(clientId, values);
      if (!result.success) {
        setError(result.error);
        return;
      }
      onDone();
    });
  }

  return (
    <>
      <ProjectForm submitLabel="Create project" onSubmit={submit} onCancel={onCancel} isPending={isPending} />
      {error && <p className="mt-2 text-xs text-red-300">{error}</p>}
    </>
  );
}
