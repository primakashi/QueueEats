import Link from "next/link";
import { Plus } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatDateTime } from "@/lib/format";

export default async function SuperAdminPage() {
  const supabase = await createClient();

  const { data: restaurants } = await supabase
    .from("restaurants")
    .select("*")
    .order("created_at", { ascending: false });

  // Fetch owner + outlet counts per restaurant
  const ids = (restaurants ?? []).map((r) => r.id as string);

  const [{ data: owners }, { data: outletCounts }] = await Promise.all(
    ids.length
      ? [
          supabase
            .from("profiles")
            .select("restaurant_id, full_name, created_at")
            .in("restaurant_id", ids)
            .eq("role", "owner"),
          supabase
            .from("outlets")
            .select("restaurant_id")
            .in("restaurant_id", ids)
            .eq("is_archived", false),
        ]
      : [{ data: [] }, { data: [] }],
  );

  const ownerByRestaurant = new Map<string, string>();
  for (const o of owners ?? []) {
    ownerByRestaurant.set(o.restaurant_id as string, o.full_name as string);
  }

  const outletCountByRestaurant = new Map<string, number>();
  for (const o of outletCounts ?? []) {
    const rid = o.restaurant_id as string;
    outletCountByRestaurant.set(rid, (outletCountByRestaurant.get(rid) ?? 0) + 1);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Restoran</h1>
          <p className="text-sm text-muted-foreground">Daftar semua restoran yang aktif di platform</p>
        </div>
        <Button render={<Link href="/superadmin/onboard" />}>
          <Plus className="h-4 w-4 mr-2" />
          Onboard Restoran
        </Button>
      </div>

      {(restaurants ?? []).length === 0 ? (
        <div className="p-12 text-center text-sm text-muted-foreground border rounded-xl bg-background">
          Belum ada restoran. Klik "Onboard Restoran" untuk memulai.
        </div>
      ) : (
        <div className="rounded-xl border bg-background overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nama Restoran</TableHead>
                <TableHead>Owner</TableHead>
                <TableHead className="text-center">Outlet</TableHead>
                <TableHead className="hidden sm:table-cell">Bergabung</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(restaurants ?? []).map((r) => (
                <TableRow key={r.id as string}>
                  <TableCell className="font-medium">{r.name as string}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {ownerByRestaurant.get(r.id as string) ?? "—"}
                  </TableCell>
                  <TableCell className="text-center tabular-nums">
                    {outletCountByRestaurant.get(r.id as string) ?? 0}
                  </TableCell>
                  <TableCell className="hidden sm:table-cell text-sm text-muted-foreground">
                    {formatDateTime(r.created_at as string)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
