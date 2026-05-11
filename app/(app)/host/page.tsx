import { requireRole } from "@/lib/auth";
import { getOrCreateRestaurant, listHostFloorState } from "@/lib/queue/service";
import { HostClient } from "./host-client";

export const dynamic = "force-dynamic";

export default async function HostPage() {
  await requireRole(["waiter", "admin"]);
  const [restaurant, list] = await Promise.all([
    getOrCreateRestaurant(),
    listHostFloorState(),
  ]);

  return (
    <HostClient
      restaurantName={restaurant.name}
      initialEntries={list.entries}
      initialTablesNeedingCleanup={list.tables_needing_cleanup}
    />
  );
}
