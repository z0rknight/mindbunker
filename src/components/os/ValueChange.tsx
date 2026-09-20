"use client";

import { useEffect, useState } from "react";

/**
 * A number/short text whose value changes in place (queue counts). On a change
 * after mount the old value fades out and the new one fades in over the same
 * space (no layout shift, no counting-up). The first render is static. The
 * outgoing text is aria-hidden so assistive tech only ever sees the current
 * value; reduced motion swaps instantly (CSS hides the outgoing layer).
 */
export function ValueChange({ value, className }: { value: string | number; className?: string }) {
  const [previous, setPrevious] = useState(value);
  const [outgoing, setOutgoing] = useState<string | null>(null);
  if (value !== previous) {
    setOutgoing(String(previous));
    setPrevious(value);
  }
  useEffect(() => {
    if (outgoing === null) return;
    const timer = setTimeout(() => setOutgoing(null), 260);
    return () => clearTimeout(timer);
  }, [outgoing]);
  return (
    <span className={className ? `os-vc ${className}` : "os-vc"}>
      {outgoing !== null && (
        <span className="os-vc-out" aria-hidden="true">
          {outgoing}
        </span>
      )}
      <span key={String(value)} className="os-vc-in" data-enter={outgoing !== null ? "true" : undefined}>
        {value}
      </span>
    </span>
  );
}
