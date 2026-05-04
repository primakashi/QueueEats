"use client";

import { useEffect, useState, useTransition } from "react";
import { CheckCircle2, Sparkles, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { formatIDR } from "@/lib/format";
import { createClient } from "@/lib/supabase/client";
import { completeMockPaymentPublic } from "../actions";

export type MockPaymentSummary = {
  payment_id: string;
  payment_status: "pending" | "paid" | "failed" | "expired";
  amount: number;
  paid_at: string | null;
  order_id: string;
  order_number: string;
  customer_name: string | null;
  table_number: string | null;
  items: Array<{
    name: string;
    quantity: number;
    unit_price: number;
    line_total: number;
  }>;
};

export function PayPanel({ summary }: { summary: MockPaymentSummary }) {
  const [status, setStatus] = useState(summary.payment_status);
  const [pending, start] = useTransition();

  useEffect(() => {
    if (status === "paid") return;
    const supabase = createClient();
    const channel = supabase
      .channel(`pub-pay-${summary.payment_id}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "payments",
          filter: `id=eq.${summary.payment_id}`,
        },
        (p) => {
          const next = p.new as { status?: MockPaymentSummary["payment_status"] };
          if (next.status) setStatus(next.status);
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [summary.payment_id, status]);

  function pay() {
    start(async () => {
      const res = await completeMockPaymentPublic(summary.payment_id);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      setStatus("paid");
    });
  }

  if (status === "paid") {
    return (
      <Card className="m-5 w-full max-w-md p-6 text-center gap-3">
        <div className="mx-auto h-16 w-16 rounded-full bg-emerald-100 text-emerald-700 grid place-items-center">
          <CheckCircle2 className="h-10 w-10" />
        </div>
        <div className="text-xl font-semibold">Payment successful</div>
        <div className="text-sm text-muted-foreground">
          Order {summary.order_number} is being prepared. Thank you!
        </div>
        <div className="text-3xl font-semibold tabular-nums pt-2">
          {formatIDR(summary.amount)}
        </div>
      </Card>
    );
  }

  return (
    <Card className="m-5 w-full max-w-md p-5 gap-4">
      <div className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
        <Sparkles className="h-4 w-4 shrink-0 mt-0.5" />
        <div>
          <div className="font-medium">Demo / mock payment</div>
          <div className="text-amber-800/80">
            This is a simulated QRIS flow — tapping Pay instantly marks the
            order as paid.
          </div>
        </div>
      </div>

      <div>
        <div className="text-xs uppercase tracking-wider text-muted-foreground">
          Amount
        </div>
        <div className="text-3xl font-semibold tabular-nums">
          {formatIDR(summary.amount)}
        </div>
      </div>

      <div className="space-y-1.5 rounded-md border p-3">
        <div className="text-xs uppercase tracking-wider text-muted-foreground mb-1">
          Order details
        </div>
        {summary.items.map((it, i) => (
          <div key={i} className="flex justify-between text-sm">
            <span className="truncate pr-2">
              <span className="text-muted-foreground mr-1.5">
                {it.quantity}×
              </span>
              {it.name}
            </span>
            <span className="tabular-nums">{formatIDR(it.line_total)}</span>
          </div>
        ))}
      </div>

      <Button size="lg" className="w-full h-12 text-base" onClick={pay} disabled={pending}>
        {pending ? (
          <>
            <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Processing...
          </>
        ) : (
          <>Pay {formatIDR(summary.amount)}</>
        )}
      </Button>
    </Card>
  );
}
