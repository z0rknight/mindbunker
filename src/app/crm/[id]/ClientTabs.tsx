"use client";

import { useState } from "react";
import { formatCurrency, formatDate } from "@/utils/date";
import { updateClient } from "@/modules/crm/actions";
import { ProjectManager, type ClientProjectView } from "./ProjectManager";
import { InstagramProfileCard } from "./InstagramProfileCard";

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
    notes: string | null;
    source: string | null;
    totalProjects: number;
    totalRevenue: number;
    contacted: boolean;
    converted: boolean;
    createdAt: Date | null;
  };
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
              <h3 className="text-zinc-400 text-xs font-semibold uppercase tracking-wider mb-3">
                Contact Information
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-zinc-800/50 rounded-lg p-4">
                  <p className="text-zinc-500 text-xs mb-1">Email</p>
                  <p className="text-white">{client.email || "—"}</p>
                </div>
                <div className="bg-zinc-800/50 rounded-lg p-4">
                  <p className="text-zinc-500 text-xs mb-1">Phone</p>
                  <p className="text-white">{client.phone || "—"}</p>
                </div>
              </div>
            </div>

            {/* Stats */}
            <div>
              <h3 className="text-zinc-400 text-xs font-semibold uppercase tracking-wider mb-3">
                Statistics
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-zinc-800/50 rounded-lg p-4">
                  <p className="text-zinc-500 text-xs mb-1">Total Projects</p>
                  <p className="text-2xl font-bold text-white">{client.totalProjects}</p>
                </div>
                <div className="bg-zinc-800/50 rounded-lg p-4">
                  <p className="text-zinc-500 text-xs mb-1">Total Revenue</p>
                  <p className="text-2xl font-bold text-emerald-400">
                    {formatCurrency(client.totalRevenue)}
                  </p>
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
              <h3 className="text-zinc-400 text-xs font-semibold uppercase tracking-wider mb-3">
                Metadata
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
            </div>
          </div>
        )}

        {activeTab === "projects" && (
          <ProjectManager
            clientId={client.id}
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
