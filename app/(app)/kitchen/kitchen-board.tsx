"use client";

import {
  useCallback,
  useEffect,
  useState,
  useSyncExternalStore,
  useTransition,
} from "react";
import { toast } from "sonner";
import { Clock, ChefHat, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { formatTime } from "@/lib/format";
import { createClient } from "@/lib/supabase/client";
import type {
  Order,
  OrderItem,
  OrderStatus,
  OrderWithItems,
} from "@/lib/types";
import { updateOrderStatus } from "./actions";

function subscribeClock(cb: () => void) {
  const id = setInterval(cb, 15000);
  return () => clearInterval(id);
}

function useNow(): number {
  return useSyncExternalStore(
    subscribeClock,
    () => Date.now(),
    () => 0,
  );
}

export function KitchenBoard({
  initialOrders,
}: {
  initialOrders: OrderWithItems[];
}) {
  const [orders, setOrders] = useState<OrderWithItems[]>(initialOrders);
  const now = useNow();

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
    const supabase = createClient();
    const channel = supabase
      .channel("kitchen-orders")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "orders" },
        async (payload) => {
          const newOrder = payload.new as Order;
          if (!["pending", "preparing"].includes(newOrder.status)) return;
          const full = await fetchFullOrder(newOrder.id);
          if (!full) return;
          setOrders((prev) => {
            if (prev.some((o) => o.id === full.id)) return prev;
            toast.info(`New order ${full.order_number}`);
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
          setOrders((prev) => {
            if (!["pending", "preparing"].includes(updated.status)) {
              return prev.filter((o) => o.id !== updated.id);
            }
            return prev.map((o) =>
              o.id === updated.id
                ? { ...o, ...updated, order_items: o.order_items }
                : o,
            );
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
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchFullOrder]);

  const pending = orders.filter((o) => o.status === "pending");
  const preparing = orders.filter((o) => o.status === "preparing");

  return (
    <div className="grid gap-6 md:grid-cols-2">
      <Column
        title="New orders"
        icon={<Clock className="h-4 w-4" />}
        count={pending.length}
        accent="bg-slate-200 text-slate-900"
      >
        {pending.length === 0 ? (
          <EmptyColumn label="No new orders" />
        ) : (
          pending.map((o) => <OrderCard key={o.id} order={o} now={now} />)
        )}
      </Column>
      <Column
        title="Preparing"
        icon={<ChefHat className="h-4 w-4" />}
        count={preparing.length}
        accent="bg-amber-500 text-white"
      >
        {preparing.length === 0 ? (
          <EmptyColumn label="Nothing on the stove yet" />
        ) : (
          preparing.map((o) => <OrderCard key={o.id} order={o} now={now} />)
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
  const overdue = mins >= 15;

  function transition(next: OrderStatus) {
    start(async () => {
      const res = await updateOrderStatus(order.id, next);
      if (!res.ok) toast.error(res.error);
    });
  }

  return (
    <Card
      className={cn(
        "p-4 gap-3",
        overdue && order.status !== "ready" && "border-red-500",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="text-lg font-semibold tabular-nums">
            {order.order_number}
          </div>
          <div className="text-xs text-muted-foreground">
            {formatTime(order.created_at)}
            {order.table_number ? ` · Table ${order.table_number}` : ""}
            {order.customer_name ? ` · ${order.customer_name}` : ""}
          </div>
        </div>
        <Badge
          variant={overdue ? "destructive" : "secondary"}
          className="tabular-nums"
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
          Order note: {order.notes}
        </div>
      )}

      <div className="flex gap-2 pt-1">
        {order.status === "pending" && (
          <Button
            className="flex-1 h-12 text-base touch-manipulation"
            disabled={pending}
            onClick={() => transition("preparing")}
          >
            <ChefHat className="h-4 w-4 mr-2" />
            Start preparing
          </Button>
        )}
        {order.status === "preparing" && (
          <Button
            className="flex-1 h-12 text-base bg-emerald-600 hover:bg-emerald-600/90 touch-manipulation"
            disabled={pending}
            onClick={() => transition("ready")}
          >
            <CheckCircle2 className="h-4 w-4 mr-2" />
            Mark ready
          </Button>
        )}
      </div>
    </Card>
  );
}
