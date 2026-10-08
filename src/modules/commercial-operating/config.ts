export const COMMERCIAL_CAPACITY_STATES = ["OPEN", "LIMITED", "WAITLIST", "PAUSED"] as const;
export type CommercialCapacityState = (typeof COMMERCIAL_CAPACITY_STATES)[number];

export const COMMERCIAL_OFFER_DECISION_EVENT = "commercial.offer_confirmed";
export const COMMERCIAL_CAPACITY_EVENT = "commercial.capacity_changed";
