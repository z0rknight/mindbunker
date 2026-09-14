import Link from "next/link";
import { RenameClientButton } from "./RenameClientButton";

export function ClientIdentityRail({
  client,
}: {
  client: {
    id: number;
    name: string;
    status: string;
    source: string | null;
    email: string | null;
    phone: string | null;
    instagramUsername: string | null;
    instagramProfilePictureUrl: string | null;
    createdAt: Date | null;
  };
}) {
  return (
    <aside className="rounded-2xl border border-zinc-800 bg-zinc-950/35 p-4" data-testid="client-identity-rail">
      <Link
        href="/crm"
        className="mb-3 inline-flex items-center gap-1 text-xs text-zinc-500 transition-colors hover:text-zinc-300"
      >
        ← CRM
      </Link>

      <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-zinc-700 bg-zinc-800 text-sm font-black text-zinc-400">
        {client.instagramProfilePictureUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={client.instagramProfilePictureUrl} alt="" className="h-full w-full object-cover" />
        ) : (
          client.name.slice(0, 2).toUpperCase()
        )}
      </div>

      <div className="mt-3 flex items-center gap-2">
        <h1 className="truncate text-lg font-bold text-white">{client.name}</h1>
        <RenameClientButton clientId={client.id} currentName={client.name} />
      </div>
      {client.instagramUsername && (
        <p className="mt-0.5 text-xs font-bold text-fuchsia-400">@{client.instagramUsername}</p>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <span
          className={`text-[10px] font-semibold uppercase tracking-wider px-2 py-1 rounded ${
            client.status === "active"
              ? "bg-emerald-500/20 text-emerald-400"
              : client.status === "lead"
              ? "bg-blue-500/20 text-blue-400"
              : "bg-zinc-500/20 text-zinc-400"
          }`}
        >
          {client.status}
        </span>
        {client.source && <span className="text-[11px] text-zinc-500">via {client.source}</span>}
      </div>

      <dl className="mt-4 space-y-3 border-t border-zinc-800 pt-3">
        <div>
          <dt className="text-[10px] font-black uppercase tracking-wide text-zinc-600">Email</dt>
          <dd className="mt-0.5 truncate text-xs font-semibold text-zinc-300">{client.email || "—"}</dd>
        </div>
        <div>
          <dt className="text-[10px] font-black uppercase tracking-wide text-zinc-600">Phone</dt>
          <dd className="mt-0.5 truncate text-xs font-semibold text-zinc-300">{client.phone || "—"}</dd>
        </div>
        <div>
          <dt className="text-[10px] font-black uppercase tracking-wide text-zinc-600">Client since</dt>
          <dd className="mt-0.5 text-xs font-semibold text-zinc-300">
            {client.createdAt
              ? new Intl.DateTimeFormat("en", { dateStyle: "medium", timeZone: "America/Sao_Paulo" }).format(client.createdAt)
              : "—"}
          </dd>
        </div>
      </dl>
    </aside>
  );
}
