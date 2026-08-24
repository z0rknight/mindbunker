"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ProjectForm,
  type ProjectFormValues,
} from "@/components/projects/ProjectForm";
import { createProject } from "@/modules/projects/actions";

// Brief C ("Final Local Ingest / Live Readiness") §1B: /projects must allow
// creating a Project directly -- the real QA operator naturally tried
// Projects -> New Project -> Add Multiple Videos and found no creation
// entry point here at all. Reuses the EXISTING canonical project creation
// model/action/schema (ProjectForm + createProject(clientId, values)) --
// deliberately NOT a parallel project model. The only thing this component
// adds on top of the CRM's existing ProjectManager is a client picker,
// since creation here isn't already scoped to one client's page. After a
// successful create, redirects straight into the new Project workspace.
export function NewProjectButton({
  clients,
}: {
  clients: Array<{ id: number; name: string }>;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [clientId, setClientId] = useState<string>(clients[0]?.id.toString() ?? "");
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState("");

  function create(values: ProjectFormValues) {
    setError("");
    const parsedClientId = Number(clientId);
    if (!clientId || !Number.isSafeInteger(parsedClientId) || parsedClientId <= 0) {
      setError("Choose a client.");
      return;
    }
    startTransition(async () => {
      const result = await createProject(parsedClientId, values);
      if (!result.success) {
        setError(result.error);
        return;
      }
      setOpen(false);
      if (result.projectId) {
        router.push(`/projects/${result.projectId}`);
        return;
      }
      router.refresh();
    });
  }

  if (clients.length === 0) {
    return (
      <Link
        href="/crm"
        className="rounded-xl border border-cyan-700/50 bg-cyan-950/30 px-4 py-2.5 text-sm font-black text-cyan-300 transition hover:bg-cyan-900/40"
      >
        + New Project
      </Link>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-xl border border-cyan-700/50 bg-cyan-950/30 px-4 py-2.5 text-sm font-black text-cyan-300 transition hover:bg-cyan-900/40"
      >
        + New Project
      </button>

      {open && (
        <div
          className="fixed inset-0 z-[60] flex items-end justify-center bg-black/70 backdrop-blur-sm sm:items-center"
          onClick={(e) => e.target === e.currentTarget && !isPending && setOpen(false)}
        >
          <div className="safe-sheet max-h-[92dvh] w-full overflow-y-auto rounded-t-3xl border border-zinc-700 bg-zinc-900 p-5 shadow-2xl sm:mx-4 sm:max-w-lg sm:rounded-2xl sm:p-6">
            <div className="mb-1 flex items-center justify-between">
              <h2 className="text-base font-bold text-white">New project</h2>
              <button
                type="button"
                onClick={() => !isPending && setOpen(false)}
                className="flex min-h-11 min-w-11 items-center justify-center rounded-full text-zinc-500 hover:bg-zinc-800 hover:text-white text-xl leading-none"
                aria-label="Close"
              >
                ×
              </button>
            </div>
            <div className="mb-4">
              <label htmlFor="newProjectClient" className="mb-1 block text-xs font-bold text-zinc-500">
                Client
              </label>
              <select
                id="newProjectClient"
                value={clientId}
                onChange={(event) => setClientId(event.target.value)}
                className="min-h-12 w-full rounded-xl border border-zinc-700 bg-zinc-950/70 px-3.5 text-base text-white outline-none transition focus:border-cyan-500 focus:ring-4 focus:ring-cyan-500/10"
              >
                {clients.map((client) => (
                  <option key={client.id} value={client.id}>
                    {client.name}
                  </option>
                ))}
              </select>
            </div>
            <ProjectForm
              submitLabel="Create project"
              onSubmit={create}
              onCancel={() => setOpen(false)}
              isPending={isPending}
            />
            {error && <p className="mt-3 text-sm text-red-300">{error}</p>}
          </div>
        </div>
      )}
    </>
  );
}
