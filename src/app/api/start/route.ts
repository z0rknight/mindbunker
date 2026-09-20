import { submitGuidedIntake } from "@/modules/guided-intake/actions";

const MAX_BODY_BYTES = 24_000;

function json(body: unknown, status = 200) {
  return Response.json(body, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

export async function POST(request: Request) {
  const contentType = request.headers.get("content-type")?.toLowerCase() ?? "";
  if (!contentType.startsWith("application/json")) {
    return json({ success: false, message: "Send this request as JSON." }, 415);
  }
  const contentLength = Number(request.headers.get("content-length") ?? "0");
  if (Number.isFinite(contentLength) && contentLength > MAX_BODY_BYTES) {
    return json({ success: false, message: "This request is too large." }, 413);
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json({ success: false, message: "The submission could not be read." }, 400);
  }

  try {
    const result = await submitGuidedIntake(body);
    if (!result.success) {
      return json({ ok: false, message: result.message, errors: result.errors }, result.status);
    }
    return json({
      ok: true,
      deduped: result.deduped,
      path: { label: result.publicStartingPath },
      message: "Got it. Emmanuel will review this personally before confirming scope, timing, or price.",
    });
  } catch (error) {
    // Never log the request body: it contains personal contact/context data.
    console.error("Guided intake submission failed", error instanceof Error ? error.name : "UnknownError");
    return json({ success: false, message: "We could not save this yet. Your answers are still here — please try again." }, 500);
  }
}
