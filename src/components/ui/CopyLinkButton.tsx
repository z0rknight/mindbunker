"use client";

import { useEffect, useRef, useState } from "react";
import { StatusTransition } from "@/components/os";

// MICRO PATCH #1 (Open/Copy micro-actions): one small reusable "Copy"
// action for canonical URLs that already render somewhere in the admin
// UI (reviewUrl/deliveryUrl/publishedUrl/Asset URL/Source Media URL/
// Client Gateway link/etc). Deliberately NOT a clipboard "framework" --
// just the standard browser Clipboard API, no dependency, no
// provider-specific handling. "Open" already exists everywhere these URLs
// render (as a plain <a target="_blank"> or button) -- this only adds
// what's missing.
//
// RMEDIA OS M1 proof surface: the label change goes through the shared
// StatusTransition (brief fade/rise, works without motion) and is announced to
// assistive tech through a polite live region. Behaviour is otherwise unchanged.
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
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  async function copy() {
    try {
      if (!navigator.clipboard) throw new Error("clipboard unavailable");
      await navigator.clipboard.writeText(url);
      setState("copied");
    } catch {
      setState("error");
    } finally {
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => setState("idle"), 1500);
    }
  }

  const text = state === "copied" ? "Copied" : state === "error" ? "Copy failed" : label;
  return (
    <>
      <button type="button" onClick={copy} className={className}>
        <StatusTransition
          variant="inline"
          marker="none"
          label={text}
          tone={state === "copied" ? "success" : state === "error" ? "danger" : "neutral"}
        />
      </button>
      <span className="sr-only" role="status" aria-live="polite">
        {state === "copied" ? "Copied to clipboard" : state === "error" ? "Copy failed" : ""}
      </span>
    </>
  );
}
