"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CurrencyInput } from "@/components/ui/currency-input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { addCashMovement } from "../session-actions";
import {
  CASH_IN_CATEGORIES,
  CASH_OUT_CATEGORIES,
  CASH_MOVEMENT_CATEGORY_LABEL,
  type CashMovementCategory,
  type CashMovementType,
} from "@/lib/types";

type Props = {
  sessionId: string;
  type: CashMovementType;
  onClose: () => void;
};

export function CashMovementModal({ sessionId, type, onClose }: Props) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [category, setCategory] = useState<CashMovementCategory>(
    type === "cash_in" ? "owner_top_up" : "petty_cash_purchase",
  );

  const categories = type === "cash_in" ? CASH_IN_CATEGORIES : CASH_OUT_CATEGORIES;
  const title = type === "cash_in" ? "Kas Masuk" : "Kas Keluar";

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const fd = new FormData(e.currentTarget);
    fd.set("type", type);
    fd.set("category", category);
    start(async () => {
      const res = await addCashMovement(sessionId, fd);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      toast.success(`${title} berhasil dicatat`);
      router.refresh();
      onClose();
    });
  }

  return (
    <Dialog open onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="cm-amount">Jumlah (Rp) <span className="text-destructive">*</span></Label>
            <CurrencyInput
              id="cm-amount"
              name="amount"
              placeholder="0"
              required
              disabled={pending}
              autoFocus
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="cm-category">Kategori</Label>
            <Select value={category} onValueChange={(v) => setCategory(v as CashMovementCategory)}>
              <SelectTrigger id="cm-category">
                <SelectValue>{CASH_MOVEMENT_CATEGORY_LABEL[category]}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                {categories.map((c) => (
                  <SelectItem key={c} value={c}>{CASH_MOVEMENT_CATEGORY_LABEL[c]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="cm-notes">Catatan</Label>
            <Input
              id="cm-notes"
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
            <Button type="submit" className="flex-1" disabled={pending} aria-busy={pending}>
              {pending ? "Menyimpan…" : "Simpan"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
