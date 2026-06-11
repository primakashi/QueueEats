"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Banknote, CheckCircle2, CreditCard, Printer } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatIDR } from "@/lib/format";
import { PAYMENT_DESTINATIONS } from "@/lib/types";
import type { Order } from "@/lib/types";
import { confirmPayment } from "../actions";
import { FullScreenLoading } from "@/components/full-screen-loading";

export function PaymentPanel({ order }: { order: Order }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [action, setAction] = useState<"cash" | "edc" | null>(null);
  const [paymentDestination, setPaymentDestination] = useState<string>("");

  const isPaid = order.payment_status === "paid";

  function pay(method: "cash" | "edc") {
    setAction(method);
    start(async () => {
      const res = await confirmPayment(order.id, method, paymentDestination || undefined);
      if (!res.ok) {
        toast.error(res.error);
        setAction(null);
        return;
      }
      toast.success("Pembayaran diterima!");
      router.refresh();
      setAction(null);
    });
  }

  if (isPaid) {
    return (
      <Card className="p-6 gap-3 text-center">
        <div className="mx-auto h-14 w-14 rounded-full bg-emerald-100 text-emerald-700 grid place-items-center">
          <CheckCircle2 className="h-8 w-8" />
        </div>
        <div className="text-lg font-semibold">Pembayaran diterima</div>
        <div className="text-sm text-muted-foreground">
          {order.payment_method === "edc" ? "Dibayar via EDC / Kartu" : "Dibayar tunai"}
        </div>
        <div className="text-3xl font-semibold tabular-nums pt-2">
          {formatIDR(order.total)}
        </div>
        <button
          type="button"
          onClick={() =>
            window.open(
              `/cashier/${order.id}/print`,
              "_blank",
              "width=420,height=700,toolbar=0,menubar=0",
            )
          }
          className="inline-flex items-center justify-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors mx-auto mt-1"
        >
          <Printer className="h-4 w-4" /> Cetak struk
        </button>
      </Card>
    );
  }

  return (
    <Card className="p-5 gap-4">
      {pending && <FullScreenLoading title="Memproses pembayaran…" />}
      <h3 className="font-semibold">Terima pembayaran</h3>
      <div className="text-center py-2">
        <div className="text-sm text-muted-foreground mb-1">Total tagihan</div>
        <div className="text-3xl font-semibold tabular-nums">{formatIDR(order.total)}</div>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="pay-destination">Pembayaran Dari</Label>
        <Select
          value={paymentDestination}
          onValueChange={(v) => setPaymentDestination(v === "__none__" || !v ? "" : v)}
        >
          <SelectTrigger id="pay-destination" className="w-full">
            <SelectValue placeholder="Pilih tujuan (opsional)…" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__none__">Tidak ditentukan</SelectItem>
            {PAYMENT_DESTINATIONS.map((d) => (
              <SelectItem key={d} value={d}>{d}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="grid gap-3">
        <Button
          size="lg"
          className="h-14 text-base gap-3"
          onClick={() => pay("cash")}
          disabled={pending}
          aria-busy={action === "cash"}
        >
          {action === "cash" ? (
            <Spinner className="h-5 w-5 shrink-0" size="md" />
          ) : (
            <Banknote className="h-5 w-5 shrink-0" />
          )}
          {action === "cash" ? "Mencatat…" : "Bayar Tunai"}
        </Button>
        <Button
          size="lg"
          variant="outline"
          className="h-14 text-base gap-3"
          onClick={() => pay("edc")}
          disabled={pending}
          aria-busy={action === "edc"}
        >
          {action === "edc" ? (
            <Spinner className="h-5 w-5 shrink-0" size="md" />
          ) : (
            <CreditCard className="h-5 w-5 shrink-0" />
          )}
          {action === "edc" ? "Mencatat…" : "Bayar EDC / Kartu"}
        </Button>
      </div>
    </Card>
  );
}
