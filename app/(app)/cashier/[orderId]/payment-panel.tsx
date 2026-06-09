"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { QRCodeSVG } from "qrcode.react";
import {
  Banknote,
  CheckCircle2,
  ExternalLink,
  QrCode,
  RefreshCw,
  Sparkles,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Spinner } from "@/components/ui/spinner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { createRealtimeClient } from "@/lib/supabase/client";
import { formatIDR } from "@/lib/format";
import { PAYMENT_DESTINATIONS } from "@/lib/types";
import type { Order, Payment } from "@/lib/types";
import {
  cancelQrisPayment,
  simulateCashPayment,
  simulateMockPayment,
  startCashPayment,
  startQrisPayment,
} from "../actions";
import { FullScreenLoading } from "@/components/full-screen-loading";

export function PaymentPanel({
  order,
  initialPayment,
}: {
  order: Order;
  initialPayment: Payment | null;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [action, setAction] = useState<
    "begin-qris" | "begin-cash" | "simulate-cash" | "simulate-mock" | "cancel" | null
  >(null);
  const [payment, setPayment] = useState<Payment | null>(initialPayment);
  const [paymentDestination, setPaymentDestination] = useState<string>("");
  const [method, setMethod] = useState<"qris" | "cash" | null>(() => {
    if (!initialPayment || initialPayment.status !== "pending") return null;
    if (initialPayment.provider === "cash") return "cash";
    if (initialPayment.provider === "mock" || initialPayment.provider === "xendit")
      return "qris";
    return null;
  });

  const isPaid = order.payment_status === "paid";
  const isMock = payment?.provider === "mock";
  const [origin, setOrigin] = useState<string>("");
  useEffect(() => {
    setOrigin(window.location.origin);
  }, []);
  const mockPayUrl =
    isMock && payment && origin ? `${origin}/pay/${payment.id}` : null;

  useEffect(() => {
    if (!payment || payment.status !== "pending") return;
    let cancelled = false;
    let cleanup: (() => void) | null = null;

    (async () => {
      const supabase = await createRealtimeClient();
      if (cancelled) return;

      const channel = supabase
        .channel(`pay-${payment.id}`)
        .on(
          "postgres_changes",
          {
            event: "UPDATE",
            schema: "public",
            table: "payments",
            filter: `id=eq.${payment.id}`,
          },
          (p) => {
            const next = p.new as Payment;
            setPayment(next);
            if (next.status === "paid") {
              toast.success("Pembayaran diterima!");
              router.refresh();
            }
          },
        )
        .subscribe((status) => {
          if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
            console.warn("[payment realtime]", status);
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
  }, [payment, router]);

  function beginQris() {
    setMethod("qris");
    setAction("begin-qris");
    start(async () => {
      const res = await startQrisPayment(order.id, paymentDestination || undefined);
      if (!res.ok) {
        toast.error(res.error);
        setMethod(null);
        setAction(null);
        return;
      }
      setPayment(res.payment);
      setAction(null);
    });
  }

  function beginCash() {
    setMethod("cash");
    setAction("begin-cash");
    start(async () => {
      const res = await startCashPayment(order.id, paymentDestination || undefined);
      if (!res.ok) {
        toast.error(res.error);
        setMethod(null);
        setAction(null);
        return;
      }
      setPayment(res.payment);
      setAction(null);
    });
  }

  function simulateCash() {
    if (!payment) return;
    setAction("simulate-cash");
    start(async () => {
      const res = await simulateCashPayment(payment.id);
      if (!res.ok) {
        toast.error(res.error);
        setAction(null);
        return;
      }
      toast.success("Pembayaran tunai tercatat");
      setAction(null);
    });
  }

  function simulateMock() {
    if (!payment) return;
    setAction("simulate-mock");
    start(async () => {
      const res = await simulateMockPayment(payment.id);
      if (!res.ok) {
        toast.error(res.error);
        setAction(null);
        return;
      }
      setAction(null);
    });
  }

  function cancelQris() {
    setAction("cancel");
    start(async () => {
      const res = await cancelQrisPayment(order.id);
      if (!res.ok) {
        toast.error(res.error);
        setAction(null);
        return;
      }
      setPayment(null);
      setMethod(null);
      setAction(null);
      router.refresh();
    });
  }

  const loadingOverlay = pending ? (
    <FullScreenLoading title="Memproses pembayaran…" />
  ) : null;

  if (isPaid) {
    return (
      <Card className="p-6 gap-3 text-center">
        <div className="mx-auto h-14 w-14 rounded-full bg-emerald-100 text-emerald-700 grid place-items-center">
          <CheckCircle2 className="h-8 w-8" />
        </div>
        <div className="text-lg font-semibold">Pembayaran diterima</div>
        <div className="text-sm text-muted-foreground">
          {order.payment_method === "qris" ? "Dibayar via QRIS" : "Dibayar tunai"}
        </div>
        <div className="text-3xl font-semibold tabular-nums pt-2">
          {formatIDR(order.total)}
        </div>
      </Card>
    );
  }

  if (method === "cash" && payment) {
    return (
      <Card className="p-5 gap-4">
        {loadingOverlay}
        <div className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
          <Sparkles className="h-4 w-4 shrink-0 mt-0.5" />
          <div>
            <div className="font-medium">Alur tunai mock</div>
            <div className="text-amber-800/80">
              Sama seperti QRIS mock: terima tunai dari pelanggan, lalu ketuk
              “Simulasi pelanggan bayar” untuk mencatatnya.
            </div>
          </div>
        </div>
        <div className="text-center space-y-1">
          <div className="text-sm text-muted-foreground">Jumlah yang ditagih</div>
          <div className="text-2xl font-semibold tabular-nums">
            {formatIDR(payment.amount)}
          </div>
        </div>
        <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground py-6">
          <RefreshCw className="h-4 w-4 animate-spin" />
          Menunggu tunai…
        </div>
        <Separator />
        <div className="grid gap-2">
          <Button
            className="w-full"
            onClick={simulateCash}
            disabled={pending}
            aria-busy={action === "simulate-cash"}
          >
            {action === "simulate-cash" ? (
              <Spinner className="mr-2" />
            ) : (
              <Sparkles className="h-4 w-4 mr-2" />
            )}
            {action === "simulate-cash" ? "Mencatat…" : "Simulasi pelanggan bayar"}
          </Button>
          <Button
            variant="outline"
            className="w-full"
            onClick={cancelQris}
            disabled={pending}
            aria-busy={action === "cancel"}
          >
            {action === "cancel" ? (
              <Spinner className="mr-2" />
            ) : (
              <XCircle className="h-4 w-4 mr-2" />
            )}
            {action === "cancel" ? "Membatalkan…" : "Batalkan tunai"}
          </Button>
        </div>
      </Card>
    );
  }

  if (method === "qris" && payment) {
    const qrValue = isMock
      ? mockPayUrl ?? `ayamseruni:pending:${payment.id}`
      : payment.qr_string ?? "";
    return (
      <Card className="p-5 gap-4">
        {loadingOverlay}
        {isMock && (
          <div className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
            <Sparkles className="h-4 w-4 shrink-0 mt-0.5" />
            <div>
              <div className="font-medium">Mode pembayaran mock</div>
              <div className="text-amber-800/80">
                Ketuk “Simulasi pindai” di bawah.
              </div>
            </div>
          </div>
        )}
        <div className="text-center space-y-1">
          <div className="text-sm text-muted-foreground">Minta pelanggan memindai</div>
          <div className="text-2xl font-semibold tabular-nums">
            {formatIDR(payment.amount)}
          </div>
        </div>
        <div className="relative mx-auto bg-white p-4 rounded-lg border">
          {qrValue ? (
            <QRCodeSVG value={qrValue} size={256} level="M" marginSize={0} />
          ) : (
            <div className="h-64 w-64 grid place-items-center text-muted-foreground">
              QR tidak tersedia
            </div>
          )}
        </div>
        <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
          <RefreshCw className="h-4 w-4 animate-spin" />
          Menunggu pembayaran...
        </div>
        <Separator />
        <div className="grid gap-2">
          {isMock && (
            <>
              <Button
                className="w-full"
                onClick={simulateMock}
                disabled={pending}
                aria-busy={action === "simulate-mock"}
              >
                {action === "simulate-mock" ? (
                  <Spinner className="mr-2" />
                ) : (
                  <Sparkles className="h-4 w-4 mr-2" />
                )}
                {action === "simulate-mock"
                  ? "Mencatat…"
                  : "Simulasi pindai pelanggan"}
              </Button>
              {mockPayUrl && (
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => window.open(mockPayUrl, "_blank")}
                  disabled={pending}
                >
                  <ExternalLink className="h-4 w-4 mr-2" /> Buka halaman bayar
                  pelanggan
                </Button>
              )}
            </>
          )}
          <Button
            variant="outline"
            className="w-full"
            onClick={cancelQris}
            disabled={pending}
            aria-busy={action === "cancel"}
          >
            {action === "cancel" ? (
              <Spinner className="mr-2" />
            ) : (
              <XCircle className="h-4 w-4 mr-2" />
            )}
            {action === "cancel" ? "Membatalkan…" : "Batalkan QRIS"}
          </Button>
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-5 gap-4">
      {loadingOverlay}
      <h3 className="font-semibold">Terima pembayaran</h3>
      <div className="space-y-1.5">
        <Label htmlFor="pay-destination">Tujuan pembayaran</Label>
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
      <div className="grid w-full min-w-0 gap-3">
        <Button
          size="lg"
          variant="outline"
          className="h-auto w-full min-w-0 shrink items-start gap-3 py-4 whitespace-normal text-left"
          onClick={beginQris}
          disabled={pending}
          aria-busy={action === "begin-qris"}
        >
          {action === "begin-qris" ? (
            <Spinner className="mt-0.5 h-5 w-5 shrink-0" size="md" />
          ) : (
            <QrCode className="mt-0.5 h-5 w-5 shrink-0" />
          )}
          <div className="min-w-0 flex-1">
            <div className="font-semibold">
              {action === "begin-qris" ? "Membuat QR…" : "QRIS"}
            </div>
            <div className="text-xs text-muted-foreground font-normal break-words">
              Buat kode QR via Xendit
            </div>
          </div>
        </Button>
        <Button
          size="lg"
          variant="outline"
          className="h-auto w-full min-w-0 shrink items-start gap-3 py-4 whitespace-normal text-left"
          onClick={beginCash}
          disabled={pending}
          aria-busy={action === "begin-cash"}
        >
          {action === "begin-cash" ? (
            <Spinner className="mt-0.5 h-5 w-5 shrink-0" size="md" />
          ) : (
            <Banknote className="mt-0.5 h-5 w-5 shrink-0" />
          )}
          <div className="min-w-0 flex-1">
            <div className="font-semibold">
              {action === "begin-cash" ? "Memulai…" : "Tunai"}
            </div>
            <div className="text-xs text-muted-foreground font-normal break-words">
              Menunggu pembayaran lalu konfirmasi
            </div>
          </div>
        </Button>
      </div>
    </Card>
  );
}
