"use client";

import { useState } from "react";
import { statusTransitionAttrs, type StatusMarker, type StatusTone } from "@/lib/os/feedback";

/**
 * Presentation-only status label. It renders the label and tone it is GIVEN;
 * it defines no business states and derives none. When the label changes
 * after mount the new label fades/rises in briefly (CSS, tokens, no layout
 * animation); the first render is never animated. Works identically with
 * motion removed. `variant="inline"` drops the pill chrome (plain text).
 */
export function StatusTransition({
  label,
  tone = "neutral",
  marker = "dot",
  status,
  variant = "pill",
  className,
}: {
  label: string;
  tone?: StatusTone;
  marker?: StatusMarker;
  /** Optional domain status supplied by the caller, exposed as data-status. */
  status?: string;
  variant?: "pill" | "inline";
  className?: string;
}) {
  const [previous, setPrevious] = useState(label);
  const [entering, setEntering] = useState(false);
  if (label !== previous) {
    setPrevious(label);
    setEntering(true);
  }
  const base = variant === "inline" ? "os-st os-st-inline" : "os-st";
  return (
    <span className={className ? `${base} ${className}` : base} {...statusTransitionAttrs({ tone, marker, status })}>
      {marker === "check" && (
        <svg className="os-ck" viewBox="0 0 16 16" aria-hidden="true">
          <path d="M3 8.5l3.2 3L13 4.5" />
        </svg>
      )}
      <span
        key={label}
        className="os-st-label"
        data-enter={entering ? "true" : undefined}
        onAnimationEnd={() => setEntering(false)}
      >
        {label}
      </span>
    </span>
  );
}
