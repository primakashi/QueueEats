"use client";

import { useState, useTransition, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ChevronDown,
  LayoutGrid,
  List,
  Loader2,
  Plus,
  Printer,
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
  type OrderChannelKind,
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

const PRINTED_KEY = "waiter-printed-orders";

function loadPrintedSet(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = localStorage.getItem(PRINTED_KEY);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? new Set(parsed) : new Set();
  } catch {
    return new Set();
  }
}

function markPrinted(orderId: string) {
  if (typeof window === "undefined") return;
  try {
    const set = loadPrintedSet();
    set.add(orderId);
    const arr = [...set].slice(-500);
    localStorage.setItem(PRINTED_KEY, JSON.stringify(arr));
  } catch {
    /* ignore */
  }
}

function usePrintTicket(orderId: string) {
  const [printed, setPrinted] = useState(false);
  useEffect(() => {
    setPrinted(loadPrintedSet().has(orderId));
  }, [orderId]);
  function print() {
    const url = `/kitchen/${orderId}/print${printed ? "?reprint=1" : ""}`;
    window.open(url, "_blank", "width=420,height=700,toolbar=0,menubar=0");
    markPrinted(orderId);
    setPrinted(true);
  }
  return { printed, print };
}

// Extra shortcut shown when order is pending — lets waiter skip kitchen
const SKIP_KITCHEN: { next: OrderStatus; label: string } = {
  next: "ready",
  label: "Langsung siap",
};

type ServiceFilter = "all" | "dine_in" | "takeaway";
type PaymentFilter = "all" | "unpaid" | "paid";

export function WaiterBoard({
  initialOrders,
  channelKindByName,
}: {
  initialOrders: OrderWithItems[];
  channelKindByName: Record<string, OrderChannelKind>;
}) {
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
              channelKindByName={channelKindByName}
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
              channelKindByName={channelKindByName}
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
  channelKindByName,
}: {
  order: OrderWithItems;
  isBusy: boolean;
  isPending: boolean;
  onAdvance: (id: string, next: OrderStatus) => void;
  channelKindByName: Record<string, OrderChannelKind>;
}) {
  const advance = NEXT_STATUS[o.status];
  const { printed, print } = usePrintTicket(o.id);
  const channelKind = o.order_channel
    ? channelKindByName[o.order_channel.toLowerCase()] ?? null
    : null;
  const tipeLabel =
    channelKind === "online" ? "Online" : channelKind === "direct" ? "Langsung" : null;
  const sourceLabel =
    o.order_channel ?? (o.service_type === "takeaway" ? "Takeaway" : "Dine-in");
  const isDineIn = o.service_type !== "takeaway";
  return (
    <Card className={`p-3 gap-0 flex flex-col transition-opacity ${isBusy ? "opacity-60" : ""}`}>
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <div className="text-sm font-semibold tabular-nums">{o.order_number}</div>
            <div className="text-xs text-muted-foreground truncate">
              {formatTime(o.created_at)}
              {o.customer_name ? ` · ${o.customer_name}` : ""}
            </div>
          </div>
          <div className="text-xs text-muted-foreground truncate mt-0.5">
            {tipeLabel ? `${tipeLabel} · ` : ""}
            {sourceLabel}
            {isDineIn && o.table_number ? ` · Meja ${o.table_number}` : ""}
          </div>
        </div>
        <div className="flex flex-col items-end gap-1">
          <div className="flex items-center gap-1">
            <Button
              type="button"
              size="icon"
              variant="ghost"
              className="h-6 w-6"
              onClick={print}
              title={printed ? "Cetak ulang tiket" : "Cetak tiket"}
              aria-label={printed ? "Cetak ulang tiket" : "Cetak tiket"}
            >
              <Printer className={`h-3.5 w-3.5 ${printed ? "text-muted-foreground" : ""}`} />
            </Button>
            <Badge className={`text-xs ${statusColor(o.status)}`}>{ORDER_STATUS_LABEL[o.status]}</Badge>
          </div>
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
              <div className="min-w-0">
                <span className="truncate">{item.name_snapshot}</span>
                {item.notes && (
                  <div className="text-muted-foreground italic truncate">↳ {item.notes}</div>
                )}
              </div>
            </div>
          ))}
          {o.order_items.length > 4 && (
            <div className="text-muted-foreground">
              +{o.order_items.length - 4} item lagi
            </div>
          )}
        </div>
      )}
      {o.notes && (
        <div className="text-xs text-muted-foreground italic border-t pt-1.5 mb-2">
          📝 {o.notes}
        </div>
      )}
      <div className="flex items-center justify-between mt-auto pt-1.5 border-t gap-2">
        <span className="font-semibold tabular-nums text-sm">{formatIDR(o.total)}</span>
        <div className="flex gap-1.5">
          {o.status === "pending" && (
            <Button
              size="sm"
              variant="ghost"
              disabled={isBusy}
              onClick={() => onAdvance(o.id, SKIP_KITCHEN.next)}
              className="h-7 text-xs text-muted-foreground"
            >
              {isBusy ? <Loader2 className="h-3 w-3 animate-spin" /> : SKIP_KITCHEN.label}
            </Button>
          )}
          {advance && (
            <Button
              size="sm"
              variant="outline"
              disabled={isBusy}
              onClick={() => onAdvance(o.id, advance.next)}
              className="h-7 text-xs"
            >
              {isBusy ? <Loader2 className="h-3 w-3 animate-spin" /> : advance.label}
            </Button>
          )}
        </div>
      </div>
    </Card>
  );
}

