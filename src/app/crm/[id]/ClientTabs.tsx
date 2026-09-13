"use client";

import { useState } from "react";
import { formatCurrency, formatDate } from "@/utils/date";
import { updateClient, logCrmActivity } from "@/modules/crm/actions";
import { CRM_ACTIVITY_TYPES, isValidClientEmail } from "@/modules/crm/core";
import { ProjectManager, type ClientProjectView } from "./ProjectManager";
import { InstagramProfileCard } from "./InstagramProfileCard";
import { CoverUploadField } from "@/components/media/CoverUploadField";
import { resolveCoverUrl } from "@/modules/media/core";
import { PortalControl } from "@/components/client-portal/PortalControl";
import { setClientPortalCapability } from "@/modules/client-portal/admin-actions";

interface ClientTabsProps {
  client: {
    id: number;
    name: string;
    status: string;
    email: string | null;
    phone: string | null;
    instagramUsername: string | null;
    instagramBio: string | null;
    instagramProfilePictureUrl: string | null;
    defaultCoverUrl: string | null;
    portalCanSeeFinancials: boolean;
    portalCanReview: boolean;
    portalCanSetPriority: boolean;
    notes: string | null;
    source: string | null;
    contacted: boolean;
    converted: boolean;
    createdAt: Date | null;
  };
  // Sprint 3 P0: live-computed, replacing the stale
  // clients.totalProjects / clients.totalRevenue cached columns. Grouped
  // by currency -- never summed across currencies.
  totalProjectsCount: number;
  totalRevenueByCurrency: Array<{ currency: string; amount: number }>;
  briefing: {
    id: number;
    serviceInterest: string;
    projectSummary: string;
    objective: string;
    contentVolume: string | null;
    references: string | null;
    timeline: string | null;
    existingAssets: string | null;
    notes: string | null;
    submittedAt: Date | null;
  } | null;
  events: Array<{
    id: number;
    type: string;
    actor: "admin" | "gateway" | "system" | "client";
    description: string;
    createdAt: Date | null;
  }>;
  projects: ClientProjectView[];
  instagramImportConfigured: boolean;
  initialTab?: Tab;
  initialProjectCreation?: boolean;
  projectReturnTo?: string;
}

type Tab = "overview" | "projects" | "notes" | "activity";

function formatTimestamp(value: Date | null) {
  if (!value) return "Date unavailable";
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "America/Sao_Paulo",
  }).format(value);
}

function BriefingField({
  label,
  value,
}: {
  label: string;
  value: string | null;
}) {
  if (!value) return null;
  return (
    <div className="rounded-lg bg-zinc-800/50 p-4">
      <p className="mb-1 text-xs text-zinc-500">{label}</p>
      <p className="whitespace-pre-wrap text-sm leading-6 text-zinc-200">{value}</p>
    </div>
  );
}

