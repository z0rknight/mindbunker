"use server";
import "server-only";
import { getAuthenticatedDb } from "@/db";
import {
  commitments, workSessions, frictionEvents, revisions, qaEvents, videoLifecycleEvents, deliveries,
  clients, crmEvents, quotes, commercialContracts, projects, videoLogs,
} from "@/db/schema";
import { and, desc, eq } from "drizzle-orm";
import { dayKeyFor } from "@/modules/work-sessions/core";

export type TimelineEntry = { kind: string; label: string; at: Date };

// Wave 2I: one deterministic, merged read-model over every event-shaped
// table this Lab round created (plus the pre-existing commitments/
// work_sessions/revisions). Rough on purpose -- last 20 rows per source,
// merged and sorted, not a real event bus.
export async function getLabTimeline(): Promise<{ today: TimelineEntry[]; yesterday: TimelineEntry[]; older: TimelineEntry[] }> {
  const db = await getAuthenticatedDb();
  const [c, ws, fr, rv, qa, lc, dl] = await Promise.all([
    db.select().from(commitments).orderBy(desc(commitments.createdAt)).limit(20),
    db.select().from(workSessions).orderBy(desc(workSessions.startedAt)).limit(20),
    db.select().from(frictionEvents).orderBy(desc(frictionEvents.createdAt)).limit(20),
    db.select().from(revisions).orderBy(desc(revisions.createdAt)).limit(20),
    db.select().from(qaEvents).orderBy(desc(qaEvents.createdAt)).limit(20),
    db.select().from(videoLifecycleEvents).orderBy(desc(videoLifecycleEvents.createdAt)).limit(20),
    db.select().from(deliveries).orderBy(desc(deliveries.deliveredAt)).limit(20),
  ]);

  const entries: TimelineEntry[] = [
    ...c.map((r) => ({ kind: "commitment", label: `Commitment: ${r.description}${r.status === "DONE" ? " (done)" : ""}`, at: new Date(r.createdAt) })),
    ...ws.map((r) => ({ kind: "work_session", label: `Work session: ${r.activityType}${r.endedAt ? "" : " (open)"}`, at: new Date(r.startedAt) })),
    ...fr.map((r) => ({ kind: "friction", label: `Friction: ${r.category}${r.note ? ` — ${r.note}` : ""}`, at: new Date(r.createdAt) })),
    ...rv.map((r) => ({ kind: "revision", label: `Revision (${r.causedBy})`, at: new Date(r.createdAt) })),
    ...qa.map((r) => ({ kind: "qa", label: `QA ${r.result}`, at: new Date(r.createdAt) })),
    ...lc.map((r) => ({ kind: "lifecycle", label: `Lifecycle → ${r.stage}`, at: new Date(r.createdAt) })),
    ...dl.map((r) => ({ kind: "delivery", label: `Delivery v${r.version} (${r.status})`, at: new Date(r.deliveredAt) })),
  ].sort((a, b) => b.at.getTime() - a.at.getTime());

  const todayKey = dayKeyFor(new Date().toISOString());
  const yesterdayKey = dayKeyFor(new Date(Date.now() - 86400000).toISOString());

  return {
    today: entries.filter((e) => dayKeyFor(e.at.toISOString()) === todayKey),
    yesterday: entries.filter((e) => dayKeyFor(e.at.toISOString()) === yesterdayKey),
    older: entries.filter((e) => {
      const k = dayKeyFor(e.at.toISOString());
      return k !== todayKey && k !== yesterdayKey;
    }),
  };
}

// Wave 3I: Contact Timeline -- Timeline extended to one client's context.
// Only facts actually present in canonical tables; never fabricated.
export async function getClientContactTimeline(clientId: number): Promise<TimelineEntry[]> {
  const db = await getAuthenticatedDb();
  const [client, events, quoteRows, contractRows, projectRows, videoRows, commitmentRows] = await Promise.all([
    db.select({ createdAt: clients.createdAt }).from(clients).where(eq(clients.id, clientId)).limit(1),
    db.select().from(crmEvents).where(eq(crmEvents.clientId, clientId)).orderBy(desc(crmEvents.createdAt)).limit(20),
    db.select().from(quotes).where(eq(quotes.clientId, clientId)).limit(20),
    db.select().from(commercialContracts).where(eq(commercialContracts.clientId, clientId)).limit(20),
    db.select().from(projects).where(eq(projects.clientId, clientId)).limit(20),
    db.select().from(videoLogs).where(eq(videoLogs.clientId, clientId)).limit(50),
    db.select().from(commitments).where(and(eq(commitments.ownerType, "CLIENT"), eq(commitments.ownerId, clientId))),
  ]);

  const entries: TimelineEntry[] = [];
  if (client[0]?.createdAt) entries.push({ kind: "lead_created", label: "Client created", at: new Date(client[0].createdAt) });
  for (const e of events) entries.push({ kind: "crm_event", label: `CRM: ${e.type}`, at: new Date(e.createdAt ?? Date.now()) });
  for (const q of quoteRows) if (q.createdAt) entries.push({ kind: "quote", label: `Quote (${q.status})`, at: new Date(q.createdAt) });
  for (const ct of contractRows) if (ct.createdAt) entries.push({ kind: "contract", label: "Contract", at: new Date(ct.createdAt) });
  for (const p of projectRows) if (p.createdAt) entries.push({ kind: "project", label: `Project created: ${p.name}`, at: new Date(p.createdAt) });
  for (const v of videoRows) if (v.status === "DONE") entries.push({ kind: "delivery", label: `Video delivered: ${v.title ?? v.id}`, at: new Date(v.date) });
  for (const cm of commitmentRows) entries.push({ kind: "commitment", label: `Commitment: ${cm.description}`, at: new Date(cm.createdAt) });

  return entries.sort((a, b) => b.at.getTime() - a.at.getTime());
}