function OrderRow({
  order: o,
  isBusy,
  isPending,
  onAdvance,
  channelKindByName,
}: {
  order: OrderWithItems;
  isBusy: boolean;
  isPending: boolean;
  onAdvance: (id: string, next: OrderStatus) => void;
  channelKindByName: Record<string, OrderChannelKind>;
}) {
  const advance = NEXT_STATUS[o.status];
  const itemSummary = o.order_items
    .slice(0, 3)
    .map((i) => `${i.quantity}× ${i.name_snapshot}`)
    .join(", ");
  const more = o.order_items.length > 3 ? ` +${o.order_items.length - 3}` : "";
  const hasItemNotes = o.order_items.some((i) => i.notes);
  const { printed, print } = usePrintTicket(o.id);
  const channelKind = o.order_channel
    ? channelKindByName[o.order_channel.toLowerCase()] ?? null
    : null;
  const tipeLabel =
    channelKind === "online" ? "Online" : channelKind === "direct" ? "Langsung" : null;
  const sourceLabel =
    o.order_channel ?? (o.service_type === "takeaway" ? "Takeaway" : "Dine-in");
  const isDineIn = o.service_type !== "takeaway";

  return (
    <Card className={`px-4 py-3 gap-0 transition-opacity ${isBusy ? "opacity-60" : ""}`}>
      <div className="flex items-center gap-3 flex-wrap">
        <Button
          type="button"
          size="icon"
          variant="ghost"
          className="h-6 w-6 shrink-0"
          onClick={print}
          title={printed ? "Cetak ulang tiket" : "Cetak tiket"}
          aria-label={printed ? "Cetak ulang tiket" : "Cetak tiket"}
        >
          <Printer className={`h-3.5 w-3.5 ${printed ? "text-muted-foreground" : ""}`} />
        </Button>
        <div className="font-semibold tabular-nums w-16 shrink-0">{o.order_number}</div>
        <div className="text-xs text-muted-foreground shrink-0">
          {formatTime(o.created_at)}
          {o.customer_name ? ` · ${o.customer_name}` : ""}
          {tipeLabel ? ` · ${tipeLabel}` : ""}
          {` · ${sourceLabel}`}
          {isDineIn && o.table_number ? ` · Meja ${o.table_number}` : ""}
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
          {o.status === "pending" && (
            <Button
              size="sm"
              variant="ghost"
              disabled={isBusy}
              onClick={() => onAdvance(o.id, SKIP_KITCHEN.next)}
              className="h-7 text-xs text-muted-foreground"
            >
              {isBusy ? <Loader2 className="h-3 w-3 animate-spin" /> : SKIP_KITCHEN.label}
            </Button>
          )}
          {advance && (
            <Button
              size="sm"
              variant="outline"
              disabled={isBusy}
              onClick={() => onAdvance(o.id, advance.next)}
              className="h-7 text-xs"
            >
              {isBusy ? <Loader2 className="h-3 w-3 animate-spin" /> : advance.label}
            </Button>
          )}
        </div>
      </div>
      {(o.notes || hasItemNotes) && (
        <div className="mt-1.5 pt-1.5 border-t text-xs text-muted-foreground space-y-0.5">
          {o.notes && <div className="italic">📝 {o.notes}</div>}
          {hasItemNotes && o.order_items.filter((i) => i.notes).map((i) => (
            <div key={i.id} className="italic">↳ {i.quantity}× {i.name_snapshot}: {i.notes}</div>
          ))}
        </div>
      )}
    </Card>
  );
}
