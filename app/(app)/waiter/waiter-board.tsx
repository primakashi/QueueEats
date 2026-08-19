"use client";

import {
  useEffect,
  useMemo,
  useOptimistic,
  useState,
  useTransition,
} from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  Check,
  ChevronDown,
  CircleDollarSign,
  Clock3,
  LayoutGrid,
  List,
  Loader2,
  MoreHorizontal,
  PackageCheck,
  Plus,
  Printer,
  RefreshCw,
  Search,
  ShoppingBag,
  SlidersHorizontal,
  UtensilsCrossed,
  Wifi,
  WifiOff,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
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
  type OrderWorkflowMode,
} from "@/lib/types";
import { updateOrderStatus } from "./waiter-actions";
import { openPrintWindow } from "@/lib/print";

const STATUS_OPTIONS: { value: OrderStatus; label: string }[] = [
  { value: "pending", label: ORDER_STATUS_LABEL.pending },
  { value: "accepted", label: ORDER_STATUS_LABEL.accepted },
  { value: "preparing", label: ORDER_STATUS_LABEL.preparing },
  { value: "ready", label: ORDER_STATUS_LABEL.ready },
  { value: "completed", label: ORDER_STATUS_LABEL.completed },
];

const QUICK_FILTERS = [
  { value: "active", label: "Aktif" },
  { value: "pending", label: "Pesanan baru" },
  { value: "preparing", label: "Di dapur" },
  { value: "ready", label: "Siap" },
  { value: "completed", label: "Selesai" },
] as const;

function nextStatusForWaiter(
  status: OrderStatus,
  workflow: OrderWorkflowMode,
): { next: OrderStatus; label: string } | undefined {
  if (status === "pending") return { next: "accepted", label: "Terima pesanan" };
  if (status === "accepted") {
    return workflow === "no_kitchen"
      ? { next: "ready", label: "Tandai siap" }
      : { next: "preparing", label: "Mulai diproses" };
  }
  if (status === "preparing") return { next: "ready", label: "Tandai siap" };
  if (status === "ready") return { next: "completed", label: "Selesaikan" };
  return undefined;
}

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
  try {
    const set = loadPrintedSet();
    set.add(orderId);
    localStorage.setItem(PRINTED_KEY, JSON.stringify([...set].slice(-500)));
  } catch {
    // Printing still works when storage is unavailable.
  }
}

