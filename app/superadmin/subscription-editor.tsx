"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Calendar, Check, Pencil, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";
import { updateRestaurantSubscription } from "./actions";

function daysUntil(endDate: string): number {
  const [y, m, d] = endDate.split("-").map(Number);
  if (!y || !m || !d) return 0;
  const end = new Date(y, m - 1, d).getTime();
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  return Math.round((end - today) / (1000 * 60 * 60 * 24));
}

function formatDate(d: string): string {
  try {
    return new Date(d).toLocaleDateString("id-ID", { dateStyle: "medium" });
  } catch {
    return d;
  }
}

export function SubscriptionEditor({
  restaurantId,
  endDate,
  notes,
}: {
  restaurantId: string;
  endDate: string | null;
  notes: string | null;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [pending, start] = useTransition();
  const [dateInput, setDateInput] = useState(endDate ?? "");
  const [notesInput, setNotesInput] = useState(notes ?? "");

  function save() {
    start(async () => {
      const res = await updateRestaurantSubscription(
        restaurantId,
        dateInput || null,
        notesInput || null,
      );
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success("Langganan diperbarui");
      setEditing(false);
      router.refresh();
    });
  }

  if (editing) {
    return (
      <div className="flex flex-col gap-1.5 min-w-[220px]">
        <Input
          type="date"
          value={dateInput}
          onChange={(e) => setDateInput(e.target.value)}
          className="h-8 text-xs"
          disabled={pending}
        />
        <Input
          placeholder="Catatan (opsional)"
          value={notesInput}
          onChange={(e) => setNotesInput(e.target.value)}
          className="h-8 text-xs"
          disabled={pending}
        />
        <div className="flex gap-1">
          <Button
            size="sm"
            className="h-7 flex-1"
            onClick={save}
            disabled={pending}
            aria-busy={pending}
          >
            {pending ? <Spinner size="xs" className="mr-1" /> : <Check className="h-3 w-3 mr-1" />}
            Simpan
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="h-7"
            onClick={() => {
              setEditing(false);
              setDateInput(endDate ?? "");
              setNotesInput(notes ?? "");
            }}
            disabled={pending}
          >
            <X className="h-3 w-3" />
          </Button>
        </div>
      </div>
    );
  }

  if (!endDate) {
    return (
      <button
        type="button"
        className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-2"
        onClick={() => setEditing(true)}
      >
        Atur tanggal
      </button>
    );
  }

  const days = daysUntil(endDate);
  const expired = days < 0;
  const urgent = expired || days <= 7;
  const warning = !urgent && days <= 30;

  return (
    <div className="flex items-center gap-2">
      <Calendar
        className={cn(
          "h-3.5 w-3.5 shrink-0",
          urgent ? "text-destructive" : warning ? "text-amber-600" : "text-muted-foreground",
        )}
      />
      <div className="text-xs leading-tight">
        <div className="font-medium tabular-nums">{formatDate(endDate)}</div>
        <div
          className={cn(
            "text-[10px]",
            urgent ? "text-destructive" : warning ? "text-amber-600" : "text-muted-foreground",
          )}
        >
          {expired
            ? `Berakhir ${Math.abs(days)} hari lalu`
            : days === 0
              ? "Berakhir hari ini"
              : `${days} hari lagi`}
        </div>
      </div>
      <Button
        size="icon"
        variant="ghost"
        className="h-6 w-6 ml-1"
        onClick={() => setEditing(true)}
        aria-label="Ubah langganan"
      >
        <Pencil className="h-3 w-3" />
      </Button>
    </div>
  );
}