export function ClientTabs({
  client,
  totalProjectsCount,
  totalRevenueByCurrency,
  briefing,
  events,
  projects,
  instagramImportConfigured,
  initialTab,
  initialProjectCreation,
  projectReturnTo,
}: ClientTabsProps) {
  const [activeTab, setActiveTab] = useState<Tab>(initialTab ?? "overview");
  const [isEditing, setIsEditing] = useState(false);
  const [notes, setNotes] = useState(client.notes ?? "");
  const [activityType, setActivityType] = useState<string>("note");
  const [activityDescription, setActivityDescription] = useState("");
  const [activityPending, setActivityPending] = useState(false);
  const [activityError, setActivityError] = useState<string | null>(null);
  const [isEditingContact, setIsEditingContact] = useState(false);
  const [contactEmail, setContactEmail] = useState(client.email ?? "");
  const [contactPhone, setContactPhone] = useState(client.phone ?? "");
  const [contactPending, setContactPending] = useState(false);
  const [contactError, setContactError] = useState<string | null>(null);
  const [isEditingMetadata, setIsEditingMetadata] = useState(false);
  const [metadataStatus, setMetadataStatus] = useState(client.status);
  const [metadataSource, setMetadataSource] = useState(client.source ?? "");
  const [metadataPending, setMetadataPending] = useState(false);
  const [defaultCoverUrl, setDefaultCoverUrl] = useState(client.defaultCoverUrl ?? "");

  const tabs: { id: Tab; label: string; icon: string }[] = [
    { id: "overview", label: "Overview", icon: "📊" },
    { id: "projects", label: "Projects", icon: "🎬" },
    { id: "notes", label: "Notes", icon: "📝" },
    { id: "activity", label: "Activity", icon: "📅" },
  ];

  async function handleSaveNotes() {
    await updateClient(client.id, { notes });
    setIsEditing(false);
  }

  // Sprint 3 P0 (client contact editing): updateClient already accepted
  // email/phone -- only the UI was missing. Deliberately does nothing
  // else: adding contact information and granting portal access
  // (PortalAccessPanel, elsewhere on this page) are separate actions.
  async function handleSaveContact() {
    const email = contactEmail.trim();
    if (email && !isValidClientEmail(email)) {
      setContactError("Enter a valid email address.");
      return;
    }
    setContactPending(true);
    setContactError(null);
    await updateClient(client.id, {
      email: email || undefined,
      phone: contactPhone.trim() || undefined,
    });
    setContactPending(false);
    setIsEditingContact(false);
  }

  // Sprint 3 P2: status/source were the two client fields updateClient
  // already accepted with no UI path to edit them at all -- in
  // particular a client could never be moved to "inactive" (the CRM
  // list's own Inactive section existed but was permanently empty).
  // Separate from Geladeira archival (an orthogonal visibility axis) and
  // from convertLeadToClient (lead -> active only) -- this is the one
  // place all three status values are reachable directly.
  async function handleSaveMetadata() {
    setMetadataPending(true);
    await updateClient(client.id, {
      status: metadataStatus as "lead" | "active" | "inactive",
      source: metadataSource.trim() || undefined,
    });
    setMetadataPending(false);
    setIsEditingMetadata(false);
  }

  async function handleLogActivity() {
    if (!activityDescription.trim()) {
      setActivityError("Enter a note before logging this activity.");
      return;
    }
    setActivityPending(true);
    setActivityError(null);
    const result = await logCrmActivity(client.id, {
      type: activityType,
      description: activityDescription,
    });
    setActivityPending(false);
    if (!result.success) {
      setActivityError(result.error);
      return;
    }
    setActivityDescription("");
  }

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
      {/* Tab Navigation */}
      <div className="flex overflow-x-auto border-b border-zinc-800">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex shrink-0 items-center gap-2 px-4 py-3 text-sm font-medium transition-colors sm:px-6 ${
              activeTab === tab.id
                ? "text-cyan-400 border-b-2 border-cyan-400 bg-zinc-800/50"
                : "text-zinc-400 hover:text-zinc-300 hover:bg-zinc-800/30"
            }`}
          >
            <span>{tab.icon}</span>
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="p-4 sm:p-6">
        {activeTab === "overview" && (
          <div className="space-y-6">
            <InstagramProfileCard
              clientId={client.id}
              initialUsername={client.instagramUsername}
              initialBio={client.instagramBio}
              initialPhotoUrl={client.instagramProfilePictureUrl}
              importConfigured={instagramImportConfigured}
            />

            <section className="rounded-2xl border border-zinc-800 bg-zinc-950/35 p-4">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                <div className="h-20 w-full shrink-0 overflow-hidden rounded-xl border border-zinc-700 bg-zinc-900 sm:w-32">
                  {resolveCoverUrl(defaultCoverUrl, client.instagramProfilePictureUrl) ? (
                    // eslint-disable-next-line @next/next/no-img-element -- authenticated R2/external operator-selected URL.
                    <img
                      src={resolveCoverUrl(defaultCoverUrl, client.instagramProfilePictureUrl) ?? undefined}
                      alt=""
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center bg-gradient-to-br from-violet-950/50 to-zinc-950 text-xs font-black uppercase tracking-widest text-zinc-600">
                      {client.name.slice(0, 2)}
                    </div>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="text-xs font-black uppercase tracking-wider text-violet-300">Default work cover</h3>
                  <p className="mt-1 text-xs leading-5 text-zinc-500">
                    Used when a Project or Video has no deliberately selected cover of its own.
                  </p>
                  <CoverUploadField
                    targetType="client"
                    targetId={client.id}
                    coverUrl={defaultCoverUrl}
                    onCoverUrlChange={setDefaultCoverUrl}
                  />
                </div>
              </div>
            </section>

            <section className="rounded-2xl border border-zinc-800 bg-zinc-950/35 p-4">
              <h3 className="text-xs font-black uppercase tracking-wider text-violet-300">Client portal controls</h3>
              <p className="mt-1 text-xs leading-5 text-zinc-500">Explicit capabilities; internal records remain unchanged when access is hidden.</p>
              <div className="mt-3 grid gap-2 md:grid-cols-3">
                <PortalControl
                  label="Financial summary"
                  description="Recorded billing evidence and rates"
                  enabled={client.portalCanSeeFinancials}
                  onChange={(enabled) => setClientPortalCapability(client.id, "financials", enabled)}
                />
                <PortalControl
                  label="Review actions"
                  description="Approve or request changes"
                  enabled={client.portalCanReview}
                  onChange={(enabled) => setClientPortalCapability(client.id, "review", enabled)}
                />
                <PortalControl
                  label="Priority request"
                  description="Choose the current item within a project"
                  enabled={client.portalCanSetPriority}
                  onChange={(enabled) => setClientPortalCapability(client.id, "priority", enabled)}
                />
              </div>
            </section>

            {briefing && (
              <div>
                <div className="mb-3 flex items-end justify-between gap-3">
                  <div>
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-emerald-300">
                      Latest briefing
                    </h3>
                    <p className="mt-1 text-xs text-zinc-600">
                      {formatTimestamp(briefing.submittedAt)}
                    </p>
                  </div>
                  <span className="rounded-full bg-emerald-500/10 px-2.5 py-1 text-[10px] font-bold uppercase text-emerald-300">
                    Received
                  </span>
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  <BriefingField label="Service" value={briefing.serviceInterest} />
                  <BriefingField label="Amount / frequency" value={briefing.contentVolume} />
                  <BriefingField label="What they are creating" value={briefing.projectSummary} />
                  <BriefingField label="Objective" value={briefing.objective} />
                  <BriefingField label="Timeline" value={briefing.timeline} />
                  <BriefingField label="Existing material" value={briefing.existingAssets} />
                  <BriefingField label="References" value={briefing.references} />
                  <BriefingField label="Additional notes" value={briefing.notes} />
                </div>
              </div>
            )}

            {/* Contact Info */}
            <div>
              <div className="mb-3 flex items-center justify-between">
                <h3 className="text-zinc-400 text-xs font-semibold uppercase tracking-wider">
                  Contact Information
                </h3>
                {!isEditingContact && (
                  <button
                    onClick={() => {
                      setContactEmail(client.email ?? "");
                      setContactPhone(client.phone ?? "");
                      setContactError(null);
                      setIsEditingContact(true);
                    }}
                    className="text-xs font-bold text-cyan-400 hover:text-cyan-300"
                  >
                    Edit
                  </button>
                )}
              </div>
              {isEditingContact ? (
                <div className="space-y-3">
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <div>
                      <label htmlFor="contact-email" className="mb-1 block text-xs text-zinc-500">
                        Email
                      </label>
                      <input
                        id="contact-email"
                        type="email"
                        value={contactEmail}
                        onChange={(e) => setContactEmail(e.target.value)}
                        placeholder="client@example.com"
                        className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                      />
                    </div>
                    <div>
                      <label htmlFor="contact-phone" className="mb-1 block text-xs text-zinc-500">
                        Phone
                      </label>
                      <input
                        id="contact-phone"
                        type="tel"
                        value={contactPhone}
                        onChange={(e) => setContactPhone(e.target.value)}
                        placeholder="+1 555 000 0000"
                        className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                      />
                    </div>
                  </div>
                  {contactError && (
                    <p role="alert" className="text-xs font-medium text-red-300">
                      {contactError}
                    </p>
                  )}
                  <div className="flex gap-2">
                    <button
                      onClick={handleSaveContact}
                      disabled={contactPending}
                      className="rounded-lg bg-cyan-600 px-4 py-2 text-sm font-bold text-white transition hover:bg-cyan-700 disabled:cursor-wait disabled:opacity-70"
                    >
                      {contactPending ? "Saving…" : "Save"}
                    </button>
                    <button
                      onClick={() => setIsEditingContact(false)}
                      className="rounded-lg bg-zinc-700 px-4 py-2 text-sm font-bold text-white transition hover:bg-zinc-600"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div className="bg-zinc-800/50 rounded-lg p-4">
                    <p className="text-zinc-500 text-xs mb-1">Email</p>
                    <p className="text-white">{client.email || "—"}</p>
                  </div>
                  <div className="bg-zinc-800/50 rounded-lg p-4">
                    <p className="text-zinc-500 text-xs mb-1">Phone</p>
                    <p className="text-white">{client.phone || "—"}</p>
                  </div>
                </div>
              )}
            </div>

            {/* Stats */}
            <div>
              <h3 className="text-zinc-400 text-xs font-semibold uppercase tracking-wider mb-3">
                Statistics
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-zinc-800/50 rounded-lg p-4">
                  <p className="text-zinc-500 text-xs mb-1">Total Projects</p>
                  <p className="text-2xl font-bold text-white">{totalProjectsCount}</p>
                </div>
                <div className="bg-zinc-800/50 rounded-lg p-4">
                  <p className="text-zinc-500 text-xs mb-1">Total Revenue</p>
                  {totalRevenueByCurrency.length === 0 ? (
                    <p className="text-2xl font-bold text-emerald-400">{formatCurrency(0)}</p>
                  ) : (
                    <p className="text-2xl font-bold text-emerald-400 space-x-2">
                      {totalRevenueByCurrency.map((row) => (
                        <span key={row.currency}>{formatCurrency(row.amount, row.currency)}</span>
                      ))}
                    </p>
                  )}
                </div>
                <div className="bg-zinc-800/50 rounded-lg p-4">
                  <p className="text-zinc-500 text-xs mb-1">Contacted</p>
                  <p className={`text-2xl font-bold ${client.contacted ? "text-emerald-400" : "text-zinc-500"}`}>
                    {client.contacted ? "✓" : "—"}
                  </p>
                </div>
                <div className="bg-zinc-800/50 rounded-lg p-4">
                  <p className="text-zinc-500 text-xs mb-1">Converted</p>
                  <p className={`text-2xl font-bold ${client.converted ? "text-emerald-400" : "text-zinc-500"}`}>
                    {client.converted ? "✓" : "—"}
                  </p>
                </div>
              </div>
            </div>

            {/* Metadata */}
            <div>
              <div className="mb-3 flex items-center justify-between">
                <h3 className="text-zinc-400 text-xs font-semibold uppercase tracking-wider">
                  Metadata
                </h3>
                {!isEditingMetadata && (
                  <button
                    onClick={() => {
                      setMetadataStatus(client.status);
                      setMetadataSource(client.source ?? "");
                      setIsEditingMetadata(true);
                    }}
                    className="text-xs font-bold text-cyan-400 hover:text-cyan-300"
                  >
                    Edit
                  </button>
                )}
              </div>
              {isEditingMetadata ? (
                <div className="space-y-3">
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <div>
                      <label htmlFor="metadata-status" className="mb-1 block text-xs text-zinc-500">
                        Status
                      </label>
                      <select
                        id="metadata-status"
                        value={metadataStatus}
                        onChange={(e) => setMetadataStatus(e.target.value as typeof metadataStatus)}
                        className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
                      >
                        <option value="lead">Lead</option>
                        <option value="active">Active</option>
                        <option value="inactive">Inactive</option>
                      </select>
                    </div>
                    <div>
                      <label htmlFor="metadata-source" className="mb-1 block text-xs text-zinc-500">
                        Source
                      </label>
                      <input
                        id="metadata-source"
                        type="text"
                        value={metadataSource}
                        onChange={(e) => setMetadataSource(e.target.value)}
                        maxLength={160}
                        placeholder="Instagram DM, referral, /book…"
                        className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                      />
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={handleSaveMetadata}
                      disabled={metadataPending}
                      className="rounded-lg bg-cyan-600 px-4 py-2 text-sm font-bold text-white transition hover:bg-cyan-700 disabled:cursor-wait disabled:opacity-70"
                    >
                      {metadataPending ? "Saving…" : "Save"}
                    </button>
                    <button
                      onClick={() => setIsEditingMetadata(false)}
                      className="rounded-lg bg-zinc-700 px-4 py-2 text-sm font-bold text-white transition hover:bg-zinc-600"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div className="bg-zinc-800/50 rounded-lg p-4">
                    <p className="text-zinc-500 text-xs mb-1">Status</p>
                    <p className="text-white capitalize">{client.status}</p>
                  </div>
                  <div className="bg-zinc-800/50 rounded-lg p-4">
                    <p className="text-zinc-500 text-xs mb-1">Source</p>
                    <p className="text-white">{client.source || "—"}</p>
                  </div>
                  <div className="bg-zinc-800/50 rounded-lg p-4">
                    <p className="text-zinc-500 text-xs mb-1">Added On</p>
                    <p className="text-white">
                      {client.createdAt ? formatDate(client.createdAt.toISOString().split("T")[0]) : "—"}
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === "projects" && (
          <ProjectManager
            clientId={client.id}
            clientDefaultCoverUrl={defaultCoverUrl}
            clientAvatarUrl={client.instagramProfilePictureUrl}
            projects={projects}
            initiallyCreating={initialProjectCreation}
            returnTo={projectReturnTo}
          />
        )}

        {activeTab === "notes" && (
          <div className="space-y-4">
            {isEditing ? (
              <div className="space-y-4">
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full h-64 bg-zinc-800 border border-zinc-700 rounded-lg p-4 text-white text-sm resize-none focus:outline-none focus:ring-2 focus:ring-cyan-500"
                  placeholder="Add notes about this client..."
                />
                <div className="flex gap-2">
                  <button
                    onClick={handleSaveNotes}
                    className="px-4 py-2 bg-cyan-600 hover:bg-cyan-700 text-white rounded-lg text-sm font-medium transition-colors"
                  >
                    Save Notes
                  </button>
                  <button
                    onClick={() => {
                      setIsEditing(false);
                      setNotes(client.notes ?? "");
                    }}
                    className="px-4 py-2 bg-zinc-700 hover:bg-zinc-600 text-white rounded-lg text-sm font-medium transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="bg-zinc-800/50 rounded-lg p-6 min-h-64">
                  {notes ? (
                    <p className="text-white text-sm whitespace-pre-wrap">{notes}</p>
                  ) : (
                    <p className="text-zinc-500 text-sm italic">No notes yet. Click edit to add notes.</p>
                  )}
                </div>
                <button
                  onClick={() => setIsEditing(true)}
                  className="px-4 py-2 bg-zinc-700 hover:bg-zinc-600 text-white rounded-lg text-sm font-medium transition-colors"
                >
                  Edit Notes
                </button>
              </div>
            )}
          </div>
        )}

        {activeTab === "activity" && (
          <div className="space-y-3">
            {/* Sprint 3: fast quick-log — the only write path in this tab
                before this was other flows (gateway briefings, stage
                changes, /book submissions) writing crm_events; this lets
                the operator log a call/email/meeting/note directly. */}
            <div className="rounded-xl border border-zinc-800 bg-zinc-950/40 p-3.5 sm:p-4">
              <div className="flex flex-col gap-2 sm:flex-row">
                <select
                  value={activityType}
                  onChange={(e) => setActivityType(e.target.value)}
                  className="rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white sm:w-40"
                >
                  {CRM_ACTIVITY_TYPES.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
                <input
                  type="text"
                  value={activityDescription}
                  onChange={(e) => setActivityDescription(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !activityPending) {
                      e.preventDefault();
                      handleLogActivity();
                    }
                  }}
                  maxLength={2_000}
                  placeholder="What happened?"
                  className="flex-1 rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                />
                <button
                  onClick={handleLogActivity}
                  disabled={activityPending}
                  className="rounded-lg bg-cyan-600 px-4 py-2 text-sm font-bold text-white transition hover:bg-cyan-700 disabled:cursor-wait disabled:opacity-70"
                >
                  {activityPending ? "Logging…" : "Log"}
                </button>
              </div>
              {activityError && (
                <p role="alert" className="mt-2 text-xs font-medium text-red-300">
                  {activityError}
                </p>
              )}
            </div>

            {events.length > 0 ? (
              events.map((event) => (
                <article
                  key={event.id}
                  className="flex gap-3 rounded-xl border border-zinc-800 bg-zinc-950/40 p-3.5 sm:p-4"
                >
                  <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-violet-500/10 text-xs text-violet-300">
                    {event.actor === "gateway" ? "↗" : event.actor === "admin" ? "E" : event.actor === "client" ? "C" : "•"}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-zinc-200">
                      {event.description}
                    </p>
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-zinc-600">
                      <span>{formatTimestamp(event.createdAt)}</span>
                      <span aria-hidden="true">·</span>
                      <span>{event.actor}</span>
                      <span aria-hidden="true">·</span>
                      <span>{event.type}</span>
                    </div>
                  </div>
                </article>
              ))
            ) : (
              <div className="rounded-lg bg-zinc-800/50 p-6 text-center">
                <p className="text-sm text-zinc-400">No activity yet</p>
                <p className="mt-2 text-xs text-zinc-500">
                  Gateway and opportunity actions will appear here.
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
