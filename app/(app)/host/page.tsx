import { requireVerifiedRole } from "@/lib/auth";
import { getOrCreateRestaurant, listHostFloorState } from "@/lib/queue/service";
import { HostClient } from "./host-client";
import { Card } from "@/components/ui/card";

export const dynamic = "force-dynamic";

export default async function HostPage() {
  const profile = await requireVerifiedRole(["waiter", "cashier", "admin", "branch_manager"]);
  const result = await loadHostData(profile.restaurant_id);

  if (!result.ok) {
    return (
      <div className="mx-auto max-w-3xl p-6">
        <Card className="border-red-200 bg-red-50 p-4 text-red-800">
          <h1 className="text-base font-semibold">Gagal memuat halaman host</h1>
          <p className="mt-2 text-sm">
            Server error terdeteksi saat mengambil data queue. Detail:
          </p>
          <pre className="mt-3 whitespace-pre-wrap rounded bg-white/70 p-3 text-xs">
            {result.message}
          </pre>
        </Card>
      </div>
    );
  }

  return (
    <HostClient
      restaurantName={result.restaurant.name}
      initialEntries={result.list.entries}
      initialTablesNeedingCleanup={result.list.tables_needing_cleanup}
    />
  );
}

async function loadHostData(restaurantId: string | null) {
  try {
    const [restaurant, list] = await Promise.all([
      getOrCreateRestaurant(restaurantId),
      listHostFloorState(restaurantId),
    ]);
    return { ok: true as const, restaurant, list };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown server error";
    console.error("Host page load failed:", error);
    return { ok: false as const, message };
  }
}
