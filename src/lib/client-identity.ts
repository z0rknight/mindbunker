// Quick Morning Reality Patch (26 Aug 2026) §5/§6: a small, deterministic,
// PRESENTATION-ONLY layer for two related UI problems:
//
//   1. Every client currently reads visually the same in list/card views
//      (a plain cyan link) -- a stronger, still-tiny visual identity
//      (a deterministic accent color per client) helps Emmanuel tell
//      clients apart at a glance without a theme system.
//   2. RMEDIA itself is represented as an ordinary `clients` row (used to
//      log internal Operations/Marketing/Administration/Product work
//      against something), but reads exactly like an external client in
//      "Active Clients" / "Top Clients by Revenue" style surfaces. §6 is
//      explicit: no new Organization/Company schema this round -- the
//      smallest truthful fix is a NAME-based check against the existing
//      canonical `clients` row already used for internal work, purely for
//      display and for excluding it from client-ranking language. This
//      identifies nothing structurally new and mutates no data.
//
// Neither function touches the database or any derived financial number --
// both are pure presentation helpers, safe to call from Server or Client
// Components.

const INTERNAL_CLIENT_NAME = "RMEDIA";

/**
 * True when `name` is RMEDIA's own canonical internal record (exact
 * match, case/whitespace-insensitive) -- never a fuzzy/partial match, so
 * a real external client who happens to mention RMEDIA in their name
 * (unlikely, but not this function's job to guess) is never misclassified.
 */
export function isInternalClientName(name: string | null | undefined): boolean {
  if (!name) return false;
  return name.trim().toUpperCase() === INTERNAL_CLIENT_NAME;
}

/**
 * Display label for a client name: RMEDIA's own row reads as
 * "RMEDIA — INTERNAL" wherever this is used, distinguishing it from an
 * external client without renaming the underlying row.
 */
export function displayClientName(name: string): string {
  return isInternalClientName(name) ? "RMEDIA — INTERNAL" : name;
}

// Small deterministic palette -- Tailwind-safe literal class strings (not
// template-built, so they survive Tailwind's static content scan). Order
// is arbitrary; what matters is that the SAME clientId always maps to the
// SAME entry, so a client's color stays stable across pages and reloads
// without needing to store anything.
const CLIENT_ACCENTS = [
  { text: "text-violet-300", border: "border-violet-500/40", dot: "bg-violet-400" },
  { text: "text-cyan-300", border: "border-cyan-500/40", dot: "bg-cyan-400" },
  { text: "text-amber-300", border: "border-amber-500/40", dot: "bg-amber-400" },
  { text: "text-emerald-300", border: "border-emerald-500/40", dot: "bg-emerald-400" },
  { text: "text-rose-300", border: "border-rose-500/40", dot: "bg-rose-400" },
  { text: "text-sky-300", border: "border-sky-500/40", dot: "bg-sky-400" },
  { text: "text-fuchsia-300", border: "border-fuchsia-500/40", dot: "bg-fuchsia-400" },
  { text: "text-lime-300", border: "border-lime-500/40", dot: "bg-lime-400" },
] as const;

const INTERNAL_ACCENT = {
  text: "text-zinc-400",
  border: "border-zinc-700",
  dot: "bg-zinc-500",
} as const;

export type ClientAccent = { text: string; border: string; dot: string };

/**
 * Deterministic small-palette accent for a client, keyed by clientId (not
 * name, which can collide or change) -- RMEDIA's internal record always
 * gets the neutral accent, never a client color, so it reads as
 * structurally different at a glance, not just "another colored client."
 */
export function getClientAccent(clientId: number, clientName: string): ClientAccent {
  if (isInternalClientName(clientName)) return INTERNAL_ACCENT;
  const index = Math.abs(clientId) % CLIENT_ACCENTS.length;
  return CLIENT_ACCENTS[index];
}
