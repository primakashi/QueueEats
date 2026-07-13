import Link from "next/link";
import { ArrowLeft, Plus } from "lucide-react";
import { createAdminClient } from "@/lib/supabase/admin";
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
import { SubscriptionEditor } from "../subscription-editor";

export default async function SuperAdminRestaurantsPage() {
  const adminClient = createAdminClient();

  const { data: restaurants } = await adminClient
    .from("restaurants")
    .select("*")
    .eq("is_active", true)
    .order("created_at", { ascending: false });

  const ids = (restaurants ?? []).map((r) => r.id as string);

  const [{ data: owners }, { data: outletCounts }] = await Promise.all(
    ids.length
      ? [
          adminClient
            .from("profiles")
            .select("id, restaurant_id, full_name, created_at")
            .in("restaurant_id", ids)
            .eq("role", "owner"),
          adminClient
            .from("outlets")
            .select("restaurant_id")
            .in("restaurant_id", ids)
            .eq("is_archived", false),
        ]
      : [{ data: [] }, { data: [] }],
  );

  const ownerIds = (owners ?? []).map((o) => o.id as string);
  const emailByUserId = new Map<string, string>();
  if (ownerIds.length) {
    const { data: usersPage } = await adminClient.auth.admin.listUsers({ perPage: 1000 });
    for (const u of usersPage?.users ?? []) {
      if (ownerIds.includes(u.id) && u.email) {
        emailByUserId.set(u.id, u.email);
      }
    }
  }

  type OwnerInfo = { name: string; email: string };
  const ownerByRestaurant = new Map<string, OwnerInfo>();
  for (const o of owners ?? []) {
    ownerByRestaurant.set(o.restaurant_id as string, {
      name: o.full_name as string,
      email: emailByUserId.get(o.id as string) ?? "—",
    });
  }

  const outletCountByRestaurant = new Map<string, number>();
  for (const o of outletCounts ?? []) {
    const rid = o.restaurant_id as string;
    outletCountByRestaurant.set(rid, (outletCountByRestaurant.get(rid) ?? 0) + 1);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" render={<Link href="/superadmin/analytics" />}>
            <ArrowLeft className="h-4 w-4 mr-1" />
            Analitik
          </Button>
          <div>
            <h1 className="text-xl font-semibold">Kelola Restoran</h1>
            <p className="text-sm text-muted-foreground">Daftar semua restoran aktif di platform</p>
          </div>
        </div>
        <Button render={<Link href="/superadmin/onboard" />}>
          <Plus className="h-4 w-4 mr-2" />
          Onboard Restoran
        </Button>
      </div>

      {(restaurants ?? []).length === 0 ? (
        <div className="p-12 text-center text-sm text-muted-foreground border rounded-xl bg-background">
          Belum ada restoran. Klik &quot;Onboard Restoran&quot; untuk memulai.
        </div>
      ) : (
        <div className="rounded-xl border bg-background overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nama Restoran</TableHead>
                <TableHead>Owner</TableHead>
                <TableHead className="hidden md:table-cell">Email Owner</TableHead>
                <TableHead className="text-center">Outlet</TableHead>
                <TableHead>Langganan</TableHead>
                <TableHead className="hidden sm:table-cell">Bergabung</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(restaurants ?? []).map((r) => (
                <TableRow key={r.id as string}>
                  <TableCell className="font-medium">{r.name as string}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {ownerByRestaurant.get(r.id as string)?.name ?? "—"}
                  </TableCell>
                  <TableCell className="hidden md:table-cell text-sm text-muted-foreground">
                    {ownerByRestaurant.get(r.id as string)?.email ?? "—"}
                  </TableCell>
                  <TableCell className="text-center tabular-nums">
                    {outletCountByRestaurant.get(r.id as string) ?? 0}
                  </TableCell>
                  <TableCell>
                    <SubscriptionEditor
                      restaurantId={r.id as string}
                      endDate={(r.subscription_end_date as string | null) ?? null}
                      notes={(r.subscription_notes as string | null) ?? null}
                    />
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
