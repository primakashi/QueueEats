"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { createRealtimeClient } from "@/lib/supabase/client";

export function CashierRealtimeRefresher() {
  const router = useRouter();
  useEffect(() => {
    let cancelled = false;
    let cleanup: (() => void) | null = null;

    (async () => {
      const supabase = await createRealtimeClient();
      if (cancelled) return;

      const channel = supabase
        .channel("cashier-orders")
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "orders" },
          () => router.refresh(),
        )
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "payments" },
          () => router.refresh(),
        )
        .subscribe((status) => {
          if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
            console.warn("[cashier realtime]", status);
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
  }, [router]);
  return null;
}
