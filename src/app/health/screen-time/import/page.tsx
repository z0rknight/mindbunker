import { requireAuth } from "@/lib/auth-server";
import { ScreenTimeImportClient } from "./ScreenTimeImportClient";

export const dynamic = "force-dynamic";

export default async function ScreenTimeImportPage() {
  // Same reasoning as /pricing-lab: this page does no database read at
  // load time (the import itself happens via a server action triggered by
  // the client form), so requireAuth() is called directly here rather than
  // relying on getAuthenticatedDb() to gate the route.
  await requireAuth();

  return <ScreenTimeImportClient />;
}
