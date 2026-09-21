"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { logoutAction } from "@/app/login/actions";

// FX + Business Operating Cash Patch §13: the sidebar outgrew a flat list,
// so each item now carries a lightweight `group` label used only to add
// small muted uppercase section headings in the desktop rail below --
// this is NOT a navigation redesign: every href, every desktopOnly flag,
// and the mobile bottom tab bar's flat rendering (filtered the same way
// as before, entirely blind to `group`) are unchanged.
const navItems = [
  { href: "/war-room", label: "War Room", mobileLabel: "War", icon: "💎", group: "OPERATIONS" },
  { href: "/", label: "Dashboard", mobileLabel: "Home", icon: "⬛", group: "OPERATIONS" },
  { href: "/productivity", label: "Productivity", mobileLabel: "Work", icon: "🎬", group: "OPERATIONS" },
  // Brief C ("Final Local Ingest / Live Readiness") §1A: real QA showed the
  // operator forgot where Projects was TWICE and naturally tried
  // Projects -> New Project -> Add Multiple Videos right after
  // Productivity. Moved immediately adjacent to Productivity rather than
  // retraining the human -- no other reordering, this is the one change.
  { href: "/projects", label: "Projects", mobileLabel: "Projects", icon: "📁", group: "OPERATIONS" },
  // RMEDIA LET'S COOK Wave 1: batch-order intake/tracking, grouped with
  // OPERATIONS immediately after Projects -- same "adjacent to where the
  // operator already is" placement Brief C used for Projects itself.
  // desktopOnly, same mobile-tab-count discipline as Sessions/Equipment
  // above (the bottom tab bar stays at its fixed 7 destinations).
  { href: "/productivity/orders", label: "LET'S COOK", mobileLabel: "Orders", icon: "🔥", desktopOnly: true, group: "OPERATIONS" },
  // Monday Local Intelligence Lab §B: the Work Session Ledger already
  // exists at /productivity/sessions but had no nav entry anywhere --
  // discoverable only by URL. Desktop sidebar only, so the mobile bottom
  // tab bar keeps its current fixed 7-destination slot count.
  { href: "/productivity/sessions", label: "Sessions", mobileLabel: "Sessions", icon: "📜", desktopOnly: true, group: "OPERATIONS" },
  // Equipment Wave 1 §4: the physical/patrimonial asset registry --
  // grouped with OPERATIONS (it's the infrastructure operations depends
  // on, not a cash concept -- see brief §10 on why Equipment's money
  // fields stay conceptually separate from Finance's MONEY group).
  // desktopOnly, same "protect the mobile tab bar's fixed 7-slot count"
  // discipline as Sessions/Pricing Lab/Subscriptions/Debts/Contracts/All
  // History above.
  { href: "/equipment", label: "Equipment", mobileLabel: "Equipment", icon: "🧰", desktopOnly: true, group: "OPERATIONS" },
  { href: "/crm", label: "CRM", mobileLabel: "CRM", icon: "👥", group: "COMMERCIAL" },
  // Internal sales tool, occasional use -- desktop sidebar only, kept out
  // of the mobile bottom tab bar so that bar stays at its fixed 7 destinations.
  { href: "/pricing-lab", label: "Pricing Lab", mobileLabel: "Pricing", icon: "🧪", desktopOnly: true, group: "COMMERCIAL" },
  { href: "/finance", label: "Finance", mobileLabel: "Money", icon: "💰", group: "MONEY" },
  // FX + Business Operating Cash Patch §12: direct canonical link, same
  // route the Finance page's own "Subscriptions" card already links to --
  // no duplicate page. Desktop sidebar only, same mobile-tab-count
  // discipline as Sessions/Contracts/All History above.
  { href: "/finance/subscriptions", label: "Subscriptions", mobileLabel: "Subs", icon: "🔁", desktopOnly: true, group: "MONEY" },
  // 14SEP Patch Sniper §6: removed from primary navigation -- low-frequency
  // admin surface, and Emmanuel said directly "I don't think I need this on
  // my menu, only a section at finance." The route, data, and every link
  // are untouched; Finance's own "💳 Debts" card still links to
  // /finance/debts exactly as before, so nothing became unreachable.
  // Monday Real-Operation Pre-Freeze §9: Commercial Contracts becomes a
  // first-class operational surface, reachable directly from main nav
  // (previously only one click deep inside /finance). Same
  // desktop-only/mobile-tab-count treatment as Sessions above.
  { href: "/finance/contracts", label: "Contracts", mobileLabel: "Contracts", icon: "🧾", desktopOnly: true, group: "MONEY" },
  { href: "/health", label: "Health", mobileLabel: "Health", icon: "🫀", group: "HEALTH" },
];

// House Cleaning Wave 2 §23 (RMEDIA_SYSTEM_SIMPLIFICATION_RESEARCH_2026_09.md):
// All History (the hist_* one-time reconstruction subsystem -- Upwork/
// Clockify/ActivityWatch backfill, explicitly "not live MindBunker data")
// no longer competes with daily navigation. Nothing was deleted: the
// route, module, tables, and tests are all untouched -- only the sidebar
// entry is gone, since a one-time reconciliation artifact doesn't belong
// next to War Room/Productivity/CRM in primary nav. Reachable via the
// small contextual link on Sessions (see productivity/sessions/page.tsx)
// if ever needed again.

