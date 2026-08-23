import { requireAuth } from "@/lib/auth-server";
import { PRICING_CONFIG } from "@/modules/pricing/config";
import { PricingLabClient } from "./PricingLabClient";

export const dynamic = "force-dynamic";

export default async function PricingLabPage() {
  // No database read is needed for this page (it's pure config + client
  // state), so getAuthenticatedDb() isn't in the call path anywhere on
  // this route. requireAuth() is called directly here instead, so this
  // internal commercial instrument is still gated exactly like every
  // other authenticated MindBunker page.
  await requireAuth();

  return <PricingLabClient config={PRICING_CONFIG} />;
}
