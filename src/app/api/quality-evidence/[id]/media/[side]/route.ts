import { isAuthenticated } from "@/lib/auth-server";
import {
  getOperatorQualityEvidenceReference,
  serveQualityEvidenceReference,
} from "@/modules/quality-evidence/serve";
import { isQualityEvidenceSide } from "@/modules/quality-evidence/core";

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string; side: string }> },
) {
  if (!(await isAuthenticated())) return new Response("Unauthorized", { status: 401 });
  const { id: rawId, side } = await context.params;
  const id = Number(rawId);
  if (!Number.isSafeInteger(id) || id <= 0 || !isQualityEvidenceSide(side)) {
    return new Response("Not found", { status: 404 });
  }
  const reference = await getOperatorQualityEvidenceReference(id, side);
  return serveQualityEvidenceReference(reference, request);
}
