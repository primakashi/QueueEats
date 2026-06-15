"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Wallet, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { openSession } from "../session-actions";

export function OpenSessionGate({ outletId }: { outletId: string | null }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [rawValue, setRawValue] = useState(0);
  const [displayValue, setDisplayValue] = useState("0");

  function handleCashInput(e: React.ChangeEvent<HTMLInputElement>) {
    const digits = e.target.value.replace(/\D/g, "");
    const num = digits === "" ? 0 : parseInt(digits, 10);
    setRawValue(num);
    setDisplayValue(num === 0 && digits === "" ? "" : num.toLocaleString("id-ID"));
  }

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const fd = new FormData(e.currentTarget);
    fd.set("opening_cash", String(rawValue));
    if (outletId) fd.set("outlet_id", outletId);
    start(async () => {
      const res = await openSession(fd);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      toast.success("Sesi kasir dibuka");
      router.refresh();
    });
  }

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-background/90 backdrop-blur-sm p-4">
      <Card className="w-full max-w-sm relative">
        <button
          type="button"
          onClick={() => router.back()}
          className="absolute top-3 right-3 p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          aria-label="Tutup"
        >
          <X className="h-4 w-4" />
        </button>
        <CardContent className="pt-6 space-y-5">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-primary/10 text-primary grid place-items-center shrink-0">
              <Wallet className="h-5 w-5" />
            </div>
            <div>
              <h2 className="font-semibold">Buka Sesi Kasir</h2>
              <p className="text-xs text-muted-foreground">Sesi belum dibuka hari ini.</p>
            </div>
          </div>
          <form onSubmit={submit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="opening-cash">Modal awal (Rp)</Label>
              <Input
                id="opening-cash"
                type="text"
                inputMode="numeric"
                value={displayValue}
                onChange={handleCashInput}
                placeholder="0"
                required
                disabled={pending}
                autoFocus
              />
              <p className="text-xs text-muted-foreground">
                Jumlah uang tunai di laci kasir saat sesi dimulai.
              </p>
            </div>
            {error && (
              <p className="text-sm text-destructive" role="alert">{error}</p>
            )}
            <Button type="submit" className="w-full" disabled={pending} aria-busy={pending}>
              {pending ? "Membuka sesi…" : "Buka Sesi"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
