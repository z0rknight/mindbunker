import Link from "next/link";
import { OPERATOR_WORKSPACE_CLASS } from "@/components/layout/workspace";
import { createEmailContactForm, getEmailContacts, updateEmailContactForm } from "@/modules/email-list/actions";
import {
  EMAIL_CONTACT_CLIENT_TYPES,
  EMAIL_CONTACT_CLIENT_TYPE_LABELS,
  EMAIL_CONTACT_ORIGINS,
  EMAIL_CONTACT_ORIGIN_LABELS,
  EMAIL_CONTACT_STATUSES,
  EMAIL_CONTACT_STATUS_LABELS,
} from "@/modules/email-list/config";

export const dynamic = "force-dynamic";

type Search = { q?: string; clientType?: string; status?: string; notice?: string; error?: string };

export default async function EmailListPage({ searchParams }: { searchParams: Promise<Search> }) {
  const query = await searchParams;
  const contacts = await getEmailContacts(query);
  const readyCount = contacts.filter((contact) => contact.status === "ACTIVE").length;
  const classifiedCount = contacts.filter((contact) => contact.clientType !== "UNCLASSIFIED").length;
  const field = "rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-white";

  return <div className={OPERATOR_WORKSPACE_CLASS}>
    <header className="mb-6 flex flex-wrap items-start justify-between gap-4">
      <div>
        <p className="text-[10px] font-black uppercase tracking-[0.22em] text-red-400">Commercial custody</p>
        <h1 className="mt-1 text-2xl font-black text-white">Email List</h1>
        <p className="mt-1 max-w-2xl text-sm leading-6 text-zinc-500">Past buyers and opted-in contacts. This list does not create CRM leads, clients, campaigns, or sends automatically.</p>
      </div>
      <Link href="/crm" className="rounded-lg border border-zinc-700 px-4 py-2 text-sm font-bold text-zinc-300">← CRM</Link>
    </header>

    {query.notice && <p role="status" className="mb-5 rounded-xl border border-emerald-900/70 bg-emerald-950/20 px-4 py-3 text-sm text-emerald-300">{query.notice}</p>}
    {query.error && <p role="alert" className="mb-5 rounded-xl border border-red-900/70 bg-red-950/20 px-4 py-3 text-sm text-red-300">{query.error}</p>}

    <div className="mb-5 grid grid-cols-3 gap-3">
      <Stat label="Shown" value={contacts.length} />
      <Stat label="Ready to contact" value={readyCount} />
      <Stat label="Classified" value={classifiedCount} />
    </div>

    <form className="mb-6 grid gap-3 rounded-xl border border-zinc-800 bg-zinc-900/50 p-4 sm:grid-cols-[1fr_190px_190px_auto]">
      <input name="q" aria-label="Search contacts" defaultValue={query.q} placeholder="Name or email" className={field} />
      <select name="clientType" aria-label="Client type" defaultValue={query.clientType ?? "ALL"} className={field}>
        <option value="ALL">All client types</option>
        {EMAIL_CONTACT_CLIENT_TYPES.map((type) => <option key={type} value={type}>{EMAIL_CONTACT_CLIENT_TYPE_LABELS[type]}</option>)}
      </select>
      <select name="status" aria-label="Contact status" defaultValue={query.status ?? "ACTIVE"} className={field}>
        <option value="ALL">All statuses</option>
        {EMAIL_CONTACT_STATUSES.map((status) => <option key={status} value={status}>{EMAIL_CONTACT_STATUS_LABELS[status]}</option>)}
      </select>
      <button className="rounded-lg bg-zinc-800 px-4 py-2 text-xs font-black uppercase text-white">Filter</button>
    </form>

    <details className="mb-6 rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
      <summary className="cursor-pointer text-sm font-black text-white">+ Add contact</summary>
      <form action={createEmailContactForm} className="mt-4 grid gap-3 lg:grid-cols-6">
        <input name="name" required placeholder="Name" className={field} />
        <input name="email" required type="email" placeholder="Email" className={field} />
        <SelectClientType className={field} />
        <SelectOrigin className={field} />
        <input name="notes" placeholder="Notes" className={field} />
        <input type="hidden" name="status" value="ACTIVE" />
        <button className="rounded-lg bg-red-700 px-4 py-2 text-xs font-black uppercase text-white">Save</button>
      </form>
    </details>

    {contacts.length === 0 ? <div className="rounded-xl border border-dashed border-zinc-800 py-16 text-center text-sm text-zinc-600">No contacts match this view.</div> : <div className="space-y-3">
      {contacts.map((contact) => <form key={contact.id} action={updateEmailContactForm} className="grid gap-3 rounded-xl border border-zinc-800 bg-zinc-900/50 p-4 lg:grid-cols-[1fr_1.2fr_190px_180px_180px_auto] lg:items-center">
        <input type="hidden" name="id" value={contact.id} />
        <input name="name" required defaultValue={contact.name} aria-label={`Name for ${contact.email}`} className={field} />
        <div className="min-w-0"><input name="email" required type="email" defaultValue={contact.email} aria-label={`Email for ${contact.name}`} className={`${field} w-full`} /><a href={`mailto:${contact.email}`} className="mt-1 block truncate text-[10px] font-bold uppercase tracking-wide text-red-400">Compose manually ↗</a></div>
        <SelectClientType className={field} value={contact.clientType} />
        <select name="status" aria-label={`Status for ${contact.name}`} defaultValue={contact.status} className={field}>{EMAIL_CONTACT_STATUSES.map((status) => <option key={status} value={status}>{EMAIL_CONTACT_STATUS_LABELS[status]}</option>)}</select>
        <SelectOrigin className={field} value={contact.relationshipOrigin} />
        <div className="flex gap-2"><input name="notes" defaultValue={contact.notes ?? ""} aria-label={`Notes for ${contact.name}`} placeholder="Notes" className={`${field} min-w-0 flex-1`} /><button className="rounded-lg border border-zinc-700 px-3 py-2 text-xs font-black text-white">Save</button></div>
      </form>)}
    </div>}
  </div>;
}

function Stat({ label, value }: { label: string; value: number }) {
  return <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-3"><p className="text-[10px] font-bold uppercase tracking-wide text-zinc-600">{label}</p><p className="mt-1 text-xl font-black text-white">{value}</p></div>;
}

function SelectClientType({ className, value = "UNCLASSIFIED" }: { className: string; value?: string }) {
  return <select name="clientType" aria-label="Client type" defaultValue={value} className={className}>{EMAIL_CONTACT_CLIENT_TYPES.map((type) => <option key={type} value={type}>{EMAIL_CONTACT_CLIENT_TYPE_LABELS[type]}</option>)}</select>;
}

function SelectOrigin({ className, value = "MANUAL" }: { className: string; value?: string }) {
  return <select name="relationshipOrigin" aria-label="Relationship origin" defaultValue={value} className={className}>{EMAIL_CONTACT_ORIGINS.map((origin) => <option key={origin} value={origin}>{EMAIL_CONTACT_ORIGIN_LABELS[origin]}</option>)}</select>;
}
