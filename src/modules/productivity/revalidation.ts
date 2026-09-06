import "server-only";

import { revalidatePath } from "next/cache";

// BUILD GATE FIX (Post-Audit Root Fix Wave follow-up): this helper used
// to live as an export of productivity/actions.ts, a "use server"
// module. Next.js 16 treats EVERY export of a "use server" file as a
// remotely-invocable Server Action and requires each one to be an async
// function -- revalidateProductivityViews is synchronous by design (a
// plain revalidatePath fan-out, not a mutation) and fails `next build`
// there with "Server Actions must be async functions." It was never
// meant to be callable from the client; it exists purely for reuse
// between server modules (every mutation in productivity/actions.ts
// itself, and video-operations/actions.ts's recordDetailedRevision,
// DR-3). Moving it to a plain server-only module (no "use server") both
// fixes the build and removes it from the Server Action surface
// entirely, which is the more correct home for an internal helper
// regardless of the sync/async build rule.
export function revalidateProductivityViews(...clientIds: Array<number | null | undefined>) {
  revalidatePath("/");
  revalidatePath("/projects");
  revalidatePath("/productivity");
  revalidatePath("/war-room");
  revalidatePath("/client/dashboard");
  for (const clientId of new Set(clientIds.filter(Boolean))) {
    revalidatePath(`/crm/${clientId}`);
  }
}