function usePrintTicket(orderId: string) {
  const [bump, setBump] = useState(0);
  const printed = useMemo(
    () => (typeof window === "undefined" ? false : loadPrintedSet().has(orderId)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [orderId, bump],
  );

  function print() {
    const opened = openPrintWindow(
      `/kitchen/${orderId}/print${printed ? "?reprint=1" : ""}`,
    );
    if (!opened) {
      toast.error(
        "Browser memblokir jendela cetak. Aktifkan popup, lalu coba lagi.",
      );
      return;
    }
    markPrinted(orderId);
    setBump((value) => value + 1);
  }

  return { printed, print };
}

type ServiceFilter = "all" | "dine_in" | "takeaway";
type PaymentFilter = "all" | "unpaid" | "paid";
type ChannelKindFilter = "all" | OrderChannelKind;
type QuickFilter = (typeof QUICK_FILTERS)[number]["value"];
type RealtimeState = "connecting" | "live" | "error";

export function WaiterBoard({
  initialOrders,
  channelKindByName,
  acceptanceByChannelName = {},
  orderWorkflow = "standard",
}: {
  initialOrders: OrderWithItems[];
  channelKindByName: Record<string, OrderChannelKind>;
  acceptanceByChannelName?: Record<string, boolean>;
  orderWorkflow?: OrderWorkflowMode;
}) {
  const router = useRouter();
  const [view, setView] = useState<"card" | "list">("card");
  const [query, setQuery] = useState("");
  const [quickFilter, setQuickFilter] = useState<QuickFilter>("active");
  const [statusFilter, setStatusFilter] = useState<Set<OrderStatus>>(new Set());
  const [serviceFilter, setServiceFilter] = useState<ServiceFilter>("all");
  const [paymentFilter, setPaymentFilter] = useState<PaymentFilter>("all");
  const [channelKindFilter, setChannelKindFilter] = useState<ChannelKindFilter>("all");
  const [channelNameFilter, setChannelNameFilter] = useState("all");
  const [realtimeState, setRealtimeState] = useState<RealtimeState>("connecting");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [, start] = useTransition();
  const [visibleOrders, commitStatus] = useOptimistic(
    initialOrders,
    (orders, action: { id: string; status: OrderStatus }) =>
      orders.map((order) =>
        order.id === action.id ? { ...order, status: action.status } : order,
      ),
  );

  useEffect(() => {
    let cleanup: (() => void) | null = null;
    let cancelled = false;

    (async () => {
      const supabase = await createRealtimeClient();
      if (cancelled) return;
      const channel = supabase
        .channel("waiter-orders")
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "orders" },
          () => router.refresh(),
        )
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "order_items" },
          () => router.refresh(),
        )
        .subscribe((status) => {
          if (status === "SUBSCRIBED") setRealtimeState("live");
          else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
            setRealtimeState("error");
          } else if (status === "CLOSED") {
            setRealtimeState("connecting");
          }
        });
      cleanup = () => supabase.removeChannel(channel);
    })();

    return () => {
      cancelled = true;
      cleanup?.();
    };
  }, [router]);

  const metrics = useMemo(() => {
    const active = visibleOrders.filter(
      (order) => order.status !== "completed" && order.status !== "cancelled",
    );
    const ready = active.filter((order) => order.status === "ready");
    const newOrders = active.filter((order) => order.status === "pending");
    const unpaid = active.filter((order) => order.payment_status !== "paid");
    return {
      active: active.length,
      ready: ready.length,
      newOrders: newOrders.length,
      unpaid: unpaid.length,
      unpaidValue: unpaid.reduce((sum, order) => sum + order.total, 0),
    };
  }, [visibleOrders]);

  const channelNames = useMemo(() => {
    const names = new Set<string>();
    visibleOrders.forEach((order) => {
      if (order.order_channel) names.add(order.order_channel);
    });
    return [...names].sort();
  }, [visibleOrders]);

  const filtered = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return visibleOrders.filter((order) => {
      if (
        quickFilter === "active" &&
        ["completed", "cancelled"].includes(order.status)
      ) return false;
      if (quickFilter !== "active" && order.status !== quickFilter) return false;
      if (statusFilter.size > 0 && !statusFilter.has(order.status)) return false;
      if (serviceFilter !== "all" && order.service_type !== serviceFilter) return false;
      if (paymentFilter === "unpaid" && order.payment_status === "paid") return false;
      if (paymentFilter === "paid" && order.payment_status !== "paid") return false;
      if (channelKindFilter !== "all") {
        const kind = order.order_channel
          ? channelKindByName[order.order_channel.toLowerCase()]
          : null;
        if (kind !== channelKindFilter) return false;
      }
      if (
        channelNameFilter !== "all" &&
        order.order_channel !== channelNameFilter
      ) return false;
      if (normalizedQuery) {
        const haystack = [
          order.order_number,
          order.customer_name,
          order.table_number,
          order.order_channel,
          order.notes,
          ...order.order_items.flatMap((item) => [item.name_snapshot, item.notes]),
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        if (!haystack.includes(normalizedQuery)) return false;
      }
      return true;
    });
  }, [
    channelKindByName,
    channelKindFilter,
    channelNameFilter,
    paymentFilter,
    query,
    quickFilter,
    serviceFilter,
    statusFilter,
    visibleOrders,
  ]);

  const activeFilterCount =
    statusFilter.size +
    Number(serviceFilter !== "all") +
    Number(paymentFilter !== "all") +
    Number(channelKindFilter !== "all") +
    Number(channelNameFilter !== "all");

  function clearFilters() {
    setStatusFilter(new Set());
    setServiceFilter("all");
    setPaymentFilter("all");
    setChannelKindFilter("all");
    setChannelNameFilter("all");
  }

  function advanceStatus(id: string, next: OrderStatus) {
    setBusyId(id);
    start(async () => {
      try {
        const result = await updateOrderStatus(id, next);
        if (!result.ok) toast.error(result.error);
        else {
          commitStatus({ id, status: next });
          toast.success(`Status diperbarui menjadi ${ORDER_STATUS_LABEL[next]}.`);
          router.refresh();
        }
      } catch (error) {
        console.error("[waiter] updateOrderStatus threw", error);
        toast.error("Gagal memperbarui status. Periksa koneksi, lalu coba lagi.");
      } finally {
        setBusyId(null);
      }
    });
  }

  return (
    <div className="space-y-5 pb-24 sm:pb-8">
      <section
        className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4"
        aria-label="Ringkasan pesanan"
      >
        <MetricCard
          icon={ShoppingBag}
          label="Pesanan aktif"
          value={metrics.active}
          detail="Perlu dipantau"
        />
        <MetricCard
          icon={Clock3}
          label="Pesanan baru"
          value={metrics.newOrders}
          detail="Menunggu diterima"
          emphasis={metrics.newOrders > 0}
        />
        <MetricCard
          icon={PackageCheck}
          label="Siap diantar"
          value={metrics.ready}
          detail="Handoff berikutnya"
          emphasis={metrics.ready > 0}
        />
        <MetricCard
          icon={CircleDollarSign}
          label="Belum dibayar"
          value={metrics.unpaid}
          detail={formatIDR(metrics.unpaidValue)}
        />
      </section>

      <section className="rounded-2xl border bg-card shadow-sm">
        <div className="flex flex-col gap-3 border-b p-3 sm:p-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Cari nomor, pelanggan, meja, atau menu…"
                aria-label="Cari pesanan"
                className="h-10 pl-9"
              />
            </div>
            <div className="flex items-center gap-2">
              <FilterMenu
                activeCount={activeFilterCount}
                statusFilter={statusFilter}
                setStatusFilter={setStatusFilter}
                serviceFilter={serviceFilter}
                setServiceFilter={setServiceFilter}
                paymentFilter={paymentFilter}
                setPaymentFilter={setPaymentFilter}
                channelKindFilter={channelKindFilter}
                setChannelKindFilter={setChannelKindFilter}
                channelNameFilter={channelNameFilter}
                setChannelNameFilter={setChannelNameFilter}
                channelNames={channelNames}
                clearFilters={clearFilters}
              />
              <Button
                variant="outline"
                size="lg"
                onClick={() => router.refresh()}
                aria-label="Muat ulang pesanan"
                className="h-10"
              >
                <RefreshCw />
                <span className="hidden sm:inline">Muat ulang</span>
              </Button>
              <div className="flex h-10 items-center rounded-lg border p-1">
                <ViewButton
                  active={view === "card"}
                  label="Kartu"
                  onClick={() => setView("card")}
                >
                  <LayoutGrid />
                </ViewButton>
                <ViewButton
                  active={view === "list"}
                  label="Daftar"
                  onClick={() => setView("list")}
                >
                  <List />
                </ViewButton>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0">
            {QUICK_FILTERS.map((filter) => {
              const count =
                filter.value === "active"
                  ? metrics.active
                  : visibleOrders.filter(
                      (order) => order.status === filter.value,
                    ).length;
              return (
                <button
                  key={filter.value}
                  type="button"
                  onClick={() => setQuickFilter(filter.value)}
                  className={`flex h-9 shrink-0 items-center gap-2 rounded-full px-3 text-sm font-medium transition-colors ${
                    quickFilter === filter.value
                      ? "bg-foreground text-background"
                      : "bg-muted text-muted-foreground hover:text-foreground"
                  }`}
                  aria-pressed={quickFilter === filter.value}
                >
                  {filter.label}
                  <span
                    className={`rounded-full px-1.5 text-xs ${
                      quickFilter === filter.value
                        ? "bg-background/20"
                        : "bg-background"
                    }`}
                  >
                    {count}
                  </span>
                </button>
              );
            })}
            <div className="ml-auto hidden shrink-0 items-center gap-1.5 text-xs text-muted-foreground sm:flex">
              {realtimeState === "live" ? (
                <Wifi className="size-3.5" />
              ) : (
                <WifiOff className="size-3.5" />
              )}
              {realtimeState === "live"
                ? "Live"
                : realtimeState === "error"
                  ? "Koneksi terganggu"
                  : "Menghubungkan…"}
            </div>
          </div>
        </div>

        <div className="p-3 sm:p-4">
          {filtered.length === 0 ? (
            <EmptyOrders
              hasOrders={visibleOrders.length > 0}
              onReset={() => {
                setQuery("");
                setQuickFilter("active");
                clearFilters();
              }}
            />
          ) : view === "card" ? (
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {filtered.map((order) => (
                <OrderCard
                  key={order.id}
                  order={order}
                  busy={busyId === order.id}
                  onAdvance={advanceStatus}
                  channelKindByName={channelKindByName}
                  requiresAcceptance={!!(
                    order.order_channel &&
                    acceptanceByChannelName[order.order_channel.toLowerCase()]
                  )}
                  orderWorkflow={orderWorkflow}
                />
              ))}
            </div>
          ) : (
            <div className="divide-y rounded-xl border">
              {filtered.map((order) => (
                <OrderRow
                  key={order.id}
                  order={order}
                  busy={busyId === order.id}
                  onAdvance={advanceStatus}
                  orderWorkflow={orderWorkflow}
                />
              ))}
            </div>
          )}
        </div>
      </section>

      <Button
        render={<Link href="/waiter/new" />}
        size="lg"
        className="fixed bottom-5 right-4 z-30 h-12 rounded-full px-5 shadow-lg sm:bottom-6 sm:right-6"
      >
        <Plus className="size-5" /> Pesanan baru
      </Button>
    </div>
  );
}

