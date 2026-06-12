"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { closeSession, getSessionSummary } from "../session-actions";
import type { CashierSession, CashMovement } from "@/lib/types";
import { formatIDR } from "@/lib/format";
import { Spinner } from "@/components/ui/spinner";
import { useEffect } from "react";

type Summary = {
  movements: CashMovement[];
  cashSales: number;
};

function SummaryRow({ label, value, className }: { label: string; value: number; className?: string }) {
  return (
    <div className={`flex justify-between text-sm ${className ?? ""}`}>
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium tabular-nums">{formatIDR(value)}</span>
    </div>
  );
}

type Props = {
  session: CashierSession;
  onClose: () => void;
};

export function CloseSessionModal({ session, onClose }: Props) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [loadingSummary, setLoadingSummary] = useState(true);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getSessionSummary(session.id).then((s) => {
      setSummary(s);
      setLoadingSummary(false);
    });
  }, [session.id]);

  const cashIn = summary?.movements.filter((m) => m.type === "cash_in").reduce((s, m) => s + m.amount, 0) ?? 0;
  const cashOut = summary?.movements.filter((m) => m.type === "cash_out").reduce((s, m) => s + m.amount, 0) ?? 0;
  const cashSales = summary?.cashSales ?? 0;
  const expected = session.opening_cash + cashIn - cashOut + cashSales;

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const fd = new FormData(e.currentTarget);
    start(async () => {
      const res = await closeSession(session.id, fd);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      toast.success("Sesi kasir ditutup");
      router.refresh();
      onClose();
    });
  }

  return (
    <Dialog open onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Tutup Sesi Kasir</DialogTitle>
        </DialogHeader>

        {loadingSummary ? (
          <div className="flex justify-center py-6">
            <Spinner />
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-4">
            <div className="rounded-lg border bg-muted/30 p-3 space-y-1.5">
              <SummaryRow label="Modal awal" value={session.opening_cash} />
              <SummaryRow label="+ Kas masuk" value={cashIn} />
              <SummaryRow label="− Kas keluar" value={cashOut} />
              <SummaryRow label="+ Penjualan tunai" value={cashSales} />
              <Separator className="my-1" />
              <SummaryRow label="Estimasi saldo akhir" value={expected} className="font-semibold text-base [&>span]:text-foreground" />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="actual-cash">Uang tunai aktual di laci (Rp) <span className="text-destructive">*</span></Label>
              <Input
                id="actual-cash"
                name="actual_closing_cash"
                type="number"
                min={0}
                step={1000}
                defaultValue={expected}
                required
                disabled={pending}
              />
              <p className="text-xs text-muted-foreground">
                Hitung fisik uang tunai di laci kasir.
              </p>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="close-notes">Catatan</Label>
              <Input
                id="close-notes"
                name="notes"
                placeholder="Opsional"
                disabled={pending}
              />
            </div>

            {error && (
              <p className="text-sm text-destructive" role="alert">{error}</p>
            )}
            <div className="flex gap-2">
              <Button type="button" variant="outline" className="flex-1" onClick={onClose} disabled={pending}>
                Batal
              </Button>
              <Button type="submit" variant="destructive" className="flex-1" disabled={pending} aria-busy={pending}>
                {pending ? "Menutup sesi…" : "Tutup Sesi"}
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
