import Link from "next/link";
import { ArrowLeft } from "lucide-react";
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
import { formatIDR } from "@/lib/format";
import { RefreshButton } from "./refresh-button";

export const dynamic = "force-dynamic";

type ViewMode = "24h_15min" | "7d_hourly" | "30d_daily" | "90d_daily";

type Props = {
  searchParams: Promise<{ mode?: string }>;
};

const VIEW_MODES: { key: ViewMode; label: string; hint: string }[] = [
  { key: "24h_15min", label: "24 jam", hint: "per 15 menit" },
  { key: "7d_hourly", label: "7 hari", hint: "per jam" },
  { key: "30d_daily", label: "30 hari", hint: "per hari" },
  { key: "90d_daily", label: "90 hari", hint: "per hari" },
];

const HEATMAP_LEVELS = [
  "bg-muted",
  "bg-primary/20",
  "bg-primary/40",
  "bg-primary/60",
  "bg-primary/85",
];

type Granularity = "15min" | "hour" | "day";

function modeConfig(mode: ViewMode): {
  granularity: Granularity;
  bucketMs: number;
  bucketCount: number;
  cellPx: number;
} {
  switch (mode) {
    case "24h_15min":
      return { granularity: "15min", bucketMs: 15 * 60 * 1000, bucketCount: 96, cellPx: 8 };
    case "7d_hourly":
      return { granularity: "hour", bucketMs: 60 * 60 * 1000, bucketCount: 168, cellPx: 6 };
    case "30d_daily":
      return { granularity: "day", bucketMs: 24 * 60 * 60 * 1000, bucketCount: 30, cellPx: 16 };
    case "90d_daily":
      return { granularity: "day", bucketMs: 24 * 60 * 60 * 1000, bucketCount: 90, cellPx: 10 };
  }
}

function bucketStart(iso: string, granularity: Granularity): number {
  const d = new Date(iso);
  if (granularity === "day") {
    d.setHours(0, 0, 0, 0);
  } else if (granularity === "hour") {
    d.setMinutes(0, 0, 0);
  } else {
    d.setSeconds(0, 0);
    d.setMinutes(Math.floor(d.getMinutes() / 15) * 15);
  }
  return d.getTime();
}

function buildBucketAxis(mode: ViewMode): number[] {
  const { bucketMs, bucketCount, granularity } = modeConfig(mode);
  const nowBucket = bucketStart(new Date().toISOString(), granularity);
  const axis: number[] = [];
  for (let i = bucketCount - 1; i >= 0; i--) {
    axis.push(nowBucket - i * bucketMs);
  }
  return axis;
}

function heatmapClass(count: number, max: number): string {
  if (count === 0 || max === 0) return HEATMAP_LEVELS[0];
  const ratio = count / max;
  if (ratio > 0.75) return HEATMAP_LEVELS[4];
  if (ratio > 0.5) return HEATMAP_LEVELS[3];
  if (ratio > 0.25) return HEATMAP_LEVELS[2];
  return HEATMAP_LEVELS[1];
}