function MetricCard({
  icon: Icon,
  label,
  value,
  detail,
  emphasis = false,
}: {
  icon: typeof ShoppingBag;
  label: string;
  value: number;
  detail: string;
  emphasis?: boolean;
}) {
  return (
    <Card className={`gap-0 p-3.5 ${emphasis ? "ring-2 ring-foreground/20" : ""}`}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-medium text-muted-foreground">{label}</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums tracking-tight">
            {value}
          </p>
        </div>
        <div className="rounded-lg bg-muted p-2">
          <Icon className="size-4" />
        </div>
      </div>
      <p className="mt-1 text-xs text-muted-foreground">{detail}</p>
    </Card>
  );
}

function ViewButton({
  active,
  label,
  onClick,
  children,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={`Tampilan ${label.toLowerCase()}`}
      aria-label={`Tampilan ${label.toLowerCase()}`}
      aria-pressed={active}
      className={`grid size-8 place-items-center rounded-md transition-colors [&_svg]:size-4 ${
        active
          ? "bg-foreground text-background"
          : "text-muted-foreground hover:text-foreground"
      }`}
    >
      {children}
    </button>
  );
}

function FilterMenu({
  activeCount,
  statusFilter,
  setStatusFilter,
  serviceFilter,
  setServiceFilter,
  paymentFilter,
  setPaymentFilter,
  channelKindFilter,
  setChannelKindFilter,
  channelNameFilter,
  setChannelNameFilter,
  channelNames,
  clearFilters,
}: {
  activeCount: number;
  statusFilter: Set<OrderStatus>;
  setStatusFilter: React.Dispatch<React.SetStateAction<Set<OrderStatus>>>;
  serviceFilter: ServiceFilter;
  setServiceFilter: (value: ServiceFilter) => void;
  paymentFilter: PaymentFilter;
  setPaymentFilter: (value: PaymentFilter) => void;
  channelKindFilter: ChannelKindFilter;
  setChannelKindFilter: (value: ChannelKindFilter) => void;
  channelNameFilter: string;
  setChannelNameFilter: (value: string) => void;
  channelNames: string[];
  clearFilters: () => void;
}) {
  function toggleStatus(status: OrderStatus) {
    setStatusFilter((current) => {
      const next = new Set(current);
      if (next.has(status)) next.delete(status);
      else next.add(status);
      return next;
    });
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={<Button variant="outline" size="lg" className="h-10" />}
      >
        <SlidersHorizontal /> Filter
        {activeCount > 0 && (
          <Badge className="ml-1 min-w-5 justify-center rounded-full px-1.5">
            {activeCount}
          </Badge>
        )}
        <ChevronDown className="opacity-60" />
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="max-h-[75vh] w-64 overflow-y-auto"
      >
        <p className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">STATUS</p>
        {STATUS_OPTIONS.map((option) => (
          <DropdownMenuCheckboxItem
            key={option.value}
            checked={statusFilter.has(option.value)}
            onCheckedChange={() => toggleStatus(option.value)}
            closeOnClick={false}
          >
            {option.label}
          </DropdownMenuCheckboxItem>
        ))}
        <DropdownMenuSeparator />
        <p className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">LAYANAN</p>
        {(["all", "dine_in", "takeaway"] as ServiceFilter[]).map((value) => (
          <DropdownMenuCheckboxItem
            key={value}
            checked={serviceFilter === value}
            onCheckedChange={() => setServiceFilter(value)}
          >
            {value === "all"
              ? "Semua layanan"
              : value === "dine_in"
                ? "Makan di tempat"
                : "Bungkus"}
          </DropdownMenuCheckboxItem>
        ))}
        <DropdownMenuSeparator />
        <p className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">PEMBAYARAN</p>
        {(["all", "unpaid", "paid"] as PaymentFilter[]).map((value) => (
          <DropdownMenuCheckboxItem
            key={value}
            checked={paymentFilter === value}
            onCheckedChange={() => setPaymentFilter(value)}
          >
            {value === "all"
              ? "Semua pembayaran"
              : value === "unpaid"
                ? "Belum dibayar"
                : "Lunas"}
          </DropdownMenuCheckboxItem>
        ))}
        <DropdownMenuSeparator />
        <p className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">CHANNEL</p>
        {(["all", "direct", "online", "popup"] as ChannelKindFilter[]).map(
          (value) => (
            <DropdownMenuCheckboxItem
              key={value}
              checked={channelKindFilter === value}
              onCheckedChange={() => {
                setChannelKindFilter(value);
                setChannelNameFilter("all");
              }}
            >
              {value === "all"
                ? "Semua channel"
                : value === "direct"
                  ? "Langsung"
                  : value === "online"
                    ? "Online"
                    : "Pop-up"}
            </DropdownMenuCheckboxItem>
          ),
        )}
        {channelNames.length > 0 && (
          <>
            <DropdownMenuSeparator />
            <p className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">SALURAN</p>
            <DropdownMenuCheckboxItem
              checked={channelNameFilter === "all"}
              onCheckedChange={() => setChannelNameFilter("all")}
            >
              Semua saluran
            </DropdownMenuCheckboxItem>
            {channelNames.map((name) => (
              <DropdownMenuCheckboxItem
                key={name}
                checked={channelNameFilter === name}
                onCheckedChange={() => setChannelNameFilter(name)}
              >
                {name}
              </DropdownMenuCheckboxItem>
            ))}
          </>
        )}
        {activeCount > 0 && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={clearFilters}
              className="justify-center text-muted-foreground"
            >
              Hapus semua filter
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function EmptyOrders({
  hasOrders,
  onReset,
}: {
  hasOrders: boolean;
  onReset: () => void;
}) {
  return (
    <div className="flex min-h-64 flex-col items-center justify-center px-6 text-center">
      <div className="mb-4 rounded-2xl bg-muted p-4">
        <ShoppingBag className="size-7 text-muted-foreground" />
      </div>
      <h2 className="font-semibold">
        {hasOrders ? "Pesanan tidak ditemukan" : "Belum ada pesanan hari ini"}
      </h2>
      <p className="mt-1 max-w-sm text-sm text-muted-foreground">
        {hasOrders
          ? "Coba kata kunci atau kombinasi filter yang berbeda."
          : "Pesanan baru akan langsung muncul di sini dan diteruskan ke alur operasional."}
      </p>
      {hasOrders && (
        <Button variant="outline" className="mt-4" onClick={onReset}>
          Reset tampilan
        </Button>
      )}
    </div>
  );
}

function OrderCard({
  order,
  busy,
  onAdvance,
  channelKindByName,
  requiresAcceptance,
  orderWorkflow,
}: {
  order: OrderWithItems;
  busy: boolean;
  onAdvance: (id: string, next: OrderStatus) => void;
  channelKindByName: Record<string, OrderChannelKind>;
  requiresAcceptance: boolean;
  orderWorkflow: OrderWorkflowMode;
}) {
  const { printed, print } = usePrintTicket(order.id);
  const source =
    order.order_channel ??
    (order.service_type === "takeaway" ? "Takeaway" : "Dine-in");
  const kind = order.order_channel
    ? channelKindByName[order.order_channel.toLowerCase()]
    : null;
  const meta = [
    kind === "online" ? "Online" : kind === "popup" ? "Pop-up" : null,
    source,
    order.service_type !== "takeaway" && order.table_number
      ? `Meja ${order.table_number}`
      : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <Card
      className={`gap-0 p-0 transition-all hover:-translate-y-0.5 hover:shadow-md ${
        busy ? "opacity-60" : ""
      }`}
    >
      <div className="flex items-start justify-between gap-3 border-b p-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-base font-semibold tabular-nums">
              {order.order_number}
            </span>
            <Badge className={statusColor(order.status)}>
              {ORDER_STATUS_LABEL[order.status]}
            </Badge>
          </div>
          <p className="mt-1 truncate text-xs text-muted-foreground">
            {formatTime(order.created_at)}
            {order.customer_name ? ` · ${order.customer_name}` : ""}
          </p>
          <p className="mt-0.5 truncate text-xs text-muted-foreground">{meta}</p>
        </div>
        <OrderMenu order={order} printed={printed} print={print} />
      </div>

      <div className="space-y-3 p-4">
        <OrderJourney order={order} />
        <div className="space-y-1.5">
          {order.order_items.slice(0, 4).map((item) => (
            <div key={item.id} className="flex items-start gap-2 text-sm">
              <span className="w-6 shrink-0 text-right font-medium tabular-nums">
                {item.quantity}×
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate">{item.name_snapshot}</p>
                {item.notes && (
                  <p className="truncate text-xs italic text-muted-foreground">
                    {item.notes}
                  </p>
                )}
              </div>
            </div>
          ))}
          {order.order_items.length > 4 && (
            <p className="pl-8 text-xs text-muted-foreground">
              +{order.order_items.length - 4} item lainnya
            </p>
          )}
        </div>
        {order.notes && (
          <div className="rounded-lg bg-muted px-3 py-2 text-xs text-muted-foreground">
            <span className="font-medium text-foreground">Catatan:</span>{" "}
            {order.notes}
          </div>
        )}
      </div>

      <div className="flex items-center justify-between gap-3 border-t bg-muted/30 p-4">
        <div>
          <p className="text-xs text-muted-foreground">Total</p>
          <p className="font-semibold tabular-nums">{formatIDR(order.total)}</p>
        </div>
        <div className="flex flex-col items-end gap-2">
          <Badge
            variant="secondary"
            className={paymentColor(order.payment_status)}
          >
            {PAYMENT_STATUS_LABEL[order.payment_status]}
          </Badge>
          <PrimaryAction
            order={order}
            busy={busy}
            requiresAcceptance={requiresAcceptance}
            orderWorkflow={orderWorkflow}
            onAdvance={(next) => onAdvance(order.id, next)}
          />
        </div>
      </div>
    </Card>
  );
}

function OrderRow({
  order,
  busy,
  onAdvance,
  orderWorkflow,
}: {
  order: OrderWithItems;
  busy: boolean;
  onAdvance: (id: string, next: OrderStatus) => void;
  orderWorkflow: OrderWorkflowMode;
}) {
  const { printed, print } = usePrintTicket(order.id);
  return (
    <div
      className={`flex flex-col gap-3 p-3 transition-colors hover:bg-muted/30 sm:flex-row sm:items-center sm:p-4 ${
        busy ? "opacity-60" : ""
      }`}
    >
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-semibold tabular-nums">{order.order_number}</span>
          <Badge className={statusColor(order.status)}>
            {ORDER_STATUS_LABEL[order.status]}
          </Badge>
          <Badge
            variant="secondary"
            className={paymentColor(order.payment_status)}
          >
            {PAYMENT_STATUS_LABEL[order.payment_status]}
          </Badge>
        </div>
        <p className="mt-1 truncate text-xs text-muted-foreground">
          {formatTime(order.created_at)}
          {order.customer_name ? ` · ${order.customer_name}` : ""}
          {order.table_number ? ` · Meja ${order.table_number}` : ""}
        </p>
        <p className="mt-1 truncate text-sm text-muted-foreground">
          {order.order_items
            .slice(0, 3)
            .map((item) => `${item.quantity}× ${item.name_snapshot}`)
            .join(", ")}
          {order.order_items.length > 3
            ? ` +${order.order_items.length - 3}`
            : ""}
        </p>
      </div>
      <div className="flex items-center justify-between gap-3 sm:justify-end">
        <span className="font-semibold tabular-nums">{formatIDR(order.total)}</span>
        <PrimaryAction
          order={order}
          busy={busy}
          requiresAcceptance={false}
          orderWorkflow={orderWorkflow}
          onAdvance={(next) => onAdvance(order.id, next)}
        />
        <OrderMenu order={order} printed={printed} print={print} />
      </div>
    </div>
  );
}

function OrderJourney({ order }: { order: OrderWithItems }) {
  const stages = [
    { label: "Pesanan", icon: ShoppingBag },
    { label: "Dapur", icon: UtensilsCrossed },
    { label: "Bayar", icon: CircleDollarSign },
    { label: "Selesai", icon: Check },
  ];
  const current =
    order.status === "completed"
      ? 3
      : order.payment_status === "paid"
        ? 2
        : ["accepted", "preparing", "ready"].includes(order.status)
          ? 1
          : 0;
  const nextOwner =
    order.status === "pending"
      ? "Waiter menerima pesanan"
      : ["accepted", "preparing"].includes(order.status)
        ? "Dapur menyiapkan pesanan"
        : order.status === "ready" && order.payment_status !== "paid"
          ? "Kasir menerima pembayaran"
          : order.status === "ready"
            ? "Waiter menyerahkan pesanan"
            : order.status === "completed"
              ? "Pesanan selesai"
              : "Tidak ada tindakan";
  return (
    <div className="rounded-xl border bg-background p-3">
      <div className="flex items-center">
        {stages.map((stage, index) => {
          const Icon = stage.icon;
          const done = index < current;
          const active = index === current;
          return (
            <div
              key={stage.label}
              className={`flex items-center ${
                index < stages.length - 1 ? "flex-1" : ""
              }`}
            >
              <div className="flex flex-col items-center gap-1">
                <div
                  className={`grid size-7 place-items-center rounded-full border ${
                    done
                      ? "border-foreground bg-foreground text-background"
                      : active
                        ? "border-foreground bg-background"
                        : "border-border text-muted-foreground"
                  }`}
                >
                  <Icon className="size-3.5" />
                </div>
                <span
                  className={`text-[10px] ${
                    active ? "font-semibold" : "text-muted-foreground"
                  }`}
                >
                  {stage.label}
                </span>
              </div>
              {index < stages.length - 1 && (
                <div
                  className={`mx-1 mb-4 h-px flex-1 ${
                    index < current ? "bg-foreground" : "bg-border"
                  }`}
                />
              )}
            </div>
          );
        })}
      </div>
      <p className="mt-2 text-xs text-muted-foreground">
        <span className="font-medium text-foreground">Berikutnya:</span>{" "}
        {nextOwner}
      </p>
    </div>
  );
}

function PrimaryAction({
  order,
  busy,
  requiresAcceptance,
  orderWorkflow,
  onAdvance,
}: {
  order: OrderWithItems;
  busy: boolean;
  requiresAcceptance: boolean;
  orderWorkflow: OrderWorkflowMode;
  onAdvance: (next: OrderStatus) => void;
}) {
  if (order.status === "ready" && order.payment_status !== "paid") {
    return (
      <Button
        render={<Link href={`/cashier/${order.id}`} />}
        size="lg"
        className="h-10"
      >
        Ke pembayaran <ArrowRight />
      </Button>
    );
  }
  const advance = nextStatusForWaiter(order.status, orderWorkflow);
  if (!advance) {
    return (
      <Button
        render={<Link href={`/cashier/${order.id}`} />}
        variant="outline"
        size="lg"
        className="h-10"
      >
        Lihat detail
      </Button>
    );
  }
  const action = advance;

  function confirmAndAdvance() {
    if (
      action.next === "completed" &&
      !window.confirm(
        "Selesaikan pesanan ini? Pastikan pesanan sudah diserahkan kepada pelanggan.",
      )
    ) return;
    onAdvance(action.next);
  }

  return (
    <div className="flex items-center gap-1.5">
      {requiresAcceptance && ["pending", "accepted"].includes(order.status) && (
        <Button
          variant="ghost"
          size="lg"
          className="h-10 text-destructive hover:text-destructive"
          disabled={busy}
          onClick={() => {
            if (
              window.confirm(
                "Tolak pesanan ini? Stok yang tercatat akan dikembalikan.",
              )
            ) onAdvance("cancelled");
          }}
        >
          Tolak
        </Button>
      )}
      <Button
        size="lg"
        className="h-10"
        disabled={busy}
        onClick={confirmAndAdvance}
      >
        {busy ? <Loader2 className="animate-spin" /> : action.label}
        {!busy && <ArrowRight />}
      </Button>
    </div>
  );
}

function OrderMenu({
  order,
  printed,
  print,
}: {
  order: OrderWithItems;
  printed: boolean;
  print: () => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            variant="ghost"
            size="icon"
            aria-label={`Aksi lainnya untuk ${order.order_number}`}
          />
        }
      >
        <MoreHorizontal />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem render={<Link href={`/cashier/${order.id}`} />}>
          Lihat atau edit detail
        </DropdownMenuItem>
        <DropdownMenuItem onClick={print}>
          <Printer /> {printed ? "Cetak ulang tiket" : "Cetak tiket dapur"}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
