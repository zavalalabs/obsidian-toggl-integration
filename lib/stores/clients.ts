import type { ClientsResponseItem } from "lib/model/Report-v3";
import { get, writable } from "svelte/store";

const clients = writable<ClientsResponseItem[]>([]);

export const setClients = clients.set;

export const Clients = { subscribe: clients.subscribe };

export function getClientIds(item: (string | number)[]): number[] {
  const clients = get(Clients);
  
  // Defensive: if clients not loaded yet, return empty array
  if (!clients || !Array.isArray(clients)) {
    console.warn("[toggl] Clients store is empty/undefined when filtering report");
    return [];
  }

  return item
    .map((item) => {
      if (typeof item === "number") {
        return item;
      }
      const client = clients.find(
        (client) => client.name.toLowerCase() === item.toLowerCase(),
      );
      return client?.id ?? null;
    })
    .filter((id) => id !== null) as number[];
}
