// Presentation-only slot map for the restaurant floor. No coordinates
// here are ever persisted -- clients are assigned to slots fresh on every
// render, deterministically, based on the order selectRestaurantClients
// already produced (current work first, then recency, then a stable
// name/id tiebreak).

export type TableSlot = {
  id: string;
  xPct: number;
  yPct: number;
  side: "left" | "right";
};

// Left/right columns leave the center floor open and the top ~22% clear
// for the comanda rail + editor station, per the mission's room layout.
// xPct stays >=16 / <=84 on every slot -- at the narrowest supported
// stage width (~340px in the mobile single-column layout) that keeps a
// ~110px-wide table card from clipping against the stage's own
// overflow:hidden edge.
export const TABLE_SLOTS: TableSlot[] = [
  { id: "left-1", xPct: 18, yPct: 36, side: "left" },
  { id: "right-1", xPct: 82, yPct: 36, side: "right" },
  { id: "left-2", xPct: 16, yPct: 60, side: "left" },
  { id: "right-2", xPct: 84, yPct: 60, side: "right" },
  { id: "left-3", xPct: 22, yPct: 84, side: "left" },
  { id: "right-3", xPct: 78, yPct: 84, side: "right" },
  { id: "left-4", xPct: 18, yPct: 96, side: "left" },
  { id: "right-4", xPct: 82, yPct: 96, side: "right" },
];

export function assignTableSlots<T>(clients: readonly T[]): Array<{ slot: TableSlot; client: T }> {
  return clients.slice(0, TABLE_SLOTS.length).map((client, index) => ({
    slot: TABLE_SLOTS[index],
    client,
  }));
}
