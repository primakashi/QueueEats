"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Printer, Wallet } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatIDR } from "@/lib/format";
import { PAYMENT_DESTINATION_GROUPS } from "@/lib/types";
import type { Order } from "@/lib/types";
import { confirmPayment } from "../actions";
import { FullScreenLoading } from "@/components/full-screen-loading";
import { openPrintWindow } from "@/lib/print";

function methodFromDestination(destination: string): "cash" | "edc" {
  return destination === "Tunai" ? "cash" : "edc";
}

export function PaymentPanel({ order }: { order: Order }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [paymentDestination, setPaymentDestination] = useState<string>("");
  const [payError, setPayError] = useState<string | null>(null);

  const isPaid = order.payment_status === "paid";

  function pay() {
    if (!paymentDestination) {
      setPayError("Pilih sumber pembayaran dulu");
      return;
    }
    const method = methodFromDestination(paymentDestination);
    setPayError(null);
    start(async () => {
      try {
        const res = await confirmPayment(order.id, method, paymentDestination);
        if (!res.ok) {
          toast.error(res.error);
          setPayError(res.error);
          return;
        }
        toast.success("Pembayaran diterima!");
        router.refresh();
      } catch (err) {
        console.error("[payment] confirmPayment threw", err);
        const msg = "Gagal menerima pembayaran. Coba lagi.";
        toast.error(msg);
        setPayError(msg);
      }
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
          onClick={() => {
            const ok = openPrintWindow(`/cashier/${order.id}/print`);
            if (!ok) {
              toast.error(
                "Browser memblokir jendela cetak. Aktifkan popup untuk situs ini, lalu coba lagi.",
              );
            }
          }}
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
            <SelectValue placeholder="Pilih sumber pembayaran" />
          </SelectTrigger>
          <SelectContent>
            {PAYMENT_DESTINATION_GROUPS.map((g) => (
              <SelectGroup key={g.label}>
                <SelectLabel>{g.label}</SelectLabel>
                {g.options.map((d) => (
                  <SelectItem key={d} value={d}>{d}</SelectItem>
                ))}
              </SelectGroup>
            ))}
          </SelectContent>
        </Select>
      </div>
      <Button
        size="lg"
        className="h-14 text-base gap-3"
        onClick={pay}
        disabled={pending || !paymentDestination}
        aria-busy={pending}
      >
        {pending ? (
          <Spinner className="h-5 w-5 shrink-0" size="md" />
        ) : (
          <Wallet className="h-5 w-5 shrink-0" />
        )}
        {pending ? "Mencatat…" : "Pembayaran Diterima"}
      </Button>
      {payError && (
        <div className="rounded-md bg-destructive/10 border border-destructive/20 px-3 py-2 text-sm text-destructive">
          {payError} — Coba lagi.
        </div>
      )}
    </Card>
  );
}
