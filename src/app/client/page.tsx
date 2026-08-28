import { redirect } from "next/navigation";
import { isClientAuthenticated } from "@/lib/client-portal-session";

// Sprint 3 P0: the bare /client route 404'd -- no page.tsx existed at
// this path (only /client/login, /client/dashboard, /client/[token], and
// /client/reset). This closes that gap with a trivial redirect, matching
// exactly what the login page itself already does for an authenticated
// visitor -- not a new auth mechanism, not a third entry point.
export const dynamic = "force-dynamic";

export default async function ClientRootPage() {
  const clientId = await isClientAuthenticated();
  redirect(clientId !== false ? "/client/dashboard" : "/client/login");
}
