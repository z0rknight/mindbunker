import type { SQL } from "drizzle-orm";
import { videoLogs } from "@/db/schema";
import { resolveVideoKindForClient } from "@/lib/client-identity";
import { todayISO } from "@/utils/date";
import {
  validateVideoCreateInput,
  type ValidatedVideoMetadata,
} from "./core";
import { deliveredForVideoStatus, type VideoStatus } from "./config";

export type CreateVideoLogsBulkRow = {
  title: string;
  date?: string | null;
  status?: string | null;
  deliveryUrl?: string | null;
  reviewUrl?: string | null;
  publishedUrl?: string | null;
};

type PreparedVideoLogInsert = Omit<
  typeof videoLogs.$inferInsert,
  "productionOrderId"
> & {
  productionOrderId?: number | null | SQL;
};

type ResolvedVideoOwner = {
  clientId: number | null;
  clientName: string | null;
};

export function prepareVideoLogInsert(input: {
  row: ValidatedVideoMetadata & { status: VideoStatus };
  owner: ResolvedVideoOwner;
  requestedVideoKind?: typeof videoLogs.$inferInsert.videoKind | null;
  batchLabel?: string | null;
  productionOrderId?: number | null | SQL;
  now: Date;
}): PreparedVideoLogInsert {
  const cleanBatchLabel =
    typeof input.batchLabel === "string"
      ? input.batchLabel.trim().slice(0, 160) || null
      : null;

  return {
    date: input.row.date ?? todayISO(),
    title: input.row.title,
    clientId: input.owner.clientId,
    projectId: input.row.projectId,
    status: input.row.status,
    startedAt: null,
    revisionsCount: 0,
    delivered: deliveredForVideoStatus(input.row.status),
    deliveryUrl: input.row.deliveryUrl,
    reviewUrl: input.row.reviewUrl,
    publishedUrl: input.row.publishedUrl,
    notes: input.row.notes,
    coverUrl: input.row.coverUrl,
    orientation: input.row.orientation,
    contentType: input.row.contentType,
    videoKind: resolveVideoKindForClient(
      input.owner.clientName,
      input.requestedVideoKind,
    ),
    batchLabel: cleanBatchLabel,
    isOperationalContainer: false,
    productionOrderId: input.productionOrderId ?? null,
    createdAt: input.now,
    updatedAt: input.now,
    visibleToClient: true,
  };
}

export function prepareVideoLogInserts(input: {
  projectId: number;
  rows: CreateVideoLogsBulkRow[];
  owner: ResolvedVideoOwner;
  batchLabel?: string | null;
  productionOrderId?: number | null | SQL;
  now: Date;
}) {
  const prepared: PreparedVideoLogInsert[] = [];

  for (let index = 0; index < input.rows.length; index++) {
    const row = input.rows[index];
    const parsed = validateVideoCreateInput({
      title: row.title,
      projectId: input.projectId,
      clientId: null,
      date: row.date ?? null,
      deliveryUrl: row.deliveryUrl ?? null,
      reviewUrl: row.reviewUrl ?? null,
      publishedUrl: row.publishedUrl ?? null,
      status: (row.status ?? "PLANNED") as VideoStatus,
      allowExplicitStatus: true,
    });
    if (!parsed.success) {
      return { success: false as const, error: `Row ${index + 1}: ${parsed.error}` };
    }
    prepared.push(
      prepareVideoLogInsert({
        row: parsed.data,
        owner: input.owner,
        batchLabel: input.batchLabel,
        productionOrderId: input.productionOrderId,
        now: input.now,
      }),
    );
  }

  return { success: true as const, data: prepared };
}
