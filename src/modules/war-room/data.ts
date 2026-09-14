import "server-only";

import { getAuthenticatedDb } from "@/db";
import { clients } from "@/db/schema";
import type { RestaurantClientCandidateInput } from "./restaurant-core";

// One cheap single-table read, unbounded -- filtering down to the
// restaurant's 6-8 displayed tables happens in the pure
// selectRestaurantClients projection, not here.
export async function getRestaurantClientCandidates(): Promise<RestaurantClientCandidateInput[]> {
  const db = await getAuthenticatedDb();
  return db
    .select({ id: clients.id, name: clients.name, archivalState: clients.archivalState })
    .from(clients);
}
