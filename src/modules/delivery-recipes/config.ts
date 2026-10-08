export const DELIVERY_RECIPE_GATES = [
  "STRUCTURE",
  "BUILD",
  "FINISH",
  "QUALITY_REVIEW",
  "REVIEW_DELIVERY",
] as const;

export type DeliveryRecipeGate = (typeof DELIVERY_RECIPE_GATES)[number];

export const DELIVERY_RECIPE_GATE_LABELS: Record<DeliveryRecipeGate, string> = {
  STRUCTURE: "Structure",
  BUILD: "Build",
  FINISH: "Finish",
  QUALITY_REVIEW: "Quality review",
  REVIEW_DELIVERY: "Review / delivery",
};

export const DELIVERY_RECIPE_STEP_STATES = [
  "NOT_STARTED",
  "ACTIVE",
  "DONE",
  "N_A",
] as const;

export type DeliveryRecipeStepState = (typeof DELIVERY_RECIPE_STEP_STATES)[number];

export const DELIVERY_RECIPE_INSTANCE_STATUSES = ["ACTIVE", "COMPLETED", "ARCHIVED"] as const;
export type DeliveryRecipeInstanceStatus = (typeof DELIVERY_RECIPE_INSTANCE_STATUSES)[number];

export const DELIVERY_RECIPE_EVENT_ACTORS = ["admin", "system"] as const;
export type DeliveryRecipeEventActor = (typeof DELIVERY_RECIPE_EVENT_ACTORS)[number];

export const DELIVERY_RECIPE_EVENT_SOURCES = ["MINDBUNKER_WEB", "RMEDIA_APP", "SYSTEM"] as const;
export type DeliveryRecipeEventSource = (typeof DELIVERY_RECIPE_EVENT_SOURCES)[number];
