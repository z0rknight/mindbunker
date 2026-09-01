// Wave 2E: Next Action / Waiting On. Deliberately not a task manager.
export const WAITING_ON_VALUES = [
  "ME", "CLIENT", "FILES", "UPLOAD", "INGEST", "RENDER", "PAYMENT", "APPROVAL", "EXTERNAL", "NONE",
] as const;
export type WaitingOn = (typeof WAITING_ON_VALUES)[number];

export function isWaitingOn(v: unknown): v is WaitingOn {
  return typeof v === "string" && (WAITING_ON_VALUES as readonly string[]).includes(v);
}
