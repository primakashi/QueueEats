"use client";

import { useState, useTransition, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ChevronDown,
  LayoutGrid,
  List,
  Plus,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { createRealtimeClient } from "@/lib/supabase/client";
import { formatIDR, formatTime } from "@/lib/format";
import { statusColor, paymentColor } from "@/lib/status";
import {
  ORDER_STATUS_LABEL,
  PAYMENT_STATUS_LABEL,
  type OrderStatus,
  type OrderWithItems,
} from "@/lib/types";
import { updateOrderStatus } from "./waiter-actions";

const STATUS_OPTIONS: { value: OrderStatus; label: string }[] = [
  { value: "pending", label: ORDER_STATUS_LABEL.pending },
  { value: "preparing", label: ORDER_STATUS_LABEL.preparing },
  { value: "ready", label: ORDER_STATUS_LABEL.ready },
  { value: "completed", label: ORDER_STATUS_LABEL.completed },
];

const NEXT_STATUS: Partial<Record<OrderStatus, { next: OrderStatus; label: string }>> = {
  pending: { next: "preparing", label: "Konfirmasi" },
  preparing: { next: "ready", label: "Siap" },
  ready: { next: "completed", label: "Selesai" },
};

type ServiceFilter = "all" | "dine_in" | "takeaway";
type PaymentFilter = "all" | "unpaid" | "paid";

export function WaiterBoard({ initialOrders }: { initialOrders: OrderWithItems[] }) {
  const router = useRouter();
  const [view, setView] = useState<"card" | "list">("card");
  const [statusFilter, setStatusFilter] = useState<Set<OrderStatus>>(new Set());
  const [serviceFilter, setServiceFilter] = useState<ServiceFilter>("all");
  const [paymentFilter, setPaymentFilter] = useState<PaymentFilter>("all");
  const [pending, start] = useTransition();
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    let cleanup: (() => void) | null = null;
    let cancelled = false;
    (async () => {
      const supabase = await createRealtimeClient();
      if (cancelled) return;
      const channel = supabase
        .channel("waiter-orders")
        .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, () => {
          router.refresh();
        })
        .on("postgres_changes", { event: "*", schema: "public", table: "order_items" }, () => {
          router.refresh();
        })
        .subscribe();
      cleanup = () => supabase.removeChannel(channel);
    })();
    return () => {
      cancelled = true;
      cleanup?.();
    };
  }, [router]);

  const filtered = initialOrders.filter((o) => {
    if (statusFilter.size > 0 && !statusFilter.has(o.status)) return false;
    if (serviceFilter !== "all" && o.service_type !== serviceFilter) return false;
    if (paymentFilter === "unpaid" && o.payment_status === "paid") return false;
    if (paymentFilter === "paid" && o.payment_status !== "paid") return false;
    return true;
  });

  function toggleStatus(s: OrderStatus) {
    setStatusFilter((prev) => {
      const next = new Set(prev);
      if (next.has(s)) next.delete(s); else next.add(s);
      return next;
    });
  }

  function advanceStatus(id: string, next: OrderStatus) {
    setBusyId(id);
    start(async () => {
      const res = await updateOrderStatus(id, next);
      if (!res.ok) toast.error(res.error);
      setBusyId(null);
    });
  }

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        <Button render={<Link href="/waiter/new" />} size="sm">
          <Plus className="h-4 w-4 mr-1.5" /> Pesanan baru
        </Button>
        <div className="flex-1" />
        {/* Status filter */}
        <DropdownMenu>
          <DropdownMenuTrigger
            render={<Button variant="outline" size="sm" className="h-9 gap-1.5" />}
          >
            Status
            {statusFilter.size > 0 && (
              <Badge variant="secondary" className="rounded-full px-1.5 text-xs">
                {statusFilter.size}
              </Badge>
            )}
            <ChevronDown className="size-3.5 opacity-60" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="min-w-40">
            {STATUS_OPTIONS.map((s) => (
              <DropdownMenuCheckboxItem
                key={s.value}
                checked={statusFilter.has(s.value)}
                onCheckedChange={() => toggleStatus(s.value)}
                closeOnClick={false}
              >
                {s.label}
              </DropdownMenuCheckboxItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
        {/* Service type filter */}
        <DropdownMenu>
          <DropdownMenuTrigger
            render={<Button variant="outline" size="sm" className="h-9 gap-1.5" />}
          >
            Tipe
            {serviceFilter !== "all" && (
              <Badge variant="secondary" className="rounded-full px-1.5 text-xs">1</Badge>
            )}
            <ChevronDown className="size-3.5 opacity-60" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="min-w-40">
            {(["all", "dine_in", "takeaway"] as const).map((t) => (
              <DropdownMenuCheckboxItem
                key={t}
                checked={serviceFilter === t}
                onCheckedChange={() => setServiceFilter(t)}
                closeOnClick={true}
              >
                {t === "all" ? "Semua" : t === "dine_in" ? "Makan di tempat" : "Bungkus"}
              </DropdownMenuCheckboxItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
        {/* Payment filter */}
        <DropdownMenu>
          <DropdownMenuTrigger
            render={<Button variant="outline" size="sm" className="h-9 gap-1.5" />}
          >
            Bayar
            {paymentFilter !== "all" && (
              <Badge variant="secondary" className="rounded-full px-1.5 text-xs">1</Badge>
            )}
            <ChevronDown className="size-3.5 opacity-60" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="min-w-40">
            {(["all", "unpaid", "paid"] as const).map((t) => (
              <DropdownMenuCheckboxItem
                key={t}
                checked={paymentFilter === t}
                onCheckedChange={() => setPaymentFilter(t)}
                closeOnClick={true}
              >
                {t === "all" ? "Semua" : t === "unpaid" ? "Belum bayar" : "Lunas"}
              </DropdownMenuCheckboxItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
        {/* View toggle */}
        <div className="flex border rounded-md overflow-hidden">
          <button
            type="button"
            onClick={() => setView("card")}
            className={`px-2.5 py-1.5 transition-colors ${view === "card" ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}
            title="Tampilan kartu"
          >
            <LayoutGrid className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => setView("list")}
            className={`px-2.5 py-1.5 transition-colors ${view === "list" ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}
            title="Tampilan daftar"
          >
            <List className="h-4 w-4" />
          </button>
        </div>
      </div>

      {filtered.length === 0 ? (
        <Card className="p-12 text-center text-sm text-muted-foreground">
          {initialOrders.length === 0 ? "Belum ada pesanan hari ini." : "Tidak ada pesanan yang sesuai filter."}
        </Card>
      ) : view === "card" ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((o) => (
            <OrderCard
              key={o.id}
              order={o}
              isBusy={busyId === o.id}
              isPending={pending}
              onAdvance={advanceStatus}
            />
          ))}
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((o) => (
            <OrderRow
              key={o.id}
              order={o}
              isBusy={busyId === o.id}
              isPending={pending}
              onAdvance={advanceStatus}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function OrderCard({
  order: o,
  isBusy,
  isPending,
  onAdvance,
}: {
  order: OrderWithItems;
  isBusy: boolean;
  isPending: boolean;
  onAdvance: (id: string, next: OrderStatus) => void;
}) {
  const advance = NEXT_STATUS[o.status];
  return (
    <Card className="p-3 gap-0 flex flex-col">
      <div className="flex items-start justify-between gap-2 mb-2">
        <div>
          <div className="text-sm font-semibold tabular-nums">{o.order_number}</div>
          <div className="text-xs text-muted-foreground">
            {formatTime(o.created_at)}
            {o.service_type === "takeaway" ? " · Bungkus" : " · Dine-in"}
            {o.table_number ? ` · Meja ${o.table_number}` : ""}
            {o.customer_name ? ` · ${o.customer_name}` : ""}
          </div>
        </div>
        <div className="flex flex-col items-end gap-1">
          <Badge className={`text-xs ${statusColor(o.status)}`}>{ORDER_STATUS_LABEL[o.status]}</Badge>
          <Badge variant="secondary" className={`text-xs ${paymentColor(o.payment_status)}`}>
            {PAYMENT_STATUS_LABEL[o.payment_status]}
          </Badge>
        </div>
      </div>
      {o.order_items.length > 0 && (
        <div className="text-xs space-y-0.5 mb-2 border-t pt-1.5">
          {o.order_items.slice(0, 4).map((item) => (
            <div key={item.id} className="flex gap-1.5">
              <span className="text-muted-foreground tabular-nums shrink-0">{item.quantity}×</span>
              <span className="truncate">{item.name_snapshot}</span>
            </div>
          ))}
          {o.order_items.length > 4 && (
            <div className="text-muted-foreground">
              +{o.order_items.length - 4} item lagi
            </div>
          )}
        </div>
      )}
      <div className="flex items-center justify-between mt-auto pt-1.5 border-t gap-2">
        <span className="font-semibold tabular-nums text-sm">{formatIDR(o.total)}</span>
        {advance && (
          <Button
            size="sm"
            variant="outline"
            disabled={isPending && isBusy}
            aria-busy={isBusy}
            onClick={() => onAdvance(o.id, advance.next)}
            className="h-7 text-xs"
          >
            {advance.label}
          </Button>
        )}
      </div>
    </Card>
  );
}

function OrderRow({
  order: o,
  isBusy,
  isPending,
  onAdvance,
}: {
  order: OrderWithItems;
  isBusy: boolean;
  isPending: boolean;
  onAdvance: (id: string, next: OrderStatus) => void;
}) {
  const advance = NEXT_STATUS[o.status];
  const itemSummary = o.order_items
    .slice(0, 3)
    .map((i) => `${i.quantity}× ${i.name_snapshot}`)
    .join(", ");
  const more = o.order_items.length > 3 ? ` +${o.order_items.length - 3}` : "";

  return (
    <Card className="px-4 py-3 gap-0">
      <div className="flex items-center gap-3 flex-wrap">
        <div className="font-semibold tabular-nums w-16 shrink-0">{o.order_number}</div>
        <div className="text-xs text-muted-foreground shrink-0">
          {formatTime(o.created_at)}
          {o.table_number ? ` · Meja ${o.table_number}` : ""}
          {o.service_type === "takeaway" ? " · Bungkus" : ""}
        </div>
        <div className="flex-1 min-w-0 text-sm text-muted-foreground truncate">
          {itemSummary}{more}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Badge className={statusColor(o.status)} variant="secondary">
            {ORDER_STATUS_LABEL[o.status]}
          </Badge>
          <Badge variant="secondary" className={paymentColor(o.payment_status)}>
            {PAYMENT_STATUS_LABEL[o.payment_status]}
          </Badge>
          <span className="font-semibold tabular-nums text-sm">{formatIDR(o.total)}</span>
          {advance && (
            <Button
              size="sm"
              variant="outline"
              disabled={isPending && isBusy}
              aria-busy={isBusy}
              onClick={() => onAdvance(o.id, advance.next)}
              className="h-7 text-xs"
            >
              {advance.label}
            </Button>
          )}
        </div>
      </div>
    </Card>
  );
}
