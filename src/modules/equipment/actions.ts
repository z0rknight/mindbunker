"use server";

import { getAuthenticatedDb } from "@/db";
import {
  equipmentAcquisitions,
  equipmentAssets,
  equipmentMaintenanceEvents,
  equipmentSystems,
} from "@/db/schema";
import { desc, eq, inArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { todayISO } from "@/utils/date";
import {
  buildAssetCode,
  computeAttentionItems,
  computeInvestmentByDomain,
  computeInvestmentSummary,
  computeMaintenanceCommandSummary,
  computeMaintenanceStatus,
  computeRecordedTco,
  computeSystemAttentionSummary,
  computeSystemFinancials,
  computeSystemInvestedCost,
  isAcquisitionStageTransitionAllowed,
  summarizeSystemConditions,
  mostRecentMaintenanceEvent,
  rankAcquisitions,
  selectCountableAssets,
  validateEquipmentAcquisitionInput,
  validateEquipmentAssetInput,
  validateEquipmentMaintenanceInput,
  validateEquipmentSystemInput,
  wouldCreateParentCycle,
  type EquipmentAcquisitionInput,
  type EquipmentAssetInput,
  type EquipmentAssetRecord,
  type EquipmentMaintenanceInput,
  type EquipmentSystemInput,
} from "./core";
import type {
  EquipmentAcquisitionPriority,
  EquipmentAcquisitionStage,
  EquipmentCondition,
  EquipmentCriticality,
  EquipmentDomain,
  EquipmentMaintenanceType,
  EquipmentOwnership,
  EquipmentStatus,
  EquipmentSystemStatus,
} from "./config";

export type EquipmentActionResult =
  | { success: true }
  | { success: false; error: string };

export type EquipmentActionResultWithId =
  | { success: true; id: number }
  | { success: false; error: string };

// Every read below accepts an optional ownership filter so the same
// queries back the [ALL]/[PERSONAL]/[RMEDIA] tabs (Wave 1 brief §4) --
// "ALL" is expressed as `undefined`, never a 4th enum value, since
// ownership is a closed classification (config.ts#EQUIPMENT_OWNERSHIPS)
// and "all of them" is a query concern, not a data value.
type OwnershipFilter = EquipmentOwnership | undefined;

// Full DB row shapes (every column) -- distinct from core.ts's
// EquipmentAssetRecord, which is deliberately the minimal shape the pure
// aggregation/validation logic needs so core.ts stays DB-schema-free and
// unit-testable with plain fixtures. Reads here return the full row.
type EquipmentAssetRow = typeof equipmentAssets.$inferSelect;
type EquipmentSystemRow = typeof equipmentSystems.$inferSelect;
type EquipmentMaintenanceEventRow = typeof equipmentMaintenanceEvents.$inferSelect;
type EquipmentAcquisitionRow = typeof equipmentAcquisitions.$inferSelect;

function ownershipWhere(ownership: OwnershipFilter) {
  return ownership ? eq(equipmentAssets.ownership, ownership) : undefined;
}

export async function getEquipmentAssets(
  ownership?: OwnershipFilter,
): Promise<EquipmentAssetRow[]> {
  const db = await getAuthenticatedDb();
  const rows = await db
    .select()
    .from(equipmentAssets)
    .where(ownershipWhere(ownership));
  return rows;
}

export async function getEquipmentAsset(id: number) {
  const db = await getAuthenticatedDb();
  const [asset] = await db
    .select()
    .from(equipmentAssets)
    .where(eq(equipmentAssets.id, id))
    .limit(1);
  if (!asset) return null;

  const [system, children, parent, maintenanceEvents] = await Promise.all([
    asset.systemId
      ? db
          .select()
          .from(equipmentSystems)
          .where(eq(equipmentSystems.id, asset.systemId))
          .limit(1)
          .then((r) => r[0] ?? null)
      : Promise.resolve(null),
    db
      .select()
      .from(equipmentAssets)
      .where(eq(equipmentAssets.parentAssetId, id)),
    asset.parentAssetId
      ? db
          .select()
          .from(equipmentAssets)
          .where(eq(equipmentAssets.id, asset.parentAssetId))
          .limit(1)
          .then((r) => r[0] ?? null)
      : Promise.resolve(null),
    db
      .select()
      .from(equipmentMaintenanceEvents)
      .where(eq(equipmentMaintenanceEvents.assetId, id))
      .orderBy(desc(equipmentMaintenanceEvents.performedAt)),
  ]);

  // Wave 2 §2/§3: the asset page should answer "is it healthy?" and
  // "what needs to happen next?" -- both derived from the SAME
  // maintenance history rendered below it, never a separate silent
  // computation that could drift from what's actually logged.
  const today = todayISO();
  const mostRecent = mostRecentMaintenanceEvent(maintenanceEvents);
  const maintenanceStatus = computeMaintenanceStatus(mostRecent?.nextInspection, today);
  const recordedTco = computeRecordedTco(asset.purchasePrice, maintenanceEvents);

  return { asset, system, children, parent, maintenanceEvents, maintenanceStatus, recordedTco };
}

// Wave 1 brief §5/§10: Command Center summary + attention panel +
// investment-by-domain bars, all derived from ONE fetch of the filtered
// asset list so every panel is looking at the same underlying set (no
// separate queries that could silently drift out of sync with each
// other under concurrent edits).
export async function getEquipmentOverview(ownership?: OwnershipFilter) {
  const db = await getAuthenticatedDb();
  const assets = await db
    .select()
    .from(equipmentAssets)
    .where(ownershipWhere(ownership));
  const systems = await db
    .select()
    .from(equipmentSystems)
    .where(ownership ? eq(equipmentSystems.ownership, ownership) : undefined);

  const summary = computeInvestmentSummary(assets);
  const byDomain = computeInvestmentByDomain(assets);

  // Wave 2 §4: Attention is now derived from every deterministic source
  // (condition, overdue/due-soon maintenance, expired warranty), not just
  // condition -- computeAttentionItems does the ranking/dedup; this
  // function's only job is building the two lookup maps it needs.
  const today = todayISO();
  const assetIds = assets.map((a) => a.id);
  const allMaintenanceEvents = assetIds.length
    ? await db
        .select()
        .from(equipmentMaintenanceEvents)
        .where(inArray(equipmentMaintenanceEvents.assetId, assetIds))
    : [];
  const eventsByAsset = new Map<number, EquipmentMaintenanceEventRow[]>();
  for (const event of allMaintenanceEvents) {
    const list = eventsByAsset.get(event.assetId) ?? [];
    list.push(event);
    eventsByAsset.set(event.assetId, list);
  }
  const maintenanceStatusByAssetId = new Map(
    assets.map((a) => {
      const mostRecent = mostRecentMaintenanceEvent(eventsByAsset.get(a.id) ?? []);
      return [a.id, computeMaintenanceStatus(mostRecent?.nextInspection, today)] as const;
    }),
  );
  const warrantyUntilByAssetId = new Map(assets.map((a) => [a.id, a.warrantyUntil] as const));

  const attentionItems = computeAttentionItems(
    assets,
    maintenanceStatusByAssetId,
    warrantyUntilByAssetId,
    today,
  );
  const assetsById = new Map(assets.map((a) => [a.id, a] as const));
  const attention = attentionItems.map((item) => ({
    ...item,
    asset: assetsById.get(item.assetId)!,
  }));

  const systemsWithCost = systems.map((system) => ({
    system,
    invested: computeSystemInvestedCost(system.id, assets),
    memberCount: assets.filter((a) => a.systemId === system.id).length,
  }));

  // "Next Acquisitions" (Wave 2 §11): the pipeline has no ownership
  // dimension of its own (a considered purchase isn't yet a classified
  // asset), so it's deliberately shown the same regardless of the
  // ALL/PERSONAL/RMEDIA tab -- only DEPLOYED/CANCELLED are excluded,
  // since those are no longer "next."
  const openAcquisitions = await db
    .select()
    .from(equipmentAcquisitions)
    .where(inArray(equipmentAcquisitions.stage, ["IDEA", "RESEARCH", "APPROVED", "BUDGETED", "ORDERED", "RECEIVED"]));
  const nextAcquisitions = rankAcquisitions(openAcquisitions).slice(0, 5);

  const maintenanceSummary = computeMaintenanceCommandSummary(
    maintenanceStatusByAssetId,
    allMaintenanceEvents,
    today,
  );

  return {
    assets,
    systems: systemsWithCost,
    summary,
    byDomain,
    attention,
    nextAcquisitions,
    maintenanceSummary,
  };
}

export async function getEquipmentSystems(ownership?: OwnershipFilter) {
  const db = await getAuthenticatedDb();
  const systems = await db
    .select()
    .from(equipmentSystems)
    .where(ownership ? eq(equipmentSystems.ownership, ownership) : undefined);
  const assets = await db.select().from(equipmentAssets);

  // Wave 3 §8: per-system Attention summary needs the same per-asset
  // maintenance-status map getEquipmentOverview already builds for the
  // Command Center -- rebuilt here from the same recorded facts (most
  // recent event's nextInspection vs. today) so a system's "2 overdue"
  // always agrees with what Command Center and Asset Detail would show
  // for the same assets.
  const today = todayISO();
  const assetIds = assets.map((a) => a.id);
  const allMaintenanceEvents = assetIds.length
    ? await db
        .select()
        .from(equipmentMaintenanceEvents)
        .where(inArray(equipmentMaintenanceEvents.assetId, assetIds))
    : [];
  const eventsByAsset = new Map<number, EquipmentMaintenanceEventRow[]>();
  for (const event of allMaintenanceEvents) {
    const list = eventsByAsset.get(event.assetId) ?? [];
    list.push(event);
    eventsByAsset.set(event.assetId, list);
  }
  const maintenanceStatusByAssetId = new Map(
    assets.map((a) => {
      const mostRecent = mostRecentMaintenanceEvent(eventsByAsset.get(a.id) ?? []);
      return [a.id, computeMaintenanceStatus(mostRecent?.nextInspection, today)] as const;
    }),
  );

  return systems.map((system) => ({
    system,
    invested: computeSystemInvestedCost(system.id, assets),
    financials: computeSystemFinancials(system.id, assets),
    conditions: summarizeSystemConditions(system.id, assets),
    attention: computeSystemAttentionSummary(system.id, assets, maintenanceStatusByAssetId),
    memberCount: assets.filter((a) => a.systemId === system.id).length,
  }));
}

export async function getEquipmentSystem(id: number) {
  const db = await getAuthenticatedDb();
  const [system] = await db
    .select()
    .from(equipmentSystems)
    .where(eq(equipmentSystems.id, id))
    .limit(1);
  if (!system) return null;

  const members = await db
    .select()
    .from(equipmentAssets)
    .where(eq(equipmentAssets.systemId, id));

  // computeSystemInvestedCost/computeSystemFinancials apply
  // selectCountableAssets internally so a priced parent + priced
  // children belonging to the same system never double-count any of the
  // three totals (Wave 1 brief §9 / Wave 2 brief §7 -- "Truth > impressive
  // number").
  const invested = computeSystemInvestedCost(id, members);
  const financials = computeSystemFinancials(id, members);
  const conditions = summarizeSystemConditions(id, members);
  const countableMembers = selectCountableAssets(members);

  // Wave 3 §8: same per-asset maintenance-status derivation as
  // getEquipmentSystems/getEquipmentOverview, scoped to this system's
  // own members (all already fetched above -- no extra asset query).
  const today = todayISO();
  const memberIds = members.map((a) => a.id);
  const memberMaintenanceEvents = memberIds.length
    ? await db
        .select()
        .from(equipmentMaintenanceEvents)
        .where(inArray(equipmentMaintenanceEvents.assetId, memberIds))
    : [];
  const eventsByAsset = new Map<number, EquipmentMaintenanceEventRow[]>();
  for (const event of memberMaintenanceEvents) {
    const list = eventsByAsset.get(event.assetId) ?? [];
    list.push(event);
    eventsByAsset.set(event.assetId, list);
  }
  const maintenanceStatusByAssetId = new Map(
    members.map((a) => {
      const mostRecent = mostRecentMaintenanceEvent(eventsByAsset.get(a.id) ?? []);
      return [a.id, computeMaintenanceStatus(mostRecent?.nextInspection, today)] as const;
    }),
  );
  const attention = computeSystemAttentionSummary(id, members, maintenanceStatusByAssetId);

  return {
    system,
    members,
    countableMembers,
    invested,
    financials,
    conditions,
    attention,
    maintenanceStatusByAssetId,
  };
}

// ─── Mutations ─────────────────────────────────────────────────────────

// Two-step create: insert with a placeholder assetCode that can never
// collide with a real "{OWN}-{DOM}-{######}" code, then derive the real
// code from the DB-assigned autoincrement id and update in the same
// action call. This avoids a concurrency-unsafe "MAX(id)+1" or
// per-domain-counter read-then-write race under D1 (Wave 1 brief §8) --
// the autoincrement id itself is the only value SQLite/D1 already hands
// out atomically. See core.ts#buildAssetCode for the full tradeoff
// writeup.
export async function createEquipmentAsset(
  input: EquipmentAssetInput,
): Promise<EquipmentActionResultWithId> {
  const validationError = validateEquipmentAssetInput(input);
  if (validationError) return { success: false, error: validationError };

  const db = await getAuthenticatedDb();
  const placeholderCode = `PENDING-${crypto.randomUUID()}`;

  const [inserted] = await db
    .insert(equipmentAssets)
    .values({
      assetCode: placeholderCode,
      name: input.name.trim(),
      ownership: input.ownership as EquipmentOwnership,
      domain: input.domain as EquipmentDomain,
      category: input.category.trim(),
      systemId: input.systemId ?? null,
      parentAssetId: input.parentAssetId ?? null,
      location: input.location?.trim() || null,
      assignedTo: input.assignedTo?.trim() || null,
      status: (input.status as EquipmentStatus) ?? "ACTIVE",
      condition: (input.condition as EquipmentCondition) ?? "GOOD",
      criticality: (input.criticality as EquipmentCriticality) ?? "CONVENIENCE",
      purchaseDate: input.purchaseDate ?? null,
      purchasePrice: input.purchasePrice ?? null,
      currentValue: input.currentValue ?? null,
      replacementCost: input.replacementCost ?? null,
      warrantyUntil: input.warrantyUntil ?? null,
      serialNumber: input.serialNumber?.trim() || null,
      notes: input.notes?.trim() || null,
    })
    .returning({ id: equipmentAssets.id });

  const assetCode = buildAssetCode(
    input.ownership as EquipmentOwnership,
    input.domain as EquipmentDomain,
    inserted.id,
  );

  await db
    .update(equipmentAssets)
    .set({ assetCode, updatedAt: new Date() })
    .where(eq(equipmentAssets.id, inserted.id));

  revalidatePath("/equipment");
  revalidatePath("/equipment/assets");
  return { success: true, id: inserted.id };
}

export async function updateEquipmentAsset(
  id: number,
  input: EquipmentAssetInput,
): Promise<EquipmentActionResult> {
  const validationError = validateEquipmentAssetInput(input);
  if (validationError) return { success: false, error: validationError };

  const db = await getAuthenticatedDb();

  // Wave 2 §13: reject a self-reference or a transitive cycle before it
  // ever reaches the DB -- see core.ts#wouldCreateParentCycle.
  const proposedParentId = input.parentAssetId ?? null;
  if (proposedParentId != null) {
    const allAssets = await db
      .select({ id: equipmentAssets.id, parentAssetId: equipmentAssets.parentAssetId })
      .from(equipmentAssets);
    if (wouldCreateParentCycle(id, proposedParentId, allAssets)) {
      return { success: false, error: "That parent assignment would create a composition cycle." };
    }
  }

  await db
    .update(equipmentAssets)
    .set({
      name: input.name.trim(),
      ownership: input.ownership as EquipmentOwnership,
      domain: input.domain as EquipmentDomain,
      category: input.category.trim(),
      systemId: input.systemId ?? null,
      parentAssetId: input.parentAssetId ?? null,
      location: input.location?.trim() || null,
      assignedTo: input.assignedTo?.trim() || null,
      status: (input.status as EquipmentStatus) ?? "ACTIVE",
      condition: (input.condition as EquipmentCondition) ?? "GOOD",
      criticality: (input.criticality as EquipmentCriticality) ?? "CONVENIENCE",
      purchaseDate: input.purchaseDate ?? null,
      purchasePrice: input.purchasePrice ?? null,
      currentValue: input.currentValue ?? null,
      replacementCost: input.replacementCost ?? null,
      warrantyUntil: input.warrantyUntil ?? null,
      serialNumber: input.serialNumber?.trim() || null,
      notes: input.notes?.trim() || null,
      updatedAt: new Date(),
    })
    .where(eq(equipmentAssets.id, id));

  revalidatePath("/equipment");
  revalidatePath("/equipment/assets");
  revalidatePath(`/equipment/assets/${id}`);
  return { success: true };
}

export async function createEquipmentSystem(
  input: EquipmentSystemInput,
): Promise<EquipmentActionResultWithId> {
  const validationError = validateEquipmentSystemInput(input);
  if (validationError) return { success: false, error: validationError };

  const db = await getAuthenticatedDb();
  const [inserted] = await db
    .insert(equipmentSystems)
    .values({
      name: input.name.trim(),
      ownership: input.ownership as EquipmentOwnership,
      description: input.description?.trim() || null,
      status: (input.status as EquipmentSystemStatus) ?? "ACTIVE",
      location: input.location?.trim() || null,
    })
    .returning({ id: equipmentSystems.id });

  revalidatePath("/equipment");
  revalidatePath("/equipment/systems");
  return { success: true, id: inserted.id };
}

export async function updateEquipmentSystem(
  id: number,
  input: EquipmentSystemInput,
): Promise<EquipmentActionResult> {
  const validationError = validateEquipmentSystemInput(input);
  if (validationError) return { success: false, error: validationError };

  const db = await getAuthenticatedDb();
  await db
    .update(equipmentSystems)
    .set({
      name: input.name.trim(),
      ownership: input.ownership as EquipmentOwnership,
      description: input.description?.trim() || null,
      status: (input.status as EquipmentSystemStatus) ?? "ACTIVE",
      location: input.location?.trim() || null,
      updatedAt: new Date(),
    })
    .where(eq(equipmentSystems.id, id));

  revalidatePath("/equipment");
  revalidatePath("/equipment/systems");
  revalidatePath(`/equipment/systems/${id}`);
  return { success: true };
}

// ─── Wave 2: Maintenance ───────────────────────────────────────────────

export async function createEquipmentMaintenanceEvent(
  input: EquipmentMaintenanceInput,
): Promise<EquipmentActionResultWithId> {
  const validationError = validateEquipmentMaintenanceInput(input);
  if (validationError) return { success: false, error: validationError };

  const db = await getAuthenticatedDb();
  const [inserted] = await db
    .insert(equipmentMaintenanceEvents)
    .values({
      assetId: input.assetId,
      type: input.type as EquipmentMaintenanceType,
      performedAt: input.performedAt,
      cost: input.cost ?? null,
      issue: input.issue?.trim() || null,
      action: input.action?.trim() || null,
      result: input.result?.trim() || null,
      nextInspection: input.nextInspection ?? null,
      notes: input.notes?.trim() || null,
    })
    .returning({ id: equipmentMaintenanceEvents.id });

  revalidatePath("/equipment");
  revalidatePath(`/equipment/assets/${input.assetId}`);
  return { success: true, id: inserted.id };
}

export async function updateEquipmentMaintenanceEvent(
  id: number,
  input: EquipmentMaintenanceInput,
): Promise<EquipmentActionResult> {
  const validationError = validateEquipmentMaintenanceInput(input);
  if (validationError) return { success: false, error: validationError };

  const db = await getAuthenticatedDb();
  await db
    .update(equipmentMaintenanceEvents)
    .set({
      type: input.type as EquipmentMaintenanceType,
      performedAt: input.performedAt,
      cost: input.cost ?? null,
      issue: input.issue?.trim() || null,
      action: input.action?.trim() || null,
      result: input.result?.trim() || null,
      nextInspection: input.nextInspection ?? null,
      notes: input.notes?.trim() || null,
      updatedAt: new Date(),
    })
    .where(eq(equipmentMaintenanceEvents.id, id));

  revalidatePath("/equipment");
  revalidatePath(`/equipment/assets/${input.assetId}`);
  return { success: true };
}

// Hard delete, same convention as finance's deleteTransaction -- a
// maintenance log has no paired record elsewhere that would be orphaned
// by removing it (unlike Owner Pay's Finance/Personal pairing).
export async function deleteEquipmentMaintenanceEvent(
  id: number,
  assetId: number,
): Promise<EquipmentActionResult> {
  const db = await getAuthenticatedDb();
  await db.delete(equipmentMaintenanceEvents).where(eq(equipmentMaintenanceEvents.id, id));
  revalidatePath("/equipment");
  revalidatePath(`/equipment/assets/${assetId}`);
  return { success: true };
}

// ─── Wave 2: Acquisitions ──────────────────────────────────────────────

export async function getEquipmentAcquisitions(): Promise<EquipmentAcquisitionRow[]> {
  const db = await getAuthenticatedDb();
  const rows = await db.select().from(equipmentAcquisitions);
  return rankAcquisitions(rows);
}

export async function getEquipmentAcquisition(id: number) {
  const db = await getAuthenticatedDb();
  const [acquisition] = await db
    .select()
    .from(equipmentAcquisitions)
    .where(eq(equipmentAcquisitions.id, id))
    .limit(1);
  if (!acquisition) return null;

  const [system, resultingAsset] = await Promise.all([
    acquisition.systemId
      ? db
          .select()
          .from(equipmentSystems)
          .where(eq(equipmentSystems.id, acquisition.systemId))
          .limit(1)
          .then((r) => r[0] ?? null)
      : Promise.resolve(null),
    acquisition.resultingAssetId
      ? db
          .select()
          .from(equipmentAssets)
          .where(eq(equipmentAssets.id, acquisition.resultingAssetId))
          .limit(1)
          .then((r) => r[0] ?? null)
      : Promise.resolve(null),
  ]);

  return { acquisition, system, resultingAsset };
}

export async function createEquipmentAcquisition(
  input: EquipmentAcquisitionInput,
): Promise<EquipmentActionResultWithId> {
  const validationError = validateEquipmentAcquisitionInput(input);
  if (validationError) return { success: false, error: validationError };

  const db = await getAuthenticatedDb();
  const [inserted] = await db
    .insert(equipmentAcquisitions)
    .values({
      name: input.name.trim(),
      stage: (input.stage as EquipmentAcquisitionStage) ?? "IDEA",
      problem: input.problem.trim(),
      expectedImpact: input.expectedImpact?.trim() || null,
      estimatedCost: input.estimatedCost ?? null,
      priority: (input.priority as EquipmentAcquisitionPriority) ?? "MEDIUM",
      requiredBy: input.requiredBy ?? null,
      riskReduction: input.riskReduction?.trim() || null,
      revenueImpact: input.revenueImpact?.trim() || null,
      systemId: input.systemId ?? null,
      domain: (input.domain as EquipmentDomain | null) ?? null,
      notes: input.notes?.trim() || null,
    })
    .returning({ id: equipmentAcquisitions.id });

  revalidatePath("/equipment");
  revalidatePath("/equipment/acquisitions");
  return { success: true, id: inserted.id };
}

export async function updateEquipmentAcquisition(
  id: number,
  input: EquipmentAcquisitionInput,
): Promise<EquipmentActionResult> {
  const validationError = validateEquipmentAcquisitionInput(input);
  if (validationError) return { success: false, error: validationError };

  const db = await getAuthenticatedDb();
  const [existing] = await db
    .select({ stage: equipmentAcquisitions.stage })
    .from(equipmentAcquisitions)
    .where(eq(equipmentAcquisitions.id, id))
    .limit(1);
  if (!existing) return { success: false, error: "Acquisition not found." };

  const nextStage = (input.stage as EquipmentAcquisitionStage) ?? existing.stage;
  if (!isAcquisitionStageTransitionAllowed(existing.stage as EquipmentAcquisitionStage, nextStage)) {
    return {
      success: false,
      error: `${existing.stage} is a final stage and cannot be changed further.`,
    };
  }

  await db
    .update(equipmentAcquisitions)
    .set({
      name: input.name.trim(),
      stage: nextStage,
      problem: input.problem.trim(),
      expectedImpact: input.expectedImpact?.trim() || null,
      estimatedCost: input.estimatedCost ?? null,
      priority: (input.priority as EquipmentAcquisitionPriority) ?? "MEDIUM",
      requiredBy: input.requiredBy ?? null,
      riskReduction: input.riskReduction?.trim() || null,
      revenueImpact: input.revenueImpact?.trim() || null,
      systemId: input.systemId ?? null,
      domain: (input.domain as EquipmentDomain | null) ?? null,
      notes: input.notes?.trim() || null,
      updatedAt: new Date(),
    })
    .where(eq(equipmentAcquisitions.id, id));

  revalidatePath("/equipment");
  revalidatePath("/equipment/acquisitions");
  revalidatePath(`/equipment/acquisitions/${id}`);
  return { success: true };
}

// Explicit operator confirmation only -- reaching DEPLOYED never
// auto-creates an Asset (Wave 2 §5: "DO NOT automatically fabricate an
// Asset"). The caller (AssetFormModal, pre-filled from the acquisition)
// supplies the final, operator-reviewed asset fields; this just performs
// the same create-asset flow as createEquipmentAsset and then records
// provenance back onto the acquisition via resultingAssetId.
export async function createEquipmentAssetFromAcquisition(
  acquisitionId: number,
  input: EquipmentAssetInput,
): Promise<EquipmentActionResultWithId> {
  const result = await createEquipmentAsset(input);
  if (!result.success) return result;

  const db = await getAuthenticatedDb();
  await db
    .update(equipmentAcquisitions)
    .set({ resultingAssetId: result.id, updatedAt: new Date() })
    .where(eq(equipmentAcquisitions.id, acquisitionId));

  revalidatePath("/equipment");
  revalidatePath("/equipment/acquisitions");
  revalidatePath(`/equipment/acquisitions/${acquisitionId}`);
  return result;
}
