"use server";

import "server-only";

import { getDb } from "@/db";
import { clients, crmEvents } from "@/db/schema";
import { eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import {
  buildQuoteRequestDescription,
  QUOTE_REQUEST_EVENT_TYPE,
  validateQuoteRequestInput,
} from "./core";

// /quoteavideo public intake (Client Service Reality Patch, 25 Aug 2026).
//
// Mirrors modules/booking/actions.ts's submitPublicBookingRequest almost
// exactly: lookup-or-create client by lowercased email (new email -> Lead,
// existing email -> reuse the same client/lead row, never duplicate),
// idempotencyKey-guarded crm_events row carrying the full submission as a
// readable description (brief section 3's "store the submitted
// briefing/evidence"), and -- critically -- this action does NOT create a
// project or video. Section 3 is explicit: no production entity exists
// until Emmanuel reviews and approves a quote (see modules/quotes/actions
// .ts's createProductionFromQuote for that later, separate step).

export type QuoteRequestActionState = {
  success?: boolean;
  message?: string;
  errors?: Record<string, string>;
};

export async function submitQuoteRequest(
  _previousState: QuoteRequestActionState,
  formData: FormData,
): Promise<QuoteRequestActionState> {
  const idempotencyKey =
    typeof formData.get("idempotencyKey") === "string"
      ? (formData.get("idempotencyKey") as string).slice(0, 100)
      : null;

  const validation = validateQuoteRequestInput({
    name: formData.get("name"),
    email: formData.get("email"),
    company: formData.get("company"),
    contentType: formData.get("contentType"),
    whatAreYouCreating: formData.get("whatAreYouCreating"),
    mainObjective: formData.get("mainObjective"),
    quantityFrequency: formData.get("quantityFrequency"),
    idealTimeline: formData.get("idealTimeline"),
    referencesContext: formData.get("referencesContext"),
    notes: formData.get("notes"),
  });
  if (!validation.success) {
    return { errors: validation.errors, message: "Check the highlighted fields." };
  }

  const db = await getDb();

  if (idempotencyKey) {
    const already = await db
      .select({ id: crmEvents.id })
      .from(crmEvents)
      .where(eq(crmEvents.idempotencyKey, idempotencyKey))
      .limit(1);
    if (already.length > 0) {
      return { success: true };
    }
  }

  const data = validation.data;
  const now = new Date();
  const description = buildQuoteRequestDescription(data);

  const existingClient = await db
    .select({ id: clients.id })
    .from(clients)
    .where(sql`lower(${clients.email}) = ${data.email}`)
    .limit(1);

  let clientId: number;
  if (existingClient[0]) {
    clientId = existingClient[0].id;
    await db
      .update(clients)
      .set({ lastInteractionAt: now })
      .where(eq(clients.id, clientId));
  } else {
    const inserted = await db
      .insert(clients)
      .values({
        name: data.name,
        status: "lead",
        opportunityStage: "new",
        email: data.email,
        serviceInterest: data.contentType,
        source: "quoteavideo",
        contacted: false,
        converted: false,
        lastInteractionAt: now,
      })
      .returning({ id: clients.id });
    if (!inserted[0]) {
      return { message: "Something went wrong. Please try again." };
    }
    clientId = inserted[0].id;
    await db.insert(crmEvents).values({
      clientId,
      type: "lead_created",
      actor: "gateway",
      description: `Lead created from /quoteavideo: ${data.name}`,
    });
  }

  await db
    .insert(crmEvents)
    .values({
      clientId,
      type: QUOTE_REQUEST_EVENT_TYPE,
      actor: "gateway",
      description,
      idempotencyKey,
    })
    .onConflictDoNothing({ target: crmEvents.idempotencyKey });

  revalidatePath(`/crm/${clientId}`);
  revalidatePath("/crm");
  return { success: true, message: "Thanks — I'll follow up by email shortly." };
}
