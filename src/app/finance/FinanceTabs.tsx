"use client";

import { useState, type ReactNode } from "react";

// Tuesday Patch Priority 4 (brief §Finance.5): "No topo: Overview ·
// Transactions · Accounting details. E o default sempre seria Overview."
// All three panels are already server-rendered with their data -- this
// only toggles which one is visible, no re-fetch, no route change.
const TABS = [
  { key: "overview", label: "Overview" },
  { key: "transactions", label: "Transactions" },
  { key: "accounting", label: "Accounting details" },
] as const;

type TabKey = (typeof TABS)[number]["key"];

export function FinanceTabs({
  overview,
  transactions,
  accounting,
}: {
  overview: ReactNode;
  transactions: ReactNode;
  accounting: ReactNode;
}) {
  const [tab, setTab] = useState<TabKey>("overview");

  return (
    <div>
      <div className="mb-6 flex gap-1 rounded-xl border border-zinc-800 bg-zinc-900/60 p-1" role="tablist">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            role="tab"
            aria-selected={tab === t.key}
            onClick={() => setTab(t.key)}
            className={`min-h-9 flex-1 rounded-lg px-3 text-xs font-black transition ${
              tab === t.key ? "bg-cyan-600 text-white" : "text-zinc-400 hover:text-zinc-200"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div hidden={tab !== "overview"}>{overview}</div>
      <div hidden={tab !== "transactions"}>{transactions}</div>
      <div hidden={tab !== "accounting"}>{accounting}</div>
    </div>
  );
}
