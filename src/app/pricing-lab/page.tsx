import { requireAuth } from "@/lib/auth-server";
import { PRICING_CONFIG } from "@/modules/pricing/config";
import { getPricingReality } from "@/modules/pricing/data";
import { PricingLabClient } from "./PricingLabClient";

export const dynamic = "force-dynamic";

export default async function PricingLabPage() {
  await requireAuth();
  const reality = await getPricingReality();

  return <PricingLabClient config={PRICING_CONFIG} reality={reality} />;
}
