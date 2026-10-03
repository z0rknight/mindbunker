import { videoWorkspaceHref } from "@/modules/productivity/core";

/**
 * Minimal app-shell inspection contract.
 *
 * A caller names the canonical entity it wants to inspect; this module owns
 * the route projection. The contract is intentionally a URL today, not a
 * drawer implementation. A future shell can keep the same entity reference
 * and change how it opens without teaching execution/CRM/finance modules
 * about presentation details.
 */
export type InspectableEntity =
  | { type: "client"; id: number }
  | { type: "project"; id: number }
  | { type: "video"; id: number }
  | { type: "session"; id: number };

export function entityInspectionHref(
  entity: InspectableEntity,
  returnTo?: string,
): string {
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
