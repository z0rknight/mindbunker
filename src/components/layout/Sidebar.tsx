"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { logoutAction } from "@/app/login/actions";

const navItems = [
  { href: "/war-room", label: "War Room", mobileLabel: "War", icon: "💎" },
  { href: "/", label: "Dashboard", mobileLabel: "Home", icon: "⬛" },
  { href: "/productivity", label: "Productivity", mobileLabel: "Work", icon: "🎬" },
  { href: "/finance", label: "Finance", mobileLabel: "Money", icon: "💰" },
  { href: "/health", label: "Health", mobileLabel: "Health", icon: "🫀" },
  { href: "/crm", label: "CRM", mobileLabel: "CRM", icon: "👥" },
  { href: "/projects", label: "Projects", mobileLabel: "Projects", icon: "📁" },
  // Reference/reporting surface, not part of daily Productivity execution --
  // desktop sidebar only, deliberately excluded from the mobile bottom tab
  // bar so that bar stays at its current 7 destinations.
  { href: "/all-history", label: "All History", mobileLabel: "History", icon: "🗄️", desktopOnly: true },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <>
      <header className="fixed inset-x-0 top-0 z-40 flex h-16 items-center justify-between border-b border-zinc-800 bg-zinc-950/95 px-4 backdrop-blur md:hidden safe-top">
        <Link href="/" className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-violet-600 text-sm font-bold text-white">
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
          <div className="w-8 h-8 bg-violet-600 rounded-lg flex items-center justify-center text-white font-bold text-sm">
            MB
          </div>
          <div>
            <p className="text-white font-bold text-sm tracking-wide">RMEDIA</p>
            <p className="text-zinc-500 text-xs tracking-widest uppercase">MindBunker</p>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-1">
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          const isWarRoom = item.href === "/war-room";
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                isActive && isWarRoom
                  ? "bg-cyan-900/40 text-cyan-300 border border-cyan-700/50"
                  : isActive
                  ? "bg-violet-600/20 text-violet-400 border border-violet-600/30"
                  : isWarRoom
                  ? "text-cyan-500 hover:text-cyan-300 hover:bg-cyan-900/20 border border-cyan-900/30"
                  : "text-zinc-400 hover:text-white hover:bg-zinc-800"
              }`}
            >
              <span className="text-base">{item.icon}</span>
              {item.label}
              {isWarRoom && !isActive && (
                <span className="ml-auto text-xs bg-cyan-900/50 text-cyan-500 px-1.5 py-0.5 rounded font-bold">
                  NEW
                </span>
              )}
            </Link>
          );
        })}
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
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-label={item.label}
              className={`flex min-h-16 flex-col items-center justify-center gap-1 rounded-lg px-1 py-2 text-[9px] font-semibold transition-colors ${
                isActive ? "text-violet-300" : "text-zinc-500 active:bg-zinc-800 active:text-white"
              }`}
            >
              <span className="text-xl leading-none" aria-hidden="true">{item.icon}</span>
              <span className="max-w-full truncate">{item.mobileLabel}</span>
            </Link>
          );
        })}
      </nav>
    </>
  );
}
