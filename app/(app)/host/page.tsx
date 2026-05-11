import { requireRole } from "@/lib/auth";
import { getOrCreateRestaurant, listHostFloorState } from "@/lib/queue/service";
import { HostClient } from "./host-client";
import { Card } from "@/components/ui/card";

export const dynamic = "force-dynamic";

export default async function HostPage() {
  await requireRole(["waiter", "admin"]);
  try {
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
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown server error";
    console.error("Host page load failed:", error);

    return (
      <div className="mx-auto max-w-3xl p-6">
        <Card className="border-red-200 bg-red-50 p-4 text-red-800">
          <h1 className="text-base font-semibold">Gagal memuat halaman host</h1>
          <p className="mt-2 text-sm">
            Server error terdeteksi saat mengambil data queue. Detail:
          </p>
          <pre className="mt-3 whitespace-pre-wrap rounded bg-white/70 p-3 text-xs">
            {message}
          </pre>
        </Card>
      </div>
    );
  }
}