// Section order is fixed here (not alphabetical, not insertion order of
// some other list) so it stays stable regardless of how navItems above
// gets reordered later.
const GROUP_ORDER = ["OPERATIONS", "COMMERCIAL", "MONEY", "HEALTH"];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <>
      <header className="fixed inset-x-0 top-0 z-40 flex h-16 items-center justify-between border-b border-zinc-800 bg-zinc-950/95 px-4 backdrop-blur md:hidden safe-top">
        <Link href="/" className="flex items-center gap-2.5">
          <div className="mb-pixel-logo flex h-8 w-8 items-center justify-center bg-violet-600 text-sm font-bold text-white">
            MB
          </div>
          <div>
            <p className="text-sm font-bold leading-none text-white">MindBunker</p>
            <p className="mt-1 text-[10px] uppercase tracking-widest text-zinc-500">RMEDIA</p>
          </div>
        </Link>
        <div className="flex items-center gap-2">
          <span className="rounded-full border border-emerald-800/70 bg-emerald-950/70 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-emerald-400">
            🔒 Private
          </span>
          <form action={logoutAction}>
            <button
              type="submit"
              className="flex min-h-11 min-w-11 items-center justify-center rounded-full text-zinc-500 active:bg-zinc-800 active:text-white"
              aria-label="Sair do MindBunker"
              title="Sair"
            >
              ↪
            </button>
          </form>
        </div>
      </header>

      <aside className="hidden w-64 min-h-screen bg-zinc-950 border-r border-zinc-800 md:flex flex-col">
      {/* Logo */}
      <div className="px-6 py-6 border-b border-zinc-800">
        <div className="flex items-center gap-3">
          <div className="mb-pixel-logo w-8 h-8 bg-violet-600 flex items-center justify-center text-white font-bold text-sm">
            MB
          </div>
          <div>
            <p className="text-white font-bold text-sm tracking-wide">RMEDIA</p>
            <p className="text-zinc-500 text-xs tracking-widest uppercase">MindBunker</p>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 space-y-4 overflow-y-auto px-3 py-4">
        {GROUP_ORDER.map((group) => (
          <div key={group}>
            <p className="px-3 pb-1.5 text-[10px] font-bold uppercase tracking-widest text-zinc-600">
              {group}
            </p>
            <div className="space-y-1">
              {navItems
                .filter((item) => item.group === group)
                .map((item) => {
                  const isActive =
                    pathname === item.href ||
                    (item.href !== "/" && pathname.startsWith(`${item.href}/`));
                  const isWarRoom = item.href === "/war-room";
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      aria-current={isActive ? "page" : undefined}
                      className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                        isActive
                          ? "border-l-2 border-l-red-600 bg-zinc-900 text-white"
                          : isWarRoom
                          ? "text-zinc-300 hover:text-white hover:bg-zinc-800"
                          : "text-zinc-400 hover:text-white hover:bg-zinc-800"
                      }`}
                    >
                      <span className="text-base grayscale opacity-70" aria-hidden="true">{item.icon}</span>
                      {item.label}
                      {isWarRoom && !isActive && (
                        <span className="ml-auto rounded border border-zinc-700 px-1.5 py-0.5 text-[10px] font-bold text-zinc-400">
                          NEW
                        </span>
                      )}
                    </Link>
                  );
                })}
            </div>
          </div>
        ))}
      </nav>

      {/* Footer */}
      <div className="px-6 py-4 border-t border-zinc-800">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-zinc-500 text-xs">🔒 Sessão privada</p>
            <p className="mt-1 text-[10px] text-zinc-700">Single-user mode</p>
          </div>
          <form action={logoutAction}>
            <button
              type="submit"
              className="rounded-lg border border-zinc-800 px-3 py-2 text-xs font-semibold text-zinc-500 transition hover:border-zinc-700 hover:text-white"
            >
              Sair
            </button>
          </form>
        </div>
      </div>
      </aside>

      <nav className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-7 border-t border-zinc-800 bg-zinc-950/95 px-1 pb-safe backdrop-blur md:hidden">
        {navItems.filter((item) => !item.desktopOnly).map((item) => {
          const isActive =
            pathname === item.href ||
            (item.href !== "/" && pathname.startsWith(`${item.href}/`));
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-label={item.label}
              aria-current={isActive ? "page" : undefined}
              className={`flex min-h-16 flex-col items-center justify-center gap-1 rounded-lg px-1 py-2 text-[9px] font-semibold transition-colors ${
                isActive ? "border-t-2 border-t-red-600 bg-zinc-900 text-white" : "text-zinc-500 active:bg-zinc-800 active:text-white"
              }`}
            >
              <span className="text-xl leading-none grayscale" aria-hidden="true">{item.icon}</span>
              <span className="max-w-full truncate">{item.mobileLabel}</span>
            </Link>
          );
        })}
      </nav>
    </>
  );
}