function formatBucketLabel(ts: number, granularity: Granularity): string {
  const d = new Date(ts);
  if (granularity === "day") {
    return d.toLocaleDateString("id-ID", { day: "2-digit", month: "short" });
  }
  if (granularity === "hour") {
    return d.toLocaleString("id-ID", {
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  }
  return d.toLocaleString("id-ID", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default async function SuperAdminAnalyticsPage({ searchParams }: Props) {
  const { mode: modeParam } = await searchParams;
  const mode: ViewMode = (VIEW_MODES.find((m) => m.key === modeParam)?.key ??
    "30d_daily") as ViewMode;
  const { granularity, bucketMs, bucketCount, cellPx } = modeConfig(mode);

  const adminClient = createAdminClient();

  const cutoffMs = Date.now() - bucketCount * bucketMs;
  const cutoffISO = new Date(cutoffMs).toISOString();

  const [{ data: restaurants }, { data: orders }] = await Promise.all([
    adminClient.from("restaurants").select("id, name, created_at"),
    adminClient
      .from("orders")
      .select("restaurant_id, total, status, payment_status, created_at, created_by")
      .gte("created_at", cutoffISO)
      .neq("status", "cancelled"),
  ]);

  type Bucket = {
    id: string;
    name: string;
    orderCount: number;
    paidRevenue: number;
    paidOrders: number;
    perBucket: Map<number, number>;
  };

  const byRestaurant = new Map<string, Bucket>();
  for (const r of restaurants ?? []) {
    byRestaurant.set(r.id as string, {
      id: r.id as string,
      name: r.name as string,
      orderCount: 0,
      paidRevenue: 0,
      paidOrders: 0,
      perBucket: new Map(),
    });
  }

  const userCounts = new Map<string, number>();

  for (const o of orders ?? []) {
    const rid = o.restaurant_id as string | null;
    if (!rid) continue;
    const bucket = byRestaurant.get(rid);
    if (!bucket) continue;
    bucket.orderCount += 1;

    const bucketKey = bucketStart(o.created_at as string, granularity);
    bucket.perBucket.set(bucketKey, (bucket.perBucket.get(bucketKey) ?? 0) + 1);

    if (o.payment_status === "paid") {
      bucket.paidOrders += 1;
      bucket.paidRevenue += (o.total as number) ?? 0;
    }

    const uid = o.created_by as string | null;
    if (uid) userCounts.set(uid, (userCounts.get(uid) ?? 0) + 1);
  }

  const rows = Array.from(byRestaurant.values()).sort(
    (a, b) => b.paidRevenue - a.paidRevenue,
  );

  const totalOrders = rows.reduce((s, r) => s + r.orderCount, 0);
  const totalRevenue = rows.reduce((s, r) => s + r.paidRevenue, 0);
  const activeClients = rows.filter((r) => r.orderCount > 0).length;

  const bucketAxis = buildBucketAxis(mode);
  const heatmapRows = rows.filter((r) => r.orderCount > 0);
  let maxCellCount = 0;
  for (const r of heatmapRows) {
    for (const v of r.perBucket.values()) {
      if (v > maxCellCount) maxCellCount = v;
    }
  }

  const topUserIds = Array.from(userCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([id]) => id);

  let topUsers: Array<{
    id: string;
    name: string;
    email: string;
    restaurantName: string;
    count: number;
  }> = [];
  if (topUserIds.length) {
    const { data: profs } = await adminClient
      .from("profiles")
      .select("id, full_name, restaurant_id")
      .in("id", topUserIds);

    const restaurantNameById = new Map<string, string>();
    for (const r of restaurants ?? []) {
      restaurantNameById.set(r.id as string, r.name as string);
    }

    const emailById = new Map<string, string>();
    const { data: usersPage } = await adminClient.auth.admin.listUsers({ perPage: 1000 });
    for (const u of usersPage?.users ?? []) {
      if (u.email) emailById.set(u.id, u.email);
    }

    const profById = new Map<string, { full_name: string; restaurant_id: string | null }>();
    for (const p of profs ?? []) {
      profById.set(p.id as string, {
        full_name: p.full_name as string,
        restaurant_id: (p.restaurant_id as string | null) ?? null,
      });
    }

    topUsers = topUserIds.map((id) => {
      const p = profById.get(id);
      return {
        id,
        name: p?.full_name ?? "—",
        email: emailById.get(id) ?? "—",
        restaurantName: p?.restaurant_id
          ? restaurantNameById.get(p.restaurant_id) ?? "—"
          : "—",
        count: userCounts.get(id) ?? 0,
      };
    });
  }

  const activeMode = VIEW_MODES.find((m) => m.key === mode)!;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" render={<Link href="/superadmin" />}>
            <ArrowLeft className="h-4 w-4 mr-1" />
            Kembali
          </Button>
          <div>
            <h1 className="text-xl font-semibold">Analitik Klien</h1>
            <p className="text-sm text-muted-foreground">
              {activeMode.label} terakhir · {activeMode.hint}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex gap-1 rounded-lg border bg-background p-1">
            {VIEW_MODES.map((m) => (
              <Link
                key={m.key}
                href={`/superadmin/analytics?mode=${m.key}`}
                className={`px-3 py-1.5 text-xs rounded-md transition-colors leading-tight ${
                  m.key === mode
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-muted"
                }`}
              >
                <div className="font-medium">{m.label}</div>
                <div className="text-[10px] opacity-80">{m.hint}</div>
              </Link>
            ))}
          </div>
          <RefreshButton />
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <SummaryCard label="Klien aktif" value={`${activeClients} / ${rows.length}`} />
        <SummaryCard label="Total order" value={totalOrders.toLocaleString("id-ID")} />
        <SummaryCard label="Total pendapatan (paid)" value={formatIDR(totalRevenue)} />
      </div>

      <div className="rounded-xl border bg-background overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Restoran</TableHead>
              <TableHead className="text-right">Order</TableHead>
              <TableHead className="text-right">Order dibayar</TableHead>
              <TableHead className="text-right">Pendapatan</TableHead>
              <TableHead className="text-right hidden sm:table-cell">Rata-rata / order</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-sm text-muted-foreground py-8">
                  Belum ada data.
                </TableCell>
              </TableRow>
            ) : (
              rows.map((r) => {
                const avg = r.paidOrders > 0 ? r.paidRevenue / r.paidOrders : 0;
                return (
                  <TableRow key={r.id}>
                    <TableCell className="font-medium">{r.name}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {r.orderCount.toLocaleString("id-ID")}
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-muted-foreground">
                      {r.paidOrders.toLocaleString("id-ID")}
                    </TableCell>
                    <TableCell className="text-right tabular-nums font-medium">
                      {formatIDR(r.paidRevenue)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-muted-foreground hidden sm:table-cell">
                      {avg > 0 ? formatIDR(avg) : "—"}
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      <section className="rounded-xl border bg-background p-4 space-y-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <h2 className="text-sm font-semibold">Heatmap aktivitas klien</h2>
            <p className="text-xs text-muted-foreground">
              Jumlah order {activeMode.hint}, per restoran
            </p>
          </div>
          <HeatmapLegend />
        </div>
        {heatmapRows.length === 0 ? (
          <div className="text-sm text-muted-foreground py-6 text-center">
            Belum ada aktivitas pada rentang ini.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <div className="inline-block min-w-full">
              {heatmapRows.map((r) => (
                <div key={r.id} className="flex items-center gap-2 py-0.5">
                  <div className="w-40 shrink-0 truncate text-xs text-muted-foreground pr-2">
                    {r.name}
                  </div>
                  <div className="flex gap-[1px]">
                    {bucketAxis.map((ts) => {
                      const count = r.perBucket.get(ts) ?? 0;
                      return (
                        <div
                          key={ts}
                          title={`${r.name} · ${formatBucketLabel(ts, granularity)} · ${count} order`}
                          className={`rounded-[2px] ${heatmapClass(count, maxCellCount)}`}
                          style={{ height: cellPx, width: cellPx }}
                        />
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </section>

      <section className="rounded-xl border bg-background overflow-hidden">
        <div className="p-4 border-b">
          <h2 className="text-sm font-semibold">User paling aktif</h2>
          <p className="text-xs text-muted-foreground">
            Top 10 staff berdasarkan jumlah order yang dibuat
          </p>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nama</TableHead>
              <TableHead className="hidden md:table-cell">Email</TableHead>
              <TableHead>Restoran</TableHead>
              <TableHead className="text-right">Order</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {topUsers.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="text-center text-sm text-muted-foreground py-8">
                  Belum ada order dari user.
                </TableCell>
              </TableRow>
            ) : (
              topUsers.map((u) => (
                <TableRow key={u.id}>
                  <TableCell className="font-medium">{u.name}</TableCell>
                  <TableCell className="hidden md:table-cell text-sm text-muted-foreground">
                    {u.email}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {u.restaurantName}
                  </TableCell>
                  <TableCell className="text-right tabular-nums font-medium">
                    {u.count.toLocaleString("id-ID")}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </section>
    </div>
  );
}

function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border bg-background p-4">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-lg font-semibold tabular-nums mt-1">{value}</div>
    </div>
  );
}

function HeatmapLegend() {
  return (
    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
      <span>Sedikit</span>
      {HEATMAP_LEVELS.map((cls, i) => (
        <span key={i} className={`h-3 w-3 rounded-[3px] ${cls}`} />
      ))}
      <span>Banyak</span>
    </div>
  );
}
