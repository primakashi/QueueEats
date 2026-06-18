"use client";

import { useState, useTransition } from "react";
import { useRouter, usePathname } from "next/navigation";
import {
  Wallet,
  ScrollText,
  ClipboardList,
  Filter,
  ShoppingBag,
  XCircle,
  ArrowDownLeft,
  ArrowUpRight,
  Boxes,
  ChefHat,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatIDR, formatDateTime } from "@/lib/format";
import { ORDER_STATUS_LABEL, type OrderStatus } from "@/lib/types";
import type {
  AuditLog,
  OperationalEvent,
  OperationalEventKind,
  SessionWithExtras,
} from "./types";

type Tab = "kasir" | "perubahan" | "operasional";

export function LogTabs({
  initialTab,
  sessions,
  auditLogs,
  events,
  days,
  showOutletColumn,
}: {
  initialTab: Tab;
  sessions: SessionWithExtras[];
  auditLogs: AuditLog[];
  events: OperationalEvent[];
  days: number;
  showOutletColumn: boolean;
}) {
  const [tab, setTab] = useState<Tab>(initialTab);
  const router = useRouter();
  const pathname = usePathname();

  function selectTab(next: Tab) {
    setTab(next);
    const params = new URLSearchParams();
    params.set("tab", next);
    if (next === "operasional" && days !== 7) params.set("days", String(days));
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-1 border-b -mx-1 px-1 overflow-x-auto">
        <TabButton active={tab === "kasir"} onClick={() => selectTab("kasir")}>
          <Wallet className="size-4" />
          <span>Log Kasir</span>
          <Count value={sessions.length} active={tab === "kasir"} />
        </TabButton>
        <TabButton active={tab === "perubahan"} onClick={() => selectTab("perubahan")}>
          <ScrollText className="size-4" />
          <span>Log Perubahan</span>
          <Count value={auditLogs.length} active={tab === "perubahan"} />
        </TabButton>
        <TabButton active={tab === "operasional"} onClick={() => selectTab("operasional")}>
          <ClipboardList className="size-4" />
          <span>Log Operasional</span>
          <Count value={events.length} active={tab === "operasional"} />
        </TabButton>
      </div>

      {tab === "kasir" && (
        <KasirTab sessions={sessions} showOutletColumn={showOutletColumn} />
      )}
      {tab === "perubahan" && <PerubahanTab logs={auditLogs} />}
      {tab === "operasional" && <OperasionalTab events={events} days={days} />}
    </div>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        "relative inline-flex items-center gap-2 px-4 py-3 text-sm font-medium transition-colors whitespace-nowrap " +
        (active
          ? "text-foreground border-b-2 border-foreground -mb-px"
          : "text-muted-foreground hover:text-foreground border-b-2 border-transparent -mb-px")
      }
    >
      {children}
    </button>
  );
}

function Count({ value, active }: { value: number; active: boolean }) {
  return (
    <span
      className={
        "ml-1 inline-flex items-center justify-center min-w-5 h-5 rounded-full px-1.5 text-[10px] font-semibold " +
        (active ? "bg-foreground text-background" : "bg-muted text-muted-foreground")
      }
    >
      {value}
    </span>
  );
}

// =============================================================================
// KASIR TAB
// =============================================================================

