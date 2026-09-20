"use client";

import type { ButtonHTMLAttributes } from "react";
import { actionButtonAttrs } from "@/lib/os/feedback";
import { usePendingGate } from "./hooks";

export type ActionButtonProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, "type"> & {
  /** The caller's own in-flight flag (e.g. useTransition's isPending). */
  pending?: boolean;
  /** Optional caller-supplied outcome. The button never decides success. */
  state?: "idle" | "success" | "error";
  type?: "button" | "submit";
};

/**
 * Server-truth action button. Not optimistic: it only reflects the caller's
 * pending/state. While pending it keeps focus (aria-disabled, not disabled),
 * blocks double activation, and shows a restrained loading cue only after
 * ~150ms (and for >= ~300ms once shown). Width never changes; the cue is a 2px
 * bar drawn by CSS.
 */
export function ActionButton({
  pending = false,
  state,
  disabled,
  onClick,
  className,
  children,
  type = "button",
  ...rest
}: ActionButtonProps) {
  const loading = usePendingGate(pending);
  const attrs = actionButtonAttrs({ pending, loading, state, disabled });
  return (
    <button
      type={type}
      {...rest}
      {...attrs}
      className={className ? `os-act ${className}` : "os-act"}
      onClick={(event) => {
        if (pending) {
          event.preventDefault();
          return;
        }
        onClick?.(event);
      }}
    >
      {state === "success" && (
        <svg className="os-ck" viewBox="0 0 16 16" aria-hidden="true">
          <path d="M3 8.5l3.2 3L13 4.5" />
        </svg>
      )}
      {children}
    </button>
  );
}
