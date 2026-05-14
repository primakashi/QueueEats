"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useTransition,
} from "react";
import { toast } from "sonner";
import {
  Clock,
  ChefHat,
  CheckCircle2,
  Loader2,
  Package,
  UtensilsCrossed,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { formatTime } from "@/lib/format";
import { createClient, createRealtimeClient } from "@/lib/supabase/client";
import type {
  Order,
  OrderItem,
  OrderServiceType,
  OrderStatus,
  OrderWithItems,
} from "@/lib/types";
import { updateOrderStatus } from "./actions";

const KITCHEN_STATUSES: OrderStatus[] = ["pending", "preparing", "ready"];

/** Realtime patches sometimes omit unchanged columns — infer when missing. */
function resolveServiceType(
  order: Pick<Order, "service_type" | "table_number">,
): OrderServiceType {
  if (order.service_type === "takeaway" || order.service_type === "dine_in") {
    return order.service_type;
  }
  const t = order.table_number?.trim();
  return t ? "dine_in" : "takeaway";
}

function useNow(): number {
  const [now, setNow] = useState(0);
  useEffect(() => {
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 15000);
    return () => clearInterval(id);
  }, []);
  return now;
}

export function KitchenBoard({
  initialOrders,
}: {
  initialOrders: OrderWithItems[];
}) {
  const [orders, setOrders] = useState<OrderWithItems[]>(initialOrders);
  const now = useNow();
  const notifiedIds = useRef<Set<string>>(
    new Set(initialOrders.map((o) => o.id)),
  );

  const fetchFullOrder = useCallback(
    async (id: string): Promise<OrderWithItems | null> => {
      const supabase = createClient();
      const { data } = await supabase
        .from("orders")
        .select("*, order_items(*)")
        .eq("id", id)
        .maybeSingle();
      return (data as OrderWithItems | null) ?? null;
    },
    [],
  );

  useEffect(() => {
    let cancelled = false;
    let cleanup: (() => void) | null = null;

    (async () => {
      const supabase = await createRealtimeClient();
      if (cancelled) return;

      const channel = supabase
        .channel("kitchen-orders")
        .on(
          "postgres_changes",
          { event: "INSERT", schema: "public", table: "orders" },
          async (payload) => {
            const newOrder = payload.new as Order;
            if (!KITCHEN_STATUSES.includes(newOrder.status)) return;
            if (notifiedIds.current.has(newOrder.id)) return;
            notifiedIds.current.add(newOrder.id);
            const full = await fetchFullOrder(newOrder.id);
            if (!full) return;
            toast.success(`Pesanan baru ${full.order_number}`);
            setOrders((prev) => {
              if (prev.some((o) => o.id === full.id)) return prev;
              return [...prev, full].sort((a, b) =>
                a.created_at.localeCompare(b.created_at),
              );
            });
          },
        )
        .on(
          "postgres_changes",
          { event: "UPDATE", schema: "public", table: "orders" },
          async (payload) => {
            const updated = payload.new as Order;
            const patch = updated as Record<string, unknown>;
            setOrders((prev) => {
              if (!KITCHEN_STATUSES.includes(updated.status)) {
                return prev.filter((o) => o.id !== updated.id);
              }
              const exists = prev.some((o) => o.id === updated.id);
              if (!exists) return prev;
              return prev.map((o) => {
                if (o.id !== updated.id) return o;
                return {
                  ...o,
                  ...updated,
                  order_items: o.order_items,
                  service_type: (
                    "service_type" in patch
                      ? updated.service_type
                      : o.service_type
                  ) as Order["service_type"],
                  table_number:
                    "table_number" in patch
                      ? updated.table_number
                      : o.table_number,
                  customer_name:
                    "customer_name" in patch
                      ? updated.customer_name
                      : o.customer_name,
                  notes: "notes" in patch ? updated.notes : o.notes,
                };
              });
            });
          },
        )
        .on(
          "postgres_changes",
          { event: "INSERT", schema: "public", table: "order_items" },
          (payload) => {
            const item = payload.new as OrderItem;
            setOrders((prev) =>
              prev.map((o) =>
                o.id === item.order_id
                  ? {
                      ...o,
                      order_items: o.order_items.some((x) => x.id === item.id)
                        ? o.order_items
                        : [...o.order_items, item],
                    }
                  : o,
              ),
            );
          },
        )
        .subscribe((status, err) => {
          if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
            console.warn("[kitchen realtime]", status, err ?? "");
          }
        });

      cleanup = () => {
        supabase.removeChannel(channel);
      };
    })();

    return () => {
      cancelled = true;
      cleanup?.();
    };
  }, [fetchFullOrder]);

  const pending = orders.filter((o) => o.status === "pending");
  const preparing = orders.filter((o) => o.status === "preparing");
  const ready = orders.filter((o) => o.status === "ready");

  return (
    <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
      <Column
        title="Pesanan baru"
        icon={<Clock className="h-4 w-4" />}
        count={pending.length}
        accent="bg-slate-200 text-slate-900"
      >
        {pending.length === 0 ? (
          <EmptyColumn label="Belum ada pesanan baru" />
        ) : (
          pending.map((o) => <OrderCard key={o.id} order={o} now={now} />)
        )}
      </Column>
      <Column
        title="Dimasak"
        icon={<ChefHat className="h-4 w-4" />}
        count={preparing.length}
        accent="bg-amber-500 text-white"
      >
        {preparing.length === 0 ? (
          <EmptyColumn label="Belum ada yang dimasak" />
        ) : (
          preparing.map((o) => <OrderCard key={o.id} order={o} now={now} />)
        )}
      </Column>
      <Column
        title="Siap"
        icon={<CheckCircle2 className="h-4 w-4" />}
        count={ready.length}
        accent="bg-emerald-600 text-white"
      >
        {ready.length === 0 ? (
          <EmptyColumn label="Belum ada yang siap" />
        ) : (
          ready.map((o) => <OrderCard key={o.id} order={o} now={now} />)
        )}
      </Column>
    </div>
  );
}