function KasirTab({
  sessions,
  showOutletColumn,
}: {
  sessions: SessionWithExtras[];
  showOutletColumn: boolean;
}) {
  if (sessions.length === 0) {
    return (
      <Card className="p-12 text-center text-sm text-muted-foreground">
        Belum ada sesi kasir dalam 30 hari terakhir.
      </Card>
    );
  }
  return (
    <Card className="p-0 overflow-hidden">
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Tanggal</TableHead>
              {showOutletColumn && <TableHead>Outlet</TableHead>}
              <TableHead>Operator</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Modal Awal</TableHead>
              <TableHead className="text-right">Kas Masuk</TableHead>
              <TableHead className="text-right">Kas Keluar</TableHead>
              <TableHead className="text-right">Penjualan Tunai</TableHead>
              <TableHead className="text-right">Estimasi Akhir</TableHead>
              <TableHead className="text-right">Aktual Akhir</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sessions.map((r) => {
              const expected = r.opening_cash + r.cash_in - r.cash_out + r.cash_sales;
              const discrepancy = r.actual_closing_cash != null ? r.actual_closing_cash - expected : null;
              return (
                <TableRow key={r.id}>
                  <TableCell className="font-medium tabular-nums whitespace-nowrap">
                    {new Date(r.session_date).toLocaleDateString("id-ID", { dateStyle: "medium" })}
                    <div className="text-xs text-muted-foreground">{formatDateTime(r.opened_at)}</div>
                  </TableCell>
                  {showOutletColumn && (
                    <TableCell className="text-sm">{r.outlet_name ?? "—"}</TableCell>
                  )}
                  <TableCell className="text-sm">
                    <div>{r.opener_name ?? "—"}</div>
                    {r.closer_name && r.closer_name !== r.opener_name && (
                      <div className="text-xs text-muted-foreground">Ditutup: {r.closer_name}</div>
                    )}
                  </TableCell>
                  <TableCell>
                    {r.status === "open" ? (
                      <Badge variant="outline" className="text-emerald-600 border-emerald-300 bg-emerald-50">Aktif</Badge>
                    ) : (
                      <Badge variant="secondary">Ditutup</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right tabular-nums text-sm">{formatIDR(r.opening_cash)}</TableCell>
                  <TableCell className="text-right tabular-nums text-sm text-emerald-700">{formatIDR(r.cash_in)}</TableCell>
                  <TableCell className="text-right tabular-nums text-sm text-rose-700">{formatIDR(r.cash_out)}</TableCell>
                  <TableCell className="text-right tabular-nums text-sm">{formatIDR(r.cash_sales)}</TableCell>
                  <TableCell className="text-right tabular-nums text-sm font-medium">{formatIDR(expected)}</TableCell>
                  <TableCell className="text-right tabular-nums text-sm">
                    {r.actual_closing_cash != null ? (
                      <div>
                        <div>{formatIDR(r.actual_closing_cash)}</div>
                        {discrepancy != null && discrepancy !== 0 && (
                          <div className={`text-xs ${discrepancy < 0 ? "text-rose-600" : "text-emerald-600"}`}>
                            {discrepancy > 0 ? "+" : ""}{formatIDR(discrepancy)}
                          </div>
                        )}
                      </div>
                    ) : "—"}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </Card>
  );
}

// =============================================================================
// PERUBAHAN TAB (audit logs)
// =============================================================================

const TABLE_LABEL: Record<string, string> = {
  menu_items: "Menu",
  menu_categories: "Kategori Menu",
  outlets: "Outlet",
  profiles: "Staf",
  order_channels: "Saluran Pesanan",
  payment_methods: "Metode Pembayaran",
  payment_providers: "Provider Pembayaran",
  restaurants: "Restoran",
  discounts: "Diskon",
};

const ACTION_LABEL: Record<string, string> = {
  create: "Dibuat",
  update: "Diubah",
  delete: "Dihapus",
};

const FIELD_LABEL: Record<string, string> = {
  price: "Harga",
  name: "Nama",
  tax_rate: "Pajak",
  service_charge_rate: "Biaya Layanan",
  service_charge_channels: "Saluran Service Charge",
  round_total: "Pembulatan",
  role: "Peran",
  is_active: "Status aktif",
  kind: "Tipe",
  description: "Deskripsi",
  default_daily_quota: "Kuota harian default",
  value: "Nilai",
  value_type: "Tipe nilai",
  scope: "Cakupan",
};

function formatValue(field: string | null, value: string | null): string {
  if (value === null) return "—";
  if (field === "price" || field === "value") {
    const n = Number(value);
    return Number.isFinite(n)
      ? new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(n)
      : value;
  }
  if (field === "tax_rate" || field === "service_charge_rate") {
    const n = Number(value);
    return Number.isFinite(n) ? `${(n * 100).toFixed(1)}%` : value;
  }
  if (field === "is_active" || field === "round_total") {
    if (value === "true" || value === "t") return "Aktif";
    if (value === "false" || value === "f") return "Nonaktif";
    return value;
  }
  if (field === "service_charge_channels") {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) {
        if (parsed.length === 0) return "Semua saluran";
        return parsed.join(", ");
      }
    } catch {
      // fall through
    }
    return value;
  }
  return value;
}

function actionVariant(action: string): "default" | "secondary" | "destructive" {
  if (action === "create") return "default";
  if (action === "delete") return "destructive";
  return "secondary";
}

function formatLogDate(iso: string): string {
  return new Intl.DateTimeFormat("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Jakarta",
  }).format(new Date(iso));
}

function PerubahanTab({ logs }: { logs: AuditLog[] }) {
  if (logs.length === 0) {
    return (
      <Card className="p-12 text-center text-sm text-muted-foreground">
        Belum ada perubahan yang tercatat.
      </Card>
    );
  }
  return (
    <Card className="p-0 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/50">
              <th className="px-4 py-3 text-left font-medium text-muted-foreground whitespace-nowrap">Waktu</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Oleh</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Tabel</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Entitas</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Aksi</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Field</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Nilai Lama</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Nilai Baru</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {logs.map((row) => {
              const isPriceDecrease =
                row.field_name === "price" &&
                row.old_value !== null &&
                row.new_value !== null &&
                Number(row.new_value) < Number(row.old_value);
              return (
                <tr key={row.id} className={isPriceDecrease ? "bg-red-50 dark:bg-red-950/20" : undefined}>
                  <td className="px-4 py-3 text-muted-foreground whitespace-nowrap text-xs">
                    {formatLogDate(row.created_at)}
                  </td>
                  <td className="px-4 py-3 font-medium whitespace-nowrap">{row.changed_by_name}</td>
                  <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                    {TABLE_LABEL[row.table_name] ?? row.table_name}
                  </td>
                  <td className="px-4 py-3 max-w-[160px] truncate" title={row.entity_name ?? undefined}>
                    {row.entity_name ?? <span className="text-muted-foreground">—</span>}
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant={actionVariant(row.action)} className="text-xs">
                      {ACTION_LABEL[row.action] ?? row.action}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                    {row.field_name ? (FIELD_LABEL[row.field_name] ?? row.field_name) : "—"}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                    {formatValue(row.field_name, row.old_value)}
                  </td>
                  <td className={`px-4 py-3 font-medium whitespace-nowrap ${isPriceDecrease ? "text-red-600 dark:text-red-400" : ""}`}>
                    {formatValue(row.field_name, row.new_value)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

// =============================================================================
// OPERASIONAL TAB (event stream)
// =============================================================================

const KIND_LABEL: Record<OperationalEventKind, string> = {
  order: "Pesanan",
  order_cancel: "Batal",
  session_open: "Buka sesi",
  session_close: "Tutup sesi",
  cash_in: "Kas masuk",
  cash_out: "Kas keluar",
  stock: "Stok",
};

const KIND_GROUPS: Array<{ id: "all" | "orders" | "sessions" | "cash" | "stock"; label: string; kinds: OperationalEventKind[] }> = [
  { id: "all", label: "Semua", kinds: ["order", "order_cancel", "session_open", "session_close", "cash_in", "cash_out", "stock"] },
  { id: "orders", label: "Pesanan", kinds: ["order", "order_cancel"] },
  { id: "sessions", label: "Sesi kasir", kinds: ["session_open", "session_close"] },
  { id: "cash", label: "Kas", kinds: ["cash_in", "cash_out"] },
  { id: "stock", label: "Stok", kinds: ["stock"] },
];

function iconFor(kind: OperationalEventKind) {
  switch (kind) {
    case "order":
      return { icon: ShoppingBag, bg: "bg-emerald-100 text-emerald-700" };
    case "order_cancel":
      return { icon: XCircle, bg: "bg-rose-100 text-rose-700" };
    case "session_open":
      return { icon: Wallet, bg: "bg-sky-100 text-sky-700" };
    case "session_close":
      return { icon: Wallet, bg: "bg-zinc-100 text-zinc-700" };
    case "cash_in":
      return { icon: ArrowDownLeft, bg: "bg-emerald-100 text-emerald-700" };
    case "cash_out":
      return { icon: ArrowUpRight, bg: "bg-amber-100 text-amber-700" };
    case "stock":
      return { icon: Boxes, bg: "bg-violet-100 text-violet-700" };
    default:
      return { icon: ChefHat, bg: "bg-zinc-100 text-zinc-700" };
  }
}

function dayLabel(iso: string): string {
  const d = new Date(iso);
  d.setHours(0, 0, 0, 0);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diff = Math.round((today.getTime() - d.getTime()) / 86400000);
  if (diff === 0) return "Hari ini";
  if (diff === 1) return "Kemarin";
  return d.toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
}

function timeLabel(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, "0")}.${String(d.getMinutes()).padStart(2, "0")}`;
}

function OperasionalTab({
  events,
  days,
}: {
  events: OperationalEvent[];
  days: number;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [, startTransition] = useTransition();
  const [filter, setFilter] = useState<(typeof KIND_GROUPS)[number]["id"]>("all");

  const filtered =
    filter === "all"
      ? events
      : events.filter((e) => {
          const allowed = new Set(KIND_GROUPS.find((g) => g.id === filter)!.kinds);
          return allowed.has(e.kind);
        });

  const grouped: Array<[string, OperationalEvent[]]> = (() => {
    const map = new Map<string, OperationalEvent[]>();
    for (const e of filtered) {
      const day = new Date(e.timestamp);
      day.setHours(0, 0, 0, 0);
      const key = day.toISOString();
      const list = map.get(key) ?? [];
      list.push(e);
      map.set(key, list);
    }
    return [...map.entries()].sort((a, b) => b[0].localeCompare(a[0]));
  })();

  function setDays(next: number) {
    const params = new URLSearchParams();
    params.set("tab", "operasional");
    params.set("days", String(next));
    startTransition(() => {
      router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    });
  }

  return (
    <div className="space-y-4">
      <Card className="p-4 flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2 mr-auto flex-wrap">
          <Filter className="size-4 text-muted-foreground" />
          {KIND_GROUPS.map((g) => (
            <button
              key={g.id}
              type="button"
              onClick={() => setFilter(g.id)}
              className={`text-xs rounded-md px-3 py-1.5 border transition-colors ${
                filter === g.id
                  ? "bg-zinc-900 text-white border-zinc-900"
                  : "bg-background hover:bg-muted border-border"
              }`}
            >
              {g.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-1">
          <span className="text-xs text-muted-foreground mr-1">Periode:</span>
          {[1, 7, 30].map((n) => (
            <Button
              key={n}
              size="sm"
              variant={days === n ? "default" : "outline"}
              onClick={() => setDays(n)}
            >
              {n === 1 ? "Hari ini" : `${n} hari`}
            </Button>
          ))}
        </div>
      </Card>

      {grouped.length === 0 ? (
        <Card className="p-12 text-center text-sm text-muted-foreground">
          Belum ada aktivitas pada periode ini.
        </Card>
      ) : (
        <div className="space-y-6">
          {grouped.map(([dayIso, list]) => (
            <div key={dayIso}>
              <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                {dayLabel(dayIso)}
                <span className="ml-2 font-normal normal-case text-muted-foreground/70 tracking-normal">
                  · {list.length} kejadian
                </span>
              </div>
              <Card className="divide-y p-0 gap-0">
                {list.map((e) => {
                  const { icon: Icon, bg } = iconFor(e.kind);
                  return (
                    <div key={e.id} className="flex items-start gap-3 px-4 py-3">
                      <div className={`size-9 rounded-md grid place-items-center shrink-0 ${bg}`}>
                        <Icon className="size-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-medium">{e.title}</span>
                          <Badge variant="outline" className="text-[10px] uppercase tracking-wider">
                            {KIND_LABEL[e.kind]}
                          </Badge>
                          {e.kind === "order" && e.status && (
                            <Badge variant="secondary" className="text-[10px]">
                              {ORDER_STATUS_LABEL[e.status as OrderStatus] ?? e.status}
                            </Badge>
                          )}
                          {e.channel && (
                            <Badge variant="outline" className="text-[10px]">
                              {e.channel}
                            </Badge>
                          )}
                          {e.category_label && (
                            <Badge variant="outline" className="text-[10px]">
                              {e.category_label}
                            </Badge>
                          )}
                        </div>
                        {e.subtitle && (
                          <div className="text-xs text-muted-foreground mt-0.5">{e.subtitle}</div>
                        )}
                        <div className="text-[11px] text-muted-foreground mt-1 flex items-center gap-2 flex-wrap">
                          {e.actor_name && (
                            <span>
                              oleh <span className="font-medium text-foreground/80">{e.actor_name}</span>
                            </span>
                          )}
                          {e.outlet_name && <span>· {e.outlet_name}</span>}
                        </div>
                      </div>
                      <div className="flex flex-col items-end shrink-0 gap-0.5">
                        {e.amount != null && (
                          <div className="text-xs font-semibold tabular-nums">
                            Rp {e.amount.toLocaleString("id-ID")}
                          </div>
                        )}
                        <div className="text-xs text-muted-foreground tabular-nums">
                          {timeLabel(e.timestamp)}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </Card>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
