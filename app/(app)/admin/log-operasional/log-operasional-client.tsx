"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ChefHat,
  Wallet,
  ArrowDownLeft,
  ArrowUpRight,
  ShoppingBag,
  XCircle,
  Boxes,
  Filter,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ORDER_STATUS_LABEL, type OrderStatus } from "@/lib/types";
import type { OperationalEvent, OperationalEventKind } from "./types";

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

export function LogOperasionalClient({
  events,
  days,
}: {
  events: OperationalEvent[];
  days: number;
}) {
  const router = useRouter();
  const [filter, setFilter] = useState<(typeof KIND_GROUPS)[number]["id"]>("all");

  const filtered = useMemo(() => {
    if (filter === "all") return events;
    const allowed = new Set(KIND_GROUPS.find((g) => g.id === filter)!.kinds);
    return events.filter((e) => allowed.has(e.kind));
  }, [events, filter]);

  const grouped = useMemo(() => {
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
  }, [filtered]);

  function setDays(next: number) {
    router.push(`/admin/log-operasional?days=${next}`);
  }

  return (
    <div className="space-y-4">
      <Card className="p-4 flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2 mr-auto">
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
                          {e.outlet_name && (
                            <span>· {e.outlet_name}</span>
                          )}
                        </div>
                      </div>
                      <div className="text-xs text-muted-foreground tabular-nums shrink-0 mt-1">
                        {timeLabel(e.timestamp)}
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
