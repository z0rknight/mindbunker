"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const navItems = [
  { href: "/", label: "Dashboard", icon: "⬛" },
  { href: "/productivity", label: "Productivity", icon: "🎬" },
  { href: "/finance", label: "Finance", icon: "💰" },
  { href: "/health", label: "Health", icon: "🫀" },
  { href: "/crm", label: "CRM", icon: "👥" },
  { href: "/investments", label: "Investments", icon: "📈" },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-64 min-h-screen bg-zinc-950 border-r border-zinc-800 flex flex-col">
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
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                isActive
                  ? "bg-violet-600/20 text-violet-400 border border-violet-600/30"
                  : "text-zinc-400 hover:text-white hover:bg-zinc-800"
              }`}
            >
              <span className="text-base">{item.icon}</span>
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="px-6 py-4 border-t border-zinc-800">
        <p className="text-zinc-600 text-xs">Single-user mode</p>
      </div>
    </aside>
  );
}
