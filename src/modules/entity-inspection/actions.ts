"use server";

import type { InspectableEntity } from "@/lib/entity-navigation";
import { getEntityInspection } from "./data";

export async function loadEntityInspection(ref: InspectableEntity) {
  try {
    return await getEntityInspection(ref);
  } catch (error) {
    console.error("Entity inspection failed", { ref, error });
    return {
      status: "unavailable" as const,
      ref,
      message: "Inspection data is temporarily unavailable. The current surface is still safe to use.",
    };
  }
}
