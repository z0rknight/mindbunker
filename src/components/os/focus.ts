"use client";

/**
 * Queue removal must not strand keyboard focus. Before a revalidation removes
 * the element that holds focus, remember the nearest landmark (section/main
 * heading); afterwards, only if focus fell back to <body>, move it there.
 * Native focus behaviour is otherwise untouched.
 */
export function rememberFocusLandmark(from: Element | null): () => void {
  const scope = from?.closest("section, main, [role='region']") ?? null;
  const heading = scope?.querySelector<HTMLElement>("h1, h2, h3") ?? null;
  return () => {
    if (typeof document === "undefined") return;
    if (document.activeElement && document.activeElement !== document.body) return;
    if (!heading || !heading.isConnected) return;
    if (!heading.hasAttribute("tabindex")) heading.setAttribute("tabindex", "-1");
    heading.focus({ preventScroll: true });
  };
}
