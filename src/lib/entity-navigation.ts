import { videoWorkspaceHref } from "../modules/productivity/core.ts";

export const ENTITY_INSPECTION_QUERY_PARAM = "inspect";

export type InspectableEntityType = "client" | "project" | "video" | "session";

export type InspectableEntity = {
  type: InspectableEntityType;
  id: number;
};

export function isInspectableEntity(value: unknown): value is InspectableEntity {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<InspectableEntity>;
  return (
    (candidate.type === "client" ||
      candidate.type === "project" ||
      candidate.type === "video" ||
      candidate.type === "session") &&
    Number.isSafeInteger(candidate.id) &&
    Number(candidate.id) > 0
  );
}

export function serializeEntityReference(entity: InspectableEntity): string {
  return `${entity.type}:${entity.id}`;
}

export function parseEntityReference(value: string | null | undefined): InspectableEntity | null {
  if (!value) return null;
  const match = /^(client|project|video|session):(\d+)$/u.exec(value);
  if (!match) return null;
  const entity = { type: match[1], id: Number(match[2]) } as InspectableEntity;
  return isInspectableEntity(entity) ? entity : null;
}

/** Deep-management destination. Inspection must never replace these pages. */
export function entityFullPageHref(entity: InspectableEntity, returnTo?: string): string {
  switch (entity.type) {
    case "client":
      return `/crm/${entity.id}`;
    case "project":
      return `/projects/${entity.id}`;
    case "video":
      return videoWorkspaceHref(entity.id, returnTo);
    case "session":
      return `/productivity/sessions?view=table#session-${entity.id}`;
  }
}

/** URL-addressable inspection that preserves the current surface. */
export function entityInspectionHref(
  entity: InspectableEntity,
  returnTo: string = "/",
): string {
  const [pathAndQuery, hash = ""] = returnTo.split("#", 2);
  const [pathname, query = ""] = pathAndQuery.split("?", 2);
  const params = new URLSearchParams(query);
  params.set(ENTITY_INSPECTION_QUERY_PARAM, serializeEntityReference(entity));
  const search = params.toString();
  return `${pathname || "/"}${search ? `?${search}` : ""}${hash ? `#${hash}` : ""}`;
}

/** Recognizes canonical management URLs without accepting arbitrary links. */
export function inspectableEntityFromHref(href: string): InspectableEntity | null {
  const parsed = new URL(href, "https://mindbunker.local");
  const direct = parseEntityReference(parsed.searchParams.get(ENTITY_INSPECTION_QUERY_PARAM));
  if (direct) return direct;

  const crm = /^\/crm\/(\d+)\/?$/u.exec(parsed.pathname);
  if (crm) return { type: "client", id: Number(crm[1]) };
  const project = /^\/projects\/(\d+)\/?$/u.exec(parsed.pathname);
  if (project) return { type: "project", id: Number(project[1]) };
  const videoId = parsed.searchParams.get("video");
  if ((parsed.pathname === "/productivity" || parsed.pathname === "/mindbunker/productivity") && videoId) {
    const entity = { type: "video", id: Number(videoId) } as const;
    return isInspectableEntity(entity) ? entity : null;
  }
  const session = /^session-(\d+)$/u.exec(parsed.hash.slice(1));
  if (session) return { type: "session", id: Number(session[1]) };
  return null;
}
