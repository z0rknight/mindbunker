"use client";

import { useState } from "react";

// MICRO PATCH #1 (Open/Copy micro-actions): one small reusable "Copy"
// action for canonical URLs that already render somewhere in the admin
// UI (reviewUrl/deliveryUrl/publishedUrl/Asset URL/Source Media URL/
// Client Gateway link/etc). Deliberately NOT a clipboard "framework" --
// just the standard browser Clipboard API, no dependency, no
// provider-specific handling. "Open" already exists everywhere these URLs
// render (as a plain <a target="_blank"> or button) -- this only adds
// what's missing.
export function CopyLinkButton({
  url,
  label = "Copy",
  className = "text-xs text-zinc-500 hover:text-white transition",
}: {
  url: string;
  label?: string;
  className?: string;
}) {
  const [state, setState] = useState<"idle" | "copied" | "error">("idle");

  async function copy() {
    try {
      if (!navigator.clipboard) throw new Error("clipboard unavailable");
      await navigator.clipboard.writeText(url);
      setState("copied");
    } catch {
      setState("error");
    } finally {
      setTimeout(() => setState("idle"), 1500);
    }
  }

  return (
    <button type="button" onClick={copy} className={className}>
      {state === "copied" ? "Copied" : state === "error" ? "Copy failed" : label}
    </button>
  );
}
