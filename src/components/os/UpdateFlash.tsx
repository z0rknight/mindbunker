"use client";

import type { ElementType, ReactNode } from "react";
import type { FlashTone } from "@/lib/os/feedback";
import { useUpdateFlash } from "./hooks";

/**
 * Changed-object feedback: a subtle background tint plus a 2px edge that
 * returns to neutral by itself. No transform, no bounce, no screen flash. It
 * fires when `changeKey` changes after mount (never on first render).
 * Reduced motion keeps the marker for the same hold; only the fade is dropped.
 */
export function UpdateFlash({
  as: Tag = "div",
  changeKey,
  tone = "brand",
  className,
  children,
  ...rest
}: {
  as?: ElementType;
  changeKey: unknown;
  tone?: FlashTone;
  className?: string;
  children?: ReactNode;
} & Record<string, unknown>) {
  const flash = useUpdateFlash(changeKey, { tone });
  return (
    <Tag {...rest} className={className ? `os-flash ${className}` : "os-flash"} data-flash={flash}>
      {children}
    </Tag>
  );
}
