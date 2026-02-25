"use client";

import { useState } from "react";
import { formatCurrency, formatDate } from "@/utils/date";
import { updateClient } from "@/modules/crm/actions";

interface ClientTabsProps {
  client: {
    id: number;
    name: string;
    status: string;
    email: string | null;
    phone: string | null;
    notes: string | null;
    source: string | null;
    totalProjects: number;
    totalRevenue: number;
    contacted: boolean;
    converted: boolean;
    createdAt: Date | null;
  };
}

type Tab = "overview" | "projects" | "notes" | "activity";

export function ClientTabs({ client }: ClientTabsProps) {
  const [activeTab, setActiveTab] = useState<Tab>("overview");
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
      <div className="flex border-b border-zinc-800">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-6 py-3 text-sm font-medium transition-colors ${
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
      <div className="p-6">
        {activeTab === "overview" && (
          <div className="space-y-6">
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
          <div className="space-y-4">
            <div className="bg-zinc-800/50 rounded-lg p-6 text-center">
              <p className="text-zinc-400 text-sm">Project tracking coming soon</p>
              <p className="text-zinc-500 text-xs mt-2">
                This tab will show all projects associated with {client.name}
              </p>
            </div>
          </div>
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
          <div className="space-y-4">
            <div className="bg-zinc-800/50 rounded-lg p-6 text-center">
              <p className="text-zinc-400 text-sm">Activity log coming soon</p>
              <p className="text-zinc-500 text-xs mt-2">
                This tab will show all interactions and activities with {client.name}
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}