function Column({
  title,
  icon,
  count,
  accent,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  count: number;
  accent: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <div
          className={cn(
            "h-7 rounded-full px-3 flex items-center gap-1.5 text-xs font-semibold",
            accent,
          )}
        >
          {icon}
          {title}
          <span className="tabular-nums">· {count}</span>
        </div>
      </div>
      <div className="space-y-3">{children}</div>
    </div>
  );
}

function EmptyColumn({ label }: { label: string }) {
  return (
    <Card className="p-8 text-center text-sm text-muted-foreground">
      {label}
    </Card>
  );
}

function OrderCard({ order, now }: { order: OrderWithItems; now: number }) {
  const [pending, start] = useTransition();
  const mins =
    now === 0
      ? 0
      : Math.max(
          0,
          Math.floor((now - new Date(order.created_at).getTime()) / 60000),
        );
  const overdue = mins >= 15 && order.status !== "ready";
  const serviceType = resolveServiceType(order);
  const isTakeaway = serviceType === "takeaway";

  function transition(next: OrderStatus) {
    start(async () => {
      const res = await updateOrderStatus(order.id, next);
      if (!res.ok) toast.error(res.error);
    });
  }

  return (
    <Card
      aria-busy={pending}
      className={cn(
        "relative gap-3 border-l-4 p-4",
        isTakeaway ? "border-l-amber-500" : "border-l-teal-600",
        overdue && "ring-2 ring-red-500 ring-offset-2 ring-offset-background",
        order.status === "ready" && "border-emerald-200 bg-emerald-50/40",
        pending && "opacity-90",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 space-y-2">
          <div
            className={cn(
              "flex flex-wrap items-center gap-2 rounded-md px-2 py-1.5 text-sm font-semibold",
              isTakeaway
                ? "bg-amber-100 text-amber-950 dark:bg-amber-950/40 dark:text-amber-50"
                : "bg-teal-100 text-teal-950 dark:bg-teal-950/40 dark:text-teal-50",
            )}
          >
            {isTakeaway ? (
              <Package className="h-4 w-4 shrink-0" aria-hidden />
            ) : (
              <UtensilsCrossed className="h-4 w-4 shrink-0" aria-hidden />
            )}
            <span>{isTakeaway ? "Bungkus" : "Makan di tempat"}</span>
            {order.table_number?.trim() ? (
              <span className="font-medium opacity-90">
                · Meja {order.table_number}
              </span>
            ) : null}
          </div>
          <div className="text-lg font-semibold tabular-nums">
            {order.order_number}
          </div>
          <div className="text-xs text-muted-foreground">
            {formatTime(order.created_at)}
            {order.customer_name ? ` · ${order.customer_name}` : ""}
          </div>
        </div>
        <Badge
          variant={overdue ? "destructive" : "secondary"}
          className="shrink-0 tabular-nums"
        >
          {mins}m
        </Badge>
      </div>

      <ul className="space-y-1.5">
        {order.order_items
          .slice()
          .sort((a, b) => a.created_at.localeCompare(b.created_at))
          .map((i) => (
            <li key={i.id} className="flex items-start gap-2 text-base">
              <span className="inline-block w-7 shrink-0 text-right font-semibold tabular-nums">
                {i.quantity}×
              </span>
              <div className="flex-1 min-w-0">
                <div className="leading-snug">{i.name_snapshot}</div>
                {i.notes && (
                  <div className="text-sm text-muted-foreground italic">
                    {i.notes}
                  </div>
                )}
              </div>
            </li>
          ))}
      </ul>

      {order.notes && (
        <div className="text-xs text-muted-foreground italic border-t pt-2">
          Catatan pesanan: {order.notes}
        </div>
      )}

      {order.status === "pending" && (
        <div className="flex gap-2 pt-1">
          <Button
            className="flex-1 h-12 text-base touch-manipulation"
            disabled={pending}
            onClick={() => transition("preparing")}
          >
            {pending ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <ChefHat className="h-4 w-4 mr-2" />
            )}
            {pending ? "Memperbarui…" : "Mulai masak"}
          </Button>
        </div>
      )}
      {order.status === "preparing" && (
        <div className="flex gap-2 pt-1">
          <Button
            className="flex-1 h-12 text-base bg-emerald-600 hover:bg-emerald-600/90 touch-manipulation"
            disabled={pending}
            onClick={() => transition("ready")}
          >
            {pending ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <CheckCircle2 className="h-4 w-4 mr-2" />
            )}
            {pending ? "Memperbarui…" : "Tandai siap"}
          </Button>
        </div>
      )}
      {order.status === "ready" && (
        <div className="flex items-center justify-center gap-2 pt-1 text-sm font-medium text-emerald-700">
          <CheckCircle2 className="h-4 w-4" />
          Siap diambil
        </div>
      )}
    </Card>
  );
}
