"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";

export function PortalControl({
  label,
  description,
  enabled,
  onChange,
}: {
  label: string;
  description?: string;
  enabled: boolean;
  onChange: (enabled: boolean) => Promise<{ success: boolean; error?: string }>;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <button
      type="button"
      role="switch"
      aria-checked={enabled}
      disabled={pending}
      onClick={() => startTransition(async () => {
        const result = await onChange(!enabled);
        if (result.success) router.refresh();
      })}
      className="flex min-h-12 w-full items-center justify-between gap-4 rounded-xl border border-zinc-800 bg-zinc-950/50 px-3.5 py-2.5 text-left transition hover:border-violet-500/40 disabled:opacity-50"
    >
      <span>
        <span className="block text-xs font-black text-zinc-200">{label}</span>
        {description && <span className="mt-0.5 block text-[11px] text-zinc-600">{description}</span>}
      </span>
      <span className={`rounded-full px-2.5 py-1 text-[10px] font-black uppercase ${enabled ? "bg-emerald-500/15 text-emerald-300" : "bg-zinc-800 text-zinc-500"}`}>
        {pending ? "Saving" : enabled ? "Visible" : "Hidden"}
      </span>
    </button>
  );
}
